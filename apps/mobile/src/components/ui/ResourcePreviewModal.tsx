import { useRoute } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system/legacy';
import { Image as ExpoImage } from 'expo-image';
import { ArrowLeft, Download, GitBranch, MessageCircle, Pencil, Share2 } from 'lucide-react-native';
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { fileApi, resourceApi } from '../../lib/api';
import { formatMobileDate } from '../../lib/dateTime';
import { haptics } from '../../lib/haptics';
import { useI18n } from '../../lib/i18n';
import { navigateToConversationOrigin, navigateToNotebook } from '../../lib/navigation';
import { getNotebookTablePreview, isTableNotebookDocument } from '../../lib/notebookDocument';
import { appendCurrentPortalStack } from '../../lib/portalNavigation';
import { type ResourceCacheEntry, saveResourceCacheEntry } from '../../lib/resourceCache';
import { formatBytes, isImage, isMarkdownFile, isTextLikeFile } from '../../lib/resourceFile';
import { getCanonicalResourceKind } from '../../lib/resourceList';
import {
  buildRemoteFetchInit,
  buildRemoteFileCandidates,
  buildRemoteSource,
  ensureNotebookDocumentFromFile,
  ensurePreviewCacheEntry,
} from '../../lib/resourcePreview';
import { getResponsiveLayoutMetrics } from '../../lib/responsiveLayout';
import type { ConversationOriginRouteParams } from '../../navigation/types';
import { useThemeColors } from '../../theme/colors';
import { tokens } from '../../theme/tokens';
import type { FileListItem } from '../../types';
import MarkdownPreview from './MarkdownPreview';
import ResourceFileTypeIcon from './ResourceFileTypeIcon';
import ResourceShareOptionsSheet from './ResourceShareOptionsSheet';
import { useToast } from './Toast';

const EMPTY_HEADERS: Record<string, string> = {};

interface ResourcePreviewModalProps {
  apiBaseUrl: string;
  initialCachedEntry?: ResourceCacheEntry | null;
  item: FileListItem | null;
  onCacheReady?: (entry: ResourceCacheEntry) => void;
  onClose: () => void;
  onReplaceItem?: (item: FileListItem, previousId?: string) => void;
  origin?: ConversationOriginRouteParams | null;
  remoteHeaders?: Record<string, string>;
  visible: boolean;
}

const formatDate = (isoString: string) => formatMobileDate(isoString);

