/**
 * ResourceScreen — File / Resource management aligned with web /content
 *
 * Features:
 *  • Source-set selection (unassigned files / specific source set)
 *  • Folder hierarchy with breadcrumb navigation
 *  • List files and folders with tabs: All, Images, Documents, Others
 *  • Create folder, move to folder
 *  • Upload via camera roll (ImagePicker) or file picker (DocumentPicker)
 *  • Upload to current folder when in library
 *  • Delete files/folders with confirmation alert
 *  • Pull-to-refresh, search filter
 *  • Image thumbnail preview inline
 */
import { useRoute } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowDownUp,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  File,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  Folder,
  FolderOpen,
  GitBranch,
  Grid3X3,
  Link2,
  List,
  MessageCircle,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Settings2,
  Share2,
  Trash2,
  Users,
  X,
} from 'lucide-react-native';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image as RNImage,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type ViewToken,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import AttachmentSheet from '../components/ui/AttachmentSheet';
import { BottomSheetScaffold } from '../components/ui/BottomSheetScaffold';
import { FilterChip, MetaTag, SelectionBadge } from '../components/ui/ChoiceControls';
import EmptyState from '../components/ui/EmptyState';
import FileGridSkeleton from '../components/ui/FileGridSkeleton';
import PortalScaffold from '../components/ui/PortalScaffold';
import PromptModal from '../components/ui/PromptModal';
import ResourceShareManageSheet from '../components/ui/ResourceShareManageSheet';
import ResourceShareOptionsSheet, {
  type ResourceShareSheetTarget,
} from '../components/ui/ResourceShareOptionsSheet';
import { HeaderIconButton } from '../components/ui/ScreenHeader';
import { SearchField } from '../components/ui/SearchField';
import SharedWithMeSheet, { type SharedWithMeRow } from '../components/ui/SharedWithMeSheet';
import { useToast } from '../components/ui/Toast';
import {
  fileApi,
  type FolderCrumb,
  getApiUrl,
  notebookApi,
  resourceApi,
  sourceSetApi,
  type TrashedDocumentItem,
} from '../lib/api';
import { getAuthHeaders } from '../lib/auth';
import { useMainTabScrollableContentPaddingBottom } from '../lib/bottomChrome';
import {
  createChatContextSelectionFromResource,
  isChatContextEligibleResource,
} from '../lib/chatContext';
import { formatMobileDate } from '../lib/dateTime';
import {
  buildFileGovernanceBadges,
  buildGovernanceCapabilityHint,
  buildGovernanceFilterSummaryLabels,
  countActiveGovernanceFilters,
  type MobileGovernanceFilterState,
  normalizeGovernanceRightsOwner,
} from '../lib/fileGovernance';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import {
  navigateBackFromPortal,
  navigateToConversationOrigin,
  navigateToNotebook,
} from '../lib/navigation';
import { getNotebookTablePreview, isTableNotebookDocument } from '../lib/notebookDocument';
import {
  appendCurrentPortalStack,
  appendCurrentPortalStackWithOrigin,
  createConversationOrigin,
  getPreviousPortalTarget,
} from '../lib/portalNavigation';
import {
  clearResourceCacheEntry,
  getResourceCacheEntry,
  listResourceCacheEntries,
  type ResourceCacheEntry,
  saveResourceCacheEntry,
} from '../lib/resourceCache';
import { areSameFileItems, getCanonicalResourceKind } from '../lib/resourceList';
import {
  clearResourceListCache,
  getResourceListCacheEntry,
  saveResourceListCacheEntry,
} from '../lib/resourceListCache';
import type {
  ConversationOriginRouteParams,
  MainTabScreenProps,
  PortalRouteParams,
  ResourceNavigationTarget,
  ResourcesRouteParams,
  RootStackScreenProps,
} from '../navigation/types';
import { useConnectionStore } from '../store/connection';
import { useFileStore } from '../store/file';
import { useThemeColors } from '../theme/colors';
import { tokens } from '../theme/tokens';
import type { FileAssetCapabilities, FileListItem, SourceSetItem } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────

type FileCategory = 'all' | 'images' | 'documents' | 'others';
type SorterType = 'createdAt' | 'name' | 'size';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'list' | 'grid';
const ROOT_TREE_KEY = '__root__';
const RESOURCE_LIST_PAGE_SIZE = 50;
const RESOURCE_TREE_PAGE_SIZE = 200;

interface ResourceTreeRow {
  depth: number;
  item: FileListItem;
}

type ResourceListRow = FileListItem | ResourceTreeRow;

const isResourceTreeRow = (value: ResourceListRow): value is ResourceTreeRow =>
  'depth' in value && 'item' in value;

function ResourceListRowSeparator() {
  return <View className="mx-4 h-px bg-foreground/5" />;
}

