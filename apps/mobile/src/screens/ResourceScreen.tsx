/**
 * ResourceScreen — File / Resource management aligned with web /resource
 *
 * Features:
 *  • Library selection (All Files / specific library)
 *  • Folder hierarchy with breadcrumb navigation
 *  • List files and folders with tabs: All, Images, Documents, Others
 *  • Create folder, move to folder
 *  • Upload via camera roll (ImagePicker) or file picker (DocumentPicker)
 *  • Upload to current folder when in library
 *  • Delete files/folders with confirmation alert
 *  • Pull-to-refresh, search filter
 *  • Image thumbnail preview inline
 */
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
  Grid3X3,
  List,
  Pencil,
  Plus,
  Search,
  Share2,
  Trash2,
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
  Share,
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
import { FilterChip, SelectionBadge } from '../components/ui/ChoiceControls';
import EmptyState from '../components/ui/EmptyState';
import FileGridSkeleton from '../components/ui/FileGridSkeleton';
import PromptModal from '../components/ui/PromptModal';
import { HeaderIconButton, ScreenHeader } from '../components/ui/ScreenHeader';
import { SearchField } from '../components/ui/SearchField';
import { useToast } from '../components/ui/Toast';
import {
  fileApi,
  type FolderCrumb,
  getApiUrl,
  knowledgeBaseApi,
  resourceApi,
  type TrashedDocumentItem,
} from '../lib/api';
import { getAuthHeaders } from '../lib/auth';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import {
  clearResourceCacheEntry,
  getResourceCacheEntry,
  listResourceCacheEntries,
  type ResourceCacheEntry,
  saveResourceCacheEntry,
} from '../lib/resourceCache';
import {
  clearResourceListCache,
  getResourceListCacheEntry,
  saveResourceListCacheEntry,
} from '../lib/resourceListCache';
import { useConnectionStore } from '../store/connection';
import { useThemeColors } from '../theme/colors';
import { tokens } from '../theme/tokens';
import type { FileListItem, KnowledgeBaseItem } from '../types';

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