const ResourcePreviewModal = memo(
  ({
    apiBaseUrl,
    initialCachedEntry,
    item,
    onCacheReady,
    onClose,
    onReplaceItem,
    origin,
    remoteHeaders = EMPTY_HEADERS,
    visible,
  }: ResourcePreviewModalProps) => {
    const route = useRoute();
    const insets = useSafeAreaInsets();
    const { height: screenHeight, width: screenWidth } = useWindowDimensions();
    const { t } = useI18n();
    const toast = useToast();
    const colors = useThemeColors();
    const responsiveMetrics = getResponsiveLayoutMetrics(screenWidth, screenHeight);
    const isTabletPreview = responsiveMetrics.isTablet;
    const previewHeaderMaxWidth = responsiveMetrics.isWideTablet ? 1180 : 960;
    const previewDocumentWidth = Math.min(
      Math.max(screenWidth - 32, 0),
      responsiveMetrics.isWideTablet ? 1040 : 860,
    );
    const previewTextWidth = Math.min(
      Math.max(screenWidth - 32, 0),
      responsiveMetrics.isWideTablet ? 920 : 780,
    );
    const previewMediaWidth = isTabletPreview
      ? Math.min(Math.max(screenWidth - 48, 0), responsiveMetrics.isWideTablet ? 1100 : 900)
      : screenWidth;
    const itemKind = getCanonicalResourceKind(item);
    const [imgLoading, setImgLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [previewIndex, setPreviewIndex] = useState(0);
    const [preparingPreview, setPreparingPreview] = useState(false);
    const [previewCacheProgress, setPreviewCacheProgress] = useState(0);
    const [cachedEntry, setCachedEntry] = useState<ResourceCacheEntry | null>(
      initialCachedEntry ?? null,
    );
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
      setCachedEntry(initialCachedEntry ?? null);
      setPdfDataUrl(null);
      setTextContent(null);
      setEditingText(false);
      setPreviewLoadFailed(false);
      setDownloadProgress(0);
      setSavingEdit(false);
      setConvertingToDocument(false);
      setTextDraft('');
      setShareSheetOpen(false);
    }, [apiBaseUrl, initialCachedEntry, item?.id, visible]);

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
        if (!shouldWarmCache) return;
        setPreparingPreview(true);
        setPreviewCacheProgress(0);

        try {
          const nextEntry = await ensurePreviewCacheEntry(item, {
            onProgress: (progress) => {
              if (!cancelled) setPreviewCacheProgress(progress);
            },
          });
          if (cancelled) return;

          if (nextEntry) {
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

    useEffect(() => {
      if (!pdfFile || !fileUrl || !visible || cachedEntry?.localUri) return;

      let cancelled = false;

      const loadPdf = async () => {
        try {
          const res = await fetch(fileUrl, {
            ...buildRemoteFetchInit(apiBaseUrl, fileUrl, remoteHeaders),
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
    }, [
      apiBaseUrl,
      cachedEntry?.localUri,
      fileUrl,
      handlePreviewError,
      pdfFile,
      remoteHeaders,
      visible,
    ]);

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
            ...buildRemoteFetchInit(apiBaseUrl, fileUrl, remoteHeaders),
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
      apiBaseUrl,
      cachedEntry?.localUri,
      fileUrl,
      handlePreviewError,
      item,
      item?.content,
      item?.id,
      itemKind,
      remoteHeaders,
      textFile,
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

    const handleDownload = async () => {
      if (downloading) return;

      setDownloading(true);
      setDownloadProgress(0);

      try {
        const { localUri } = await fileApi.download(item, {
          onProgress: (progress) => setDownloadProgress(progress),
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

            <View
              className="flex-row items-center px-4"
              style={{
                alignSelf: 'center',
                maxWidth: isTabletPreview ? previewHeaderMaxWidth : undefined,
                paddingTop: insets.top + 8,
                paddingBottom: 10,
                backgroundColor: imageFile ? colors.overlayDark : colors.background,
                width: '100%',
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
                hitSlop={{ bottom: 10, left: 10, right: 10, top: 10 }}
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
                    hitSlop={{ bottom: 10, left: 10, right: 10, top: 10 }}
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
                      hitSlop={{ bottom: 10, left: 10, right: 10, top: 10 }}
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
                      hitSlop={{ bottom: 10, left: 10, right: 10, top: 10 }}
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
                    hitSlop={{ bottom: 10, left: 10, right: 10, top: 10 }}
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
                  hitSlop={{ bottom: 10, left: 10, right: 10, top: 10 }}
                  onPress={() => setShareSheetOpen(true)}
                >
                  <Share2
                    color={imageFile ? colors.mediaOnBackdrop : colors.primary}
                    size={20}
                    strokeWidth={1.8}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={downloading}
                  hitSlop={{ bottom: 10, left: 10, right: 10, top: 10 }}
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
                  <View
                    className="flex-1 items-center justify-center"
                    style={{ paddingHorizontal: isTabletPreview ? 24 : 0 }}
                  >
                    {imgLoading ? (
                      <ActivityIndicator
                        color={colors.mediaOnBackdrop}
                        size="large"
                        style={{ position: 'absolute', zIndex: 1 }}
                      />
                    ) : null}
                    <ExpoImage
                      cachePolicy="memory-disk"
                      contentFit="contain"
                      style={{ height: screenHeight * 0.75, width: previewMediaWidth }}
                      transition={120}
                      source={
                        cachedEntry?.localUri
                          ? { uri: cachedEntry.localUri }
                          : buildRemoteSource(apiBaseUrl, fileUrl, remoteHeaders)
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
                      contentContainerStyle={{
                        alignItems: isTabletPreview ? 'center' : undefined,
                        padding: 16,
                        paddingBottom: 32,
                      }}
                    >
                      <View
                        className="mb-4 rounded-2xl border px-4 py-4"
                        style={{
                          backgroundColor: colors.fillQuaternary,
                          borderColor: colors.borderSubtle,
                          maxWidth: previewDocumentWidth,
                          width: '100%',
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
                              minWidth: Math.max(
                                previewDocumentWidth,
                                tablePreview.columns.length * 156,
                              ),
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
                    <Text
                      className="text-center text-[14px]"
                      style={{ color: colors.secondaryText }}
                    >
                      {t.resourceTablePreviewUnavailable}
                    </Text>
                  </View>
                ) : pdfFile && !fileUrl ? (
                  <View className="flex-1 items-center justify-center px-8">
                    <Text
                      className="text-center text-[14px]"
                      style={{ color: colors.secondaryText }}
                    >
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
                    <Text
                      className="text-center text-[14px]"
                      style={{ color: colors.secondaryText }}
                    >
                      {t.resourcePreviewUnavailable}
                    </Text>
                  </View>
                ) : textFile && editingText ? (
                  <View
                    className="flex-1 items-center px-4 pb-6 pt-4"
                    style={{ backgroundColor: colors.background }}
                  >
                    <View style={{ flex: 1, maxWidth: previewTextWidth, width: '100%' }}>
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
                  </View>
                ) : textFile && textContent ? (
                  markdownFile ? (
                    <MarkdownPreview
                      containerStyle={{ backgroundColor: colors.background }}
                      content={textContent}
                      contentMaxWidth={previewTextWidth}
                    />
                  ) : (
                    <ScrollView
                      className="flex-1"
                      style={{ backgroundColor: colors.background }}
                      contentContainerStyle={{
                        alignItems: isTabletPreview ? 'center' : undefined,
                        padding: 16,
                        paddingBottom: 32,
                      }}
                    >
                      <View style={{ maxWidth: previewTextWidth, width: '100%' }}>
                        <Text
                          selectable
                          className="text-[15px] leading-6"
                          style={{ color: colors.foreground }}
                        >
                          {textContent}
                        </Text>
                      </View>
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
                    <Text
                      className="text-center text-[14px]"
                      style={{ color: colors.secondaryText }}
                    >
                      {t.resourcePreviewUnavailable}
                    </Text>
                  </View>
                ) : documentSource ? (
                  <View
                    className="flex-1 items-center"
                    style={{
                      backgroundColor: colors.inputBg,
                      paddingHorizontal: isTabletPreview ? 24 : 0,
                    }}
                  >
                    <View style={{ flex: 1, maxWidth: previewDocumentWidth, width: '100%' }}>
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
                    </View>
                  </View>
                ) : (
                  <View className="flex-1 items-center justify-center px-8">
                    <Text
                      className="text-center text-[14px]"
                      style={{ color: colors.secondaryText }}
                    >
                      {t.resourcePreviewUnavailable}
                    </Text>
                  </View>
                )
              ) : (
                <View className="flex-1 items-center justify-center px-8">
                  <View
                    className="items-center justify-center rounded-3xl bg-foreground/5 mb-6"
                    style={{ height: 96, width: 96 }}
                  >
                    <ResourceFileTypeIcon
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
          visible={shareSheetOpen}
          target={{
            id: item.id,
            kind: itemKind,
            name: item.name || item.id,
          }}
          onClose={() => setShareSheetOpen(false)}
          onFail={() => toast.show('error', t.resourceShareFailed)}
          onSuccess={() => haptics.success()}
        />
      </>
    );
  },
);

ResourcePreviewModal.displayName = 'ResourcePreviewModal';

export default ResourcePreviewModal;
