/**
 * ResourceScreen — File / Resource management aligned with web /resource
 *
 * Features:
 *  • List all user files with tabs: All, Images, Documents, Others
 *  • Upload via camera roll (ImagePicker) or file picker (DocumentPicker)
 *  • Delete files with confirmation alert
 *  • Pull-to-refresh
 *  • Search filter
 *  • Image thumbnail preview inline
 */
import * as DocumentPicker from 'expo-document-picker';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowLeft,
  Download,
  Eye,
  File,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  FolderOpen,
  Plus,
  Search,
  Share2,
  X,
} from 'lucide-react-native';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Modal,
  Platform,
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
import FileGridSkeleton from '../components/ui/FileGridSkeleton';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { useToast } from '../components/ui/Toast';
import { fileApi, getApiUrl } from '../lib/api';
import { getAuthHeaders } from '../lib/auth';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { codeInlineRules } from '../lib/markdownRules';
import { useConnectionStore } from '../store/connection';
import { useThemeColors } from '../theme/colors';
import { tokens } from '../theme/tokens';
import type { FileListItem } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────

type FileCategory = 'all' | 'images' | 'documents' | 'others';
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

function isDocument(fileType: string): boolean {
  const docs = ['application/pdf', 'text/', 'application/msword', 'application/vnd'];
  return docs.some((p) => fileType.startsWith(p));
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
  if (category === 'all') return true;
  if (category === 'images') return isImage(item.fileType, item.name);
  if (category === 'documents') return isDocument(item.fileType);
  if (category === 'others') return !isImage(item.fileType, item.name) && !isDocument(item.fileType);
  return true;
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
  if (isDocument(fileType))
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
      try {
        await fileApi.download(item, {
          onProgress: () => undefined,
        });
        haptics.success();
        toast.show('success', t.resourceDownloaded);
      } catch {
        toast.show('error', t.resourceDownloadFailed);
      } finally {
        setDownloading(false);
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
                  <ActivityIndicator color={imageFile ? '#fff' : colors.primary} size="small" />
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
                    <ActivityIndicator color={colors.iconOnPrimary} size="small" style={{ marginRight: 8 }} />
                  ) : (
                    <Download color={colors.iconOnPrimary} size={18} strokeWidth={2} style={{ marginRight: 8 }} />
                  )}
                  <Text className="text-white text-[15px] font-semibold">{t.resourceDownload}</Text>
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
  item: FileListItem;
  onDelete: (id: string, name: string) => void;
  onPress: (item: FileListItem) => void;
}