function sortFileList(
  list: FileListItem[],
  sorter: SorterType,
  sortOrder: SortOrder,
  locale?: string,
): FileListItem[] {
  const sorted = [...list];
  const collator = new Intl.Collator(
    locale ? [locale, 'zh-Hans-CN', 'en-US'] : ['zh-Hans-CN', 'en-US'],
    {
      numeric: true,
      sensitivity: 'base',
      usage: 'sort',
    },
  );
  sorted.sort((a, b) => {
    let cmp: number;
    switch (sorter) {
      case 'name': {
        cmp = collator.compare(a.name ?? '', b.name ?? '');
        break;
      }
      case 'size': {
        cmp = (a.size ?? 0) - (b.size ?? 0);
        break;
      }
      default: {
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
    }
    return sortOrder === 'asc' ? cmp : -cmp;
  });
  return sorted;
}

const IMAGE_EXTENSIONS = new Set([
  'avif',
  'bmp',
  'gif',
  'heic',
  'heif',
  'jpeg',
  'jpg',
  'png',
  'svg',
  'tif',
  'tiff',
  'webp',
]);

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function hasImageExtension(fileName?: string): boolean {
  if (!fileName) return false;
  const ext = fileName.split('.').pop()?.toLowerCase();
  return !!(ext && IMAGE_EXTENSIONS.has(ext));
}

function isImage(fileType: string, fileName?: string): boolean {
  if (fileType.toLowerCase().startsWith('image/')) return true;
  return hasImageExtension(fileName);
}

const DOCUMENT_EXTENSIONS = /\.(?:md|mdx|doc|docx|ppt|pptx|xls|xlsx|pdf|txt|rtf)$/i;

function isDocument(fileType: string, fileName?: string): boolean {
  const docs = ['application/pdf', 'text/', 'application/msword', 'application/vnd'];
  if (docs.some((p) => fileType.startsWith(p))) return true;
  return !!(fileName && DOCUMENT_EXTENSIONS.test(fileName));
}

function isMarkdownFile(fileType: string, name?: string): boolean {
  if (fileType?.includes('markdown') || fileType === 'text/mdx') return true;
  return !!(name && /\.(?:md|mdx)$/i.test(name));
}

const TEXT_EXTENSIONS = new Set([
  'c',
  'cc',
  'conf',
  'cpp',
  'css',
  'csv',
  'd',
  'env',
  'go',
  'h',
  'hpp',
  'html',
  'ini',
  'java',
  'js',
  'json',
  'jsx',
  'log',
  'md',
  'mdx',
  'mjs',
  'py',
  'rb',
  'rs',
  'scss',
  'sh',
  'sql',
  'svg',
  'toml',
  'ts',
  'tsx',
  'txt',
  'xml',
  'yaml',
  'yml',
]);

function isTextLikeFile(
  fileType: string,
  fileName?: string,
  sourceType?: 'document' | 'file',
): boolean {
  if (
    fileType.startsWith('text/') ||
    fileType === 'application/json' ||
    fileType === 'application/javascript' ||
    fileType === 'application/xml'
  ) {
    return true;
  }

  const ext = fileName?.split('.').pop()?.toLowerCase();
  if (ext && TEXT_EXTENSIONS.has(ext)) return true;

  // Documents in the resource tree are authored text by default unless explicitly binary.
  if (
    sourceType === 'document' &&
    fileType !== 'application/pdf' &&
    !fileType.includes('msword') &&
    !fileType.includes('vnd.openxmlformats') &&
    !fileType.includes('vnd.ms-excel') &&
    !fileType.includes('vnd.ms-powerpoint')
  ) {
    return true;
  }

  return false;
}

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const escapeHtmlAttribute = (value: string) => escapeHtml(value);

const renderMarkdownInline = (value: string) => {
  let html = escapeHtml(value);

  html = html.replaceAll(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_match, label: string, href: string) =>
      `<a href="${escapeHtmlAttribute(href)}">${escapeHtml(label)}</a>`,
  );
  html = html.replaceAll(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replaceAll(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replaceAll(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  html = html.replaceAll(/~~([^~]+)~~/g, '<del>$1</del>');

  return html;
};

const renderMarkdownTextSegment = (segment: string) => {
  const lines = segment.replaceAll('\r\n', '\n').split('\n');
  const blocks: string[] = [];
  let paragraph: string[] = [];
  let blockquote: string[] = [];
  let list: {
    items: string[];
    ordered: boolean;
  } | null = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push(`<p>${renderMarkdownInline(paragraph.join(' '))}</p>`);
    paragraph = [];
  };

  const flushBlockquote = () => {
    if (blockquote.length === 0) return;
    blocks.push(
      `<blockquote>${blockquote.map((item) => renderMarkdownInline(item)).join('<br />')}</blockquote>`,
    );
    blockquote = [];
  };

  const flushList = () => {
    if (!list || list.items.length === 0) {
      list = null;
      return;
    }

    const tag = list.ordered ? 'ol' : 'ul';
    blocks.push(
      `<${tag}>${list.items.map((item) => `<li>${renderMarkdownInline(item)}</li>`).join('')}</${tag}>`,
    );
    list = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushBlockquote();
      flushList();
      continue;
    }

    const headingPrefix = trimmed.match(/^#{1,6}(?=\s)/)?.[0] ?? '';
    if (headingPrefix) {
      flushParagraph();
      flushBlockquote();
      flushList();
      const level = headingPrefix.length;
      blocks.push(`<h${level}>${renderMarkdownInline(trimmed.slice(level + 1))}</h${level}>`);
      continue;
    }

    const compact = trimmed.replaceAll(' ', '').replaceAll('\t', '');
    if (
      compact.length >= 3 &&
      [...new Set(compact)].length === 1 &&
      ['*', '-', '_'].includes(compact[0] ?? '')
    ) {
      flushParagraph();
      flushBlockquote();
      flushList();
      blocks.push('<hr />');
      continue;
    }

    if (trimmed.startsWith('>')) {
      flushParagraph();
      flushList();
      blockquote.push(trimmed.startsWith('> ') ? trimmed.slice(2) : trimmed.slice(1));
      continue;
    }
    flushBlockquote();

    const orderedListSeparatorIndex = trimmed.indexOf('. ');
    const orderedListPrefix =
      orderedListSeparatorIndex > 0 ? trimmed.slice(0, orderedListSeparatorIndex) : '';
    if (/^\d+$/.test(orderedListPrefix)) {
      flushParagraph();
      if (!list || !list.ordered) {
        flushList();
        list = { items: [], ordered: true };
      }
      list.items.push(trimmed.slice(orderedListSeparatorIndex + 2));
      continue;
    }

    if (trimmed.length > 2 && ['-', '*', '+'].includes(trimmed[0] ?? '') && trimmed[1] === ' ') {
      flushParagraph();
      if (!list || list.ordered) {
        flushList();
        list = { items: [], ordered: false };
      }
      list.items.push(trimmed.slice(2));
      continue;
    }

    flushList();
    paragraph.push(trimmed);
  }

  flushParagraph();
  flushBlockquote();
  flushList();

  return blocks.join('\n');
};

const renderMarkdownToHtml = (markdown: string) => {
  const normalized = markdown.replaceAll('\r\n', '\n');
  const segments: string[] = [];
  const codeBlockRegex = /```([\w-]+)?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(normalized)) !== null) {
    if (match.index > lastIndex) {
      segments.push(renderMarkdownTextSegment(normalized.slice(lastIndex, match.index)));
    }

    const language = match[1]?.trim();
    const code = escapeHtml(match[2].replace(/\n$/, ''));
    segments.push(
      `<pre><code${language ? ` data-language="${escapeHtmlAttribute(language)}"` : ''}>${code}</code></pre>`,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < normalized.length) {
    segments.push(renderMarkdownTextSegment(normalized.slice(lastIndex)));
  }

  return segments.filter(Boolean).join('\n');
};

function buildMarkdownPreviewHtml(
  markdown: string,
  colors: {
    background: string;
    border: string;
    fillTertiary: string;
    foreground: string;
    inputBg: string;
    markdownCodeBlockBg: string;
    markdownCodeInlineBg: string;
    markdownCodeInlineColor: string;
    muted: string;
    primary: string;
  },
) {
  const rendered = renderMarkdownToHtml(markdown);

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <style>
      :root {
        color-scheme: light dark;
      }
      body {
        margin: 0;
        padding: 16px;
        background: ${colors.background};
        color: ${colors.foreground};
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 15px;
        line-height: 1.68;
        word-break: break-word;
      }
      h1, h2, h3, h4, h5, h6 {
        margin: 1.1em 0 0.45em;
        line-height: 1.3;
      }
      p, ul, ol, blockquote, pre, table {
        margin: 0 0 0.9em;
      }
      a {
        color: ${colors.primary};
        text-decoration: none;
      }
      code {
        background: ${colors.markdownCodeInlineBg};
        color: ${colors.markdownCodeInlineColor};
        border-radius: 6px;
        padding: 0.12em 0.36em;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      }
      pre {
        overflow-x: auto;
        background: ${colors.markdownCodeBlockBg};
        border-radius: 12px;
        padding: 12px;
        white-space: pre-wrap;
      }
      pre code {
        background: transparent;
        color: ${colors.foreground};
        padding: 0;
      }
      blockquote {
        margin-left: 0;
        padding: 0.65em 0 0.65em 12px;
        border-left: 4px solid ${colors.primary};
        background: ${colors.fillTertiary};
        border-radius: 10px;
      }
      img {
        max-width: 100%;
        height: auto;
        border-radius: 12px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        border: 1px solid ${colors.border};
        padding: 8px 10px;
        text-align: left;
      }
      hr {
        border: 0;
        border-top: 1px solid ${colors.border};
        margin: 1.2em 0;
      }
      .muted {
        color: ${colors.muted};
        font-size: 13px;
        margin-bottom: 12px;
      }
    </style>
  </head>
  <body>${rendered}</body>
</html>`;
}

function isAudio(fileType: string): boolean {
  return fileType.startsWith('audio/');
}
function isVideo(fileType: string): boolean {
  return fileType.startsWith('video/');
}

function matchesCategory(item: FileListItem, category: FileCategory): boolean {
  if (item.fileType === 'custom/folder') return true;
  if (category === 'all') return true;
  if (category === 'images') return isImage(item.fileType, item.name);
  if (category === 'documents') return isDocument(item.fileType, item.name);
  if (category === 'others')
    return !isImage(item.fileType, item.name) && !isDocument(item.fileType, item.name);
  return true;
}

function isFolder(item: FileListItem): boolean {
  return item.fileType === 'custom/folder';
}

function FileTypeIcon({
  fileType,
  fileName,
  color,
  size = 28,
}: {
  fileType: string;
  fileName?: string;
  color: string;
  size?: number;
}) {
  if (isImage(fileType, fileName))
    return <FileImage color={color} size={size} strokeWidth={tokens.icon.strokeWidth} />;
  if (isAudio(fileType))
    return <FileAudio color={color} size={size} strokeWidth={tokens.icon.strokeWidth} />;
  if (isVideo(fileType))
    return <FileVideo color={color} size={size} strokeWidth={tokens.icon.strokeWidth} />;
  if (isDocument(fileType, fileName))
    return <FileText color={color} size={size} strokeWidth={tokens.icon.strokeWidth} />;
  return <File color={color} size={size} strokeWidth={tokens.icon.strokeWidth} />;
}

function formatDate(isoString: string): string {
  return formatMobileDate(isoString);
}

function resolveRemoteFileUrl(apiBaseUrl: string, item: Pick<FileListItem, 'id' | 'url'>): string {
  const base = apiBaseUrl?.replace(/\/$/, '') || '';

  if (
    item.url?.startsWith('http://') ||
    item.url?.startsWith('https://') ||
    item.url?.startsWith('file://')
  ) {
    return item.url;
  }

  if (item.url?.startsWith('/')) {
    return `${base}${item.url}`;
  }

  return base ? `${base}/f/${item.id}` : '';
}

function buildRemoteFileCandidates(apiBaseUrl: string, item: Pick<FileListItem, 'id' | 'url'>) {
  const proxyUrl = apiBaseUrl ? `${apiBaseUrl.replace(/\/$/, '')}/f/${item.id}` : '';
  const resolved = resolveRemoteFileUrl(apiBaseUrl, item);
  // Prefer proxyUrl (user-configured server) over item.url (APP_URL from API)
  return [...new Set([proxyUrl, resolved].filter(Boolean))];
}

async function removeLocalCachedFile(entry?: ResourceCacheEntry | null) {
  if (!entry?.localUri) return;

  try {
    const info = await FileSystem.getInfoAsync(entry.localUri);
    if (info.exists) {
      await FileSystem.deleteAsync(entry.localUri, { idempotent: true });
    }
  } catch {
    /* ignore */
  }
}

// ── File Preview Modal ────────────────────────────────────────────────

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const FilePreviewModal = memo(
  ({
    apiBaseUrl,
    item,
    origin,
    onReplaceItem,
    remoteHeaders,
    visible,
    onCacheReady,
    onClose,
  }: {
    apiBaseUrl: string;
    item: FileListItem | null;
    onCacheReady?: (entry: ResourceCacheEntry) => void;
    onReplaceItem?: (item: FileListItem, previousId?: string) => void;
    origin?: ConversationOriginRouteParams | null;
    remoteHeaders?: Record<string, string>;
    visible: boolean;
    onClose: () => void;
  }) => {
    const route = useRoute();
    const insets = useSafeAreaInsets();
    const { t } = useI18n();
    const toast = useToast();
    const colors = useThemeColors();
    const itemKind = getCanonicalResourceKind(item);
    const [imgLoading, setImgLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [previewIndex, setPreviewIndex] = useState(0);
    const [preparingPreview, setPreparingPreview] = useState(false);
    const [previewCacheProgress, setPreviewCacheProgress] = useState(0);
    const [cachedEntry, setCachedEntry] = useState<ResourceCacheEntry | null>(null);
    const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null);
    const [textContent, setTextContent] = useState<string | null>(null);
    const [previewLoadFailed, setPreviewLoadFailed] = useState(false);
    const [editingText, setEditingText] = useState(false);
    const [savingEdit, setSavingEdit] = useState(false);
    const [convertingToDocument, setConvertingToDocument] = useState(false);
    const [textDraft, setTextDraft] = useState('');
    const [shareSheetOpen, setShareSheetOpen] = useState(false);

    const previewCandidates = item ? buildRemoteFileCandidates(apiBaseUrl, item) : [];
    const fileUrl = previewCandidates[previewIndex] || '';
    const imageFile = item ? isImage(item.fileType, item.name) : false;
    const textFile = item ? isTextLikeFile(item.fileType, item.name, itemKind) : false;
    const pdfFile = item ? item.fileType === 'application/pdf' : false;
    // Office docs: use Microsoft Office Viewer (same as Web), not Google Docs
    const officeFile = item
      ? item.fileType.includes('msword') ||
        item.fileType.includes('vnd.openxmlformats') ||
        item.fileType.includes('vnd.ms-excel') ||
        item.fileType.includes('vnd.ms-powerpoint')
      : false;
    const previewableDoc = textFile || pdfFile || officeFile;
    const knownTableDocument = item
      ? itemKind === 'document' && isTableNotebookDocument(item)
      : false;
    const tablePreview = useMemo(
      () => (itemKind === 'document' ? getNotebookTablePreview(item) : null),
      [item, itemKind],
    );

    useEffect(() => {
      setImgLoading(true);
      setPreviewIndex(0);
      setPreparingPreview(false);
      setPreviewCacheProgress(0);
      setCachedEntry(null);
      setPdfDataUrl(null);
      setTextContent(null);
      setEditingText(false);
      setPreviewLoadFailed(false);
      setDownloadProgress(0);
      setSavingEdit(false);
      setConvertingToDocument(false);
      setTextDraft('');
      setShareSheetOpen(false);
    }, [apiBaseUrl, item?.id, visible]);

    const handlePreviewError = useCallback(() => {
      if (previewIndex < previewCandidates.length - 1) {
        setPreviewIndex((current) => current + 1);
        setImgLoading(true);
        setPdfDataUrl(null);
        setTextContent(null);
        setPreviewLoadFailed(false);
        return;
      }

      setImgLoading(false);
      setPreviewLoadFailed(true);
    }, [previewCandidates.length, previewIndex]);

    useEffect(() => {
      if (!item || !visible) return;

      let cancelled = false;

      const shouldWarmCache = imageFile || textFile || pdfFile;

      const prepareCache = async () => {
        const existing = await getResourceCacheEntry(item.id);
        if (cancelled) return;

        const itemUpdatedAt =
          (item as FileListItem & { updatedAt?: string | null }).updatedAt ?? undefined;
        const isFresh =
          existing &&
          (!itemUpdatedAt || !existing.updatedAt || existing.updatedAt === itemUpdatedAt);

        if (isFresh) {
          setCachedEntry(existing);
          onCacheReady?.(existing);
          return;
        }

        if (existing && !isFresh) {
          await clearResourceCacheEntry(item.id);
        }

        if (!shouldWarmCache) return;

        setPreparingPreview(true);
        setPreviewCacheProgress(0);

        try {
          const { localUri } = await fileApi.download(item, {
            onProgress: (progress) => {
              if (!cancelled) setPreviewCacheProgress(progress);
            },
          });
          if (cancelled) return;

          const nextEntry: ResourceCacheEntry = {
            cachedAt: Date.now(),
            fileId: item.id,
            localUri,
            name: item.name,
            updatedAt: itemUpdatedAt,
          };
          await saveResourceCacheEntry(nextEntry);
          if (!cancelled) {
            setCachedEntry(nextEntry);
            onCacheReady?.(nextEntry);
          }
        } catch {
          /* remote fallback still works */
        } finally {
          if (!cancelled) {
            setPreparingPreview(false);
            setPreviewCacheProgress(0);
          }
        }
      };

      void prepareCache();

      return () => {
        cancelled = true;
      };
    }, [imageFile, item, onCacheReady, pdfFile, textFile, visible]);

    // PDF: fetch via redirect (WebView fails on 302), convert to data URL for reliable display
    useEffect(() => {
      if (!pdfFile || !fileUrl || !visible || cachedEntry?.localUri) return;

      let cancelled = false;
      const loadPdf = async () => {
        try {
          const res = await fetch(fileUrl, {
            ...(remoteHeaders && Object.keys(remoteHeaders).length > 0
              ? { headers: remoteHeaders }
              : {}),
            redirect: 'follow',
          });
          if (cancelled) return;
          if (!res.ok) {
            handlePreviewError();
            return;
          }

          const blob = await res.blob();
          if (cancelled) return;

          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          if (!cancelled) {
            setPreviewLoadFailed(false);
            setPdfDataUrl(dataUrl);
          }
        } catch {
          if (!cancelled) handlePreviewError();
        }
      };

      void loadPdf();
      return () => {
        cancelled = true;
      };
    }, [cachedEntry?.localUri, fileUrl, handlePreviewError, pdfFile, remoteHeaders, visible]);

    // Text/Markdown: fetch via redirect (WebView fails on 302), render with Markdown or Text
    useEffect(() => {
      if (!item || !textFile || !visible) return;

      let cancelled = false;
      const loadText = async () => {
        try {
          if (typeof item.content === 'string') {
            if (!cancelled) {
              setPreviewLoadFailed(false);
              setTextContent(item.content);
            }

            if (itemKind === 'document') return;
          }

          if (itemKind === 'document') {
            const document = await resourceApi.getDocument(item.id).catch(() => null);
            if (cancelled) return;
            if (typeof document?.content === 'string') {
              setPreviewLoadFailed(false);
              setTextContent(document.content);
              return;
            }
          }

          if (cachedEntry?.localUri) {
            const text = await FileSystem.readAsStringAsync(cachedEntry.localUri);
            if (!cancelled) {
              setPreviewLoadFailed(false);
              setTextContent(text);
            }
            return;
          }

          if (!fileUrl) return;

          const res = await fetch(fileUrl, {
            ...(remoteHeaders && Object.keys(remoteHeaders).length > 0
              ? { headers: remoteHeaders }
              : {}),
            redirect: 'follow',
          });
          if (cancelled) return;
          if (!res.ok) {
            handlePreviewError();
            return;
          }

          const text = await res.text();
          if (!cancelled) {
            setPreviewLoadFailed(false);
            setTextContent(text);
          }
        } catch {
          if (!cancelled) handlePreviewError();
        }
      };

      void loadText();
      return () => {
        cancelled = true;
      };
    }, [
      cachedEntry?.localUri,
      fileUrl,
      handlePreviewError,
      item,
      item?.content,
      item?.id,
      itemKind,
      textFile,
      remoteHeaders,
      visible,
    ]);

    const itemUpdatedAt = item
      ? ((item as FileListItem & { updatedAt?: string | null }).updatedAt ?? undefined)
      : undefined;
    const markdownFile = item
      ? textFile && isMarkdownFile(item.fileType, item.name) && !knownTableDocument
      : false;
    const canEditText = !!item && textFile && itemKind === 'document' && !knownTableDocument;
    const canConvertToDocument = !!item && markdownFile && itemKind === 'file';
    const markdownHtml = useMemo(
      () =>
        markdownFile && textContent ? buildMarkdownPreviewHtml(textContent, colors) : undefined,
      [colors, markdownFile, textContent],
    );
    const originActionLabel = origin?.threadId ? t.threadOpen : t.chatOpenConversation;

    if (!item) return null;
    const officeViewerUri =
      officeFile && !cachedEntry?.localUri
        ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`
        : undefined;
    const documentSource = officeFile
      ? cachedEntry?.localUri
        ? { uri: cachedEntry.localUri }
        : officeViewerUri
          ? { uri: officeViewerUri }
          : undefined
      : cachedEntry?.localUri
        ? { uri: cachedEntry.localUri }
        : pdfFile && pdfDataUrl
          ? { uri: pdfDataUrl }
          : fileUrl
            ? { uri: fileUrl }
            : undefined;

    const handleShare = () => {
      setShareSheetOpen(true);
    };

    const handleDownload = async () => {
      if (downloading) return;
      setDownloading(true);
      setDownloadProgress(0);
      try {
        const { localUri } = await fileApi.download(item, {
          onProgress: (p) => setDownloadProgress(p),
        });
        const nextEntry: ResourceCacheEntry = {
          cachedAt: Date.now(),
          fileId: item.id,
          localUri,
          name: item.name,
          updatedAt: itemUpdatedAt,
        };
        await saveResourceCacheEntry(nextEntry);
        setCachedEntry(nextEntry);
        onCacheReady?.(nextEntry);
        haptics.success();
        toast.show('success', t.resourceDownloaded);
      } catch {
        toast.show('error', t.resourceDownloadFailed);
      } finally {
        setDownloading(false);
        setDownloadProgress(0);
      }
    };

    const handleStartEdit = () => {
      setTextDraft(textContent || '');
      setEditingText(true);
    };

    const handleSaveEdit = async () => {
      if (!item || !canEditText || savingEdit) return;

      setSavingEdit(true);
      try {
        await resourceApi.updateDocument(item.id, {
          content: textDraft,
          fileType: item.fileType,
        });

        if (cachedEntry?.localUri) {
          await FileSystem.writeAsStringAsync(cachedEntry.localUri, textDraft);
        }

        setTextContent(textDraft);
        setEditingText(false);
        haptics.success();
        toast.show('success', t.save);
      } catch {
        toast.show('error', t.errorSaveFailed);
      } finally {
        setSavingEdit(false);
      }
    };

    const handleEditAsDocument = async () => {
      if (!item || !canConvertToDocument || convertingToDocument) return;

      setConvertingToDocument(true);

      try {
        const ensuredDocument = await ensureNotebookDocumentFromFile(item);
        if (!ensuredDocument) {
          toast.show('error', t.errorNetwork);
          return;
        }
        const { documentId, nextItem } = ensuredDocument;
        onReplaceItem?.(nextItem, item.id);
        haptics.success();
        toast.show('success', t.fileEditAsDocumentSuccess);
        onClose();
        navigateToNotebook({
          documentId,
          ...appendCurrentPortalStack(route.name, route.params, {}),
          ...(origin?.sessionId ? { sessionId: origin.sessionId } : {}),
          ...(origin?.threadId ? { threadId: origin.threadId } : {}),
          ...(origin?.topicId ? { topicId: origin.topicId } : {}),
        });
      } catch {
        toast.show('error', t.errorNetwork);
      } finally {
        setConvertingToDocument(false);
      }
    };

    return (
      <>
        <Modal
          accessibilityViewIsModal
          statusBarTranslucent
          transparent
          animationType="none"
          visible={visible}
          onRequestClose={onClose}
        >
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(150)}
            style={{ flex: 1, backgroundColor: imageFile ? colors.mediaBackdrop : colors.inputBg }}
          >
            <StatusBar barStyle={imageFile ? 'light-content' : 'dark-content'} />

            {/* Header */}
            <View
              className="flex-row items-center px-4"
              style={{
                paddingTop: insets.top + 8,
                paddingBottom: 10,
                backgroundColor: imageFile ? colors.overlayDark : colors.background,
                ...(imageFile
                  ? {}
                  : {
                      shadowColor: colors.shadow,
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.03,
                      shadowRadius: 4,
                      elevation: 1,
                    }),
              }}
            >
              <TouchableOpacity
                className="flex-row items-center flex-1 min-w-0"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                onPress={onClose}
              >
                <ArrowLeft
                  color={imageFile ? colors.mediaOnBackdrop : colors.foreground}
                  size={22}
                  strokeWidth={tokens.icon.strokeWidth}
                />
                <View className="flex-1 min-w-0 ml-2 mr-2">
                  <Text
                    className="text-[15px] font-semibold"
                    numberOfLines={1}
                    style={{ color: imageFile ? colors.mediaOnBackdrop : colors.foreground }}
                  >
                    {item.name}
                  </Text>
                  <Text
                    className="text-[11px] mt-0.5"
                    style={{
                      color: imageFile ? colors.mediaOnBackdropSecondary : colors.secondaryText,
                    }}
                  >
                    {formatBytes(item.size)}
                    {'  ·  '}
                    {formatDate(item.createdAt)}
                  </Text>
                  {cachedEntry?.localUri || preparingPreview ? (
                    <Text
                      className="text-[10px] mt-1"
                      style={{
                        color: imageFile ? colors.mediaOnBackdropTertiary : colors.secondaryText,
                      }}
                    >
                      {cachedEntry?.localUri
                        ? t.resourceCachedLocal
                        : `${t.resourceCachingPreview} ${previewCacheProgress > 0 ? `${previewCacheProgress}%` : ''}`.trim()}
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>

              <View className="flex-row items-center gap-3 flex-shrink-0">
                {canConvertToDocument ? (
                  <TouchableOpacity
                    disabled={convertingToDocument}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    onPress={() => void handleEditAsDocument()}
                  >
                    {convertingToDocument ? (
                      <ActivityIndicator
                        color={imageFile ? colors.mediaOnBackdrop : colors.primary}
                        size="small"
                      />
                    ) : (
                      <Text
                        className="text-[12px] font-semibold"
                        style={{ color: imageFile ? colors.mediaOnBackdrop : colors.primary }}
                      >
                        {t.fileEditAsDocument}
                      </Text>
                    )}
                  </TouchableOpacity>
                ) : null}
                {canEditText ? (
                  editingText ? (
                    <TouchableOpacity
                      disabled={savingEdit}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      onPress={() => void handleSaveEdit()}
                    >
                      {savingEdit ? (
                        <ActivityIndicator
                          color={imageFile ? colors.mediaOnBackdrop : colors.primary}
                          size="small"
                        />
                      ) : (
                        <Text
                          className="text-[13px] font-semibold"
                          style={{ color: imageFile ? colors.mediaOnBackdrop : colors.primary }}
                        >
                          {t.save}
                        </Text>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      onPress={handleStartEdit}
                    >
                      <Pencil
                        color={imageFile ? colors.mediaOnBackdrop : colors.primary}
                        size={20}
                        strokeWidth={1.8}
                      />
                    </TouchableOpacity>
                  )
                ) : null}
                {origin?.sessionId ? (
                  <TouchableOpacity
                    accessibilityHint={originActionLabel}
                    accessibilityLabel={originActionLabel}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    onPress={() => {
                      onClose();
                      navigateToConversationOrigin(origin);
                    }}
                  >
                    {origin.threadId ? (
                      <GitBranch
                        color={imageFile ? colors.mediaOnBackdrop : colors.primary}
                        size={20}
                        strokeWidth={1.8}
                      />
                    ) : (
                      <MessageCircle
                        color={imageFile ? colors.mediaOnBackdrop : colors.primary}
                        size={20}
                        strokeWidth={1.8}
                      />
                    )}
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  onPress={handleShare}
                >
                  <Share2
                    color={imageFile ? colors.mediaOnBackdrop : colors.primary}
                    size={20}
                    strokeWidth={1.8}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={downloading}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  onPress={() => void handleDownload()}
                >
                  {downloading ? (
                    <View className="min-w-[28px] items-center">
                      <Text
                        className="text-[11px] font-medium"
                        style={{ color: imageFile ? colors.mediaOnBackdrop : colors.primary }}
                      >
                        {downloadProgress}%
                      </Text>
                    </View>
                  ) : (
                    <Download
                      color={imageFile ? colors.mediaOnBackdrop : colors.primary}
                      size={20}
                      strokeWidth={1.8}
                    />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Content */}
            <View style={{ flex: 1 }}>
              {imageFile ? (
                previewLoadFailed ? (
                  <View className="flex-1 items-center justify-center px-8">
                    <Text
                      className="text-center text-[14px]"
                      style={{ color: colors.mediaOnBackdropSecondary }}
                    >
                      {t.resourcePreviewUnavailable}
                    </Text>
                  </View>
                ) : fileUrl ? (
                  <View className="flex-1 items-center justify-center">
                    {imgLoading && (
                      <ActivityIndicator
                        color={colors.mediaOnBackdrop}
                        size="large"
                        style={{ position: 'absolute', zIndex: 1 }}
                      />
                    )}
                    <ExpoImage
                      cachePolicy="memory-disk"
                      contentFit="contain"
                      style={{ width: SCREEN_W, height: SCREEN_H * 0.75 }}
                      transition={120}
                      source={
                        cachedEntry?.localUri
                          ? { uri: cachedEntry.localUri }
                          : fileUrl
                            ? {
                                ...(remoteHeaders && Object.keys(remoteHeaders).length > 0
                                  ? { headers: remoteHeaders }
                                  : {}),
                                uri: fileUrl,
                              }
                            : undefined
                      }
                      onError={handlePreviewError}
                      onLoad={() => setImgLoading(false)}
                    />
                  </View>
                ) : (
                  <View className="flex-1 items-center justify-center px-8">
                    <Text
                      className="text-center text-[14px]"
                      style={{ color: colors.mediaOnBackdropSecondary }}
                    >
                      {t.resourcePreviewUnavailable}
                    </Text>
                  </View>
                )
              ) : previewableDoc ? (
                knownTableDocument && tablePreview ? (
                  <View className="flex-1" style={{ backgroundColor: colors.background }}>
                    <ScrollView
                      className="flex-1"
                      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
                    >
                      <View
                        className="mb-4 rounded-2xl border px-4 py-4"
                        style={{
                          backgroundColor: colors.fillQuaternary,
                          borderColor: colors.borderSubtle,
                        }}
                      >
                        <Text
                          className="text-[11px] font-semibold uppercase tracking-[1.1px]"
                          style={{ color: colors.secondaryText }}
                        >
                          {t.resourceTablePreviewReadOnly}
                        </Text>
                        <Text
                          className="mt-2 text-[15px] font-semibold"
                          style={{ color: colors.foreground }}
                        >
                          {tablePreview.viewName || item.name}
                        </Text>
                        <Text className="mt-1 text-[13px]" style={{ color: colors.secondaryText }}>
                          {t.resourceTablePreviewSummary
                            .replace('{rows}', String(tablePreview.totalRows))
                            .replace('{columns}', String(tablePreview.totalColumns))}
                        </Text>
                      </View>

                      {tablePreview.rows.length === 0 ? (
                        <View
                          className="rounded-2xl border px-4 py-8"
                          style={{
                            backgroundColor: colors.card,
                            borderColor: colors.borderSubtle,
                          }}
                        >
                          <Text
                            className="text-center text-[14px]"
                            style={{ color: colors.secondaryText }}
                          >
                            {t.resourceTablePreviewUnavailable}
                          </Text>
                        </View>
                      ) : (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          <View
                            style={{
                              borderColor: colors.borderSubtle,
                              borderRadius: 16,
                              borderWidth: 1,
                              minWidth: Math.max(SCREEN_W - 32, tablePreview.columns.length * 156),
                              overflow: 'hidden',
                            }}
                          >
                            <View
                              className="flex-row"
                              style={{ backgroundColor: colors.fillQuaternary }}
                            >
                              {tablePreview.columns.map((column) => (
                                <View
                                  className="border-r px-3 py-3"
                                  key={column.id}
                                  style={{
                                    borderColor: colors.borderSubtle,
                                    minWidth: 156,
                                  }}
                                >
                                  <Text
                                    className="text-[13px] font-semibold"
                                    numberOfLines={1}
                                    style={{ color: colors.foreground }}
                                  >
                                    {column.name}
                                  </Text>
                                </View>
                              ))}
                            </View>
                            {tablePreview.rows.slice(0, 24).map((row, rowIndex) => (
                              <View
                                className="flex-row"
                                key={row.id}
                                style={{
                                  backgroundColor:
                                    rowIndex % 2 === 0 ? colors.card : colors.fillQuaternary,
                                }}
                              >
                                {row.cells.map((cell, cellIndex) => (
                                  <View
                                    className="border-r border-t px-3 py-3"
                                    key={`${row.id}-${tablePreview.columns[cellIndex]?.id ?? cellIndex}`}
                                    style={{
                                      borderColor: colors.borderSubtle,
                                      minWidth: 156,
                                    }}
                                  >
                                    <Text
                                      className="text-[13px] leading-5"
                                      style={{ color: colors.foreground }}
                                    >
                                      {cell || '—'}
                                    </Text>
                                  </View>
                                ))}
                              </View>
                            ))}
                          </View>
                        </ScrollView>
                      )}
                    </ScrollView>
                  </View>
                ) : knownTableDocument ? (
                  <View className="flex-1 items-center justify-center px-8">
                    <Text className="text-center text-foreground/70 text-[14px]">
                      {t.resourceTablePreviewUnavailable}
                    </Text>
                  </View>
                ) : pdfFile && !fileUrl ? (
                  <View className="flex-1 items-center justify-center px-8">
                    <Text className="text-center text-foreground/70 text-[14px]">
                      {t.resourcePreviewUnavailable}
                    </Text>
                  </View>
                ) : pdfFile &&
                  !cachedEntry?.localUri &&
                  fileUrl &&
                  !pdfDataUrl &&
                  !previewLoadFailed ? (
                  <View
                    className="flex-1 items-center justify-center"
                    style={{ backgroundColor: colors.inputBg }}
                  >
                    <ActivityIndicator color={colors.primary} size="large" />
                  </View>
                ) : pdfFile && previewLoadFailed ? (
                  <View className="flex-1 items-center justify-center px-8">
                    <Text className="text-center text-foreground/70 text-[14px]">
                      {t.resourcePreviewUnavailable}
                    </Text>
                  </View>
                ) : textFile && editingText ? (
                  <View
                    className="flex-1 px-4 pb-6 pt-4"
                    style={{ backgroundColor: colors.background }}
                  >
                    <TextInput
                      multiline
                      className="flex-1 rounded-3xl px-4 py-4 text-[15px]"
                      placeholder={item.name}
                      placeholderTextColor={colors.muted}
                      value={textDraft}
                      style={{
                        backgroundColor: colors.inputBg,
                        color: colors.foreground,
                        textAlignVertical: 'top',
                      }}
                      onChangeText={setTextDraft}
                    />
                  </View>
                ) : textFile && textContent ? (
                  markdownHtml ? (
                    <WebView
                      originWhitelist={['*']}
                      source={{ html: markdownHtml }}
                      style={{ flex: 1, backgroundColor: colors.background }}
                    />
                  ) : (
                    <ScrollView
                      className="flex-1"
                      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
                      style={{ backgroundColor: colors.background }}
                    >
                      <Text
                        selectable
                        className="text-[15px] leading-6"
                        style={{ color: colors.foreground }}
                      >
                        {textContent}
                      </Text>
                    </ScrollView>
                  )
                ) : textFile && !textContent && !previewLoadFailed ? (
                  <View
                    className="flex-1 items-center justify-center"
                    style={{ backgroundColor: colors.inputBg }}
                  >
                    <ActivityIndicator color={colors.primary} size="large" />
                  </View>
                ) : textFile && previewLoadFailed ? (
                  <View className="flex-1 items-center justify-center px-8">
                    <Text className="text-center text-foreground/70 text-[14px]">
                      {t.resourcePreviewUnavailable}
                    </Text>
                  </View>
                ) : documentSource ? (
                  <WebView
                    cacheEnabled
                    originWhitelist={['https://*', 'http://*', 'data:*']}
                    source={documentSource}
                    startInLoadingState={!pdfFile}
                    style={{ flex: 1 }}
                    renderLoading={() => (
                      <View
                        className="items-center justify-center"
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundColor: colors.inputBg,
                        }}
                      >
                        <ActivityIndicator color={colors.primary} size="large" />
                      </View>
                    )}
                    onError={handlePreviewError}
                  />
                ) : (
                  <View className="flex-1 items-center justify-center px-8">
                    <Text className="text-center text-foreground/70 text-[14px]">
                      {t.resourcePreviewUnavailable}
                    </Text>
                  </View>
                )
              ) : (
                <View className="flex-1 items-center justify-center px-8">
                  <View
                    className="items-center justify-center rounded-3xl bg-foreground/5 mb-6"
                    style={{ width: 96, height: 96 }}
                  >
                    <FileTypeIcon
                      color={colors.secondaryText}
                      fileName={item.name}
                      fileType={item.fileType}
                      size={44}
                    />
                  </View>
                  <Text className="text-foreground text-[17px] font-semibold text-center mb-2">
                    {item.name}
                  </Text>
                  <Text
                    className="text-[14px] text-center mb-1"
                    style={{ color: colors.secondaryText }}
                  >
                    {item.fileType}
                  </Text>
                  <Text
                    className="text-[14px] text-center mb-8"
                    style={{ color: colors.secondaryText }}
                  >
                    {formatBytes(item.size)}
                    {'  ·  '}
                    {formatDate(item.createdAt)}
                  </Text>
                  <TouchableOpacity
                    className="flex-row items-center rounded-2xl px-8 py-3.5"
                    style={{ backgroundColor: colors.primary }}
                    onPress={() => void handleDownload()}
                  >
                    {downloading ? (
                      <>
                        <ActivityIndicator
                          color={colors.iconOnPrimary}
                          size="small"
                          style={{ marginRight: 8 }}
                        />
                        <Text
                          className="text-[15px] font-semibold"
                          style={{ color: colors.iconOnPrimary }}
                        >
                          {downloadProgress}%
                        </Text>
                      </>
                    ) : (
                      <>
                        <Download
                          color={colors.iconOnPrimary}
                          size={18}
                          strokeWidth={2}
                          style={{ marginRight: 8 }}
                        />
                        <Text
                          className="text-[15px] font-semibold"
                          style={{ color: colors.iconOnPrimary }}
                        >
                          {t.resourceDownload}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </Animated.View>
        </Modal>
        <ResourceShareOptionsSheet
          visible={shareSheetOpen && !!item}
          target={
            item
              ? {
                  id: item.id,
                  kind: itemKind,
                  name: item.name || item.id,
                }
              : null
          }
          onClose={() => setShareSheetOpen(false)}
          onFail={() => toast.show('error', t.resourceShareFailed)}
          onSuccess={() => haptics.success()}
        />
      </>
    );
  },
);

FilePreviewModal.displayName = 'FilePreviewModal';

// ── File Row ─────────────────────────────────────────────────────────

function ResourceThumbnail({
  apiBaseUrl,
  cachedLocalUri,
  item,
  isVisible = true,
  onInvalidateCache,
  roundedClassName = 'rounded-xl',
  remoteHeaders,
  size = 48,
}: {
  apiBaseUrl: string;
  cachedLocalUri?: string | null;
  isVisible?: boolean;
  item: FileListItem;
  onInvalidateCache?: (fileId: string) => void;
  roundedClassName?: string;
  remoteHeaders?: Record<string, string>;
  size?: number;
}) {
  const colors = useThemeColors();
  const itemIsFolder = isFolder(item);
  const isImageFile = !itemIsFolder && isImage(item.fileType, item.name);
  const [thumbnailIndex, setThumbnailIndex] = useState(0);
  const [tryDirectUrl, setTryDirectUrl] = useState(true);
  const [cachedUriFailed, setCachedUriFailed] = useState(false);
  const thumbnailCandidates = isImageFile ? buildRemoteFileCandidates(apiBaseUrl, item) : [];
  const thumbnailUrl = thumbnailCandidates[thumbnailIndex] || null;

  useEffect(() => {
    setThumbnailIndex(0);
    setTryDirectUrl(true);
    setCachedUriFailed(false);
  }, [apiBaseUrl, cachedLocalUri, item.id, item.url]);

  useEffect(() => {
    if (!cachedLocalUri) return;

    let cancelled = false;

    const validateCachedThumbnail = async () => {
      try {
        const info = await FileSystem.getInfoAsync(cachedLocalUri);
        if (!info.exists) {
          if (!cancelled) {
            setCachedUriFailed(true);
            onInvalidateCache?.(item.id);
          }
          return;
        }
        if (!cancelled) setCachedUriFailed(false);
      } catch {
        if (!cancelled) {
          setCachedUriFailed(true);
          onInvalidateCache?.(item.id);
        }
      }
    };

    void validateCachedThumbnail();

    return () => {
      cancelled = true;
    };
  }, [cachedLocalUri, item.id, onInvalidateCache]);

  const handleDirectUrlError = useCallback(() => {
    setTryDirectUrl(false);
  }, []);

  const handleThumbnailError = useCallback(() => {
    if (thumbnailIndex < thumbnailCandidates.length - 1) {
      setThumbnailIndex((current) => current + 1);
      setTryDirectUrl(true);
      return;
    }
  }, [thumbnailCandidates.length, thumbnailIndex]);

  const usingCachedLocalThumbnail = Boolean(cachedLocalUri && !cachedUriFailed);
  const shouldUseRemoteThumbnail = Boolean(
    !usingCachedLocalThumbnail && isVisible && tryDirectUrl && thumbnailUrl,
  );
  const remoteThumbnailSource = shouldUseRemoteThumbnail
    ? {
        ...(remoteHeaders && Object.keys(remoteHeaders).length > 0
          ? { headers: remoteHeaders }
          : {}),
        uri: thumbnailUrl!,
      }
    : null;

  const handleImageError = useCallback(() => {
    if (usingCachedLocalThumbnail) {
      setCachedUriFailed(true);
      return;
    }
    if (shouldUseRemoteThumbnail) {
      handleDirectUrlError();
      return;
    }
    handleThumbnailError();
  }, [
    handleDirectUrlError,
    handleThumbnailError,
    shouldUseRemoteThumbnail,
    usingCachedLocalThumbnail,
  ]);

  if (itemIsFolder) {
    return (
      <Folder
        color={colors.secondaryText}
        size={size * 0.54}
        strokeWidth={tokens.icon.strokeWidth}
      />
    );
  }

  if (remoteThumbnailSource) {
    return (
      <ExpoImage
        cachePolicy="memory-disk"
        className={`h-full w-full ${roundedClassName}`}
        contentFit="cover"
        key={`remote:${item.id}:${thumbnailIndex}`}
        source={remoteThumbnailSource}
        transition={100}
        onError={handleImageError}
      />
    );
  }

  if (usingCachedLocalThumbnail) {
    return (
      <RNImage
        className={`h-full w-full ${roundedClassName}`}
        key={`local:${item.id}:${cachedLocalUri}`}
        resizeMode="cover"
        source={{ uri: cachedLocalUri! }}
        onError={handleImageError}
      />
    );
  }

  return (
    <FileTypeIcon
      color={colors.secondaryText}
      fileName={item.name}
      fileType={item.fileType}
      size={size * 0.54}
    />
  );
}

function ResourceGovernanceBadges({
  item,
  maxVisible = 3,
}: {
  item: FileListItem;
  maxVisible?: number;
}) {
  const colors = useThemeColors();
  const { t } = useI18n();
  const badges = useMemo(
    () => buildFileGovernanceBadges(item, t, maxVisible),
    [item, maxVisible, t],
  );

  if (isFolder(item) || badges.length === 0) return null;

  return (
    <View className="mt-1 flex-row flex-wrap">
      {badges.map((badge) => (
        <View className="mr-1.5 mt-1" key={badge.key}>
          <MetaTag
            backgroundColor={badge.emphasis === 'warning' ? colors.warningSubtle : undefined}
            label={badge.label}
            textColor={badge.emphasis === 'warning' ? colors.fileArchive : undefined}
            tone={
              badge.emphasis === 'warning'
                ? 'neutral'
                : badge.emphasis === 'accent'
                  ? 'accent'
                  : badge.emphasis === 'success'
                    ? 'success'
                    : 'neutral'
            }
          />
        </View>
      ))}
    </View>
  );
}

interface FileRowProps {
  apiBaseUrl: string;
  cachedLocalUri?: string | null;
  isCached?: boolean;
  isSelected?: boolean;
  isVisible?: boolean;
  item: FileListItem;
  onDelete: (id: string, name: string, isFolder: boolean) => void;
  onFolderPress?: (item: FileListItem) => void;
  onInvalidateCache?: (fileId: string) => void;
  onLongPressItem?: (item: FileListItem) => void;
  onMoveToFolder?: (item: FileListItem) => void;
  onOpenActions?: (item: FileListItem) => void;
  onPress: (item: FileListItem) => void;
  onSelect?: (item: FileListItem) => void;
  remoteHeaders?: Record<string, string>;
  selectMode?: boolean;
  showFolderActions?: boolean;
}

function FileRow({
  item,
  isCached,
  cachedLocalUri,
  isSelected,
  isVisible = true,
  onInvalidateCache,
  onDelete,
  onOpenActions,
  onFolderPress,
  onLongPressItem,
  onMoveToFolder,
  onPress,
  onSelect,
  apiBaseUrl,
  remoteHeaders,
  selectMode,
  showFolderActions,
}: FileRowProps) {
  const colors = useThemeColors();
  const { t } = useI18n();
  const itemIsFolder = isFolder(item);

  const handlePress = () => {
    if (selectMode && onSelect) {
      onSelect(item);
    } else if (itemIsFolder && onFolderPress) {
      onFolderPress(item);
    } else {
      onPress(item);
    }
  };

  return (
    <TouchableOpacity
      accessibilityLabel={itemIsFolder ? item.name : `${item.name}, ${formatBytes(item.size)}`}
      accessibilityRole="button"
      activeOpacity={0.6}
      className="flex-row items-center px-5 py-3 bg-background"
      onPress={handlePress}
      onLongPress={() => {
        haptics.medium();
        if (selectMode && onSelect) {
          onSelect(item);
        } else if (onLongPressItem) {
          onLongPressItem(item);
        } else if (itemIsFolder && !onOpenActions) {
          onDelete(item.id, item.name, true);
        } else if (!onOpenActions && showFolderActions && onMoveToFolder) {
          Alert.alert(item.name, undefined, [
            { text: t.cancel, style: 'cancel' },
            {
              text: t.delete,
              style: 'destructive',
              onPress: () => onDelete(item.id, item.name, false),
            },
            { text: t.resourceMoveToFolder, onPress: () => onMoveToFolder(item) },
          ]);
        } else {
          onDelete(item.id, item.name, false);
        }
      }}
    >
      <View className="mr-3 h-12 w-12 items-center justify-center rounded-xl bg-foreground/5">
        {selectMode ? (
          <View className="absolute -right-1 -top-1 z-10">
            <SelectionBadge selected={!!isSelected} />
          </View>
        ) : null}
        <ResourceThumbnail
          apiBaseUrl={apiBaseUrl}
          cachedLocalUri={cachedLocalUri}
          isVisible={isVisible}
          item={item}
          remoteHeaders={remoteHeaders}
          onInvalidateCache={onInvalidateCache}
        />
        {isCached && !itemIsFolder ? (
          <View
            className="absolute -bottom-1 -right-1 rounded-full px-1.5 py-0.5"
            style={{ backgroundColor: colors.successSubtle }}
          >
            <Check color={colors.success} size={10} strokeWidth={2.6} />
          </View>
        ) : null}
      </View>

      <View className="min-w-0 flex-1">
        <Text className="text-[15px] font-medium text-foreground" numberOfLines={1}>
          {item.name}
        </Text>
        <Text className="mt-0.5 text-[12px]" style={{ color: colors.secondaryText }}>
          {itemIsFolder
            ? formatDate(item.createdAt)
            : `${formatBytes(item.size)}  ·  ${formatDate(item.createdAt)}`}
        </Text>
        <ResourceGovernanceBadges item={item} />
      </View>

      {onOpenActions && !selectMode ? (
        <TouchableOpacity
          accessibilityRole="button"
          className="ml-2 h-8 w-8 items-center justify-center rounded-full"
          hitSlop={8}
          onPress={(event) => {
            event.stopPropagation();
            onOpenActions(item);
          }}
        >
          <Pencil color={colors.secondaryText} size={16} strokeWidth={tokens.icon.strokeWidth} />
        </TouchableOpacity>
      ) : itemIsFolder && !selectMode ? (
        <View className="ml-2">
          <ChevronRight color={colors.secondaryText} size={18} strokeWidth={1.5} />
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function fileListItemFromShared(params: {
  fileType?: string;
  kind: 'file' | 'document';
  localId: string;
  name: string;
}): FileListItem {
  const canonicalKind = getCanonicalResourceKind({ id: params.localId, kind: params.kind });
  const isFile = canonicalKind === 'file';
  return {
    id: params.localId,
    name: params.name,
    fileType: isFile ? 'application/octet-stream' : params.fileType || 'text/plain',
    sourceType: isFile ? 'file' : 'document',
    size: 0,
    createdAt: new Date().toISOString(),
    chunkCount: null,
    chunkingError: null,
    embeddingError: null,
    embeddingStatus: null,
    finishEmbedding: false,
    url: '',
  };
}

function fileListItemFromNavigationTarget(target: ResourceNavigationTarget): FileListItem {
  return {
    chunkCount: null,
    chunkingError: null,
    content: target.content ?? null,
    createdAt: new Date().toISOString(),
    embeddingError: null,
    embeddingStatus: null,
    fileType:
      target.fileType ??
      (target.sourceType === 'document' ? 'text/plain' : 'application/octet-stream'),
    finishEmbedding: false,
    id: target.id,
    name: target.name,
    size: 0,
    sourceType: target.sourceType ?? 'file',
    url: target.url ?? '',
  };
}

async function ensureNotebookDocumentFromFile(item: FileListItem): Promise<{
  documentId: string;
  nextItem: FileListItem;
} | null> {
  const ensured = await resourceApi.ensureFileDocument(item.id);
  const documentId = ensured?.id;

  if (!documentId) return null;

  const document = await resourceApi.getDocument(documentId).catch(() => null);

  return {
    documentId,
    nextItem: {
      ...item,
      ...(typeof document?.content === 'string' ? { content: document.content } : {}),
      fileType: document?.fileType ?? item.fileType,
      id: documentId,
      name: document?.title || item.name,
      sourceType: 'document',
    },
  };
}

function isSourceSetConflictError(error: unknown) {
  if (!error || typeof error !== 'object') return false;

  const maybeError = error as {
    data?: { code?: string };
    message?: string;
  };
  const message = maybeError.message ?? '';

  return (
    maybeError.data?.code === 'CONFLICT' ||
    message.includes('FILE_ALREADY_IN_SOURCE_SET') ||
    message.includes('FILE_ALREADY_IN_KNOWLEDGE_BASE')
  );
}

// ── Main Screen ───────────────────────────────────────────────────────

type ResourceScreenRouteName = 'PortalResources' | 'Resources';
type ResourceScreenRouteParams = (ResourcesRouteParams & PortalRouteParams) | undefined;

interface ResourceScreenImplProps {
  navigation: {
    addListener: MainTabScreenProps<'Resources'>['navigation']['addListener'];
    canGoBack: () => boolean;
    goBack: () => void;
    setParams: (params?: Partial<NonNullable<ResourceScreenRouteParams>>) => void;
  };
  route: {
    name: ResourceScreenRouteName;
    params: ResourceScreenRouteParams;
  };
}

function ResourceScreenImpl({ navigation, route }: ResourceScreenImplProps) {
  const { locale, t } = useI18n();
  const insets = useSafeAreaInsets();
  const scrollListPaddingBottom = useMainTabScrollableContentPaddingBottom();
  const toast = useToast();
  const colors = useThemeColors();
  const addChatContextSelection = useFileStore((s) => s.addChatContextSelection);

  const [files, setFiles] = useState<FileListItem[]>([]);
  const [hasResolvedFiles, setHasResolvedFiles] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [category, setCategory] = useState<FileCategory>('all');
  const [searchText, setSearchText] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [apiBase, setApiBase] = useState('');
  const [attachmentSheetVisible, setAttachmentSheetVisible] = useState(false);
  const [previewItem, setPreviewItem] = useState<FileListItem | null>(null);
  const [resourceOrigin, setResourceOrigin] = useState<ConversationOriginRouteParams | null>(null);
  const [previewOrigin, setPreviewOrigin] = useState<ConversationOriginRouteParams | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [sourceSetId, setSourceSetId] = useState<string | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [currentFolderSlug, setCurrentFolderSlug] = useState<string | null>(null);
  const [folderBreadcrumb, setFolderBreadcrumb] = useState<FolderCrumb[]>([]);
  const [sourceSets, setSourceSets] = useState<SourceSetItem[]>([]);
  const [sourceSetSelectVisible, setSourceSetSelectVisible] = useState(false);
  const [sourceSetNameDraft, setSourceSetNameDraft] = useState('');
  const [sourceSetNameMode, setSourceSetNameMode] = useState<'create' | 'rename'>('create');
  const [sourceSetNameModalVisible, setSourceSetNameModalVisible] = useState(false);
  const [sourceSetActionVisible, setSourceSetActionVisible] = useState(false);
  const [sourceSetActionMode, setSourceSetActionMode] = useState<'add' | 'move'>('add');
  const [sourceSetActionIds, setSourceSetActionIds] = useState<string[]>([]);
  const [sourceSetActionSubmitting, setSourceSetActionSubmitting] = useState(false);
  const [createFolderVisible, setCreateFolderVisible] = useState(false);
  const [createFolderName, setCreateFolderName] = useState('');
  const [moveToFolderItem, setMoveToFolderItem] = useState<FileListItem | null>(null);
  const [moveTargetFolders, setMoveTargetFolders] = useState<FileListItem[]>([]);
  const [moveFolderStack, setMoveFolderStack] = useState<
    Array<{ id: string; name: string } | null>
  >([null]);
  const [sorter, setSorter] = useState<SorterType>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sortMenuVisible, setSortMenuVisible] = useState(false);
  const [governanceSheetVisible, setGovernanceSheetVisible] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [governanceFilters, setGovernanceFilters] = useState<MobileGovernanceFilterState>({});
  const [governanceDraft, setGovernanceDraft] = useState<MobileGovernanceFilterState>({});
  const [governanceCapabilities, setGovernanceCapabilities] = useState<FileAssetCapabilities>();
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [actionItem, setActionItem] = useState<FileListItem | null>(null);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [visibleIds, setVisibleIds] = useState<Set<string>>(() => new Set());
  const [cachedResourceIds, setCachedResourceIds] = useState<Set<string>>(() => new Set());
  const [cachedResourceMap, setCachedResourceMap] = useState<Record<string, ResourceCacheEntry>>(
    {},
  );
  const [resourceAuthHeaders, setResourceAuthHeaders] = useState<Record<string, string>>({});
  const [treeChildrenByParent, setTreeChildrenByParent] = useState<Record<string, FileListItem[]>>(
    {},
  );
  const [treeExpandedIds, setTreeExpandedIds] = useState<Set<string>>(() => new Set());
  const [treeLoadingIds, setTreeLoadingIds] = useState<Set<string>>(() => new Set());
  const [trashModalVisible, setTrashModalVisible] = useState(false);
  const [trashLoading, setTrashLoading] = useState(false);
  const [trashedDocuments, setTrashedDocuments] = useState<TrashedDocumentItem[]>([]);
  const [restoringTrashId, setRestoringTrashId] = useState<string | null>(null);
  const [shareTarget, setShareTarget] = useState<ResourceShareSheetTarget | null>(null);
  const [manageShareTarget, setManageShareTarget] = useState<ResourceShareSheetTarget | null>(null);
  const [sourceSetSharingMenuVisible, setSourceSetSharingMenuVisible] = useState(false);
  const [sharedWithMeVisible, setSharedWithMeVisible] = useState(false);
  const viewabilityConfig = useMemo(
    () => ({ itemVisiblePercentThreshold: 10, minimumViewTime: 100 }),
    [],
  );
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: Array<ViewToken<ResourceListRow>> }) => {
      setVisibleIds((prev) => {
        const next = new Set(prev);
        for (const token of viewableItems) {
          if (!token.item || isResourceTreeRow(token.item)) continue;
          next.add(token.item.id);
        }
        return next;
      });
    },
    [],
  );
  const treeChildrenByParentRef = useRef<Record<string, FileListItem[]>>({});
  const nextOffsetRef = useRef(0);
  const loadRequestRef = useRef(0);
  const searchRef = useRef<TextInput>(null);

  const sourceSetSpaceId = useMemo(() => {
    if (!sourceSetId) return undefined;
    return sourceSets.find((l) => l.id === sourceSetId)?.spaceId ?? undefined;
  }, [sourceSetId, sourceSets]);
  const availableTargetSourceSets = useMemo(
    () => sourceSets.filter((item) => item.id !== sourceSetId),
    [sourceSetId, sourceSets],
  );

  const normalizedGovernanceFilters = useMemo(
    () => ({
      ...governanceFilters,
      assetRightsOwner: normalizeGovernanceRightsOwner(governanceFilters.assetRightsOwner),
    }),
    [governanceFilters],
  );

  const resourceListQueryParams = useMemo(
    () => ({
      ...normalizedGovernanceFilters,
      sourceSetId: sourceSetId ?? undefined,
      limit: RESOURCE_LIST_PAGE_SIZE,
      parentId: sourceSetId ? (currentFolderId ?? currentFolderSlug ?? null) : null,
      q: searchText.trim() || undefined,
      ...(sourceSetSpaceId ? { spaceId: sourceSetSpaceId } : {}),
    }),
    [
      normalizedGovernanceFilters,
      sourceSetId,
      currentFolderId,
      currentFolderSlug,
      sourceSetSpaceId,
      searchText,
    ],
  );

  /** Stable identity for list reload — avoids re-running when only the loadFiles callback reference changes */
  const resourceListQueryKey = useMemo(
    () =>
      JSON.stringify({
        sourceSet: sourceSetId ?? null,
        parent: sourceSetId ? (currentFolderId ?? currentFolderSlug ?? null) : null,
        q: searchText.trim() || null,
        space: sourceSetSpaceId ?? null,
        governance: normalizedGovernanceFilters,
      }),
    [
      normalizedGovernanceFilters,
      sourceSetId,
      currentFolderId,
      currentFolderSlug,
      sourceSetSpaceId,
      searchText,
    ],
  );

  const activeGovernanceFilterCount = useMemo(
    () => countActiveGovernanceFilters(governanceFilters),
    [governanceFilters],
  );

  const governanceFilterSummaryLabels = useMemo(
    () => buildGovernanceFilterSummaryLabels(governanceFilters, t),
    [governanceFilters, t],
  );
  const governanceCapabilityHint = useMemo(
    () => buildGovernanceCapabilityHint(governanceCapabilities, t),
    [governanceCapabilities, t],
  );
  const governanceWorkbenchSummary = useMemo(() => {
    if (governanceFilterSummaryLabels.length > 0) return governanceFilterSummaryLabels.join(' · ');
    return governanceCapabilityHint || t.resourceGovernanceFiltersSubtitle;
  }, [
    governanceCapabilityHint,
    governanceFilterSummaryLabels,
    t.resourceGovernanceFiltersSubtitle,
  ]);
  const hasGovernanceWorkbench = Boolean(
    governanceCapabilityHint || governanceFilterSummaryLabels.length > 0,
  );
  const selectionSummaryLabel = useMemo(
    () => t.resourceSelectCount.replace('{count}', String(selectedIds.size)),
    [selectedIds.size, t.resourceSelectCount],
  );
  const resourceItemsById = useMemo(() => {
    const map = new Map<string, FileListItem>();

    for (const item of files) {
      map.set(item.id, item);
    }

    for (const children of Object.values(treeChildrenByParent)) {
      for (const item of children) {
        if (!map.has(item.id)) map.set(item.id, item);
      }
    }

    if (previewItem) {
      map.set(previewItem.id, previewItem);
    }

    return map;
  }, [files, previewItem, treeChildrenByParent]);
  const selectedSourceSetEligibleIds = useMemo(
    () =>
      Array.from(selectedIds).filter((id) => {
        const item = resourceItemsById.get(id);
        return Boolean(item && !isFolder(item));
      }),
    [resourceItemsById, selectedIds],
  );
  const selectedHasSourceSetUnsupportedItems = useMemo(
    () =>
      Array.from(selectedIds).some((id) => {
        const item = resourceItemsById.get(id);
        return Boolean(item && isFolder(item));
      }),
    [resourceItemsById, selectedIds],
  );

  const openGovernanceSheet = useCallback(() => {
    setGovernanceDraft(governanceFilters);
    setGovernanceSheetVisible(true);
  }, [governanceFilters]);

  const clearGovernanceDraft = useCallback(() => {
    setGovernanceDraft({});
  }, []);

  const applyGovernanceFilters = useCallback(() => {
    haptics.selection();
    setGovernanceFilters({
      ...governanceDraft,
      assetRightsOwner: normalizeGovernanceRightsOwner(governanceDraft.assetRightsOwner),
    });
    setGovernanceSheetVisible(false);
  }, [governanceDraft]);

  useEffect(() => {
    if (!searchVisible) return;
    const timer = setTimeout(() => searchRef.current?.focus(), 120);
    return () => clearTimeout(timer);
  }, [searchVisible]);

  useEffect(() => {
    treeChildrenByParentRef.current = treeChildrenByParent;
  }, [treeChildrenByParent]);

  const toggleSelect = useCallback((item: FileListItem) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const refreshCachedResources = useCallback(async () => {
    try {
      const entries = await listResourceCacheEntries();
      setCachedResourceIds(new Set(entries.map((entry) => entry.fileId)));
      setCachedResourceMap(Object.fromEntries(entries.map((entry) => [entry.fileId, entry])));
    } catch {
      setCachedResourceIds(new Set());
      setCachedResourceMap({});
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const hydrateAuthHeaders = async () => {
      try {
        const headers = await getAuthHeaders(apiBase);
        if (!cancelled) {
          setResourceAuthHeaders(headers);
        }
      } catch {
        if (!cancelled) {
          setResourceAuthHeaders({});
        }
      }
    };

    if (apiBase) {
      void hydrateAuthHeaders();
    } else {
      setResourceAuthHeaders({});
    }

    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  const invalidateCachedResource = useCallback((fileId: string) => {
    setCachedResourceIds((prev) => {
      if (!prev.has(fileId)) return prev;
      const next = new Set(prev);
      next.delete(fileId);
      return next;
    });
    setCachedResourceMap((prev) => {
      if (!prev[fileId]) return prev;
      const next = { ...prev };
      delete next[fileId];
      return next;
    });
    void clearResourceCacheEntry(fileId);
  }, []);

  const purgeResourceState = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;

      const idSet = new Set(ids);

      setFiles((prev) => prev.filter((item) => !idSet.has(item.id)));
      setSelectedIds((prev) => {
        if (prev.size === 0) return prev;
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
      setVisibleIds((prev) => {
        if (prev.size === 0) return prev;
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
      setTreeExpandedIds((prev) => {
        if (prev.size === 0) return prev;
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
      setTreeChildrenByParent((prev) =>
        Object.fromEntries(
          Object.entries(prev).map(([key, items]) => [
            key,
            items.filter((item) => !idSet.has(item.id)),
          ]),
        ),
      );
      setCachedResourceIds((prev) => {
        if (prev.size === 0) return prev;
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
      setCachedResourceMap((prev) => {
        const next = { ...prev };
        for (const id of ids) delete next[id];
        return next;
      });

      if (previewItem && idSet.has(previewItem.id)) {
        setPreviewVisible(false);
        setPreviewItem(null);
      }

      if (actionItem && idSet.has(actionItem.id)) {
        setActionItem(null);
      }
    },
    [actionItem, previewItem],
  );

  const purgeDeletedResources = useCallback(
    async (ids: string[]) => {
      await Promise.all(
        ids.map(async (id) => {
          const cachedEntry = cachedResourceMap[id] ?? (await getResourceCacheEntry(id));
          await removeLocalCachedFile(cachedEntry);
          await clearResourceCacheEntry(id);
        }),
      );
      purgeResourceState(ids);
    },
    [cachedResourceMap, purgeResourceState],
  );

  const replaceResourceItem = useCallback((nextItem: FileListItem, previousId?: string) => {
    const targetId = previousId ?? nextItem.id;

    setFiles((prev) =>
      prev.some((item) => item.id === targetId)
        ? prev.map((item) => (item.id === targetId ? nextItem : item))
        : prev,
    );
    setSelectedIds((prev) => {
      if (!prev.has(targetId) || targetId === nextItem.id) return prev;
      const next = new Set(prev);
      next.delete(targetId);
      next.add(nextItem.id);
      return next;
    });
    setVisibleIds((prev) => {
      if (!prev.has(targetId) || targetId === nextItem.id) return prev;
      const next = new Set(prev);
      next.delete(targetId);
      next.add(nextItem.id);
      return next;
    });
    setTreeChildrenByParent((prev) => {
      let changed = false;
      const nextEntries = Object.entries(prev).map(([key, items]) => {
        const nextItems = items.map((item) => {
          if (item.id !== targetId) return item;
          changed = true;
          return nextItem;
        });

        return [key, nextItems] as const;
      });

      return changed ? Object.fromEntries(nextEntries) : prev;
    });
    setPreviewItem((current) =>
      current && (current.id === targetId || current.id === nextItem.id) ? nextItem : current,
    );
    setActionItem((current) =>
      current && (current.id === targetId || current.id === nextItem.id) ? nextItem : current,
    );
  }, []);

  // ── Data (defined early for handleBatchDelete etc.) ──────────────────

  const loadSourceSets = useCallback(async () => {
    try {
      const list = await sourceSetApi.list();
      setSourceSets(list ?? []);
    } catch {
      setSourceSets([]);
    }
  }, []);

  const loadFolderBreadcrumb = useCallback(async (slug: string) => {
    try {
      const chain = await resourceApi.getFolderBreadcrumb(slug);
      setFolderBreadcrumb(chain ?? []);
    } catch {
      setFolderBreadcrumb([]);
    }
  }, []);

  const syncVisibleTreeChildren = useCallback(
    (parentId: string | null, items: FileListItem[]) => {
      if (!sourceSetId || searchText.trim()) return;

      const treeKey = parentId ?? ROOT_TREE_KEY;

      setTreeChildrenByParent((prev) => {
        if (areSameFileItems(prev[treeKey], items)) return prev;

        return {
          ...prev,
          [treeKey]: items,
        };
      });
    },
    [sourceSetId, searchText],
  );

  const loadFiles = useCallback(
    async (silent = false, append = false) => {
      const ticket = ++loadRequestRef.current;
      const loadOffset = append ? nextOffsetRef.current : 0;
      const cachedEntry = append ? null : getResourceListCacheEntry(resourceListQueryParams);
      const hasCachedEntry = Boolean(cachedEntry);

      if (!append) {
        if (cachedEntry) {
          nextOffsetRef.current = cachedEntry.items.length;
          setFiles(cachedEntry.items);
          setHasMore(cachedEntry.hasMore);
          setHasResolvedFiles(true);
          syncVisibleTreeChildren(resourceListQueryParams.parentId ?? null, cachedEntry.items);
        } else if (!silent) {
          nextOffsetRef.current = 0;
          setFiles([]);
          setHasMore(false);
          setHasResolvedFiles(false);
        }
      }

      setLoading(!silent && !append && !hasCachedEntry);
      if (append) setLoadingMore(true);

      try {
        const base = await getApiUrl();
        setApiBase((prev) => (prev === base ? prev : base));
        const result = await resourceApi.getKnowledgeItems({
          ...resourceListQueryParams,
          limit: RESOURCE_LIST_PAGE_SIZE,
          offset: loadOffset,
        });
        if (ticket !== loadRequestRef.current) return;
        const items = result?.items ?? [];
        const nextHasMore = result?.hasMore ?? false;
        setGovernanceCapabilities(result?.governanceCapabilities);

        setHasMore(nextHasMore);
        nextOffsetRef.current = loadOffset + items.length;

        if (append) {
          setFiles((prev) => [...prev, ...items]);
          setHasResolvedFiles(true);
        } else {
          saveResourceListCacheEntry(resourceListQueryParams, {
            cachedAt: Date.now(),
            hasMore: nextHasMore,
            items,
          });
          setFiles(items);
          setHasResolvedFiles(true);
          syncVisibleTreeChildren(resourceListQueryParams.parentId ?? null, items);
        }
      } catch {
        if (ticket !== loadRequestRef.current) return;
        setGovernanceCapabilities(undefined);
        if (!append && !hasCachedEntry && !silent) {
          nextOffsetRef.current = 0;
          setFiles([]);
          setHasMore(false);
          setHasResolvedFiles(true);
        }
      } finally {
        if (ticket === loadRequestRef.current) {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [resourceListQueryParams, syncVisibleTreeChildren],
  );

  const loadTreeChildren = useCallback(
    async (parentId: string | null, force = false) => {
      if (!sourceSetId) return;

      const treeKey = parentId ?? ROOT_TREE_KEY;
      const cacheParams = {
        ...normalizedGovernanceFilters,
        sourceSetId,
        limit: RESOURCE_TREE_PAGE_SIZE,
        parentId,
        ...(sourceSetSpaceId ? { spaceId: sourceSetSpaceId } : {}),
      };

      if (!force) {
        const cachedEntry = getResourceListCacheEntry(cacheParams);

        if (cachedEntry) {
          setTreeChildrenByParent((prev) => {
            if (areSameFileItems(prev[treeKey], cachedEntry.items)) return prev;

            return {
              ...prev,
              [treeKey]: cachedEntry.items,
            };
          });
        } else if (treeChildrenByParentRef.current[treeKey]) {
          return;
        }
      }

      setTreeLoadingIds((prev) => {
        const next = new Set(prev);
        next.add(treeKey);
        return next;
      });

      try {
        const result = await resourceApi.getKnowledgeItems({
          ...normalizedGovernanceFilters,
          sourceSetId,
          limit: RESOURCE_TREE_PAGE_SIZE,
          offset: 0,
          parentId,
          ...(sourceSetSpaceId ? { spaceId: sourceSetSpaceId } : {}),
        });

        const items = result?.items ?? [];
        saveResourceListCacheEntry(cacheParams, {
          cachedAt: Date.now(),
          hasMore: result?.hasMore ?? false,
          items,
        });

        setTreeChildrenByParent((prev) => ({
          ...prev,
          [treeKey]: items,
        }));
      } catch {
        setTreeChildrenByParent((prev) => ({
          ...prev,
          [treeKey]: [],
        }));
      } finally {
        setTreeLoadingIds((prev) => {
          const next = new Set(prev);
          next.delete(treeKey);
          return next;
        });
      }
    },
    [normalizedGovernanceFilters, sourceSetId, sourceSetSpaceId],
  );

  const refreshTreeData = useCallback(async () => {
    if (!sourceSetId) {
      setTreeChildrenByParent({});
      setTreeExpandedIds(new Set());
      return;
    }

    await loadTreeChildren(null, true);

    if (currentFolderId) {
      await loadTreeChildren(currentFolderId, true);
    }
  }, [currentFolderId, sourceSetId, loadTreeChildren]);

  useEffect(() => {
    if (!trashModalVisible) return;
    let cancelled = false;
    void (async () => {
      setTrashLoading(true);
      try {
        const res = await resourceApi.queryTrashedDocuments({
          current: 0,
          pageSize: 100,
          ...(sourceSetId ? { sourceSetId } : {}),
        });
        if (!cancelled) setTrashedDocuments(res?.items ?? []);
      } catch {
        if (!cancelled) {
          setTrashedDocuments([]);
          toast.show('error', t.resourceTrashLoadFailed);
        }
      } finally {
        if (!cancelled) setTrashLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sourceSetId, t.resourceTrashLoadFailed, toast, trashModalVisible]);

  const handleRestoreTrashed = useCallback(
    async (id: string) => {
      setRestoringTrashId(id);
      try {
        await resourceApi.restoreDocument(id);
        haptics.success();
        setTrashedDocuments((prev) => prev.filter((row) => row.id !== id));
        clearResourceListCache();
        await loadFiles(true);
        await refreshTreeData();
        toast.show('success', t.resourceTrashRestored);
      } catch {
        toast.show('error', t.resourceTrashRestoreFailed);
      } finally {
        setRestoringTrashId(null);
      }
    },
    [loadFiles, refreshTreeData, t.resourceTrashRestored, t.resourceTrashRestoreFailed, toast],
  );

  /**
   * Unified resource deletion - handles both files and documents concurrently
   */
  const deleteResourcesUnified = useCallback(
    async (ids: string[], trash: boolean = true) => {
      // Classify resources by type for concurrent deletion
      const fileIds: string[] = [];
      const documentIds: string[] = [];

      for (const id of ids) {
        const item = resourceItemsById.get(id);
        if (
          item &&
          (getCanonicalResourceKind(item) === 'document' || item.fileType === 'custom/folder')
        ) {
          documentIds.push(id);
        } else {
          fileIds.push(id);
        }
      }

      // Execute deletions concurrently
      const promises: Promise<void>[] = [];
      if (fileIds.length > 0) {
        if (fileIds.length === 1) {
          promises.push(fileApi.remove(fileIds[0]!, trash));
        } else {
          promises.push(fileApi.removeFiles(fileIds, trash));
        }
      }
      if (documentIds.length > 0) {
        if (documentIds.length === 1) {
          promises.push(resourceApi.deleteDocument(documentIds[0]!, trash));
        } else {
          promises.push(resourceApi.deleteDocuments(documentIds, trash));
        }
      }

      await Promise.all(promises);
    },
    [resourceItemsById],
  );

  const handleBatchDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    const hasFolders = ids.some((id) => {
      const item = resourceItemsById.get(id);
      return item?.fileType === 'custom/folder';
    });
    const confirmTitle = hasFolders ? t.resourceFolderDeleteConfirm : t.resourceDeleteConfirm;
    const confirmDesc = hasFolders ? t.resourceFolderDeleteDesc : t.resourceDeleteDesc;
    Alert.alert(confirmTitle, `${ids.length} items\n${confirmDesc}`, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteResourcesUnified(ids);
            haptics.success();
            await purgeDeletedResources(ids);
            clearSelection();
            clearResourceListCache();
            await loadFiles(true);
            await refreshTreeData();
          } catch {
            toast.show('error', t.resourceDeleteFailed);
          }
        },
      },
    ]);
  }, [
    selectedIds,
    resourceItemsById,
    deleteResourcesUnified,
    purgeDeletedResources,
    clearSelection,
    loadFiles,
    refreshTreeData,
    t,
    toast,
  ]);

  const [batchMoveIds, setBatchMoveIds] = useState<Set<string>>(() => new Set());

  const handleBatchMove = useCallback(() => {
    setBatchMoveIds(new Set(selectedIds));
    setMoveToFolderItem({
      id: '__batch__',
      name: '',
      fileType: '',
      size: 0,
      createdAt: '',
      sourceType: 'file',
      url: '',
    } as FileListItem);
    setMoveFolderStack([null]);
  }, [selectedIds]);

  const moveFolderParentId = moveFolderStack.at(-1)?.id ?? null;
  const moveFolderCurrent = moveFolderStack.length > 1 ? moveFolderStack.at(-1) : null;

  useEffect(() => {
    if (moveToFolderItem && sourceSetId) {
      resourceApi
        .getKnowledgeItems({
          sourceSetId,
          parentId: moveFolderParentId,
          ...(sourceSetSpaceId ? { spaceId: sourceSetSpaceId } : {}),
        })
        .then((res) => {
          const folders = (res?.items ?? []).filter((i) => i.fileType === 'custom/folder');
          setMoveTargetFolders(folders);
        })
        .catch(() => setMoveTargetFolders([]));
    } else {
      setMoveTargetFolders([]);
      setMoveFolderStack([null]);
    }
  }, [sourceSetSpaceId, moveFolderParentId, moveToFolderItem, sourceSetId]);

  const handlePreview = useCallback(
    (item: FileListItem) => {
      const openPreview = (nextItem: FileListItem = item) => {
        haptics.light();
        setPreviewOrigin(resourceOrigin);
        setPreviewItem(nextItem);
        setPreviewVisible(true);
      };

      if (getCanonicalResourceKind(item) !== 'document') {
        openPreview();
        return;
      }

      void (async () => {
        const document = await notebookApi.get(item.id).catch(() => null);
        if (document) {
          haptics.light();
          navigateToNotebook(
            appendCurrentPortalStackWithOrigin(
              route.name,
              route.params,
              {
                documentId: item.id,
              },
              resourceOrigin,
            ),
          );
          return;
        }

        openPreview(item);
      })();
    },
    [resourceOrigin, route.name, route.params],
  );

  const consumeNavigationTarget = useCallback(async () => {
    const params = route.params;
    if (!params) return;

    const { openItem, openItemId, openKind, openSourceSetId, sessionId, threadId, topicId } =
      params;
    const hasNavigationTarget =
      openItem !== undefined ||
      openItemId !== undefined ||
      openKind !== undefined ||
      openSourceSetId !== undefined;

    if (!hasNavigationTarget) return;

    if (openSourceSetId !== undefined) {
      setSourceSetId(openSourceSetId ?? null);
      setCurrentFolderId(null);
      setCurrentFolderSlug(null);
      setTreeChildrenByParent({});
      setTreeExpandedIds(new Set());
      setFolderBreadcrumb([]);
      clearResourceListCache();
    }

    const nextOrigin =
      createConversationOrigin({
        sessionId,
        ...(threadId ? { threadId } : {}),
        ...(topicId ? { topicId } : {}),
      }) ?? null;

    let previewTarget: FileListItem | null = openItem
      ? fileListItemFromNavigationTarget(openItem)
      : null;

    if (!previewTarget && openItemId && openKind === 'document') {
      const document = await notebookApi.get(openItemId).catch(() => null);

      if (document) {
        setResourceOrigin(nextOrigin);
        navigateToNotebook(
          appendCurrentPortalStackWithOrigin(
            route.name,
            route.params,
            {
              documentId: openItemId,
            },
            nextOrigin,
          ),
        );
        navigation.setParams({
          openItem: undefined,
          openItemId: undefined,
          openKind: undefined,
          openSourceSetId: undefined,
          sessionId: undefined,
          threadId: undefined,
          topicId: undefined,
        });
        return;
      }

      previewTarget = {
        ...fileListItemFromShared({
          fileType: 'text/plain',
          kind: 'document',
          localId: openItemId,
          name: openItemId,
        }),
      };
    }

    if (!previewTarget && openItemId && openKind === 'file') {
      previewTarget = fileListItemFromShared({
        kind: 'file',
        localId: openItemId,
        name: openItemId,
      });
    }

    setResourceOrigin(nextOrigin);

    if (previewTarget && openKind !== 'source_set') {
      setPreviewOrigin(nextOrigin);
      setPreviewItem(previewTarget);
      setPreviewVisible(true);
      haptics.light();
    }

    navigation.setParams({
      openItem: undefined,
      openItemId: undefined,
      openKind: undefined,
      openSourceSetId: undefined,
      sessionId: undefined,
      threadId: undefined,
      topicId: undefined,
    });
  }, [navigation, route.name, route.params]);

  useEffect(
    () =>
      navigation.addListener('blur', () => {
        setResourceOrigin(null);
        setPreviewOrigin(null);
      }),
    [navigation],
  );

  useEffect(() => {
    useConnectionStore.getState().checkConnection();
  }, []);

  useEffect(() => {
    loadSourceSets();
    void refreshCachedResources();
  }, [loadSourceSets, refreshCachedResources]);

  useEffect(() => {
    void consumeNavigationTarget();
  }, [consumeNavigationTarget]);

  useEffect(() => {
    if (currentFolderSlug) {
      loadFolderBreadcrumb(currentFolderSlug);
    } else {
      setFolderBreadcrumb([]);
    }
  }, [currentFolderSlug, loadFolderBreadcrumb]);

  useEffect(() => {
    nextOffsetRef.current = 0;
    void (async () => {
      await refreshCachedResources();
      await loadFiles();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadFiles identity can churn without query changes; resourceListQueryKey matches list fetch semantics
  }, [resourceListQueryKey, refreshCachedResources]);

  useEffect(() => {
    if (!sourceSetId) return;
    void loadTreeChildren(null);
  }, [sourceSetId, loadTreeChildren]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshCachedResources();
      await loadFiles(true);
    } finally {
      setRefreshing(false);
    }
  }, [loadFiles, refreshCachedResources]);

  const handleFolderPress = useCallback((item: FileListItem) => {
    nextOffsetRef.current = 0;
    setCurrentFolderId(item.id);
    setCurrentFolderSlug(item.slug ?? item.id);
  }, []);

  const handleFolderPressResolved = useCallback(
    (item: FileListItem) => {
      if (!sourceSetId) {
        toast.show('info', t.resourceFolderOpenNeedsSourceSet);
        return;
      }
      handleFolderPress(item);
    },
    [handleFolderPress, sourceSetId, t.resourceFolderOpenNeedsSourceSet, toast],
  );

  const handleBreadcrumbPress = useCallback(
    (item: FolderCrumb, index: number) => {
      if (index === folderBreadcrumb.length - 1) return;
      nextOffsetRef.current = 0;
      setCurrentFolderId(item.id);
      setCurrentFolderSlug(item.slug);
    },
    [folderBreadcrumb.length],
  );

  const handleBackToRoot = useCallback(() => {
    nextOffsetRef.current = 0;
    setCurrentFolderId(null);
    setCurrentFolderSlug(null);
  }, []);

  const handleCreateFolder = useCallback(async () => {
    if (!sourceSetId) return;
    const name = createFolderName.trim() || t.resourceNewFolder;
    setCreateFolderVisible(false);
    setCreateFolderName('');
    try {
      await resourceApi.createFolder({
        sourceSetId,
        parentId: currentFolderId ?? currentFolderSlug ?? undefined,
        title: name,
      });
      haptics.success();
      clearResourceListCache();
      await loadFiles(true);
      await refreshTreeData();
    } catch {
      toast.show('error', t.resourceUploadFailed);
    }
  }, [
    sourceSetId,
    currentFolderId,
    currentFolderSlug,
    createFolderName,
    loadFiles,
    refreshTreeData,
    t.resourceNewFolder,
    t.resourceUploadFailed,
    toast,
  ]);

  const handleMoveToFolder = useCallback(
    async (targetFolderId: string | null) => {
      const isBatch = batchMoveIds.size > 0;
      const idsToMove = isBatch
        ? Array.from(batchMoveIds)
        : moveToFolderItem
          ? [moveToFolderItem.id]
          : [];
      setMoveToFolderItem(null);
      setBatchMoveIds(new Set());
      setMoveFolderStack([null]);
      if (idsToMove.length === 0) return;
      try {
        for (const id of idsToMove) {
          const item = resourceItemsById.get(id);
          if (item && id !== '__batch__') {
            await resourceApi.moveResource(id, targetFolderId, getCanonicalResourceKind(item));
          }
        }
        haptics.success();
        toast.show('success', t.done);
        clearSelection();
        clearResourceListCache();
        await loadFiles(true);
        await refreshTreeData();
      } catch {
        toast.show('error', t.resourceUploadFailed);
      }
    },
    [
      moveToFolderItem,
      batchMoveIds,
      resourceItemsById,
      clearSelection,
      loadFiles,
      refreshTreeData,
      t.done,
      t.resourceUploadFailed,
      toast,
    ],
  );

  // ── Upload ────────────────────────────────────────────────────────

  const doUpload = useCallback(
    async (uri: string, name: string, mimeType: string) => {
      setUploading(true);
      setUploadProgress(0);
      try {
        const created = await fileApi.upload(uri, name, mimeType, {
          sourceSetId: sourceSetId ?? undefined,
          onProgress: (p) => setUploadProgress(p),
          parentId: currentFolderId ?? currentFolderSlug ?? undefined,
        });
        haptics.success();
        toast.show('success', t.resourceUploaded);
        setFiles((prev) => {
          const optimistic: FileListItem = {
            chunkCount: null,
            chunkingError: null,
            chunkingStatus: null,
            createdAt: new Date().toISOString(),
            editorData: null,
            embeddingError: null,
            embeddingStatus: null,
            fileType: mimeType,
            finishEmbedding: false,
            id: created.id,
            name,
            size: 0,
            sourceType: 'file',
            url: created.url,
          };
          return [optimistic, ...prev];
        });
        await new Promise((r) => setTimeout(r, 200));
        clearResourceListCache();
        await loadFiles(true);
        await refreshTreeData();
        await refreshCachedResources();
      } catch {
        toast.show('error', t.resourceUploadFailed);
      } finally {
        setUploading(false);
        setUploadProgress(0);
      }
    },
    [
      currentFolderId,
      currentFolderSlug,
      sourceSetId,
      loadFiles,
      refreshCachedResources,
      refreshTreeData,
      t,
      toast,
    ],
  );

  const handlePickPhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'] as any,
      allowsMultipleSelection: true,
      quality: 0.85,
    });
    if (result.canceled) return;
    for (const asset of result.assets) {
      const name = asset.fileName ?? `photo_${Date.now()}.jpg`;
      const mimeType = asset.mimeType ?? 'image/jpeg';
      await doUpload(asset.uri, name, mimeType);
    }
  }, [doUpload]);

  const handlePickFile = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    for (const asset of result.assets) {
      await doUpload(asset.uri, asset.name, asset.mimeType ?? 'application/octet-stream');
    }
  }, [doUpload]);

  const handleUpload = useCallback(() => {
    haptics.light();
    setAttachmentSheetVisible(true);
  }, []);

  const currentSourceSetName = sourceSetId
    ? (sourceSets.find((l) => l.id === sourceSetId)?.name ?? '')
    : t.resourceSourceSetUnassigned;

  const resetSourceSetNavigation = useCallback(() => {
    setCurrentFolderId(null);
    setCurrentFolderSlug(null);
    setTreeChildrenByParent({});
    setTreeExpandedIds(new Set());
    setFolderBreadcrumb([]);
    clearResourceListCache();
  }, []);

  const openCreateSourceSetModal = useCallback(() => {
    setSourceSetNameMode('create');
    setSourceSetNameDraft('');
    setSourceSetSelectVisible(false);
    setSourceSetNameModalVisible(true);
  }, []);

  const openRenameSourceSetModal = useCallback(() => {
    if (!sourceSetId) return;

    setSourceSetNameMode('rename');
    setSourceSetNameDraft(currentSourceSetName);
    setSourceSetSharingMenuVisible(false);
    setSourceSetNameModalVisible(true);
  }, [currentSourceSetName, sourceSetId]);

  const handleSubmitSourceSetName = useCallback(
    async (value: string) => {
      const name = value.trim();
      if (!name) return;

      setSourceSetNameModalVisible(false);

      try {
        if (sourceSetNameMode === 'create') {
          const createdId = await sourceSetApi.create({ name });
          if (!createdId) {
            toast.show('error', t.errorNetwork);
            return;
          }

          await loadSourceSets();
          setSourceSetId(createdId);
          resetSourceSetNavigation();
          await loadFiles(true);
          haptics.success();
          toast.show('success', t.resourceSourceSetCreated);
          return;
        }

        if (!sourceSetId) return;

        await sourceSetApi.update(sourceSetId, { name });
        await loadSourceSets();
        haptics.success();
        toast.show('success', t.resourceRenamed);
      } catch {
        toast.show(
          'error',
          sourceSetNameMode === 'create' ? t.errorNetwork : t.resourceRenameFailed,
        );
      }
    },
    [loadFiles, loadSourceSets, resetSourceSetNavigation, sourceSetId, sourceSetNameMode, t, toast],
  );

  const handleDeleteSourceSet = useCallback(() => {
    if (!sourceSetId) return;

    Alert.alert(t.resourceDeleteSourceSetConfirm, t.resourceDeleteSourceSetDesc, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await sourceSetApi.remove(sourceSetId, false);
              await loadSourceSets();
              setSourceSetId(null);
              resetSourceSetNavigation();
              await loadFiles(true);
              haptics.success();
              toast.show('success', t.resourceSourceSetDeleted);
            } catch {
              toast.show('error', t.resourceDeleteFailed);
            }
          })();
        },
      },
    ]);
  }, [loadFiles, loadSourceSets, resetSourceSetNavigation, sourceSetId, t, toast]);

  // ── Delete ────────────────────────────────────────────────────────

  const handleDelete = useCallback(
    (id: string, name: string, isFolderItem: boolean) => {
      haptics.warning();
      const confirmTitle = isFolderItem ? t.resourceFolderDeleteConfirm : t.resourceDeleteConfirm;
      const confirmDesc = isFolderItem ? t.resourceFolderDeleteDesc : t.resourceDeleteDesc;
      Alert.alert(confirmTitle, `"${name}"\n${confirmDesc}`, [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.delete,
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteResourcesUnified([id]);
              haptics.success();
              await purgeDeletedResources([id]);
              clearResourceListCache();
              await loadFiles(true);
              await refreshTreeData();
            } catch {
              toast.show('error', t.resourceDeleteFailed);
            }
          },
        },
      ]);
    },
    [deleteResourcesUnified, loadFiles, purgeDeletedResources, refreshTreeData, t, toast],
  );

  const closeActionSheet = useCallback(() => setActionItem(null), []);

  const handleRenameStart = useCallback(() => {
    if (!actionItem) return;
    setRenameValue(actionItem.name || '');
    setRenameModalVisible(true);
    closeActionSheet();
  }, [actionItem, closeActionSheet]);

  const handleRenameSubmit = useCallback(
    async (newName: string) => {
      if (!actionItem || !newName.trim()) return;
      setRenameModalVisible(false);
      try {
        const itemIsFolder = isFolder(actionItem);
        if (itemIsFolder || getCanonicalResourceKind(actionItem) === 'document') {
          await resourceApi.updateDocument(actionItem.id, { title: newName.trim() });
        } else {
          await fileApi.update(actionItem.id, { name: newName.trim() });
        }
        haptics.success();
        setFiles((prev) =>
          prev.map((f) => (f.id === actionItem.id ? { ...f, name: newName.trim() } : f)),
        );
        clearResourceListCache();
        await refreshTreeData();
        toast.show('success', t.resourceRenamed);
      } catch {
        toast.show('error', t.resourceRenameFailed);
      }
    },
    [actionItem, refreshTreeData, t, toast],
  );

  const handleConvertActionItemToDocument = useCallback(async () => {
    if (
      !actionItem ||
      isFolder(actionItem) ||
      getCanonicalResourceKind(actionItem) !== 'file' ||
      !isMarkdownFile(actionItem.fileType, actionItem.name)
    ) {
      return;
    }

    try {
      const ensuredDocument = await ensureNotebookDocumentFromFile(actionItem);
      if (!ensuredDocument) {
        toast.show('error', t.errorNetwork);
        return;
      }

      const { documentId, nextItem } = ensuredDocument;
      replaceResourceItem(nextItem, actionItem.id);
      closeActionSheet();
      haptics.success();
      toast.show('success', t.fileEditAsDocumentSuccess);
      navigateToNotebook(
        appendCurrentPortalStackWithOrigin(
          route.name,
          route.params,
          {
            documentId,
          },
          resourceOrigin,
        ),
      );
    } catch {
      toast.show('error', t.errorNetwork);
    }
  }, [
    actionItem,
    closeActionSheet,
    replaceResourceItem,
    resourceOrigin,
    route.name,
    route.params,
    t,
    toast,
  ]);

  const openItemShareSheet = useCallback((item: FileListItem) => {
    setShareTarget({
      id: item.id,
      kind: getCanonicalResourceKind(item),
      name: item.name || item.id,
    });
  }, []);

  const handleBatchShareLink = useCallback(() => {
    if (selectedIds.size !== 1) return;
    const onlyId = Array.from(selectedIds)[0];
    const item = onlyId ? resourceItemsById.get(onlyId) : undefined;
    if (!item) return;
    openItemShareSheet(item);
    clearSelection();
  }, [clearSelection, openItemShareSheet, resourceItemsById, selectedIds]);

  const handleShareFromActionSheet = useCallback(
    (item: FileListItem) => {
      closeActionSheet();
      openItemShareSheet(item);
    },
    [closeActionSheet, openItemShareSheet],
  );

  const handleShareSourceSet = useCallback(() => {
    if (!sourceSetId) return;
    setShareTarget({
      id: sourceSetId,
      kind: 'source_set',
      name: sourceSets.find((l) => l.id === sourceSetId)?.name || t.resourceTitle,
    });
  }, [sourceSetId, sourceSets, t.resourceTitle]);

  const handleAddToChatContext = useCallback(
    async (item: FileListItem) => {
      closeActionSheet();

      if (!isChatContextEligibleResource(item)) return;

      try {
        const context = await createChatContextSelectionFromResource(item);

        if (!context) {
          toast.show('error', t.fileUploadFailed);
          return;
        }

        addChatContextSelection(context);
        haptics.success();
        toast.show('success', t.fileAddToChatContextSuccess);
      } catch {
        toast.show('error', t.fileUploadFailed);
      }
    },
    [
      addChatContextSelection,
      closeActionSheet,
      t.fileAddToChatContextSuccess,
      t.fileUploadFailed,
      toast,
    ],
  );

  const openManageShareFromItem = useCallback(
    (item: FileListItem) => {
      closeActionSheet();
      setManageShareTarget({
        id: item.id,
        kind: getCanonicalResourceKind(item),
        name: item.name || item.id,
      });
    },
    [closeActionSheet],
  );

  const openManageSourceSetShare = useCallback(() => {
    if (!sourceSetId) return;
    setManageShareTarget({
      id: sourceSetId,
      kind: 'source_set',
      name: sourceSets.find((l) => l.id === sourceSetId)?.name || t.resourceTitle,
    });
  }, [sourceSetId, sourceSets, t.resourceTitle]);

  const canMoveAction = !!sourceSetId;

  const refreshResourceSurface = useCallback(async () => {
    clearResourceListCache();
    await Promise.all([loadFiles(true), refreshTreeData(), loadSourceSets()]);
  }, [loadFiles, loadSourceSets, refreshTreeData]);

  const openSourceSetAction = useCallback((ids: string[], mode: 'add' | 'move') => {
    if (ids.length === 0) return;
    setSourceSetActionIds(ids);
    setSourceSetActionMode(mode);
    setSourceSetActionVisible(true);
  }, []);

  const handleRemoveFromSourceSet = useCallback(
    (ids: string[]) => {
      if (!sourceSetId || ids.length === 0) return;

      closeActionSheet();
      Alert.alert(
        t.resourceRemoveFromSourceSetConfirm,
        t.resourceRemoveFromSourceSetDesc.replace('{count}', String(ids.length)),
        [
          { text: t.cancel, style: 'cancel' },
          {
            text: t.delete,
            style: 'destructive',
            onPress: () => {
              void (async () => {
                try {
                  await sourceSetApi.removeFiles(sourceSetId, ids);
                  clearSelection();
                  await refreshResourceSurface();
                  haptics.success();
                  toast.show('success', t.resourceRemoveFromSourceSetSuccess);
                } catch {
                  toast.show('error', t.resourceRemoveFromSourceSetFailed);
                }
              })();
            },
          },
        ],
      );
    },
    [clearSelection, closeActionSheet, refreshResourceSurface, sourceSetId, t, toast],
  );

  const handleSelectSourceSetTarget = useCallback(
    async (targetSourceSetId: string) => {
      if (sourceSetActionSubmitting || sourceSetActionIds.length === 0) return;

      setSourceSetActionSubmitting(true);
      try {
        if (sourceSetActionMode === 'move' && sourceSetId) {
          await sourceSetApi.removeFiles(sourceSetId, sourceSetActionIds);
          await Promise.all(
            sourceSetActionIds.map(async (id) => {
              const item = resourceItemsById.get(id);
              if (!item?.parentId) return;

              await resourceApi.moveResource(id, null, getCanonicalResourceKind(item));
            }),
          );
        }

        await sourceSetApi.addFiles(targetSourceSetId, sourceSetActionIds);
        setSourceSetActionVisible(false);
        setSourceSetActionIds([]);
        clearSelection();
        await refreshResourceSurface();
        haptics.success();
        toast.show(
          'success',
          sourceSetActionMode === 'move'
            ? t.resourceMoveToSourceSetSuccess
            : t.resourceAddToSourceSetSuccess,
        );
      } catch (error) {
        const hasConflict = isSourceSetConflictError(error);

        toast.show(
          hasConflict ? 'info' : 'error',
          hasConflict
            ? t.resourceAddToSourceSetExists
            : sourceSetActionMode === 'move'
              ? t.resourceMoveToSourceSetFailed
              : t.resourceAddToSourceSetFailed,
        );
      } finally {
        setSourceSetActionSubmitting(false);
      }
    },
    [
      clearSelection,
      refreshResourceSurface,
      resourceItemsById,
      sourceSetActionIds,
      sourceSetActionMode,
      sourceSetActionSubmitting,
      sourceSetId,
      t,
      toast,
    ],
  );

  const handleSharedWithMePick = useCallback(
    async (row: SharedWithMeRow) => {
      setSharedWithMeVisible(false);
      const rowKind =
        row.kind === 'source_set'
          ? row.kind
          : getCanonicalResourceKind({ id: row.localId, kind: row.kind });

      if (rowKind === 'source_set') {
        setSourceSetId(row.localId);
        setCurrentFolderId(null);
        setCurrentFolderSlug(null);
        setTreeChildrenByParent({});
        setTreeExpandedIds(new Set());
        setFolderBreadcrumb([]);
        clearResourceListCache();
        haptics.success();
        return;
      }
      if (rowKind === 'file') {
        setPreviewOrigin(resourceOrigin);
        setPreviewItem(
          fileListItemFromShared({ kind: 'file', localId: row.localId, name: row.name }),
        );
        setPreviewVisible(true);
        haptics.light();
        return;
      }
      const doc = await resourceApi.getDocument(row.localId).catch(() => null);
      const ft = doc?.fileType ?? 'text/plain';
      if (ft === 'custom/folder') {
        const kbId = doc?.sourceSetId;
        if (typeof kbId === 'string' && kbId.length > 0) {
          const slug = doc?.slug ?? row.localId;
          setSourceSetId(kbId);
          setCurrentFolderId(row.localId);
          setCurrentFolderSlug(slug);
          setTreeChildrenByParent({});
          setTreeExpandedIds(new Set());
          setFolderBreadcrumb([]);
          clearResourceListCache();
          void loadSourceSets();
          void loadFolderBreadcrumb(slug);
          haptics.success();
          return;
        }
        toast.show('info', t.resourceSharedFolderHint);
        return;
      }

      const notebookDocument = await notebookApi.get(row.localId).catch(() => null);
      if (notebookDocument) {
        haptics.light();
        navigateToNotebook(
          appendCurrentPortalStackWithOrigin(
            route.name,
            route.params,
            {
              documentId: row.localId,
            },
            resourceOrigin,
          ),
        );
        return;
      }

      setPreviewOrigin(resourceOrigin);
      setPreviewItem(
        fileListItemFromShared({
          kind: 'document',
          localId: row.localId,
          name: row.name,
          fileType: ft,
        }),
      );
      setPreviewVisible(true);
      haptics.light();
    },
    [
      loadFolderBreadcrumb,
      loadSourceSets,
      resourceOrigin,
      route.name,
      route.params,
      toast,
      t.resourceSharedFolderHint,
    ],
  );

  // ── Filtered & sorted files ────────────────────────────────────────

  const treeMode = sourceSetId !== null && viewMode === 'list' && !searchText.trim();

  const treeRows = useMemo(() => {
    if (!treeMode) return [];

    const rows: ResourceTreeRow[] = [];

    const walk = (parentId: string | null, depth: number) => {
      const treeKey = parentId ?? ROOT_TREE_KEY;
      const children = sortFileList(treeChildrenByParent[treeKey] ?? [], sorter, sortOrder, locale);

      for (const child of children) {
        const includeRow = isFolder(child) || matchesCategory(child, category);
        if (includeRow) {
          rows.push({ depth, item: child });
        }

        if (isFolder(child) && treeExpandedIds.has(child.id)) {
          walk(child.id, depth + 1);
        }
      }
    };

    walk(null, 0);
    return rows;
  }, [category, locale, sortOrder, sorter, treeChildrenByParent, treeExpandedIds, treeMode]);

  const filtered = sortFileList(
    files.filter((f) => matchesCategory(f, category)),
    sorter,
    sortOrder,
    locale,
  );
  const hasResolvedTreeRoot =
    treeMode && Object.prototype.hasOwnProperty.call(treeChildrenByParent, ROOT_TREE_KEY);
  const showInitialSkeleton = loading && !hasResolvedFiles && !hasResolvedTreeRoot;

  const listExtraData = useMemo(
    () => ({
      cachedResourceIds,
      cachedResourceMap,
      currentFolderId,
      selectedIds,
      selectMode,
      treeExpandedIds,
      visibleIds,
    }),
    [
      cachedResourceIds,
      cachedResourceMap,
      currentFolderId,
      selectedIds,
      selectMode,
      treeExpandedIds,
      visibleIds,
    ],
  );

  /** Disclosure only: expand/collapse without changing the current-folder context. */
  const handleTreeChevronPress = useCallback(
    async (item: FileListItem) => {
      if (!isFolder(item)) return;
      const isExpanded = treeExpandedIds.has(item.id);
      if (isExpanded) {
        setTreeExpandedIds((prev) => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
        return;
      }
      setTreeExpandedIds((prev) => {
        const next = new Set(prev);
        next.add(item.id);
        return next;
      });
      await loadTreeChildren(item.id);
    },
    [loadTreeChildren, treeExpandedIds],
  );

  /** Row tap: move into folder for listing/upload; expand when collapsed. */
  const handleTreeFolderRowPress = useCallback(
    async (item: FileListItem) => {
      if (!isFolder(item)) return;
      setCurrentFolderId(item.id);
      setCurrentFolderSlug(item.slug ?? item.id);
      if (!treeExpandedIds.has(item.id)) {
        setTreeExpandedIds((prev) => {
          const next = new Set(prev);
          next.add(item.id);
          return next;
        });
        await loadTreeChildren(item.id);
      }
    },
    [loadTreeChildren, treeExpandedIds],
  );

  const handleExpandAllTree = useCallback(async () => {
    if (!sourceSetId) return;

    const nextChildren: Record<string, FileListItem[]> = {};
    const expandedIds = new Set<string>();
    const queue: Array<string | null> = [null];

    while (queue.length > 0) {
      const parentId = queue.shift() ?? null;
      const treeKey = parentId ?? ROOT_TREE_KEY;

      let children = treeChildrenByParent[treeKey];
      if (!children) {
        const result = await resourceApi.getKnowledgeItems({
          ...normalizedGovernanceFilters,
          sourceSetId,
          limit: 200,
          offset: 0,
          parentId,
          ...(sourceSetSpaceId ? { spaceId: sourceSetSpaceId } : {}),
        });
        children = sortFileList(result?.items ?? [], sorter, sortOrder, locale);
      }

      nextChildren[treeKey] = children;

      for (const child of children) {
        if (!isFolder(child)) continue;
        expandedIds.add(child.id);
        queue.push(child.id);
      }
    }

    setTreeChildrenByParent((prev) => ({ ...prev, ...nextChildren }));
    setTreeExpandedIds(expandedIds);
  }, [
    normalizedGovernanceFilters,
    sourceSetId,
    sourceSetSpaceId,
    locale,
    sortOrder,
    sorter,
    treeChildrenByParent,
  ]);

  const handleCollapseAllTree = useCallback(() => {
    setTreeExpandedIds(new Set());
    setCurrentFolderId(null);
    setCurrentFolderSlug(null);
  }, []);

  const handleLoadMore = useCallback(() => {
    if (!hasMore || loadingMore) return;
    void loadFiles(true, true);
  }, [hasMore, loadingMore, loadFiles]);

  const getSortLabel = () => {
    if (sorter === 'createdAt')
      return sortOrder === 'desc' ? t.resourceSortNewest : t.resourceSortOldest;
    if (sorter === 'name') return `${t.resourceSortName} ${sortOrder === 'asc' ? 'A-Z' : 'Z-A'}`;
    return `${t.resourceSortSize} ${sortOrder === 'asc' ? '↑' : '↓'}`;
  };
  const previousPortalTarget = getPreviousPortalTarget(route.params?.portalStack);
  const resourceOriginActionLabel = resourceOrigin?.threadId
    ? t.threadOpen
    : t.chatOpenConversation;

  const handlePortalBack = useCallback(() => {
    navigateBackFromPortal({
      conversationOrigin: resourceOrigin,
      navigation,
      portalStack: route.params?.portalStack,
    });
  }, [navigation, resourceOrigin, route.params?.portalStack]);

  const toggleSearch = () => {
    setSearchVisible((value) => {
      const next = !value;
      if (!next) setSearchText('');
      return next;
    });
  };

  const handleEnterSelectMode = useCallback((item: FileListItem) => {
    setSelectMode(true);
    setSelectedIds(new Set([item.id]));
  }, []);

  // ── Tabs ──────────────────────────────────────────────────────────

  const TABS: { key: FileCategory; label: string }[] = [
    { key: 'all', label: t.resourceTabAll },
    { key: 'images', label: t.resourceTabImages },
    { key: 'documents', label: t.resourceTabDocuments },
    { key: 'others', label: t.resourceTabOthers },
  ];

  // ── Render ────────────────────────────────────────────────────────

  return (
    <PortalScaffold
      active={route.name === 'PortalResources'}
      headerLevel="root"
      portalCurrentLabel={previewItem?.name || t.resourceTitle}
      portalRouteName={route.name}
      portalRouteParams={route.params}
      headerChildren={
        <>
          {/* Source-set selector */}
          <TouchableOpacity
            activeOpacity={0.7}
            className="mx-6 mb-2 flex-row items-center rounded-xl px-3.5 py-2.5"
            style={{
              backgroundColor: colors.fillQuaternary,
              borderColor: colors.borderSubtle,
              borderWidth: 1,
            }}
            onPress={() => setSourceSetSelectVisible(true)}
          >
            <FolderOpen color={colors.primary} size={18} strokeWidth={tokens.icon.strokeWidth} />
            <Text
              className="ml-2.5 flex-1 text-[14px] font-medium text-foreground"
              numberOfLines={1}
            >
              {currentSourceSetName}
            </Text>
            <ChevronRight color={colors.muted} size={18} strokeWidth={tokens.icon.strokeWidth} />
          </TouchableOpacity>

          {/* Breadcrumb when in folder */}
          {folderBreadcrumb.length > 0 && (
            <ScrollView
              horizontal
              className="mx-6 mb-2"
              contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              showsHorizontalScrollIndicator={false}
            >
              <TouchableOpacity
                activeOpacity={0.7}
                className="flex-row items-center rounded-full px-3 py-1.5"
                style={{ backgroundColor: colors.fillTertiary }}
                onPress={handleBackToRoot}
              >
                <ArrowLeft color={colors.primary} size={14} strokeWidth={tokens.icon.strokeWidth} />
                <Text className="ml-1 text-[12px] font-medium" style={{ color: colors.primary }}>
                  {sourceSetId ? t.resourceFolderRoot : t.resourceSourceSetUnassigned}
                </Text>
              </TouchableOpacity>
              {folderBreadcrumb.map((crumb, index) => (
                <TouchableOpacity
                  activeOpacity={0.7}
                  className="flex-row items-center rounded-full px-3 py-1.5"
                  key={crumb.id}
                  style={{
                    backgroundColor:
                      index === folderBreadcrumb.length - 1 ? colors.primary : colors.fillTertiary,
                  }}
                  onPress={() => handleBreadcrumbPress(crumb, index)}
                >
                  <Text
                    className="text-[12px] font-medium"
                    numberOfLines={1}
                    style={{
                      color:
                        index === folderBreadcrumb.length - 1 ? colors.iconOnPrimary : colors.muted,
                      maxWidth: 80,
                    }}
                  >
                    {crumb.name}
                  </Text>
                  {index < folderBreadcrumb.length - 1 && (
                    <ChevronRight
                      color={colors.muted}
                      size={14}
                      strokeWidth={tokens.icon.strokeWidth}
                      style={{ marginLeft: 4 }}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {sourceSetId && treeMode ? (
            <View className="mx-6 mb-2 rounded-2xl border border-border bg-card px-3 py-3">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <FolderOpen
                    color={colors.primary}
                    size={16}
                    strokeWidth={tokens.icon.strokeWidth}
                  />
                  <Text className="ml-2 text-[13px] font-semibold text-foreground">
                    {t.resourceExplorer}
                  </Text>
                </View>
                <View className="flex-row items-center" style={{ gap: 6 }}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    className="rounded-full px-3 py-1.5"
                    style={{ backgroundColor: colors.fillTertiary }}
                    onPress={() => void handleExpandAllTree()}
                  >
                    <Text className="text-[11px] font-semibold" style={{ color: colors.primary }}>
                      {t.resourceExpandAll}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    className="rounded-full px-3 py-1.5"
                    style={{ backgroundColor: colors.fillTertiary }}
                    onPress={handleCollapseAllTree}
                  >
                    <Text
                      className="text-[11px] font-semibold"
                      style={{ color: colors.secondaryText }}
                    >
                      {t.resourceCollapseAll}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              {currentFolderId && folderBreadcrumb.length > 0 ? (
                <Text
                  className="mt-2 text-[11px] font-medium"
                  style={{ color: colors.secondaryText }}
                >
                  {t.resourceCurrentFolder}:{' '}
                  {folderBreadcrumb.map((crumb) => crumb.name).join(' / ')}
                </Text>
              ) : null}
            </View>
          ) : null}

          {searchVisible ? (
            <SearchField
              accessibilityLabel={t.search}
              containerClassName="mx-6 mb-2"
              placeholder={t.search}
              ref={searchRef}
              returnKeyType="search"
              size="compact"
              value={searchText}
              rightElement={
                <TouchableOpacity
                  hitSlop={8}
                  onPress={() => {
                    if (searchText.length > 0) {
                      setSearchText('');
                      return;
                    }

                    setSearchVisible(false);
                  }}
                >
                  <X
                    color={colors.muted}
                    size={tokens.icon.size.sm}
                    strokeWidth={tokens.icon.strokeWidth}
                  />
                </TouchableOpacity>
              }
              onChangeText={setSearchText}
              onSubmitEditing={() => loadFiles()}
            />
          ) : null}

          {/* Filter tabs + sort */}
          <View className="mx-6 mb-2">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingRight: 12,
              }}
            >
              {TABS.map((tab) => {
                const active = category === tab.key;
                return (
                  <FilterChip
                    active={active}
                    key={tab.key}
                    label={tab.label}
                    onPress={() => {
                      haptics.selection();
                      setCategory(tab.key);
                    }}
                  />
                );
              })}
              <FilterChip
                active={activeGovernanceFilterCount > 0}
                count={activeGovernanceFilterCount > 0 ? activeGovernanceFilterCount : undefined}
                label={t.resourceGovernanceFilters}
                icon={
                  <Settings2
                    color={activeGovernanceFilterCount > 0 ? colors.primary : colors.muted}
                    size={tokens.icon.size.sm}
                    strokeWidth={tokens.icon.strokeWidth}
                  />
                }
                onPress={openGovernanceSheet}
              />
              <FilterChip
                label={getSortLabel()}
                icon={
                  <ArrowDownUp
                    color={colors.primary}
                    size={tokens.icon.size.sm}
                    strokeWidth={tokens.icon.strokeWidth}
                  />
                }
                onPress={() => setSortMenuVisible(true)}
              />
            </ScrollView>
            {hasGovernanceWorkbench ? (
              <TouchableOpacity
                activeOpacity={0.82}
                className="mt-3 rounded-2xl border px-4 py-3"
                style={{
                  backgroundColor: colors.fillQuaternary,
                  borderColor: colors.borderSubtle,
                }}
                onPress={openGovernanceSheet}
              >
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1 min-w-0">
                    <Text
                      className="text-[11px] font-semibold uppercase tracking-[1.2px]"
                      style={{ color: colors.secondaryText }}
                    >
                      {t.resourceGovernanceFilters}
                    </Text>
                    <Text
                      className="mt-1 text-[14px] font-semibold"
                      style={{ color: colors.foreground }}
                    >
                      {activeGovernanceFilterCount > 0
                        ? governanceWorkbenchSummary
                        : t.resourceGovernanceFiltersSubtitle}
                    </Text>
                    {governanceCapabilityHint && activeGovernanceFilterCount === 0 ? (
                      <Text
                        className="mt-1 text-[12px] leading-5"
                        style={{ color: colors.secondaryText }}
                      >
                        {governanceCapabilityHint}
                      </Text>
                    ) : null}
                  </View>
                  <View className="items-end">
                    <View
                      className="rounded-full px-2.5 py-1"
                      style={{
                        backgroundColor:
                          activeGovernanceFilterCount > 0
                            ? colors.primaryMuted
                            : colors.fillTertiary,
                      }}
                    >
                      <Text
                        className="text-[11px] font-semibold"
                        style={{
                          color:
                            activeGovernanceFilterCount > 0 ? colors.primary : colors.secondaryText,
                        }}
                      >
                        {activeGovernanceFilterCount > 0
                          ? String(activeGovernanceFilterCount)
                          : t.resourceGovernanceApply}
                      </Text>
                    </View>
                    <ChevronRight
                      color={colors.muted}
                      size={16}
                      strokeWidth={tokens.icon.strokeWidth}
                      style={{ marginTop: 10 }}
                    />
                  </View>
                </View>
                {governanceFilterSummaryLabels.length > 0 ? (
                  <View className="mt-3 flex-row flex-wrap" style={{ gap: 6 }}>
                    {governanceFilterSummaryLabels.map((label) => (
                      <MetaTag key={label} label={label} tone="accent" />
                    ))}
                  </View>
                ) : null}
              </TouchableOpacity>
            ) : null}
          </View>
        </>
      }
      leftElement={
        previousPortalTarget ? (
          <ArrowLeft color={colors.primary} size={20} strokeWidth={tokens.icon.strokeWidth} />
        ) : undefined
      }
      rightActions={
        selectMode ? (
          <TouchableOpacity
            hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
            onPress={clearSelection}
          >
            <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '500' }}>
              {t.resourceCancelSelect}
            </Text>
          </TouchableOpacity>
        ) : (
          <View className="flex-row items-center" style={{ gap: 6 }}>
            {resourceOrigin?.sessionId ? (
              <HeaderIconButton
                accessibilityLabel={resourceOriginActionLabel}
                onPress={() => navigateToConversationOrigin(resourceOrigin)}
              >
                {resourceOrigin.threadId ? (
                  <GitBranch
                    color={colors.primary}
                    size={20}
                    strokeWidth={tokens.icon.strokeWidth}
                  />
                ) : (
                  <MessageCircle
                    color={colors.primary}
                    size={20}
                    strokeWidth={tokens.icon.strokeWidth}
                  />
                )}
              </HeaderIconButton>
            ) : null}
            <HeaderIconButton
              accessibilityLabel={t.search}
              active={searchVisible}
              onPress={toggleSearch}
            >
              {searchVisible ? (
                <X color={colors.primary} size={20} strokeWidth={tokens.icon.strokeWidth} />
              ) : (
                <Search color={colors.primary} size={20} strokeWidth={tokens.icon.strokeWidth} />
              )}
            </HeaderIconButton>
            <HeaderIconButton
              accessibilityLabel={t.resourceSharedWithMe}
              onPress={() => setSharedWithMeVisible(true)}
            >
              <Link2 color={colors.primary} size={20} strokeWidth={tokens.icon.strokeWidth} />
            </HeaderIconButton>
            {sourceSetId ? (
              <HeaderIconButton
                accessibilityLabel={t.resourceShareSourceSetMenuTitle}
                onPress={() => setSourceSetSharingMenuVisible(true)}
              >
                <MoreVertical
                  color={colors.primary}
                  size={20}
                  strokeWidth={tokens.icon.strokeWidth}
                />
              </HeaderIconButton>
            ) : null}
            <HeaderIconButton
              accessibilityLabel={t.resourceTrash}
              onPress={() => setTrashModalVisible(true)}
            >
              <Trash2 color={colors.primary} size={20} strokeWidth={tokens.icon.strokeWidth} />
            </HeaderIconButton>
            <HeaderIconButton onPress={() => setViewMode((m) => (m === 'list' ? 'grid' : 'list'))}>
              {viewMode === 'list' ? (
                <Grid3X3 color={colors.primary} size={20} strokeWidth={tokens.icon.strokeWidth} />
              ) : (
                <List color={colors.primary} size={20} strokeWidth={tokens.icon.strokeWidth} />
              )}
            </HeaderIconButton>
          </View>
        )
      }
      title={
        selectMode
          ? t.resourceSelectCount.replace('{count}', String(selectedIds.size))
          : t.resourceTitle
      }
      onDismiss={route.name === 'PortalResources' ? handlePortalBack : undefined}
      onPressLeft={previousPortalTarget ? handlePortalBack : undefined}
    >
      {/* Batch action bar */}
      {selectMode && selectedIds.size > 0 && (
        <View
          className="mx-4 mb-3 rounded-[24px] border px-4 py-3"
          style={{
            backgroundColor: colors.card,
            borderColor: colors.borderSubtle,
            marginTop: 4,
            paddingBottom: insets.bottom + 8,
          }}
        >
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text
                className="text-[11px] font-semibold uppercase tracking-[1.2px]"
                style={{ color: colors.secondaryText }}
              >
                {t.resourceTitle}
              </Text>
              <Text className="mt-1 text-[16px] font-semibold" style={{ color: colors.foreground }}>
                {selectionSummaryLabel}
              </Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              className="h-9 w-9 items-center justify-center rounded-full"
              style={{ backgroundColor: colors.fillTertiary }}
              onPress={() => {
                setSelectMode(false);
                setSelectedIds(new Set());
              }}
            >
              <X color={colors.secondaryText} size={18} strokeWidth={tokens.icon.strokeWidth} />
            </TouchableOpacity>
          </View>

          <View className="mt-3 flex-row flex-wrap" style={{ gap: 8 }}>
            <TouchableOpacity
              activeOpacity={0.78}
              className="flex-row items-center rounded-full px-3 py-2"
              style={{ backgroundColor: `${colors.danger}12` }}
              onPress={handleBatchDelete}
            >
              <Trash2 color={colors.danger} size={15} strokeWidth={tokens.icon.strokeWidth} />
              <Text className="ml-2 text-[13px] font-semibold" style={{ color: colors.danger }}>
                {t.resourceBatchDelete}
              </Text>
            </TouchableOpacity>
            {sourceSetId ? (
              <TouchableOpacity
                activeOpacity={0.78}
                className="flex-row items-center rounded-full px-3 py-2"
                style={{ backgroundColor: colors.primaryMuted }}
                onPress={handleBatchMove}
              >
                <Folder color={colors.primary} size={15} strokeWidth={tokens.icon.strokeWidth} />
                <Text className="ml-2 text-[13px] font-semibold" style={{ color: colors.primary }}>
                  {t.resourceBatchMove}
                </Text>
              </TouchableOpacity>
            ) : null}
            {!selectedHasSourceSetUnsupportedItems &&
            sourceSetId &&
            availableTargetSourceSets.length > 0 &&
            selectedSourceSetEligibleIds.length > 0 ? (
              <TouchableOpacity
                activeOpacity={0.78}
                className="flex-row items-center rounded-full px-3 py-2"
                style={{ backgroundColor: colors.primaryMuted }}
                onPress={() => openSourceSetAction(selectedSourceSetEligibleIds, 'move')}
              >
                <FolderOpen
                  color={colors.primary}
                  size={15}
                  strokeWidth={tokens.icon.strokeWidth}
                />
                <Text className="ml-2 text-[13px] font-semibold" style={{ color: colors.primary }}>
                  {t.resourceMoveToSourceSet}
                </Text>
              </TouchableOpacity>
            ) : null}
            {!selectedHasSourceSetUnsupportedItems &&
            sourceSetId &&
            selectedSourceSetEligibleIds.length > 0 ? (
              <TouchableOpacity
                activeOpacity={0.78}
                className="flex-row items-center rounded-full px-3 py-2"
                style={{ backgroundColor: `${colors.danger}12` }}
                onPress={() => handleRemoveFromSourceSet(selectedSourceSetEligibleIds)}
              >
                <FolderOpen color={colors.danger} size={15} strokeWidth={tokens.icon.strokeWidth} />
                <Text className="ml-2 text-[13px] font-semibold" style={{ color: colors.danger }}>
                  {t.resourceRemoveFromSourceSet}
                </Text>
              </TouchableOpacity>
            ) : null}
            {!selectedHasSourceSetUnsupportedItems &&
            !sourceSetId &&
            sourceSets.length > 0 &&
            selectedSourceSetEligibleIds.length > 0 ? (
              <TouchableOpacity
                activeOpacity={0.78}
                className="flex-row items-center rounded-full px-3 py-2"
                style={{ backgroundColor: colors.primaryMuted }}
                onPress={() => openSourceSetAction(selectedSourceSetEligibleIds, 'add')}
              >
                <FolderOpen
                  color={colors.primary}
                  size={15}
                  strokeWidth={tokens.icon.strokeWidth}
                />
                <Text className="ml-2 text-[13px] font-semibold" style={{ color: colors.primary }}>
                  {t.resourceAddToSourceSet}
                </Text>
              </TouchableOpacity>
            ) : null}
            {selectedIds.size === 1 ? (
              <TouchableOpacity
                activeOpacity={0.78}
                className="flex-row items-center rounded-full px-3 py-2"
                style={{ backgroundColor: colors.primaryMuted }}
                onPress={handleBatchShareLink}
              >
                <Link2 color={colors.primary} size={15} strokeWidth={tokens.icon.strokeWidth} />
                <Text className="ml-2 text-[13px] font-semibold" style={{ color: colors.primary }}>
                  {t.resourceBatchShareLink}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      )}

      {/* Content */}
      {showInitialSkeleton ? (
        <FileGridSkeleton />
      ) : (
        <FlatList<ResourceListRow>
          data={treeMode ? treeRows : filtered}
          extraData={listExtraData}
          key={treeMode ? 'tree' : viewMode}
          keyExtractor={(item) => (isResourceTreeRow(item) ? item.item.id : item.id)}
          numColumns={!treeMode && viewMode === 'grid' ? 3 : 1}
          viewabilityConfig={treeMode ? undefined : viewabilityConfig}
          ItemSeparatorComponent={
            !treeMode && viewMode === 'list' ? ResourceListRowSeparator : undefined
          }
          ListEmptyComponent={
            <EmptyState
              iconVariant="resource"
              title={currentFolderId || currentFolderSlug ? t.resourceFolderEmpty : t.resourceEmpty}
              action={
                <View className="flex-row flex-wrap justify-center gap-3 mt-2">
                  <TouchableOpacity
                    activeOpacity={0.7}
                    className="flex-row items-center rounded-2xl px-5 py-3"
                    style={{ backgroundColor: colors.primary }}
                    onPress={handleUpload}
                  >
                    <Plus color={colors.iconOnPrimary} size={18} strokeWidth={2.5} />
                    <Text
                      className="ml-2 text-[15px] font-semibold"
                      style={{ color: colors.iconOnPrimary }}
                    >
                      {t.resourceUpload}
                    </Text>
                  </TouchableOpacity>
                  {sourceSetId && (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      className="flex-row items-center rounded-2xl px-5 py-3"
                      style={{
                        backgroundColor: colors.primarySubtle,
                        borderColor: colors.primaryBorder,
                        borderWidth: 1,
                      }}
                      onPress={() => setCreateFolderVisible(true)}
                    >
                      <Folder
                        color={colors.primary}
                        size={18}
                        strokeWidth={tokens.icon.strokeWidth}
                      />
                      <Text
                        className="ml-2 text-[15px] font-semibold"
                        style={{ color: colors.primary }}
                      >
                        {t.resourceNewFolder}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              }
              description={
                currentFolderId || currentFolderSlug
                  ? t.resourceFolderEmptyDesc
                  : t.resourceEmptyDesc
              }
            />
          }
          ListFooterComponent={
            !treeMode && hasMore ? (
              <TouchableOpacity
                activeOpacity={0.7}
                className="items-center justify-center py-4"
                disabled={loadingMore}
                onPress={handleLoadMore}
              >
                {loadingMore ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                  <Text style={{ color: colors.primary }}>{t.resourceLoadMore}</Text>
                )}
              </TouchableOpacity>
            ) : null
          }
          columnWrapperStyle={
            !treeMode && viewMode === 'grid'
              ? { justifyContent: 'space-between', paddingHorizontal: 12 }
              : undefined
          }
          contentContainerStyle={
            (treeMode ? treeRows.length === 0 : filtered.length === 0)
              ? {
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingBottom: scrollListPaddingBottom,
                }
              : { paddingBottom: scrollListPaddingBottom }
          }
          refreshControl={
            <RefreshControl
              colors={[colors.primary]}
              refreshing={refreshing}
              tintColor={colors.primary}
              onRefresh={onRefresh}
            />
          }
          renderItem={({ item }) =>
            isResourceTreeRow(item) ? (
              (() => {
                const row = item;
                const entry = row.item;
                const entryIsFolder = isFolder(entry);
                const isExpanded = treeExpandedIds.has(entry.id);
                const isLoadingChildren = treeLoadingIds.has(entry.id);
                const isFocusedFolder = currentFolderId === entry.id;
                const isCached = cachedResourceIds.has(entry.id);

                return (
                  <TouchableOpacity
                    activeOpacity={0.72}
                    className="px-4 py-2"
                    onLongPress={() => {
                      haptics.medium();
                      if (selectMode) {
                        toggleSelect(entry);
                      } else {
                        handleEnterSelectMode(entry);
                      }
                    }}
                    onPress={() => {
                      if (selectMode) {
                        toggleSelect(entry);
                        return;
                      }

                      if (entryIsFolder) {
                        void handleTreeFolderRowPress(entry);
                        return;
                      }

                      handlePreview(entry);
                    }}
                  >
                    <View
                      className="flex-row items-center rounded-2xl px-3 py-2.5"
                      style={{
                        backgroundColor: isFocusedFolder ? colors.fillTertiary : 'transparent',
                        marginLeft: row.depth * 16,
                      }}
                    >
                      <View className="mr-2 h-6 w-6 items-center justify-center">
                        {entryIsFolder ? (
                          isLoadingChildren ? (
                            <ActivityIndicator color={colors.primary} size="small" />
                          ) : (
                            <TouchableOpacity
                              activeOpacity={0.7}
                              className="h-6 w-6 items-center justify-center"
                              hitSlop={8}
                              onPress={() => void handleTreeChevronPress(entry)}
                            >
                              {isExpanded ? (
                                <ChevronDown color={colors.primary} size={16} strokeWidth={2.2} />
                              ) : (
                                <ChevronRight color={colors.primary} size={16} strokeWidth={2.2} />
                              )}
                            </TouchableOpacity>
                          )
                        ) : null}
                      </View>

                      <View className="mr-3 h-11 w-11 items-center justify-center rounded-xl bg-foreground/5 overflow-hidden">
                        {selectMode ? (
                          <View className="absolute -right-1 -top-1 z-10">
                            <SelectionBadge selected={selectedIds.has(entry.id)} />
                          </View>
                        ) : null}
                        <ResourceThumbnail
                          apiBaseUrl={apiBase}
                          cachedLocalUri={cachedResourceMap[entry.id]?.localUri}
                          item={entry}
                          remoteHeaders={resourceAuthHeaders}
                          roundedClassName="rounded-xl"
                          onInvalidateCache={invalidateCachedResource}
                        />
                        {isCached && !entryIsFolder ? (
                          <View
                            className="absolute -bottom-1 -right-1 rounded-full px-1.5 py-0.5"
                            style={{ backgroundColor: colors.successSubtle }}
                          >
                            <Check color={colors.success} size={10} strokeWidth={2.6} />
                          </View>
                        ) : null}
                      </View>

                      <View className="min-w-0 flex-1">
                        <Text className="text-[14px] font-medium text-foreground" numberOfLines={1}>
                          {entry.name}
                        </Text>
                        <Text
                          className="mt-0.5 text-[11px]"
                          numberOfLines={1}
                          style={{ color: colors.secondaryText }}
                        >
                          {entryIsFolder
                            ? formatDate(entry.createdAt)
                            : `${formatBytes(entry.size)}  ·  ${formatDate(entry.createdAt)}`}
                        </Text>
                        <ResourceGovernanceBadges item={entry} maxVisible={2} />
                      </View>
                      {!selectMode ? (
                        <TouchableOpacity
                          accessibilityRole="button"
                          className="h-8 w-8 items-center justify-center rounded-full"
                          hitSlop={8}
                          onPress={(event) => {
                            event.stopPropagation();
                            setActionItem(entry);
                          }}
                        >
                          <Pencil
                            color={colors.secondaryText}
                            size={16}
                            strokeWidth={tokens.icon.strokeWidth}
                          />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })()
            ) : viewMode === 'grid' ? (
              <TouchableOpacity
                activeOpacity={0.7}
                className="flex-1 m-1 items-center rounded-xl bg-foreground/5 p-3"
                style={viewMode === 'grid' ? { minWidth: 0 } : undefined}
                onLongPress={() => (selectMode ? toggleSelect(item) : handleEnterSelectMode(item))}
                onPress={() => {
                  if (selectMode) {
                    toggleSelect(item);
                    return;
                  }
                  if (isFolder(item)) {
                    handleFolderPressResolved(item);
                    return;
                  }
                  handlePreview(item);
                }}
              >
                <View className="h-14 w-14 items-center justify-center">
                  <View className="h-14 w-14 items-center justify-center rounded-lg bg-foreground/5 overflow-hidden">
                    {selectMode ? (
                      <View className="absolute -right-1 -top-1 z-10">
                        <SelectionBadge selected={selectedIds.has(item.id)} />
                      </View>
                    ) : null}
                    <ResourceThumbnail
                      isVisible
                      apiBaseUrl={apiBase}
                      cachedLocalUri={cachedResourceMap[item.id]?.localUri}
                      item={item}
                      remoteHeaders={resourceAuthHeaders}
                      roundedClassName="rounded-lg"
                      size={56}
                      onInvalidateCache={invalidateCachedResource}
                    />
                    {cachedResourceIds.has(item.id) && !isFolder(item) ? (
                      <View
                        className="absolute -bottom-1 -right-1 rounded-full px-1.5 py-0.5"
                        style={{ backgroundColor: colors.successSubtle }}
                      >
                        <Check color={colors.success} size={10} strokeWidth={2.6} />
                      </View>
                    ) : null}
                  </View>
                </View>
                {!selectMode ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    className="absolute right-2 top-2 z-10 h-7 w-7 items-center justify-center rounded-full"
                    style={{ backgroundColor: colors.overlay }}
                    onPress={(event) => {
                      event.stopPropagation();
                      setActionItem(item);
                    }}
                  >
                    <Pencil
                      color={colors.secondaryText}
                      size={14}
                      strokeWidth={tokens.icon.strokeWidth}
                    />
                  </TouchableOpacity>
                ) : null}
                <Text className="mt-1 text-center text-[11px] text-foreground" numberOfLines={2}>
                  {item.name}
                </Text>
                <Text
                  className="mt-0.5 text-center text-[10px]"
                  numberOfLines={1}
                  style={{ color: colors.secondaryText }}
                >
                  {isFolder(item) ? formatDate(item.createdAt) : formatBytes(item.size)}
                </Text>
                <View className="items-center">
                  <ResourceGovernanceBadges item={item} maxVisible={2} />
                </View>
              </TouchableOpacity>
            ) : (
              <FileRow
                apiBaseUrl={apiBase}
                cachedLocalUri={cachedResourceMap[item.id]?.localUri}
                isCached={cachedResourceIds.has(item.id)}
                isSelected={selectedIds.has(item.id)}
                isVisible={visibleIds.size === 0 || visibleIds.has(item.id)}
                item={item}
                remoteHeaders={resourceAuthHeaders}
                selectMode={selectMode}
                showFolderActions={!!sourceSetId}
                onDelete={handleDelete}
                onFolderPress={handleFolderPressResolved}
                onInvalidateCache={invalidateCachedResource}
                onLongPressItem={handleEnterSelectMode}
                onOpenActions={setActionItem}
                onPress={handlePreview}
                onSelect={selectMode ? toggleSelect : undefined}
                onMoveToFolder={
                  sourceSetId
                    ? (i) => {
                        setMoveToFolderItem(i);
                        setBatchMoveIds(new Set());
                        setMoveFolderStack([null]);
                      }
                    : undefined
                }
              />
            )
          }
          onEndReached={!treeMode && hasMore && !loadingMore ? handleLoadMore : undefined}
          onEndReachedThreshold={0.3}
          onViewableItemsChanged={treeMode ? undefined : onViewableItemsChanged}
        />
      )}

      {/* Upload FAB — hidden in select mode to avoid confusion */}
      {!selectMode && (
        <View
          className="absolute bottom-0 right-0"
          style={{ paddingBottom: insets.bottom + 12, paddingRight: 20 }}
        >
          <TouchableOpacity
            activeOpacity={0.8}
            className="items-center justify-center rounded-full shadow-lg"
            style={{ width: 56, height: 56, elevation: 6, backgroundColor: colors.primary }}
            onPress={uploading ? undefined : handleUpload}
          >
            {uploading ? (
              <View className="items-center">
                <ActivityIndicator color={colors.iconOnPrimary} size="small" />
                {uploadProgress > 0 && (
                  <Text
                    className="text-[9px] font-medium mt-0.5"
                    style={{ color: colors.iconOnPrimary }}
                  >
                    {uploadProgress}%
                  </Text>
                )}
              </View>
            ) : (
              <Plus color={colors.iconOnPrimary} size={26} strokeWidth={2.5} />
            )}
          </TouchableOpacity>
        </View>
      )}

      <AttachmentSheet
        visible={attachmentSheetVisible}
        onClose={() => setAttachmentSheetVisible(false)}
        onDocument={() => void handlePickFile()}
        onGallery={() => void handlePickPhoto()}
        onNewFolder={
          sourceSetId
            ? () => {
                setAttachmentSheetVisible(false);
                setCreateFolderVisible(true);
              }
            : undefined
        }
      />

      <BottomSheetScaffold
        description={t.resourceGovernanceFiltersSubtitle}
        title={t.resourceGovernanceFilters}
        visible={governanceSheetVisible}
        headerRight={
          activeGovernanceFilterCount > 0 || countActiveGovernanceFilters(governanceDraft) > 0 ? (
            <TouchableOpacity activeOpacity={0.72} onPress={clearGovernanceDraft}>
              <Text className="text-[14px] font-semibold" style={{ color: colors.primary }}>
                {t.resourceGovernanceClear}
              </Text>
            </TouchableOpacity>
          ) : undefined
        }
        onClose={() => setGovernanceSheetVisible(false)}
      >
        <View className="px-5 pb-2">
          {governanceCapabilityHint ? (
            <View
              className="mb-4 rounded-2xl border px-3.5 py-3"
              style={{ backgroundColor: colors.fillQuaternary, borderColor: colors.borderSubtle }}
            >
              <Text className="text-[12px]" style={{ color: colors.secondaryText }}>
                {governanceCapabilityHint}
              </Text>
            </View>
          ) : null}
          {[
            {
              key: 'assetReviewStatus',
              label: t.resourceGovernanceSectionReview,
              options: [
                { label: t.resourceGovernanceAny, value: undefined },
                { label: t.resourceGovernanceReviewDraft, value: 'draft' },
                { label: t.resourceGovernanceReviewApproved, value: 'approved' },
                { label: t.resourceGovernanceReviewArchived, value: 'archived' },
              ],
            },
            {
              key: 'assetUsagePolicy',
              label: t.resourceGovernanceSectionUsage,
              options: [
                { label: t.resourceGovernanceAny, value: undefined },
                { label: t.resourceGovernanceUsageInternal, value: 'internal' },
                { label: t.resourceGovernanceUsagePublic, value: 'public' },
                { label: t.resourceGovernanceUsageRestricted, value: 'restricted' },
              ],
            },
            {
              key: 'assetClassification',
              label: t.resourceGovernanceSectionClassification,
              options: [
                { label: t.resourceGovernanceAny, value: undefined },
                { label: t.resourceGovernanceClassificationGeneral, value: 'general' },
                { label: t.resourceGovernanceClassificationBrand, value: 'brand' },
                { label: t.resourceGovernanceClassificationFinance, value: 'finance' },
                { label: t.resourceGovernanceClassificationHr, value: 'hr' },
                { label: t.resourceGovernanceClassificationLegal, value: 'legal' },
                { label: t.resourceGovernanceClassificationProduct, value: 'product' },
              ],
            },
          ].map((section) => (
            <View className="mb-4" key={section.key}>
              <Text
                className="mb-2 text-[13px] font-semibold"
                style={{ color: colors.secondaryText }}
              >
                {section.label}
              </Text>
              <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                {section.options.map((option) => {
                  const selected =
                    governanceDraft[section.key as keyof MobileGovernanceFilterState] ===
                    option.value;

                  return (
                    <FilterChip
                      active={selected}
                      key={`${section.key}:${option.value ?? 'all'}`}
                      label={option.label}
                      onPress={() => {
                        haptics.selection();
                        setGovernanceDraft((prev) => ({
                          ...prev,
                          [section.key]: option.value,
                        }));
                      }}
                    />
                  );
                })}
              </View>
            </View>
          ))}
          <View className="mb-4">
            <Text
              className="mb-2 text-[13px] font-semibold"
              style={{ color: colors.secondaryText }}
            >
              {t.resourceGovernanceSectionRightsOwner}
            </Text>
            <View
              className="rounded-2xl border px-3.5 py-2.5"
              style={{ backgroundColor: colors.fillQuaternary, borderColor: colors.borderSubtle }}
            >
              <TextInput
                autoCapitalize="words"
                className="text-[15px] text-foreground"
                placeholder={t.resourceGovernanceRightsOwnerPlaceholder}
                placeholderTextColor={colors.muted}
                returnKeyType="done"
                value={governanceDraft.assetRightsOwner ?? ''}
                onChangeText={(text) =>
                  setGovernanceDraft((prev) => ({
                    ...prev,
                    assetRightsOwner: text,
                  }))
                }
              />
            </View>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.8}
            className="mt-1 items-center rounded-2xl px-5 py-3.5"
            style={{ backgroundColor: colors.primary }}
            onPress={applyGovernanceFilters}
          >
            <Text className="text-[15px] font-semibold" style={{ color: colors.iconOnPrimary }}>
              {t.resourceGovernanceApply}
            </Text>
          </TouchableOpacity>
        </View>
      </BottomSheetScaffold>

      <FilePreviewModal
        apiBaseUrl={apiBase}
        item={previewItem}
        origin={previewOrigin}
        remoteHeaders={resourceAuthHeaders}
        visible={previewVisible}
        onReplaceItem={replaceResourceItem}
        onCacheReady={(entry) => {
          setCachedResourceIds((prev) => {
            const next = new Set(prev);
            next.add(entry.fileId);
            return next;
          });
          setCachedResourceMap((prev) => ({
            ...prev,
            [entry.fileId]: entry,
          }));
        }}
        onClose={() => {
          setPreviewVisible(false);
          setPreviewOrigin(null);
        }}
      />

      <ResourceShareOptionsSheet
        target={shareTarget}
        visible={!!shareTarget}
        onClose={() => setShareTarget(null)}
        onFail={() => toast.show('error', t.resourceShareFailed)}
        onSuccess={() => haptics.success()}
      />

      <ResourceShareManageSheet
        target={manageShareTarget}
        visible={!!manageShareTarget}
        onActionError={() => toast.show('error', t.resourceShareFailed)}
        onClose={() => setManageShareTarget(null)}
      />

      <SharedWithMeSheet
        visible={sharedWithMeVisible}
        onClose={() => setSharedWithMeVisible(false)}
        onPick={handleSharedWithMePick}
      />

      {/* Recycle bin (soft-deleted documents) */}
      <Modal
        accessibilityViewIsModal
        transparent
        animationType="slide"
        visible={trashModalVisible}
        onRequestClose={() => setTrashModalVisible(false)}
      >
        <Pressable
          className="flex-1 justify-end bg-black/40"
          onPress={() => setTrashModalVisible(false)}
        >
          <Pressable
            className="rounded-t-2xl bg-card overflow-hidden"
            style={{ maxHeight: '82%', paddingBottom: insets.bottom + 12 }}
            onPress={(e: { stopPropagation?: () => void }) => e.stopPropagation?.()}
          >
            <View className="items-center pt-3 pb-2">
              <View className="h-1 w-9 rounded-full bg-foreground/10" />
            </View>
            <View className="flex-row items-center border-b border-foreground/10 px-4 pb-3">
              <TouchableOpacity
                accessibilityRole="button"
                className="h-10 w-10 items-center justify-center rounded-full active:bg-foreground/5"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => setTrashModalVisible(false)}
              >
                <X color={colors.muted} size={22} strokeWidth={tokens.icon.strokeWidth} />
              </TouchableOpacity>
              <Text
                className="flex-1 text-center text-[17px] font-bold text-foreground"
                numberOfLines={1}
              >
                {t.resourceTrashTitle}
              </Text>
              <View className="h-10 w-10" />
            </View>
            {trashLoading ? (
              <View className="items-center justify-center py-16">
                <ActivityIndicator color={colors.primary} size="large" />
              </View>
            ) : trashedDocuments.length === 0 ? (
              <View className="items-center px-6 py-16">
                <Trash2 color={colors.muted} size={40} strokeWidth={1.5} />
                <Text className="mt-4 text-center text-[16px] font-medium text-foreground">
                  {t.resourceTrashEmpty}
                </Text>
              </View>
            ) : (
              <FlatList
                data={trashedDocuments}
                keyExtractor={(row) => row.id}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item: row }) => {
                  const isTrashedFolder = row.fileType === 'custom/folder';
                  const displayName = row.title?.trim() || row.filename?.trim() || 'Untitled';
                  const busy = restoringTrashId === row.id;
                  return (
                    <View className="flex-row items-center border-b border-foreground/5 px-4 py-3.5">
                      {isTrashedFolder ? (
                        <Folder
                          color={colors.muted}
                          size={22}
                          strokeWidth={tokens.icon.strokeWidth}
                        />
                      ) : (
                        <FileText
                          color={colors.muted}
                          size={22}
                          strokeWidth={tokens.icon.strokeWidth}
                        />
                      )}
                      <Text className="ml-3 flex-1 text-[15px] text-foreground" numberOfLines={2}>
                        {displayName}
                      </Text>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        className="ml-2 rounded-xl px-3 py-2"
                        disabled={restoringTrashId !== null}
                        style={{
                          backgroundColor: colors.primarySubtle,
                          opacity: restoringTrashId !== null && !busy ? 0.5 : 1,
                        }}
                        onPress={() => void handleRestoreTrashed(row.id)}
                      >
                        {busy ? (
                          <ActivityIndicator color={colors.primary} size="small" />
                        ) : (
                          <Text
                            className="text-[14px] font-semibold"
                            style={{ color: colors.primary }}
                          >
                            {t.resourceTrashRestore}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                }}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        accessibilityViewIsModal
        transparent
        animationType="slide"
        visible={sourceSetSharingMenuVisible}
        onRequestClose={() => setSourceSetSharingMenuVisible(false)}
      >
        <Pressable
          className="flex-1 justify-end bg-black/40"
          onPress={() => setSourceSetSharingMenuVisible(false)}
        >
          <Pressable
            className="bg-card rounded-t-2xl overflow-hidden"
            style={{ paddingBottom: insets.bottom + 16 }}
            onPress={(e: any) => e.stopPropagation?.()}
          >
            <View className="items-center pt-3 pb-2">
              <View className="w-9 h-1 rounded-full bg-foreground/10" />
            </View>
            <Text className="px-5 text-[16px] font-semibold text-foreground mb-1">
              {t.resourceShareSourceSetMenuTitle}
            </Text>
            <Pressable
              className="flex-row items-center py-3.5 px-5 active:bg-foreground/5"
              onPress={() => {
                setSourceSetSharingMenuVisible(false);
                handleShareSourceSet();
              }}
            >
              <Share2 color={colors.muted} size={18} strokeWidth={tokens.icon.strokeWidth} />
              <Text className="ml-3 text-base text-foreground">{t.resourceShareSourceSet}</Text>
            </Pressable>
            <Pressable
              className="flex-row items-center py-3.5 px-5 active:bg-foreground/5"
              onPress={() => {
                setSourceSetSharingMenuVisible(false);
                openManageSourceSetShare();
              }}
            >
              <Users color={colors.muted} size={18} strokeWidth={tokens.icon.strokeWidth} />
              <Text className="ml-3 text-base text-foreground">{t.resourceShareManage}</Text>
            </Pressable>
            <Pressable
              className="flex-row items-center py-3.5 px-5 active:bg-foreground/5"
              onPress={openRenameSourceSetModal}
            >
              <Pencil color={colors.muted} size={18} strokeWidth={tokens.icon.strokeWidth} />
              <Text className="ml-3 text-base text-foreground">{t.actionRename}</Text>
            </Pressable>
            <Pressable
              className="flex-row items-center py-3.5 px-5 active:bg-foreground/5"
              onPress={() => {
                setSourceSetSharingMenuVisible(false);
                handleDeleteSourceSet();
              }}
            >
              <Trash2 color={colors.danger} size={18} strokeWidth={tokens.icon.strokeWidth} />
              <Text className="ml-3 text-base text-red-500">{t.delete}</Text>
            </Pressable>
            <View className="px-5 mt-1">
              <Pressable
                className="items-center py-3.5 rounded-xl bg-foreground/[0.04]"
                onPress={() => setSourceSetSharingMenuVisible(false)}
              >
                <Text className="text-base font-medium" style={{ color: colors.secondaryText }}>
                  {t.cancel}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Item Action Sheet */}
      <Modal
        accessibilityViewIsModal
        transparent
        animationType="slide"
        visible={!!actionItem}
        onRequestClose={closeActionSheet}
      >
        <Pressable className="flex-1 justify-end bg-black/40" onPress={closeActionSheet}>
          <Pressable
            className="bg-card rounded-t-2xl overflow-hidden"
            style={{ paddingBottom: insets.bottom + 16, maxHeight: '72%' }}
            onPress={(e: any) => e.stopPropagation?.()}
          >
            <View className="items-center pt-3 pb-2">
              <View className="w-9 h-1 rounded-full bg-foreground/10" />
            </View>
            {actionItem ? (
              <View className="px-5">
                {!isFolder(actionItem) ? (
                  <Pressable
                    className="flex-row items-center py-3.5 px-3 rounded-xl active:bg-foreground/5"
                    onPress={() => {
                      haptics.light();
                      handlePreview(actionItem);
                      closeActionSheet();
                    }}
                  >
                    <Eye color={colors.muted} size={18} strokeWidth={tokens.icon.strokeWidth} />
                    <Text className="ml-3 text-base text-foreground">{t.notebookPreview}</Text>
                  </Pressable>
                ) : null}
                {!isFolder(actionItem) &&
                getCanonicalResourceKind(actionItem) === 'file' &&
                isMarkdownFile(actionItem.fileType, actionItem.name) ? (
                  <Pressable
                    className="flex-row items-center py-3.5 px-3 rounded-xl active:bg-foreground/5"
                    onPress={() => void handleConvertActionItemToDocument()}
                  >
                    <FileText
                      color={colors.muted}
                      size={18}
                      strokeWidth={tokens.icon.strokeWidth}
                    />
                    <View className="ml-3 flex-1">
                      <Text className="text-base text-foreground">{t.fileEditAsDocument}</Text>
                      <Text className="mt-0.5 text-[12px]" style={{ color: colors.secondaryText }}>
                        {t.fileEditAsDocumentDesc}
                      </Text>
                    </View>
                  </Pressable>
                ) : null}
                {canMoveAction ? (
                  <Pressable
                    className="flex-row items-center py-3.5 px-3 rounded-xl active:bg-foreground/5"
                    onPress={() => {
                      haptics.light();
                      setMoveToFolderItem(actionItem);
                      setBatchMoveIds(new Set());
                      setMoveFolderStack([null]);
                      closeActionSheet();
                    }}
                  >
                    <Folder color={colors.muted} size={18} strokeWidth={tokens.icon.strokeWidth} />
                    <Text className="ml-3 text-base text-foreground">{t.resourceMoveToFolder}</Text>
                  </Pressable>
                ) : null}
                {!isFolder(actionItem) && sourceSetId && availableTargetSourceSets.length > 0 ? (
                  <Pressable
                    className="flex-row items-center py-3.5 px-3 rounded-xl active:bg-foreground/5"
                    onPress={() => {
                      closeActionSheet();
                      openSourceSetAction([actionItem.id], 'move');
                    }}
                  >
                    <FolderOpen
                      color={colors.muted}
                      size={18}
                      strokeWidth={tokens.icon.strokeWidth}
                    />
                    <Text className="ml-3 text-base text-foreground">
                      {t.resourceMoveToSourceSet}
                    </Text>
                  </Pressable>
                ) : null}
                {!isFolder(actionItem) && sourceSetId ? (
                  <Pressable
                    className="flex-row items-center py-3.5 px-3 rounded-xl active:bg-foreground/5"
                    onPress={() => handleRemoveFromSourceSet([actionItem.id])}
                  >
                    <FolderOpen
                      color={colors.danger}
                      size={18}
                      strokeWidth={tokens.icon.strokeWidth}
                    />
                    <Text className="ml-3 text-base text-red-500">
                      {t.resourceRemoveFromSourceSet}
                    </Text>
                  </Pressable>
                ) : null}
                {!isFolder(actionItem) && !sourceSetId && sourceSets.length > 0 ? (
                  <Pressable
                    className="flex-row items-center py-3.5 px-3 rounded-xl active:bg-foreground/5"
                    onPress={() => {
                      closeActionSheet();
                      openSourceSetAction([actionItem.id], 'add');
                    }}
                  >
                    <FolderOpen
                      color={colors.muted}
                      size={18}
                      strokeWidth={tokens.icon.strokeWidth}
                    />
                    <Text className="ml-3 text-base text-foreground">
                      {t.resourceAddToSourceSet}
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable
                  className="flex-row items-center py-3.5 px-3 rounded-xl active:bg-foreground/5"
                  onPress={handleRenameStart}
                >
                  <Pencil color={colors.muted} size={18} strokeWidth={tokens.icon.strokeWidth} />
                  <Text className="ml-3 text-base text-foreground">{t.actionRename}</Text>
                </Pressable>
                {isChatContextEligibleResource(actionItem) ? (
                  <Pressable
                    className="flex-row items-center py-3.5 px-3 rounded-xl active:bg-foreground/5"
                    onPress={() => void handleAddToChatContext(actionItem)}
                  >
                    <FileText
                      color={colors.muted}
                      size={18}
                      strokeWidth={tokens.icon.strokeWidth}
                    />
                    <View className="ml-3 flex-1">
                      <Text className="text-base text-foreground">{t.fileAddToChatContext}</Text>
                      <Text className="mt-0.5 text-[12px]" style={{ color: colors.secondaryText }}>
                        {t.fileAddToChatContextDesc}
                      </Text>
                    </View>
                  </Pressable>
                ) : null}
                <Pressable
                  className="flex-row items-center py-3.5 px-3 rounded-xl active:bg-foreground/5"
                  onPress={() => handleShareFromActionSheet(actionItem)}
                >
                  <Share2 color={colors.muted} size={18} strokeWidth={tokens.icon.strokeWidth} />
                  <Text className="ml-3 text-base text-foreground">
                    {t.resourceShareCreateLinkAction}
                  </Text>
                </Pressable>
                <Pressable
                  className="flex-row items-center py-3.5 px-3 rounded-xl active:bg-foreground/5"
                  onPress={() => openManageShareFromItem(actionItem)}
                >
                  <Users color={colors.muted} size={18} strokeWidth={tokens.icon.strokeWidth} />
                  <Text className="ml-3 text-base text-foreground">{t.resourceShareManage}</Text>
                </Pressable>
                <Pressable
                  className="flex-row items-center py-3.5 px-3 rounded-xl active:bg-foreground/5"
                  onPress={() => {
                    closeActionSheet();
                    handleDelete(actionItem.id, actionItem.name, isFolder(actionItem));
                  }}
                >
                  <Trash2 color={colors.danger} size={18} strokeWidth={tokens.icon.strokeWidth} />
                  <Text className="ml-3 text-base text-red-500">{t.delete}</Text>
                </Pressable>
              </View>
            ) : null}
            <View className="px-5 mt-2">
              <Pressable
                className="items-center py-3.5 rounded-xl bg-foreground/[0.04]"
                onPress={closeActionSheet}
              >
                <Text className="text-base font-medium" style={{ color: colors.secondaryText }}>
                  {t.cancel}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <PromptModal
        defaultValue={renameValue}
        placeholder={t.resourceRenamePlaceholder}
        submitLabel={t.confirm}
        title={t.actionRename}
        visible={renameModalVisible}
        onCancel={() => setRenameModalVisible(false)}
        onSubmit={handleRenameSubmit}
      />

      <PromptModal
        defaultValue={sourceSetNameDraft}
        placeholder={t.resourceCreateSourceSetPlaceholder}
        submitLabel={t.confirm}
        visible={sourceSetNameModalVisible}
        title={sourceSetNameMode === 'create' ? t.resourceCreateSourceSet : t.actionRename}
        onCancel={() => setSourceSetNameModalVisible(false)}
        onSubmit={handleSubmitSourceSetName}
      />

      <Modal
        accessibilityViewIsModal
        transparent
        animationType="slide"
        visible={sourceSetActionVisible}
        onRequestClose={() => {
          if (sourceSetActionSubmitting) return;
          setSourceSetActionVisible(false);
          setSourceSetActionIds([]);
        }}
      >
        <TouchableOpacity
          activeOpacity={1}
          className="flex-1 justify-end bg-black/40"
          onPress={() => {
            if (sourceSetActionSubmitting) return;
            setSourceSetActionVisible(false);
            setSourceSetActionIds([]);
          }}
        >
          <View
            className="rounded-t-2xl bg-card"
            style={{ paddingBottom: insets.bottom + 16, maxHeight: '60%' }}
          >
            <View className="items-center pt-3 pb-2">
              <View className="w-9 h-1 rounded-full bg-foreground/10" />
            </View>
            <View className="px-5">
              <Text className="text-[18px] font-bold text-foreground">
                {sourceSetActionMode === 'move'
                  ? t.resourceMoveToSourceSet
                  : t.resourceAddToSourceSet}
              </Text>
              <Text className="mt-1 text-[13px]" style={{ color: colors.secondaryText }}>
                {t.resourceSelectSourceSetTarget}
              </Text>
            </View>
            <ScrollView className="mt-3 max-h-72">
              {availableTargetSourceSets.map((library) => (
                <TouchableOpacity
                  activeOpacity={0.72}
                  className="mx-5 mt-1 flex-row items-center rounded-xl px-4 py-3"
                  disabled={sourceSetActionSubmitting}
                  key={library.id}
                  style={{ backgroundColor: colors.fillTertiary }}
                  onPress={() => void handleSelectSourceSetTarget(library.id)}
                >
                  <FolderOpen
                    color={colors.primary}
                    size={20}
                    strokeWidth={tokens.icon.strokeWidth}
                  />
                  <Text className="ml-3 flex-1 text-[16px] font-medium text-foreground">
                    {library.name}
                  </Text>
                  {sourceSetActionSubmitting ? (
                    <ActivityIndicator color={colors.primary} size="small" />
                  ) : (
                    <ChevronRight
                      color={colors.muted}
                      size={18}
                      strokeWidth={tokens.icon.strokeWidth}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Source-set select modal */}
      <Modal
        accessibilityViewIsModal
        transparent
        animationType="slide"
        visible={sourceSetSelectVisible}
        onRequestClose={() => setSourceSetSelectVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          className="flex-1 justify-end bg-black/40"
          onPress={() => setSourceSetSelectVisible(false)}
        >
          <View
            className="rounded-t-2xl bg-card"
            style={{ paddingBottom: insets.bottom + 16, maxHeight: '60%' }}
          >
            <View className="items-center pt-3 pb-2">
              <View className="w-9 h-1 rounded-full bg-foreground/10" />
            </View>
            <View className="flex-row items-center justify-between px-5">
              <Text className="text-[18px] font-bold text-foreground">
                {t.resourceSourceSetSelect}
              </Text>
              <TouchableOpacity
                activeOpacity={0.78}
                className="rounded-full px-3 py-2"
                style={{ backgroundColor: colors.primarySubtle }}
                onPress={openCreateSourceSetModal}
              >
                <Text className="text-[12px] font-semibold" style={{ color: colors.primary }}>
                  {t.resourceCreateSourceSet}
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView className="mt-2 max-h-64">
              <TouchableOpacity
                activeOpacity={0.7}
                className="mx-5 flex-row items-center rounded-xl px-4 py-3"
                style={{
                  backgroundColor: !sourceSetId ? colors.primary + '20' : colors.fillTertiary,
                }}
                onPress={() => {
                  setSourceSetId(null);
                  setCurrentFolderId(null);
                  setCurrentFolderSlug(null);
                  setTreeChildrenByParent({});
                  setTreeExpandedIds(new Set());
                  setSourceSetSelectVisible(false);
                }}
              >
                <FolderOpen
                  color={!sourceSetId ? colors.primary : colors.muted}
                  size={22}
                  strokeWidth={tokens.icon.strokeWidth}
                />
                <Text
                  className="ml-3 text-[16px] font-medium"
                  style={{ color: !sourceSetId ? colors.primary : colors.foreground }}
                >
                  {t.resourceSourceSetUnassigned}
                </Text>
              </TouchableOpacity>
              {sourceSets.map((lib) => (
                <TouchableOpacity
                  activeOpacity={0.7}
                  className="mx-5 mt-1 flex-row items-center rounded-xl px-4 py-3"
                  key={lib.id}
                  style={{
                    backgroundColor:
                      sourceSetId === lib.id ? colors.primary + '20' : colors.fillTertiary,
                  }}
                  onPress={() => {
                    setSourceSetId(lib.id);
                    setCurrentFolderId(null);
                    setCurrentFolderSlug(null);
                    setTreeChildrenByParent({});
                    setTreeExpandedIds(new Set());
                    setSourceSetSelectVisible(false);
                  }}
                >
                  <FolderOpen
                    color={sourceSetId === lib.id ? colors.primary : colors.muted}
                    size={22}
                    strokeWidth={tokens.icon.strokeWidth}
                  />
                  <Text
                    className="ml-3 flex-1 text-[16px] font-medium"
                    numberOfLines={1}
                    style={{ color: sourceSetId === lib.id ? colors.primary : colors.foreground }}
                  >
                    {lib.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Move to folder modal */}
      <Modal
        accessibilityViewIsModal
        transparent
        animationType="slide"
        visible={!!moveToFolderItem || batchMoveIds.size > 0}
        onRequestClose={() => {
          setMoveToFolderItem(null);
          setBatchMoveIds(new Set());
          setMoveFolderStack([null]);
        }}
      >
        <TouchableOpacity
          activeOpacity={1}
          className="flex-1 justify-end bg-black/40"
          onPress={() => {
            setMoveToFolderItem(null);
            setBatchMoveIds(new Set());
            setMoveFolderStack([null]);
          }}
        >
          <View
            className="rounded-t-2xl bg-card"
            style={{ paddingBottom: insets.bottom + 16, maxHeight: '55%' }}
          >
            <View className="items-center pt-3 pb-2">
              <View className="w-9 h-1 rounded-full bg-foreground/10" />
            </View>
            <View className="flex-row items-center justify-between px-5">
              <TouchableOpacity
                onPress={() =>
                  moveFolderStack.length > 1 ? setMoveFolderStack((s) => s.slice(0, -1)) : undefined
                }
              >
                {moveFolderStack.length > 1 ? (
                  <ArrowLeft color={colors.primary} size={22} strokeWidth={2} />
                ) : (
                  <View style={{ width: 22 }} />
                )}
              </TouchableOpacity>
              <Text
                className="flex-1 text-center text-[18px] font-bold text-foreground"
                numberOfLines={1}
              >
                {batchMoveIds.size > 0
                  ? t.resourceSelectCount.replace('{count}', String(batchMoveIds.size))
                  : (moveFolderCurrent?.name ?? t.resourceMoveToFolder)}
              </Text>
              <View style={{ width: 22 }} />
            </View>
            <ScrollView className="mt-2 max-h-56">
              <TouchableOpacity
                activeOpacity={0.7}
                className="mx-5 mt-1 flex-row items-center rounded-xl px-4 py-3"
                style={{ backgroundColor: colors.fillTertiary }}
                onPress={() => void handleMoveToFolder(null)}
              >
                <FolderOpen
                  color={colors.primary}
                  size={22}
                  strokeWidth={tokens.icon.strokeWidth}
                />
                <Text className="ml-3 text-[16px] font-medium text-foreground">
                  {t.resourceFolderRoot}
                </Text>
              </TouchableOpacity>
              {moveFolderCurrent && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  className="mx-5 mt-1 flex-row items-center rounded-xl px-4 py-3"
                  style={{ backgroundColor: colors.primary + '20' }}
                  onPress={() => void handleMoveToFolder(moveFolderCurrent.id)}
                >
                  <Folder color={colors.primary} size={22} strokeWidth={tokens.icon.strokeWidth} />
                  <Text
                    className="ml-3 flex-1 text-[16px] font-medium"
                    numberOfLines={1}
                    style={{ color: colors.primary }}
                  >
                    {moveFolderCurrent.name}
                  </Text>
                </TouchableOpacity>
              )}
              {moveTargetFolders.map((folder) => (
                <TouchableOpacity
                  activeOpacity={0.7}
                  className="mx-5 mt-1 flex-row items-center rounded-xl px-4 py-3"
                  key={folder.id}
                  style={{ backgroundColor: colors.fillTertiary }}
                  onPress={() =>
                    setMoveFolderStack((s) => [
                      ...s,
                      { id: folder.slug ?? folder.id, name: folder.name },
                    ])
                  }
                >
                  <Folder color={colors.muted} size={22} strokeWidth={tokens.icon.strokeWidth} />
                  <Text
                    className="ml-3 flex-1 text-[16px] font-medium text-foreground"
                    numberOfLines={1}
                  >
                    {folder.name}
                  </Text>
                  <ChevronRight color={colors.muted} size={20} strokeWidth={1.5} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Sort menu — compact dropdown-style overlay */}
      <Modal
        accessibilityViewIsModal
        transparent
        animationType="fade"
        visible={sortMenuVisible}
        onRequestClose={() => setSortMenuVisible(false)}
      >
        <Pressable
          className="flex-1 items-end px-5 pt-24"
          style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
          onPress={() => setSortMenuVisible(false)}
        >
          <Pressable
            className="rounded-2xl bg-card py-2 shadow-lg"
            style={{ minWidth: 180 }}
            onPress={(e: any) => e.stopPropagation?.()}
          >
            {[
              { sorter: 'createdAt' as const, order: 'desc' as const, label: t.resourceSortNewest },
              { sorter: 'createdAt' as const, order: 'asc' as const, label: t.resourceSortOldest },
              {
                sorter: 'name' as const,
                order: 'asc' as const,
                label: `${t.resourceSortName} A-Z`,
              },
              {
                sorter: 'name' as const,
                order: 'desc' as const,
                label: `${t.resourceSortName} Z-A`,
              },
              { sorter: 'size' as const, order: 'asc' as const, label: `${t.resourceSortSize} ↑` },
              { sorter: 'size' as const, order: 'desc' as const, label: `${t.resourceSortSize} ↓` },
            ].map((opt) => (
              <TouchableOpacity
                activeOpacity={0.7}
                className="px-4 py-2.5"
                key={`${opt.sorter}-${opt.order}`}
                onPress={() => {
                  setSorter(opt.sorter);
                  setSortOrder(opt.order);
                  setSortMenuVisible(false);
                }}
              >
                <Text
                  className="text-[15px] font-medium"
                  style={{
                    color:
                      sorter === opt.sorter && sortOrder === opt.order
                        ? colors.primary
                        : colors.foreground,
                  }}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Create folder modal */}
      <Modal
        accessibilityViewIsModal
        transparent
        animationType="fade"
        visible={createFolderVisible}
        onRequestClose={() => setCreateFolderVisible(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/40 px-6">
          <View className="w-full max-w-sm rounded-2xl bg-card p-5">
            <Text className="text-[18px] font-bold text-foreground">{t.resourceCreateFolder}</Text>
            <TextInput
              autoFocus
              className="mt-4 rounded-xl border border-foreground/10 bg-background px-4 py-3 text-[16px] text-foreground"
              placeholder={t.resourceCreateFolderPlaceholder}
              placeholderTextColor={colors.muted}
              value={createFolderName}
              onChangeText={setCreateFolderName}
              onSubmitEditing={() => void handleCreateFolder()}
            />
            <View className="mt-4 flex-row justify-end gap-3">
              <TouchableOpacity
                className="rounded-xl px-4 py-2"
                onPress={() => {
                  setCreateFolderVisible(false);
                  setCreateFolderName('');
                }}
              >
                <Text style={{ color: colors.primary }}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="rounded-xl bg-primary px-4 py-2"
                onPress={() => void handleCreateFolder()}
              >
                <Text className="font-medium" style={{ color: colors.iconOnPrimary }}>
                  {t.done}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </PortalScaffold>
  );
}

export function PortalResourceScreen({
  navigation,
  route,
}: RootStackScreenProps<'PortalResources'>) {
  return (
    <ResourceScreenImpl
      navigation={navigation as ResourceScreenImplProps['navigation']}
      route={route as ResourceScreenImplProps['route']}
    />
  );
}

export default function ResourceScreen({ navigation, route }: MainTabScreenProps<'Resources'>) {
  return (
    <ResourceScreenImpl
      navigation={navigation as ResourceScreenImplProps['navigation']}
      route={route as ResourceScreenImplProps['route']}
    />
  );
}
