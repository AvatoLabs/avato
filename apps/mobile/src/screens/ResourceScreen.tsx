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
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowDownUp,
  ArrowLeft,
  Check,
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
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import AttachmentSheet from '../components/ui/AttachmentSheet';
import EmptyState from '../components/ui/EmptyState';
import PromptModal from '../components/ui/PromptModal';
import FileGridSkeleton from '../components/ui/FileGridSkeleton';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { useToast } from '../components/ui/Toast';
import {
  fileApi,
  getApiUrl,
  knowledgeBaseApi,
  resourceApi,
  type FolderCrumb,
} from '../lib/api';
import { getAuthHeaders } from '../lib/auth';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { codeInlineRules } from '../lib/markdownRules';
import { useConnectionStore } from '../store/connection';
import { useThemeColors } from '../theme/colors';
import { tokens } from '../theme/tokens';
import type { FileListItem, KnowledgeBaseItem } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────

type FileCategory = 'all' | 'images' | 'documents' | 'others';
type SorterType = 'createdAt' | 'name' | 'size';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'list' | 'grid';

function sortFileList(
  list: FileListItem[],
  sorter: SorterType,
  sortOrder: SortOrder,
): FileListItem[] {
  const sorted = [...list];
  sorted.sort((a, b) => {
    let aVal: string | number;
    let bVal: string | number;
    switch (sorter) {
      case 'name':
        aVal = (a.name ?? '').toLowerCase();
        bVal = (b.name ?? '').toLowerCase();
        break;
      case 'size':
        aVal = a.size ?? 0;
        bVal = b.size ?? 0;
        break;
      default:
        aVal = new Date(a.createdAt).getTime();
        bVal = new Date(b.createdAt).getTime();
    }
    const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
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

function isImageMimeType(mime?: string | null): boolean {
  if (!mime) return false;
  const normalized = mime.toLowerCase();
  return normalized.startsWith('image/');
}

function hasKnownImageSignature(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;

  // PNG
  if (
    bytes.length >= 8 &&
    bytes[0] === 137 &&
    bytes[1] === 80 &&
    bytes[2] === 78 &&
    bytes[3] === 71 &&
    bytes[4] === 13 &&
    bytes[5] === 10 &&
    bytes[6] === 26 &&
    bytes[7] === 10
  )
    return true;

  // JPEG
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return true;

  // GIF
  if (
    bytes.length >= 6 &&
    bytes[0] === 71 &&
    bytes[1] === 73 &&
    bytes[2] === 70 &&
    bytes[3] === 56
  )
    return true;

  // WEBP: RIFF....WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 82 &&
    bytes[1] === 73 &&
    bytes[2] === 70 &&
    bytes[3] === 70 &&
    bytes[8] === 87 &&
    bytes[9] === 69 &&
    bytes[10] === 66 &&
    bytes[11] === 80
  )
    return true;

  // BMP: BM
  if (bytes[0] === 66 && bytes[1] === 77) return true;

  // TIFF: II*\0 or MM\0*
  if (
    (bytes[0] === 73 && bytes[1] === 73 && bytes[2] === 42 && bytes[3] === 0) ||
    (bytes[0] === 77 && bytes[1] === 77 && bytes[2] === 0 && bytes[3] === 42)
  )
    return true;

  return false;
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

function getResourcePreviewMdStyles(colors: {
  foreground: string;
  primary: string;
  markdownCodeInlineBg: string;
  markdownCodeInlineColor: string;
  markdownCodeBlockBg: string;
  markdownText: string;
  fillTertiary: string;
  divider: string;
}) {
  return {
    body: { color: colors.foreground, fontSize: 15, lineHeight: 24 },
    text: { color: colors.foreground },
    textgroup: { color: colors.foreground },
    heading1: {
      color: colors.foreground,
      fontSize: 22,
      fontWeight: '700' as const,
      marginBottom: 10,
      marginTop: 18,
    },
    heading2: {
      color: colors.foreground,
      fontSize: 18,
      fontWeight: '700' as const,
      marginBottom: 8,
      marginTop: 14,
    },
    heading3: {
      color: colors.foreground,
      fontSize: 16,
      fontWeight: '600' as const,
      marginBottom: 6,
      marginTop: 12,
    },
    paragraph: { marginBottom: 10 },
    bullet_list: { marginBottom: 10 },
    ordered_list: { marginBottom: 10 },
    list_item: { marginBottom: 4 },
    code_inline: {
      backgroundColor: colors.markdownCodeInlineBg,
      borderRadius: 4,
      color: colors.markdownCodeInlineColor,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 13,
      paddingHorizontal: 4,
      paddingVertical: 2,
    },
    fence: {
      backgroundColor: colors.markdownCodeBlockBg,
      borderRadius: 8,
      color: colors.markdownText,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 13,
      lineHeight: 20,
      marginBottom: 10,
      padding: 12,
    },
    blockquote: {
      backgroundColor: colors.fillTertiary,
      borderColor: colors.primary,
      borderLeftWidth: 3,
      marginBottom: 10,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    hr: { backgroundColor: colors.divider, height: 1, marginVertical: 12 },
    link: { color: colors.primary },
    strong: { fontWeight: '600' as const },
  };
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
  if (category === 'others') return !isImage(item.fileType, item.name) && !isDocument(item.fileType, item.name);
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

// ── File Preview Modal ────────────────────────────────────────────────

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const FilePreviewModal = memo(
  ({
    apiBaseUrl,
    item,
    visible,
    onClose,
  }: {
    apiBaseUrl: string;
    item: FileListItem | null;
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
    const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null);
    const [textContent, setTextContent] = useState<string | null>(null);
    const [previewLoadFailed, setPreviewLoadFailed] = useState(false);

    const previewCandidates = item ? buildRemoteFileCandidates(apiBaseUrl, item) : [];
    const fileUrl = previewCandidates[previewIndex] || '';
    const imageFile = item ? isImage(item.fileType, item.name) : false;
    const textFile = item
      ? item.fileType.startsWith('text/') || item.fileType === 'application/json'
      : false;
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
      setPdfDataUrl(null);
      setTextContent(null);
      setPreviewLoadFailed(false);
      setDownloadProgress(0);
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

    // PDF: fetch via redirect (WebView fails on 302), convert to data URL for reliable display
    useEffect(() => {
      if (!pdfFile || !fileUrl || !visible) return;

      let cancelled = false;
      const loadPdf = async () => {
        try {
          const res = await fetch(fileUrl, { redirect: 'follow' });
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
          if (!cancelled) setPdfDataUrl(dataUrl);
        } catch {
          if (!cancelled) handlePreviewError();
        }
      };

      void loadPdf();
      return () => {
        cancelled = true;
      };
    }, [fileUrl, pdfFile, visible, handlePreviewError]);

    // Text/Markdown: fetch via redirect (WebView fails on 302), render with Markdown or Text
    useEffect(() => {
      if (!textFile || !fileUrl || !visible) return;

      let cancelled = false;
      const loadText = async () => {
        try {
          const res = await fetch(fileUrl, { redirect: 'follow' });
          if (cancelled) return;
          if (!res.ok) {
            handlePreviewError();
            return;
          }

          const text = await res.text();
          if (!cancelled) setTextContent(text);
        } catch {
          if (!cancelled) handlePreviewError();
        }
      };

      void loadText();
      return () => {
        cancelled = true;
      };
    }, [fileUrl, textFile, visible, handlePreviewError]);

    if (!item) return null;

    const markdownFile = textFile && isMarkdownFile(item.fileType, item.name);

    const handleShare = () => {
      void Share.share(
        Platform.OS === 'ios'
          ? {
              title: item.name,
              url: fileUrl,
            }
          : {
              message: fileUrl,
              title: item.name,
            },
      );
    };

    const handleDownload = async () => {
      if (downloading) return;
      setDownloading(true);
      setDownloadProgress(0);
      try {
        await fileApi.download(item, {
          onProgress: (p) => setDownloadProgress(p),
        });
        haptics.success();
        toast.show('success', t.resourceDownloaded);
      } catch {
        toast.show('error', t.resourceDownloadFailed);
      } finally {
        setDownloading(false);
        setDownloadProgress(0);
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
              </View>
            </TouchableOpacity>

            <View className="flex-row items-center gap-3 flex-shrink-0">
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
                    <Text className="text-[11px] font-medium" style={{ color: imageFile ? '#fff' : colors.primary }}>
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
                    source={fileUrl}
                    style={{ width: SCREEN_W, height: SCREEN_H * 0.75 }}
                    transition={120}
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
              ) : pdfFile && fileUrl && !pdfDataUrl && !previewLoadFailed ? (
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
              ) : textFile && fileUrl && !textContent && !previewLoadFailed ? (
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
              ) : textFile && textContent ? (
                <ScrollView
                  className="flex-1"
                  contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
                  style={{ backgroundColor: colors.background }}
                >
                  {markdownFile ? (
                    <Markdown rules={codeInlineRules} style={getResourcePreviewMdStyles(colors)}>
                      {textContent}
                    </Markdown>
                  ) : (
                    <Text
                      selectable
                      className="text-[15px] leading-6"
                      style={{ color: colors.foreground }}
                    >
                      {textContent}
                    </Text>
                  )}
                </ScrollView>
              ) : (
                <WebView
                  cacheEnabled
                  originWhitelist={['https://*', 'http://*', 'data:*']}
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
                  source={
                    officeFile
                      ? {
                          uri: `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`,
                        }
                      : pdfFile && pdfDataUrl
                        ? { uri: pdfDataUrl }
                        : { uri: fileUrl }
                  }
                  onError={handlePreviewError}
                />
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
                <Text className="text-[14px] text-center mb-1" style={{ color: colors.secondaryText }}>
                  {item.fileType}
                </Text>
                <Text className="text-[14px] text-center mb-8" style={{ color: colors.secondaryText }}>
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
                      <ActivityIndicator color={colors.iconOnPrimary} size="small" style={{ marginRight: 8 }} />
                      <Text className="text-white text-[15px] font-semibold">{downloadProgress}%</Text>
                    </>
                  ) : (
                    <>
                      <Download color={colors.iconOnPrimary} size={18} strokeWidth={2} style={{ marginRight: 8 }} />
                      <Text className="text-white text-[15px] font-semibold">{t.resourceDownload}</Text>
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

interface FileRowProps {
  apiBaseUrl: string;
  isSelected?: boolean;
  isVisible?: boolean;
  item: FileListItem;
  onDelete: (id: string, name: string, isFolder: boolean) => void;
  onFolderPress?: (item: FileListItem) => void;
  onLongPressItem?: (item: FileListItem) => void;
  onMoveToFolder?: (item: FileListItem) => void;
  onPress: (item: FileListItem) => void;
  onSelect?: (item: FileListItem) => void;
  selectMode?: boolean;
  showFolderActions?: boolean;
}

function FileRow({
  item,
  isSelected,
  isVisible = true,
  onDelete,
  onFolderPress,
  onLongPressItem,
  onMoveToFolder,
  onPress,
  onSelect,
  apiBaseUrl,
  selectMode,
  showFolderActions,
}: FileRowProps) {
  const colors = useThemeColors();
  const { t } = useI18n();
  const iconColor = colors.secondaryText;
  const [thumbnailIndex, setThumbnailIndex] = useState(0);
  const [thumbnailDataUrl, setThumbnailDataUrl] = useState<string | null>(null);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const [tryDirectUrl, setTryDirectUrl] = useState(true);
  const itemIsFolder = isFolder(item);
  const isImageFile = !itemIsFolder && isImage(item.fileType, item.name);
  const thumbnailCandidates = isImageFile
    ? buildRemoteFileCandidates(apiBaseUrl, item)
    : [];
  const thumbnailUrl = thumbnailCandidates[thumbnailIndex] || null;

  useEffect(() => {
    setThumbnailIndex(0);
    setThumbnailDataUrl(null);
    setThumbnailFailed(false);
    setTryDirectUrl(true);
  }, [apiBaseUrl, item.id, item.url]);

  const handleDirectUrlError = useCallback(() => {
    setTryDirectUrl(false);
  }, []);

  const handleThumbnailError = useCallback(() => {
    setThumbnailDataUrl(null);

    if (thumbnailIndex < thumbnailCandidates.length - 1) {
      setThumbnailIndex((current) => current + 1);
      setTryDirectUrl(true);
      return;
    }

    setThumbnailFailed(true);
  }, [thumbnailCandidates.length, thumbnailIndex]);

  const isLikelyImageResponse = useCallback((res: Response) => {
    if (!res.ok) return false;
    const contentType = res.headers.get('content-type')?.toLowerCase() || '';
    return (
      !contentType || contentType.startsWith('image/') || contentType.includes('octet-stream')
    );
  }, []);

  // Fallback: fetch via redirect when direct URL fails (ExpoImage may not follow 302 on some platforms)
  useEffect(() => {
    if (!isVisible || !thumbnailUrl || !isImageFile || tryDirectUrl) {
      if (!tryDirectUrl && isVisible) {
        setThumbnailDataUrl(null);
        setThumbnailFailed(false);
      }
      return;
    }

    setThumbnailFailed(false);
    setThumbnailDataUrl(null);
    let cancelled = false;

    const loadThumbnail = async () => {
      try {
        let res = await fetch(thumbnailUrl, { redirect: 'follow' });
        if (cancelled) return;
        if (__DEV__ && !isLikelyImageResponse(res)) {
          const authHeaders = await getAuthHeaders(apiBaseUrl);
          if (cancelled) return;
          if (Object.keys(authHeaders).length > 0) {
            res = await fetch(thumbnailUrl, { headers: authHeaders, redirect: 'follow' });
          }
        }
        if (cancelled) return;

        if (!isLikelyImageResponse(res)) {
          handleThumbnailError();
          return;
        }

        const blob = await res.blob();
        if (cancelled) return;

        const blobType = blob.type?.toLowerCase() || '';
        const maybeGenericBinary = !blobType || blobType.includes('octet-stream');
        if (!maybeGenericBinary && !isImageMimeType(blobType)) {
          handleThumbnailError();
          return;
        }

        if (!isImageMimeType(blobType)) {
          const header = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
          if (!hasKnownImageSignature(header)) {
            handleThumbnailError();
            return;
          }
        }

        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        if (cancelled) return;

        const preferredMime = isImageMimeType(blobType) ? blobType : item.fileType;
        const normalizedDataUrl = dataUrl.startsWith('data:image/')
          ? dataUrl
          : dataUrl.replace(/^data:[^;]+;/, `data:${preferredMime};`);

        setThumbnailDataUrl(normalizedDataUrl);
      } catch {
        if (!cancelled) handleThumbnailError();
      }
    };

    void loadThumbnail();
    return () => {
      cancelled = true;
    };
  }, [isVisible, apiBaseUrl, thumbnailUrl, isImageFile, tryDirectUrl, item.fileType, handleThumbnailError, isLikelyImageResponse]);

  const thumbnailSource = thumbnailDataUrl
    ? { uri: thumbnailDataUrl }
    : isVisible && tryDirectUrl && thumbnailUrl
      ? { uri: thumbnailUrl }
      : null;
  const showThumbnail = !!thumbnailSource && !thumbnailFailed;

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
        } else if (itemIsFolder) {
          onDelete(item.id, item.name, true);
        } else if (showFolderActions && onMoveToFolder) {
          Alert.alert(item.name, undefined, [
            { text: t.cancel, style: 'cancel' },
            { text: t.delete, style: 'destructive', onPress: () => onDelete(item.id, item.name, false) },
            { text: t.resourceMoveToFolder, onPress: () => onMoveToFolder(item) },
          ]);
        } else {
          onDelete(item.id, item.name, false);
        }
      }}
    >
      {selectMode && (
        <View className="mr-3 h-6 w-6 items-center justify-center rounded-full border-2" style={{ borderColor: isSelected ? colors.primary : colors.muted }}>
          {isSelected && <Check color={colors.primary} size={14} strokeWidth={2.5} />}
        </View>
      )}
      <View className="mr-3 h-12 w-12 items-center justify-center rounded-xl bg-foreground/5">
        {itemIsFolder ? (
          <Folder color={iconColor} size={26} strokeWidth={tokens.icon.strokeWidth} />
        ) : showThumbnail && thumbnailSource ? (
          <ExpoImage
            cachePolicy="memory-disk"
            className="h-12 w-12 rounded-xl"
            contentFit="cover"
            source={thumbnailSource}
            transition={100}
            onError={tryDirectUrl ? handleDirectUrlError : handleThumbnailError}
          />
        ) : (
          <FileTypeIcon color={iconColor} fileName={item.name} fileType={item.fileType} size={26} />
        )}
      </View>

      <View className="min-w-0 flex-1">
        <Text className="text-[15px] font-medium text-foreground" numberOfLines={1}>
          {item.name}
        </Text>
        <Text className="mt-0.5 text-[12px]" style={{ color: colors.secondaryText }}>
          {itemIsFolder ? formatDate(item.createdAt) : `${formatBytes(item.size)}  ·  ${formatDate(item.createdAt)}`}
        </Text>
      </View>

      <View className="ml-2">
        {itemIsFolder ? (
          <ChevronRight color={colors.secondaryText} size={18} strokeWidth={1.5} />
        ) : (
          <Eye color={colors.secondaryText} size={16} strokeWidth={1.5} />
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────

export default function ResourceScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const colors = useThemeColors();

  const [files, setFiles] = useState<FileListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [category, setCategory] = useState<FileCategory>('all');
  const [searchText, setSearchText] = useState('');
  const [apiBase, setApiBase] = useState('');
  const [attachmentSheetVisible, setAttachmentSheetVisible] = useState(false);
  const [previewItem, setPreviewItem] = useState<FileListItem | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [libraryId, setLibraryId] = useState<string | null>(null);
  const [currentFolderSlug, setCurrentFolderSlug] = useState<string | null>(null);
  const [folderBreadcrumb, setFolderBreadcrumb] = useState<FolderCrumb[]>([]);
  const [libraries, setLibraries] = useState<KnowledgeBaseItem[]>([]);
  const [librarySelectVisible, setLibrarySelectVisible] = useState(false);
  const [createFolderVisible, setCreateFolderVisible] = useState(false);
  const [createFolderName, setCreateFolderName] = useState('');
  const [moveToFolderItem, setMoveToFolderItem] = useState<FileListItem | null>(null);
  const [moveTargetFolders, setMoveTargetFolders] = useState<FileListItem[]>([]);
  const [moveFolderStack, setMoveFolderStack] = useState<Array<{ id: string; name: string } | null>>([
    null,
  ]);
  const [sorter, setSorter] = useState<SorterType>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sortMenuVisible, setSortMenuVisible] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionItem, setActionItem] = useState<FileListItem | null>(null);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());
  const viewabilityConfig = useMemo(
    () => ({ itemVisiblePercentThreshold: 10, minimumViewTime: 100 }),
    [],
  );
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: Array<{ item: FileListItem }> }) => {
    setVisibleIds((prev) => {
      const next = new Set(prev);
      for (const { item } of viewableItems) {
        next.add(item.id);
      }
      return next;
    });
  }, []);
  const nextOffsetRef = useRef(0);
  const loadRequestRef = useRef(0);
  const searchRef = useRef<TextInput>(null);

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

  const loadFiles = useCallback(
    async (silent = false, append = false) => {
      const ticket = ++loadRequestRef.current;
      const loadOffset = append ? nextOffsetRef.current : 0;
      if (!silent) setLoading(append ? false : true);
      if (append) setLoadingMore(true);
      try {
        const base = await getApiUrl();
        setApiBase(base);
        const result = await resourceApi.getKnowledgeItems({
          category: category === 'all' ? undefined : category,
          knowledgeBaseId: libraryId ?? undefined,
          limit: 50,
          offset: loadOffset,
          parentId: currentFolderSlug ?? null,
          q: searchText || undefined,
          sorter,
          sortType: sortOrder,
        });
        if (ticket !== loadRequestRef.current) return;
        const items = result?.items ?? [];
        setHasMore(result?.hasMore ?? false);
        nextOffsetRef.current = loadOffset + items.length;
        setFiles(append ? (prev) => [...prev, ...items] : items);
      } catch {
        if (ticket !== loadRequestRef.current) return;
        if (!append) setFiles([]);
      } finally {
        if (ticket === loadRequestRef.current) {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [category, searchText, libraryId, currentFolderSlug, sorter, sortOrder],
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
              if (item?.fileType === 'custom/folder') {
                await resourceApi.deleteDocument(id);
              } else {
                await fileApi.remove(id);
              }
            }
            haptics.success();
            clearSelection();
            await loadFiles(true);
          } catch {
            toast.show('error', t.resourceDeleteFailed);
          }
        },
      },
    ]);
  }, [selectedIds, files, clearSelection, loadFiles, t, toast]);

  const [batchMoveIds, setBatchMoveIds] = useState<Set<string>>(new Set());

  const handleBatchMove = useCallback(() => {
    setBatchMoveIds(new Set(selectedIds));
    setMoveToFolderItem({ id: '__batch__', name: '', fileType: '', size: 0, createdAt: '', sourceType: 'file', url: '' } as FileListItem);
    setMoveFolderStack([null]);
  }, [selectedIds]);

  const moveFolderParentId = moveFolderStack[moveFolderStack.length - 1]?.id ?? null;
  const moveFolderCurrent = moveFolderStack.length > 1 ? moveFolderStack[moveFolderStack.length - 1] : null;

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
  }, [loadLibraries]);

  useEffect(() => {
    if (currentFolderSlug) {
      loadFolderBreadcrumb(currentFolderSlug);
    } else {
      setFolderBreadcrumb([]);
    }
  }, [currentFolderSlug, loadFolderBreadcrumb]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadFiles(true);
  }, [loadFiles]);

  const handleFolderPress = useCallback((item: FileListItem) => {
    const slug = item.slug || item.id;
    setCurrentFolderSlug(slug);
  }, []);

  const handleBreadcrumbPress = useCallback((item: FolderCrumb, index: number) => {
    if (index === folderBreadcrumb.length - 1) return;
    setCurrentFolderSlug(item.slug);
  }, [folderBreadcrumb.length]);

  const handleBackToRoot = useCallback(() => {
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
        parentId: currentFolderSlug ?? undefined,
        title: name,
      });
      haptics.success();
      await loadFiles(true);
    } catch {
      toast.show('error', t.resourceUploadFailed);
    }
  }, [libraryId, currentFolderSlug, createFolderName, loadFiles, t.resourceNewFolder, t.resourceUploadFailed, toast]);

  const handleMoveToFolder = useCallback(
    async (targetFolderId: string | null) => {
      const isBatch = batchMoveIds.size > 0;
      const idsToMove = isBatch ? Array.from(batchMoveIds) : moveToFolderItem ? [moveToFolderItem.id] : [];
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
        await loadFiles(true);
      } catch {
        toast.show('error', t.resourceUploadFailed);
      }
    },
    [moveToFolderItem, batchMoveIds, files, clearSelection, loadFiles, t.done, t.resourceUploadFailed, toast],
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
          parentId: currentFolderSlug ?? undefined,
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
        await loadFiles(true);
      } catch {
        toast.show('error', t.resourceUploadFailed);
      } finally {
        setUploading(false);
        setUploadProgress(0);
      }
    },
    [loadFiles, libraryId, currentFolderSlug, t, toast],
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
    ? libraries.find((l) => l.id === libraryId)?.name ?? ''
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
              if (isFolderItem) {
                await resourceApi.deleteDocument(id);
              } else {
                await fileApi.remove(id);
              }
              haptics.success();
              setFiles((prev) => prev.filter((f) => f.id !== id));
            } catch {
              toast.show('error', t.resourceDeleteFailed);
            }
          },
        },
      ]);
    },
    [t, toast],
  );

  const closeActionSheet = useCallback(() => setActionItem(null), []);

  const handleLongPressItem = useCallback((item: FileListItem) => {
    setActionItem(item);
  }, []);

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
          prev.map((f) =>
            f.id === actionItem.id ? { ...f, name: newName.trim() } : f,
          ),
        );
        toast.show('success', t.resourceRenamed);
      } catch {
        toast.show('error', t.resourceRenameFailed);
      }
    },
    [actionItem, t, toast],
  );

  const handleShare = useCallback(
    async (item: FileListItem) => {
      closeActionSheet();
      const base = apiBase?.replace(/\/$/, '') || '';
      const url = base ? `${base}/f/${item.id}` : '';
      if (!url) return;
      try {
        await Share.share(
          Platform.OS === 'ios'
            ? { title: item.name, url }
            : { message: url, title: item.name },
        );
      } catch {
        toast.show('error', t.resourceShareFailed);
      }
    },
    [apiBase, closeActionSheet, t, toast],
  );

  // ── Filtered & sorted files ────────────────────────────────────────

  const filtered = sortFileList(
    files.filter((f) => matchesCategory(f, category)),
    sorter,
    sortOrder,
  );

  const handleLoadMore = useCallback(() => {
    if (!hasMore || loadingMore) return;
    void loadFiles(true, true);
  }, [hasMore, loadingMore, loadFiles]);

  const getSortLabel = () => {
    if (sorter === 'createdAt') return sortOrder === 'desc' ? t.resourceSortNewest : t.resourceSortOldest;
    if (sorter === 'name') return `${t.resourceSortName} ${sortOrder === 'asc' ? 'A-Z' : 'Z-A'}`;
    return `${t.resourceSortSize} ${sortOrder === 'asc' ? '↑' : '↓'}`;
  };

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
        rightAccessibilityLabel={
          selectMode ? t.resourceCancelSelect : t.resourceViewModeToggle
        }
        title={selectMode ? t.resourceSelectCount.replace('{count}', String(selectedIds.size)) : t.resourceTitle}
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
            <View className="flex-row items-center" style={{ gap: 20 }}>
              <TouchableOpacity
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                onPress={() => setViewMode((m) => (m === 'list' ? 'grid' : 'list'))}
              >
                {viewMode === 'list' ? (
                  <Grid3X3 color={colors.primary} size={22} strokeWidth={tokens.icon.strokeWidth} />
                ) : (
                  <List color={colors.primary} size={22} strokeWidth={tokens.icon.strokeWidth} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
                onPress={() => setSelectMode(true)}
              >
                <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '500' }}>
                  {t.resourceSelect}
                </Text>
              </TouchableOpacity>
            </View>
          )
        }
        titleIcon={
          <FolderOpen color={colors.primary} size={20} strokeWidth={tokens.icon.strokeWidth} />
        }
      >
        {/* Library selector */}
        <TouchableOpacity
          activeOpacity={0.7}
          className="mx-5 mb-2 flex-row items-center rounded-xl bg-foreground/[0.04] px-3.5 py-2.5"
          onPress={() => setLibrarySelectVisible(true)}
        >
          <FolderOpen color={colors.primary} size={18} strokeWidth={tokens.icon.strokeWidth} />
          <Text className="ml-2.5 flex-1 text-[14px] font-medium text-foreground" numberOfLines={1}>
            {currentLibraryName}
          </Text>
          <ChevronRight color={colors.muted} size={18} strokeWidth={1.5} />
        </TouchableOpacity>

        {/* Breadcrumb when in folder */}
        {folderBreadcrumb.length > 0 && (
          <ScrollView
            className="mx-4 mb-2"
            contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            <TouchableOpacity
              activeOpacity={0.7}
              className="flex-row items-center rounded-full px-3 py-1.5"
              style={{ backgroundColor: colors.fillTertiary }}
              onPress={handleBackToRoot}
            >
              <ArrowLeft color={colors.primary} size={14} strokeWidth={2} />
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
                    color: index === folderBreadcrumb.length - 1 ? colors.iconOnPrimary : colors.muted,
                    maxWidth: 80,
                  }}
                >
                  {crumb.name}
                </Text>
                {index < folderBreadcrumb.length - 1 && (
                  <ChevronRight
                    color={colors.muted}
                    size={14}
                    strokeWidth={1.5}
                    style={{ marginLeft: 4 }}
                  />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <View className="mx-5 mb-2 flex-row items-center rounded-xl bg-foreground/[0.04] px-3.5 py-2.5">
          <Search color={colors.muted} size={16} strokeWidth={2} />
          <TextInput
            className="ml-2.5 flex-1 text-[14px] text-foreground"
            placeholder={t.search}
            placeholderTextColor={colors.muted}
            ref={searchRef}
            returnKeyType="search"
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={() => loadFiles()}
          />
          {searchText.length > 0 && (
            <TouchableOpacity hitSlop={8} onPress={() => setSearchText('')}>
              <X color={colors.muted} size={16} strokeWidth={2} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter tabs + sort (single row) */}
        <View className="mx-4 mb-2 flex-row items-center justify-between">
          <ScrollView
            contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flex: 1 }}
          >
            {TABS.map((tab) => {
              const active = category === tab.key;
              return (
                <TouchableOpacity
                  activeOpacity={0.7}
                  className="rounded-full px-4 py-2"
                  key={tab.key}
                  style={{
                    backgroundColor: active ? colors.primary : colors.fillTertiary,
                  }}
                  onPress={() => {
                    haptics.selection();
                    setCategory(tab.key);
                  }}
                >
                  <Text
                    className="text-[13px] font-semibold"
                    style={{ color: active ? colors.iconOnPrimary : colors.muted }}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <TouchableOpacity
            activeOpacity={0.7}
            accessibilityLabel={`${t.resourceSortBy}: ${getSortLabel()}`}
            accessibilityRole="button"
            className="ml-2 items-center justify-center rounded-full p-2"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ backgroundColor: colors.fillTertiary }}
            onPress={() => setSortMenuVisible(true)}
          >
            <ArrowDownUp color={colors.primary} size={18} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </ScreenHeader>

      {/* Batch action bar */}
      {selectMode && selectedIds.size > 0 && (
        <View
          className="flex-row items-center justify-around border-t border-border bg-card px-4 py-3"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          <TouchableOpacity
            className="flex-1 items-center"
            onPress={handleBatchDelete}
          >
            <Text style={{ color: colors.danger }}>{t.resourceBatchDelete}</Text>
          </TouchableOpacity>
          {libraryId && (
            <TouchableOpacity
              className="flex-1 items-center"
              onPress={handleBatchMove}
            >
              <Text style={{ color: colors.primary }}>{t.resourceBatchMove}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Content */}
      {loading && files.length === 0 ? (
        <FileGridSkeleton />
      ) : (
        <FlatList
          key={viewMode}
          columnWrapperStyle={viewMode === 'grid' ? { justifyContent: 'space-between', paddingHorizontal: 12 } : undefined}
          ItemSeparatorComponent={
            viewMode === 'list' ? () => <View className="mx-4 h-px bg-foreground/5" /> : undefined
          }
          data={filtered}
          keyExtractor={(item) => item.id}
          numColumns={viewMode === 'grid' ? 3 : 1}
          ListEmptyComponent={
            <EmptyState
              action={
                <View className="flex-row flex-wrap justify-center gap-3 mt-2">
                  <TouchableOpacity
                    activeOpacity={0.7}
                    className="flex-row items-center rounded-2xl px-5 py-3"
                    style={{ backgroundColor: colors.primary }}
                    onPress={handleUpload}
                  >
                    <Plus color={colors.iconOnPrimary} size={18} strokeWidth={2.5} />
                    <Text className="ml-2 text-[15px] font-semibold" style={{ color: colors.iconOnPrimary }}>
                      {t.resourceUpload}
                    </Text>
                  </TouchableOpacity>
                  {libraryId && (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      className="flex-row items-center rounded-2xl px-5 py-3"
                      style={{ backgroundColor: colors.primary + '20', borderWidth: 1, borderColor: colors.primary }}
                      onPress={() => setCreateFolderVisible(true)}
                    >
                      <Folder color={colors.primary} size={18} strokeWidth={tokens.icon.strokeWidth} />
                      <Text className="ml-2 text-[15px] font-semibold" style={{ color: colors.primary }}>
                        {t.resourceNewFolder}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              }
              description={
                currentFolderSlug ? t.resourceFolderEmptyDesc : t.resourceEmptyDesc
              }
              iconVariant="resource"
              title={currentFolderSlug ? t.resourceFolderEmpty : t.resourceEmpty}
            />
          }
          contentContainerStyle={
            filtered.length === 0
              ? {
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingBottom: insets.bottom + 80,
                }
              : { paddingBottom: insets.bottom + 80 }
          }
          refreshControl={
            <RefreshControl
              colors={[colors.primary]}
              refreshing={refreshing}
              tintColor={colors.primary}
              onRefresh={onRefresh}
            />
          }
          ListFooterComponent={
            hasMore ? (
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
          onEndReached={hasMore && !loadingMore ? handleLoadMore : undefined}
          onEndReachedThreshold={0.3}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          renderItem={({ item }) =>
            viewMode === 'grid' ? (
              <TouchableOpacity
                activeOpacity={0.7}
                className="flex-1 m-1 items-center rounded-xl bg-foreground/5 p-3"
                style={viewMode === 'grid' ? { minWidth: 0 } : undefined}
                onPress={() =>
                  selectMode
                    ? toggleSelect(item)
                    : isFolder(item) && libraryId
                      ? handleFolderPress(item)
                      : handlePreview(item)
                }
                onLongPress={() =>
                  selectMode
                    ? toggleSelect(item)
                    : libraryId
                      ? handleLongPressItem(item)
                      : handleDelete(item.id, item.name, isFolder(item))
                }
              >
                {selectMode && (
                  <View
                    className="absolute right-2 top-2 z-10 h-5 w-5 items-center justify-center rounded-full border-2"
                    style={{ borderColor: selectedIds.has(item.id) ? colors.primary : colors.muted }}
                  >
                    {selectedIds.has(item.id) && <Check color={colors.primary} size={12} strokeWidth={2.5} />}
                  </View>
                )}
                <View className="h-14 w-14 items-center justify-center">
                  {isFolder(item) ? (
                    <Folder color={colors.muted} size={28} strokeWidth={tokens.icon.strokeWidth} />
                  ) : isImage(item.fileType, item.name) ? (
                    (() => {
                      const imgUrl = buildRemoteFileCandidates(apiBase, item)[0];
                      return imgUrl ? (
                        <ExpoImage
                          cachePolicy="memory-disk"
                          className="h-14 w-14 rounded-lg bg-foreground/5"
                          contentFit="cover"
                          source={{ uri: imgUrl }}
                        />
                      ) : (
                        <FileTypeIcon color={colors.muted} fileName={item.name} fileType={item.fileType} size={28} />
                      );
                    })()
                  ) : (
                    <FileTypeIcon color={colors.muted} fileName={item.name} fileType={item.fileType} size={28} />
                  )}
                </View>
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
                isSelected={selectedIds.has(item.id)}
                isVisible={visibleIds.size === 0 || visibleIds.has(item.id)}
                item={item}
                onDelete={handleDelete}
                onFolderPress={libraryId ? handleFolderPress : undefined}
                onLongPressItem={libraryId ? handleLongPressItem : undefined}
                onMoveToFolder={
                  libraryId
                    ? (i) => {
                        setMoveToFolderItem(i);
                        setBatchMoveIds(new Set());
                        setMoveFolderStack([null]);
                      }
                    : undefined
                }
                onPress={handlePreview}
                onSelect={selectMode ? toggleSelect : undefined}
                selectMode={selectMode}
                showFolderActions={!!libraryId}
              />
            )
          }
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
                  <Text className="text-[9px] font-medium mt-0.5" style={{ color: colors.iconOnPrimary }}>
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
        onClose={() => setAttachmentSheetVisible(false)}
        visible={attachmentSheetVisible}
      />

      <FilePreviewModal
        apiBaseUrl={apiBase}
        item={previewItem}
        visible={previewVisible}
        onClose={() => setPreviewVisible(false)}
      />

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
                <Text className="text-base font-medium" style={{ color: colors.secondaryText }}>{t.cancel}</Text>
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
        animationType="slide"
        transparent
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
                    backgroundColor: libraryId === lib.id ? colors.primary + '20' : colors.fillTertiary,
                  }}
                  onPress={() => {
                    setLibraryId(lib.id);
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
        animationType="slide"
        transparent
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
                  moveFolderStack.length > 1
                    ? setMoveFolderStack((s) => s.slice(0, -1))
                    : undefined
                }
              >
                {moveFolderStack.length > 1 ? (
                  <ArrowLeft color={colors.primary} size={22} strokeWidth={2} />
                ) : (
                  <View style={{ width: 22 }} />
                )}
              </TouchableOpacity>
              <Text className="flex-1 text-center text-[18px] font-bold text-foreground" numberOfLines={1}>
                {batchMoveIds.size > 0
                  ? t.resourceSelectCount.replace('{count}', String(batchMoveIds.size))
                  : moveFolderCurrent?.name ?? t.resourceMoveToFolder}
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
                <FolderOpen color={colors.primary} size={22} strokeWidth={tokens.icon.strokeWidth} />
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
                  <Text className="ml-3 flex-1 text-[16px] font-medium" numberOfLines={1} style={{ color: colors.primary }}>
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
                    setMoveFolderStack((s) => [...s, { id: folder.slug ?? folder.id, name: folder.name }])
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
        animationType="fade"
        transparent
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
              { sorter: 'name' as const, order: 'asc' as const, label: `${t.resourceSortName} A-Z` },
              { sorter: 'name' as const, order: 'desc' as const, label: `${t.resourceSortName} Z-A` },
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
                  nextOffsetRef.current = 0;
                  void loadFiles(false, false);
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
        animationType="fade"
        transparent
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