function FileRow({ item, onDelete, onPress, apiBaseUrl }: FileRowProps) {
  const colors = useThemeColors();
  const iconColor = colors.secondaryText;
  const [thumbnailIndex, setThumbnailIndex] = useState(0);
  const [thumbnailDataUrl, setThumbnailDataUrl] = useState<string | null>(null);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const isImageFile = isImage(item.fileType, item.name);
  const thumbnailCandidates = isImageFile
    ? buildRemoteFileCandidates(apiBaseUrl, item)
    : [];
  const thumbnailUrl = thumbnailCandidates[thumbnailIndex] || null;

  useEffect(() => {
    setThumbnailIndex(0);
    setThumbnailDataUrl(null);
    setThumbnailFailed(false);
  }, [apiBaseUrl, item.id, item.url]);

  const handleThumbnailError = useCallback(() => {
    setThumbnailDataUrl(null);

    if (thumbnailIndex < thumbnailCandidates.length - 1) {
      setThumbnailIndex((current) => current + 1);
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

  // Fetch image via redirect (native Image may not follow 302), convert to data URL
  useEffect(() => {
    if (!thumbnailUrl || !isImageFile) {
      setThumbnailDataUrl(null);
      setThumbnailFailed(false);
      return;
    }

    setThumbnailFailed(false);
    setThumbnailDataUrl(null);
    let cancelled = false;

    const loadThumbnail = async () => {
      try {
        // /f/:id is public and redirects to pre-signed URL. Try without auth headers first
        // to avoid passing Authorization/OIDC headers to object storage on redirect.
        let res = await fetch(thumbnailUrl, { redirect: 'follow' });
        if (cancelled) return;
        if (__DEV__ && !isLikelyImageResponse(res)) {
          console.warn('[ResourceScreen] thumbnail non-image response, retry with auth', {
            contentType: res.headers.get('content-type') || '',
            status: res.status,
            url: thumbnailUrl,
          });
        }

        if (!isLikelyImageResponse(res) && apiBaseUrl) {
          const authHeaders = await getAuthHeaders(apiBaseUrl);
          if (cancelled) return;

          if (Object.keys(authHeaders).length > 0) {
            res = await fetch(thumbnailUrl, {
              headers: authHeaders,
              redirect: 'follow',
            });
          }
        }
        if (cancelled) return;

        if (!isLikelyImageResponse(res)) {
          if (__DEV__) {
            console.warn('[ResourceScreen] thumbnail failed after retries', {
              contentType: res.headers.get('content-type') || '',
              status: res.status,
              url: thumbnailUrl,
            });
          }
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
  }, [apiBaseUrl, thumbnailUrl, isImageFile, item.fileType, handleThumbnailError, isLikelyImageResponse]);

  const showThumbnail = thumbnailDataUrl && !thumbnailFailed;

  return (
    <TouchableOpacity
      accessibilityLabel={`${item.name}, ${formatBytes(item.size)}`}
      accessibilityRole="button"
      activeOpacity={0.6}
      className="flex-row items-center px-5 py-3 bg-background"
      onPress={() => onPress(item)}
      onLongPress={() => {
        haptics.medium();
        onDelete(item.id, item.name);
      }}
    >
      <View className="mr-3 h-12 w-12 items-center justify-center rounded-xl bg-foreground/5">
        {showThumbnail ? (
          <ExpoImage
            cachePolicy="memory-disk"
            className="h-12 w-12 rounded-xl"
            contentFit="cover"
            source={thumbnailDataUrl!}
            transition={100}
            onError={handleThumbnailError}
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
          {formatBytes(item.size)}
          {'  ·  '}
          {formatDate(item.createdAt)}
        </Text>
      </View>

      <View className="ml-2">
        <Eye color={colors.secondaryText} size={16} strokeWidth={1.5} />
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
  const [category, setCategory] = useState<FileCategory>('all');
  const [searchText, setSearchText] = useState('');
  const [apiBase, setApiBase] = useState('');
  const [attachmentSheetVisible, setAttachmentSheetVisible] = useState(false);
  const [previewItem, setPreviewItem] = useState<FileListItem | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const searchRef = useRef<TextInput>(null);

  const handlePreview = useCallback((item: FileListItem) => {
    haptics.light();
    setPreviewItem(item);
    setPreviewVisible(true);
  }, []);

  // ── Data ─────────────────────────────────────────────────────────

  const loadFiles = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const base = await getApiUrl();
        setApiBase(base);
        const result = await fileApi.list({
          category: category === 'all' ? undefined : category,
          q: searchText || undefined,
        });
        setFiles(result ?? []);
      } catch {
        setFiles([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [category, searchText],
  );

  useEffect(() => {
    useConnectionStore.getState().checkConnection();
  }, []);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadFiles(true);
  }, [loadFiles]);

  // ── Upload ────────────────────────────────────────────────────────

  const doUpload = useCallback(
    async (uri: string, name: string, mimeType: string) => {
      setUploading(true);
      try {
        await fileApi.upload(uri, name, mimeType);
        haptics.success();
        await loadFiles(true);
      } catch {
        toast.show('error', t.resourceUploadFailed);
      } finally {
        setUploading(false);
      }
    },
    [loadFiles, t, toast],
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

  // ── Delete ────────────────────────────────────────────────────────

  const handleDelete = useCallback(
    (id: string, name: string) => {
      haptics.warning();
      Alert.alert(t.resourceDeleteConfirm, `"${name}"\n${t.resourceDeleteDesc}`, [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.delete,
          style: 'destructive',
          onPress: async () => {
            try {
              await fileApi.remove(id);
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

  // ── Filtered files ────────────────────────────────────────────────

  const filtered = files.filter((f) => matchesCategory(f, category));

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
        rightAccessibilityLabel={t.accessibilityAddResource}
        title={t.resourceTitle}
        rightElement={
          <Plus color={colors.primary} size={20} strokeWidth={tokens.icon.strokeWidth} />
        }
        titleIcon={
          <FolderOpen color={colors.primary} size={20} strokeWidth={tokens.icon.strokeWidth} />
        }
        onPressRight={() => setAttachmentSheetVisible(true)}
      >
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

        <ScrollView
          horizontal
          className="mx-4 mb-2"
          contentContainerStyle={{ gap: 4 }}
          showsHorizontalScrollIndicator={false}
        >
          {TABS.map((tab) => {
            const active = category === tab.key;
            return (
              <TouchableOpacity
                activeOpacity={0.7}
                className="rounded-full px-4 py-1.5"
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
      </ScreenHeader>

      {/* Content */}
      {loading && files.length === 0 ? (
        <FileGridSkeleton />
      ) : (
        <FlatList
          ItemSeparatorComponent={() => <View className="mx-4 h-px bg-foreground/5" />}
          data={filtered}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <EmptyState
              description={t.resourceEmptyDesc}
              iconVariant="resource"
              title={t.resourceEmpty}
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
          renderItem={({ item }) => (
            <FileRow
              apiBaseUrl={apiBase}
              item={item}
              onDelete={handleDelete}
              onPress={handlePreview}
            />
          )}
        />
      )}

      {/* Upload FAB */}
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
            <ActivityIndicator color={colors.iconOnPrimary} size="small" />
          ) : (
            <Plus color={colors.iconOnPrimary} size={26} strokeWidth={2.5} />
          )}
        </TouchableOpacity>
      </View>

      <AttachmentSheet
        visible={attachmentSheetVisible}
        onClose={() => setAttachmentSheetVisible(false)}
        onDocument={() => void handlePickFile()}
        onGallery={() => void handlePickPhoto()}
      />

      <FilePreviewModal
        apiBaseUrl={apiBase}
        item={previewItem}
        visible={previewVisible}
        onClose={() => setPreviewVisible(false)}
      />
    </View>
  );
}