function areSameFileItems(left: FileListItem[] | undefined, right: FileListItem[]): boolean {
  if (!left) return false;
  if (left.length !== right.length) return false;

  let index = 0;

  for (const item of left) {
    const target = right[index];
    if (!target) return false;

    if (
      item.id !== target.id ||
      item.name !== target.name ||
      item.fileType !== target.fileType ||
      item.parentId !== target.parentId ||
      item.size !== target.size ||
      item.createdAt !== target.createdAt ||
      item.slug !== target.slug ||
      item.sourceType !== target.sourceType
    ) {
      return false;
    }

    index += 1;
  }

  return true;
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
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
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
    remoteHeaders,
    visible,
    onCacheReady,
    onClose,
  }: {
    apiBaseUrl: string;
    item: FileListItem | null;
    onCacheReady?: (entry: ResourceCacheEntry) => void;
    remoteHeaders?: Record<string, string>;
    visible: boolean;
    onClose: () => void;
  }) => {
    const insets = useSafeAreaInsets();
    const { t } = useI18n();
    const toast = useToast();
    const colors = useThemeColors();
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
    const [textDraft, setTextDraft] = useState('');

    const previewCandidates = item ? buildRemoteFileCandidates(apiBaseUrl, item) : [];
    const fileUrl = previewCandidates[previewIndex] || '';
    const imageFile = item ? isImage(item.fileType, item.name) : false;
    const textFile = item ? isTextLikeFile(item.fileType, item.name, item.sourceType) : false;
    const pdfFile = item ? item.fileType === 'application/pdf' : false;
    // Office docs: use Microsoft Office Viewer (same as Web), not Google Docs
    const officeFile = item
      ? item.fileType.includes('msword') ||
        item.fileType.includes('vnd.openxmlformats') ||
        item.fileType.includes('vnd.ms-excel') ||
        item.fileType.includes('vnd.ms-powerpoint')
      : false;
    const previewableDoc = textFile || pdfFile || officeFile;

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
      setTextDraft('');
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
          if (item.sourceType === 'document' && typeof item.content === 'string') {
            if (!cancelled) {
              setPreviewLoadFailed(false);
              setTextContent(item.content);
            }
            return;
          }

          if (item.sourceType === 'document') {
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
      item?.sourceType,
      textFile,
      remoteHeaders,
      visible,
    ]);

    const itemUpdatedAt = item
      ? ((item as FileListItem & { updatedAt?: string | null }).updatedAt ?? undefined)
      : undefined;
    const markdownFile = item ? textFile && isMarkdownFile(item.fileType, item.name) : false;
    const canEditText = !!item && textFile && item.sourceType === 'document';
    const markdownHtml = useMemo(
      () =>
        markdownFile && textContent ? buildMarkdownPreviewHtml(textContent, colors) : undefined,
      [colors, markdownFile, textContent],
    );

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
      const shareUrl = cachedEntry?.localUri || fileUrl;
      const shareMessage = (textFile && textContent ? textContent : fileUrl) || item.name;
      void Share.share({
        message: shareMessage,
        title: item.name,
        ...(shareUrl ? { url: shareUrl } : {}),
      });
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

    return (
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
          style={{ flex: 1, backgroundColor: imageFile ? '#000' : colors.inputBg }}
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
                color={imageFile ? '#fff' : colors.foreground}
                size={22}
                strokeWidth={tokens.icon.strokeWidth}
              />
              <View className="flex-1 min-w-0 ml-2 mr-2">
                <Text
                  className="text-[15px] font-semibold"
                  numberOfLines={1}
                  style={{ color: imageFile ? '#fff' : colors.foreground }}
                >
                  {item.name}
                </Text>
                <Text
                  className="text-[11px] mt-0.5"
                  style={{
                    color: imageFile ? 'rgba(255,255,255,0.6)' : colors.secondaryText,
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
                      color: imageFile ? 'rgba(255,255,255,0.72)' : colors.secondaryText,
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
              {canEditText ? (
                editingText ? (
                  <TouchableOpacity
                    disabled={savingEdit}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    onPress={() => void handleSaveEdit()}
                  >
                    {savingEdit ? (
                      <ActivityIndicator color={imageFile ? '#fff' : colors.primary} size="small" />
                    ) : (
                      <Text
                        className="text-[13px] font-semibold"
                        style={{ color: imageFile ? '#fff' : colors.primary }}
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
                      color={imageFile ? '#fff' : colors.primary}
                      size={20}
                      strokeWidth={1.8}
                    />
                  </TouchableOpacity>
                )
              ) : null}
              <TouchableOpacity
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                onPress={handleShare}
              >
                <Share2 color={imageFile ? '#fff' : colors.primary} size={20} strokeWidth={1.8} />
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
                      style={{ color: imageFile ? '#fff' : colors.primary }}
                    >
                      {downloadProgress}%
                    </Text>
                  </View>
                ) : (
                  <Download
                    color={imageFile ? '#fff' : colors.primary}
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
                  <Text className="text-center text-white/80 text-[14px]">
                    {t.resourcePreviewUnavailable}
                  </Text>
                </View>
              ) : fileUrl ? (
                <View className="flex-1 items-center justify-center">
                  {imgLoading && (
                    <ActivityIndicator
                      color={colors.iconOnPrimary}
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
                  <Text className="text-center text-white/80 text-[14px]">
                    {t.resourcePreviewUnavailable}
                  </Text>
                </View>
              )
            ) : previewableDoc ? (
              pdfFile && !fileUrl ? (
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
                      <Text className="text-white text-[15px] font-semibold">
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
                      <Text className="text-white text-[15px] font-semibold">
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

// ── Main Screen ───────────────────────────────────────────────────────

export default function ResourceScreen() {
  const { locale, t } = useI18n();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const colors = useThemeColors();

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
  const [previewVisible, setPreviewVisible] = useState(false);
  const [libraryId, setLibraryId] = useState<string | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [currentFolderSlug, setCurrentFolderSlug] = useState<string | null>(null);
  const [folderBreadcrumb, setFolderBreadcrumb] = useState<FolderCrumb[]>([]);
  const [libraries, setLibraries] = useState<KnowledgeBaseItem[]>([]);
  const [librarySelectVisible, setLibrarySelectVisible] = useState(false);
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
  const [viewMode, setViewMode] = useState<ViewMode>('list');
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

  const resourceListQueryParams = useMemo(
    () => ({
      knowledgeBaseId: libraryId ?? undefined,
      limit: RESOURCE_LIST_PAGE_SIZE,
      parentId: libraryId ? (currentFolderId ?? currentFolderSlug ?? null) : null,
      q: searchText.trim() || undefined,
    }),
    [libraryId, currentFolderId, currentFolderSlug, searchText],
  );

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

  // ── Data (defined early for handleBatchDelete etc.) ──────────────────

  const loadLibraries = useCallback(async () => {
    try {
      const list = await knowledgeBaseApi.list();
      setLibraries(list ?? []);
    } catch {
      setLibraries([]);
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
      if (!libraryId || searchText.trim()) return;

      const treeKey = parentId ?? ROOT_TREE_KEY;

      setTreeChildrenByParent((prev) => {
        if (areSameFileItems(prev[treeKey], items)) return prev;

        return {
          ...prev,
          [treeKey]: items,
        };
      });
    },
    [libraryId, searchText],
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
        setApiBase(base);
        const result = await resourceApi.getKnowledgeItems({
          knowledgeBaseId: resourceListQueryParams.knowledgeBaseId,
          limit: RESOURCE_LIST_PAGE_SIZE,
          offset: loadOffset,
          parentId: resourceListQueryParams.parentId,
          q: resourceListQueryParams.q,
        });
        if (ticket !== loadRequestRef.current) return;
        const items = result?.items ?? [];
        const nextHasMore = result?.hasMore ?? false;

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
      if (!libraryId) return;

      const treeKey = parentId ?? ROOT_TREE_KEY;
      const cacheParams = {
        knowledgeBaseId: libraryId,
        limit: RESOURCE_TREE_PAGE_SIZE,
        parentId,
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
          knowledgeBaseId: libraryId,
          limit: RESOURCE_TREE_PAGE_SIZE,
          offset: 0,
          parentId,
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
    [libraryId],
  );

  const refreshTreeData = useCallback(async () => {
    if (!libraryId) {
      setTreeChildrenByParent({});
      setTreeExpandedIds(new Set());
      return;
    }

    await loadTreeChildren(null, true);

    if (currentFolderId) {
      await loadTreeChildren(currentFolderId, true);
    }
  }, [currentFolderId, libraryId, loadTreeChildren]);

  useEffect(() => {
    if (!trashModalVisible) return;
    let cancelled = false;
    void (async () => {
      setTrashLoading(true);
      try {
        const res = await resourceApi.queryTrashedDocuments({
          current: 0,
          pageSize: 100,
          ...(libraryId ? { knowledgeBaseId: libraryId } : {}),
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
  }, [libraryId, t.resourceTrashLoadFailed, toast, trashModalVisible]);

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

  const handleBatchDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    const hasFolders = ids.some((id) => {
      const item = files.find((f) => f.id === id);
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
            for (const id of ids) {
              const item = files.find((f) => f.id === id);
              if (!item) continue;
              if (item.fileType === 'custom/folder' || item.sourceType === 'document') {
                await resourceApi.deleteDocument(id);
              } else {
                await fileApi.remove(id);
              }
            }
            await purgeDeletedResources(ids);
            haptics.success();
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
    files,
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
    if (moveToFolderItem && libraryId) {
      resourceApi
        .getKnowledgeItems({
          knowledgeBaseId: libraryId,
          parentId: moveFolderParentId,
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
  }, [moveToFolderItem, libraryId, moveFolderParentId]);

  const handlePreview = useCallback((item: FileListItem) => {
    haptics.light();
    setPreviewItem(item);
    setPreviewVisible(true);
  }, []);

  useEffect(() => {
    useConnectionStore.getState().checkConnection();
  }, []);

  useEffect(() => {
    loadLibraries();
    void refreshCachedResources();
  }, [loadLibraries, refreshCachedResources]);

  useEffect(() => {
    if (currentFolderSlug) {
      loadFolderBreadcrumb(currentFolderSlug);
    } else {
      setFolderBreadcrumb([]);
    }
  }, [currentFolderSlug, loadFolderBreadcrumb]);

  // 切换 library 时重置文件夹导航，避免跨库的 parentId 导致请求失败
  useEffect(() => {
    setCurrentFolderId(null);
    setCurrentFolderSlug(null);
    setTreeChildrenByParent({});
    setTreeExpandedIds(new Set());
  }, [libraryId]);

  useEffect(() => {
    nextOffsetRef.current = 0;
    void (async () => {
      await refreshCachedResources();
      await loadFiles();
    })();
  }, [loadFiles, refreshCachedResources]);

  useEffect(() => {
    if (!libraryId) return;
    void loadTreeChildren(null);
  }, [libraryId, loadTreeChildren]);

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
    if (!libraryId) return;
    const name = createFolderName.trim() || t.resourceNewFolder;
    setCreateFolderVisible(false);
    setCreateFolderName('');
    try {
      await resourceApi.createFolder({
        knowledgeBaseId: libraryId,
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
    libraryId,
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
          const item = files.find((f) => f.id === id);
          if (item && id !== '__batch__') {
            await resourceApi.moveResource(id, targetFolderId, item.sourceType);
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
      files,
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
          knowledgeBaseId: libraryId ?? undefined,
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
      libraryId,
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

  const currentLibraryName = libraryId
    ? (libraries.find((l) => l.id === libraryId)?.name ?? '')
    : t.resourceLibraryInbox;

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
              const existingItem = files.find((item) => item.id === id);
              if (isFolderItem || existingItem?.sourceType === 'document') {
                await resourceApi.deleteDocument(id);
              } else {
                await fileApi.remove(id);
              }
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
    [files, loadFiles, purgeDeletedResources, refreshTreeData, t, toast],
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
        if (itemIsFolder) {
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

  const handleShare = useCallback(
    async (item: FileListItem) => {
      closeActionSheet();
      const base = apiBase?.replace(/\/$/, '') || '';
      const cachedLocalUri = cachedResourceMap[item.id]?.localUri;
      const url = cachedLocalUri || (base ? `${base}/f/${item.id}` : '');
      if (!url) return;
      try {
        await Share.share({ message: url, title: item.name, url });
      } catch {
        toast.show('error', t.resourceShareFailed);
      }
    },
    [apiBase, cachedResourceMap, closeActionSheet, t, toast],
  );

  // ── Filtered & sorted files ────────────────────────────────────────

  const treeMode = libraryId !== null && viewMode === 'list' && !searchText.trim();

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

  const handleTreeFolderToggle = useCallback(
    async (item: FileListItem) => {
      if (!isFolder(item)) return;

      const isExpanded = treeExpandedIds.has(item.id);

      setCurrentFolderId(item.id);
      setCurrentFolderSlug(item.slug ?? item.id);

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

  const handleExpandAllTree = useCallback(async () => {
    if (!libraryId) return;

    const nextChildren: Record<string, FileListItem[]> = {};
    const expandedIds = new Set<string>();
    const queue: Array<string | null> = [null];

    while (queue.length > 0) {
      const parentId = queue.shift() ?? null;
      const treeKey = parentId ?? ROOT_TREE_KEY;

      let children = treeChildrenByParent[treeKey];
      if (!children) {
        const result = await resourceApi.getKnowledgeItems({
          knowledgeBaseId: libraryId,
          limit: 200,
          offset: 0,
          parentId,
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
  }, [libraryId, locale, sortOrder, sorter, treeChildrenByParent]);

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
    <View className="flex-1 bg-background">
      {/* Header */}
      <ScreenHeader
        headerLevel="root"
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
                accessibilityLabel={t.resourceTrash}
                onPress={() => setTrashModalVisible(true)}
              >
                <Trash2 color={colors.primary} size={20} strokeWidth={tokens.icon.strokeWidth} />
              </HeaderIconButton>
              <HeaderIconButton
                onPress={() => setViewMode((m) => (m === 'list' ? 'grid' : 'list'))}
              >
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
      >
        {/* Library selector */}
        <TouchableOpacity
          activeOpacity={0.7}
          className="mx-6 mb-2 flex-row items-center rounded-xl px-3.5 py-2.5"
          style={{
            backgroundColor: colors.fillQuaternary,
            borderColor: colors.borderSubtle,
            borderWidth: 1,
          }}
          onPress={() => setLibrarySelectVisible(true)}
        >
          <FolderOpen color={colors.primary} size={18} strokeWidth={tokens.icon.strokeWidth} />
          <Text className="ml-2.5 flex-1 text-[14px] font-medium text-foreground" numberOfLines={1}>
            {currentLibraryName}
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
                {libraryId ? t.resourceFolderRoot : t.resourceLibraryInbox}
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

        {libraryId && treeMode ? (
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
                {t.resourceCurrentFolder}: {folderBreadcrumb.map((crumb) => crumb.name).join(' / ')}
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
        </View>
      </ScreenHeader>

      {/* Batch action bar */}
      {selectMode && selectedIds.size > 0 && (
        <View
          className="flex-row items-center justify-around border-t border-border bg-card px-4 py-3"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          <TouchableOpacity className="flex-1 items-center" onPress={handleBatchDelete}>
            <Text style={{ color: colors.danger }}>{t.resourceBatchDelete}</Text>
          </TouchableOpacity>
          {libraryId && (
            <TouchableOpacity className="flex-1 items-center" onPress={handleBatchMove}>
              <Text style={{ color: colors.primary }}>{t.resourceBatchMove}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Content */}
      {showInitialSkeleton ? (
        <FileGridSkeleton />
      ) : (
        <FlatList<ResourceListRow>
          data={treeMode ? treeRows : filtered}
          key={treeMode ? 'tree' : viewMode}
          keyExtractor={(item) => (isResourceTreeRow(item) ? item.item.id : item.id)}
          numColumns={!treeMode && viewMode === 'grid' ? 3 : 1}
          viewabilityConfig={treeMode ? undefined : viewabilityConfig}
          ItemSeparatorComponent={
            !treeMode && viewMode === 'list'
              ? () => <View className="mx-4 h-px bg-foreground/5" />
              : undefined
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
                  {libraryId && (
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
                  paddingBottom: insets.bottom + 80,
                }
              : { paddingBottom: insets.bottom + 80 }
          }
          extraData={{
            cachedResourceIds,
            cachedResourceMap,
            currentFolderId,
            selectedIds,
            selectMode,
            treeExpandedIds,
            visibleIds,
          }}
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
                        void handleTreeFolderToggle(entry);
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
                              onPress={() => void handleTreeFolderToggle(entry)}
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
                      </View>
                      {libraryId && !selectMode ? (
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
                onPress={() =>
                  selectMode
                    ? toggleSelect(item)
                    : isFolder(item) && libraryId
                      ? handleFolderPress(item)
                      : handlePreview(item)
                }
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
                {libraryId && !selectMode ? (
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
                showFolderActions={!!libraryId}
                onDelete={handleDelete}
                onFolderPress={libraryId ? handleFolderPress : undefined}
                onInvalidateCache={invalidateCachedResource}
                onLongPressItem={handleEnterSelectMode}
                onOpenActions={libraryId ? setActionItem : undefined}
                onPress={handlePreview}
                onSelect={selectMode ? toggleSelect : undefined}
                onMoveToFolder={
                  libraryId
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
          libraryId
            ? () => {
                setAttachmentSheetVisible(false);
                setCreateFolderVisible(true);
              }
            : undefined
        }
      />

      <FilePreviewModal
        apiBaseUrl={apiBase}
        item={previewItem}
        remoteHeaders={resourceAuthHeaders}
        visible={previewVisible}
        onClose={() => setPreviewVisible(false)}
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
      />

      {/* Recycle bin (soft-deleted documents) */}
      <Modal
        accessibilityViewIsModal
        animationType="slide"
        transparent
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
                        <Folder color={colors.muted} size={22} strokeWidth={tokens.icon.strokeWidth} />
                      ) : (
                        <FileText color={colors.muted} size={22} strokeWidth={tokens.icon.strokeWidth} />
                      )}
                      <Text
                        className="ml-3 flex-1 text-[15px] text-foreground"
                        numberOfLines={2}
                      >
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
                          <Text className="text-[14px] font-semibold" style={{ color: colors.primary }}>
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
                <Pressable
                  className="flex-row items-center py-3.5 px-3 rounded-xl active:bg-foreground/5"
                  onPress={handleRenameStart}
                >
                  <Pencil color={colors.muted} size={18} strokeWidth={tokens.icon.strokeWidth} />
                  <Text className="ml-3 text-base text-foreground">{t.actionRename}</Text>
                </Pressable>
                {!isFolder(actionItem) && (
                  <Pressable
                    className="flex-row items-center py-3.5 px-3 rounded-xl active:bg-foreground/5"
                    onPress={() => void handleShare(actionItem)}
                  >
                    <Share2 color={colors.muted} size={18} strokeWidth={tokens.icon.strokeWidth} />
                    <Text className="ml-3 text-base text-foreground">{t.msgActionShare}</Text>
                  </Pressable>
                )}
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

      {/* Library select modal */}
      <Modal
        accessibilityViewIsModal
        transparent
        animationType="slide"
        visible={librarySelectVisible}
        onRequestClose={() => setLibrarySelectVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          className="flex-1 justify-end bg-black/40"
          onPress={() => setLibrarySelectVisible(false)}
        >
          <View
            className="rounded-t-2xl bg-card"
            style={{ paddingBottom: insets.bottom + 16, maxHeight: '60%' }}
          >
            <View className="items-center pt-3 pb-2">
              <View className="w-9 h-1 rounded-full bg-foreground/10" />
            </View>
            <Text className="px-5 text-[18px] font-bold text-foreground">
              {t.resourceLibrarySelect}
            </Text>
            <ScrollView className="mt-2 max-h-64">
              <TouchableOpacity
                activeOpacity={0.7}
                className="mx-5 flex-row items-center rounded-xl px-4 py-3"
                style={{
                  backgroundColor: !libraryId ? colors.primary + '20' : colors.fillTertiary,
                }}
                onPress={() => {
                  setLibraryId(null);
                  setCurrentFolderId(null);
                  setCurrentFolderSlug(null);
                  setLibrarySelectVisible(false);
                }}
              >
                <FolderOpen
                  color={!libraryId ? colors.primary : colors.muted}
                  size={22}
                  strokeWidth={tokens.icon.strokeWidth}
                />
                <Text
                  className="ml-3 text-[16px] font-medium"
                  style={{ color: !libraryId ? colors.primary : colors.foreground }}
                >
                  {t.resourceLibraryInbox}
                </Text>
              </TouchableOpacity>
              {libraries.map((lib) => (
                <TouchableOpacity
                  activeOpacity={0.7}
                  className="mx-5 mt-1 flex-row items-center rounded-xl px-4 py-3"
                  key={lib.id}
                  style={{
                    backgroundColor:
                      libraryId === lib.id ? colors.primary + '20' : colors.fillTertiary,
                  }}
                  onPress={() => {
                    setLibraryId(lib.id);
                    setCurrentFolderId(null);
                    setCurrentFolderSlug(null);
                    setLibrarySelectVisible(false);
                  }}
                >
                  <FolderOpen
                    color={libraryId === lib.id ? colors.primary : colors.muted}
                    size={22}
                    strokeWidth={tokens.icon.strokeWidth}
                  />
                  <Text
                    className="ml-3 flex-1 text-[16px] font-medium"
                    numberOfLines={1}
                    style={{ color: libraryId === lib.id ? colors.primary : colors.foreground }}
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
                <Text className="font-medium text-white">{t.done}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
