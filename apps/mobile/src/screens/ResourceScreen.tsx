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
  Image,
  Linking,
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
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import AttachmentSheet from '../components/ui/AttachmentSheet';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import SwipeableRow from '../components/ui/SwipeableRow';
import { useToast } from '../components/ui/Toast';
import { semanticColors } from '../constants/colors';
import { fileApi, getApiUrl } from '../lib/api';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { useConnectionStore } from '../store/connection';
import { tokens } from '../theme/tokens';
import type { FileListItem } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────

type FileCategory = 'all' | 'images' | 'documents' | 'others';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function isImage(fileType: string): boolean {
  return fileType.startsWith('image/');
}
function isDocument(fileType: string): boolean {
  const docs = ['application/pdf', 'text/', 'application/msword', 'application/vnd'];
  return docs.some((p) => fileType.startsWith(p));
}
function isAudio(fileType: string): boolean {
  return fileType.startsWith('audio/');
}
function isVideo(fileType: string): boolean {
  return fileType.startsWith('video/');
}

function matchesCategory(item: FileListItem, category: FileCategory): boolean {
  if (category === 'all') return true;
  if (category === 'images') return isImage(item.fileType);
  if (category === 'documents') return isDocument(item.fileType);
  if (category === 'others') return !isImage(item.fileType) && !isDocument(item.fileType);
  return true;
}

function FileTypeIcon({
  fileType,
  color,
  size = 28,
}: {
  fileType: string;
  color: string;
  size?: number;
}) {
  if (isImage(fileType))
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

// ── File Preview Modal ────────────────────────────────────────────────

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

function canPreviewInline(fileType: string): boolean {
  return (
    isImage(fileType) ||
    fileType === 'application/pdf' ||
    fileType.startsWith('text/') ||
    fileType === 'application/json'
  );
}

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
    const [imgLoading, setImgLoading] = useState(true);

    if (!item) return null;

    const fileUrl = `${apiBaseUrl}/f/${item.id}`;
    const imageFile = isImage(item.fileType);
    const textFile = item.fileType.startsWith('text/') || item.fileType === 'application/json';
    const pdfFile = item.fileType === 'application/pdf';

    const handleShare = () => {
      Share.share({
        title: item.name,
        url: Platform.OS === 'ios' ? fileUrl : undefined,
        message: Platform.OS === 'android' ? fileUrl : undefined,
      });
    };

    const handleOpen = () => {
      Linking.openURL(fileUrl);
    };

    return (
      <Modal
        transparent
        animationType="none"
        statusBarTranslucent
        visible={visible}
        onRequestClose={onClose}
      >
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={{ flex: 1, backgroundColor: imageFile ? '#000' : '#f8f8fa' }}
        >
          <StatusBar barStyle={imageFile ? 'light-content' : 'dark-content'} />

          {/* Header */}
          <View
            className="flex-row items-center justify-between px-4"
            style={{
              paddingTop: insets.top + 8,
              paddingBottom: 10,
              backgroundColor: imageFile ? 'rgba(0,0,0,0.6)' : '#fff',
              ...(imageFile
                ? {}
                : {
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.03,
                    shadowRadius: 4,
                    elevation: 1,
                  }),
            }}
          >
            <TouchableOpacity
              className="flex-row items-center"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={onClose}
            >
              <ArrowLeft
                color={imageFile ? '#fff' : semanticColors.foreground}
                size={22}
                strokeWidth={tokens.icon.strokeWidth}
              />
              <View style={{ flex: 1, marginLeft: 8, marginRight: 50 }}>
                <Text
                  className="text-[15px] font-semibold"
                  numberOfLines={1}
                  style={{ color: imageFile ? '#fff' : semanticColors.foreground }}
                >
                  {item.name}
                </Text>
                <Text
                  className="text-[11px] mt-0.5"
                  style={{ color: imageFile ? 'rgba(255,255,255,0.6)' : semanticColors.secondaryText }}
                >
                  {formatBytes(item.size)}
                  {'  ·  '}
                  {formatDate(item.createdAt)}
                </Text>
              </View>
            </TouchableOpacity>

            <View className="flex-row items-center gap-3">
              <TouchableOpacity
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                onPress={handleShare}
              >
                <Share2
                  color={imageFile ? '#fff' : semanticColors.primary}
                  size={20}
                  strokeWidth={1.8}
                />
              </TouchableOpacity>
              {!imageFile && (
                <TouchableOpacity
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  onPress={handleOpen}
                >
                  <Download color={semanticColors.primary} size={20} strokeWidth={1.8} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Content */}
          <View style={{ flex: 1 }}>
            {imageFile ? (
              <View className="flex-1 items-center justify-center">
                {imgLoading && (
                  <ActivityIndicator
                    color="#fff"
                    size="large"
                    style={{ position: 'absolute', zIndex: 1 }}
                  />
                )}
                <Image
                  resizeMode="contain"
                  source={{ uri: fileUrl }}
                  style={{ width: SCREEN_W, height: SCREEN_H * 0.75 }}
                  onLoad={() => setImgLoading(false)}
                  onError={() => setImgLoading(false)}
                />
              </View>
            ) : textFile || pdfFile ? (
              <WebView
                source={{ uri: fileUrl }}
                startInLoadingState
                renderLoading={() => (
                  <View
                    className="items-center justify-center"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: '#f8f8fa',
                    }}
                  >
                    <ActivityIndicator color={semanticColors.primary} size="large" />
                  </View>
                )}
                style={{ flex: 1 }}
              />
            ) : (
              <View className="flex-1 items-center justify-center px-8">
                <View
                  className="items-center justify-center rounded-3xl bg-foreground/5 mb-6"
                  style={{ width: 96, height: 96 }}
                >
                  <FileTypeIcon color={semanticColors.secondaryText} fileType={item.fileType} size={44} />
                </View>
                <Text className="text-foreground text-[17px] font-semibold text-center mb-2">
                  {item.name}
                </Text>
                <Text className="text-secondary/40 text-[14px] text-center mb-1">
                  {item.fileType}
                </Text>
                <Text className="text-secondary/40 text-[14px] text-center mb-8">
                  {formatBytes(item.size)}
                  {'  ·  '}
                  {formatDate(item.createdAt)}
                </Text>
                <TouchableOpacity
                  className="flex-row items-center rounded-2xl px-8 py-3.5"
                  style={{ backgroundColor: semanticColors.primary }}
                  onPress={handleOpen}
                >
                  <Eye color="#fff" size={18} strokeWidth={2} style={{ marginRight: 8 }} />
                  <Text className="text-white text-[15px] font-semibold">
                    {t.resourceOpenExternal || 'Open in Browser'}
                  </Text>
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
  const iconColor = semanticColors.secondaryText;
  const thumbnailUrl = isImage(item.fileType) ? `${apiBaseUrl}/f/${item.id}` : null;

  return (
    <SwipeableRow onDelete={() => onDelete(item.id, item.name)}>
      <TouchableOpacity
        activeOpacity={0.6}
        className="flex-row items-center px-5 py-3 bg-background"
        onPress={() => onPress(item)}
      >
        <View
          className="items-center justify-center rounded-xl bg-foreground/5"
          style={{ width: 48, height: 48, marginRight: 12 }}
        >
          {thumbnailUrl ? (
            <Image
              resizeMode="cover"
              source={{ uri: thumbnailUrl }}
              style={{ width: 48, height: 48, borderRadius: 12 }}
            />
          ) : (
            <FileTypeIcon color={iconColor} fileType={item.fileType} size={26} />
          )}
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text className="text-[15px] font-medium text-foreground" numberOfLines={1}>
            {item.name}
          </Text>
          <Text className="mt-0.5 text-[12px] text-secondary/40">
            {formatBytes(item.size)}
            {'  ·  '}
            {formatDate(item.createdAt)}
          </Text>
        </View>

        <Eye color={semanticColors.secondaryText} size={16} strokeWidth={1.5} style={{ marginLeft: 8 }} />
      </TouchableOpacity>
    </SwipeableRow>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────

export default function ResourceScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const isConnected = useConnectionStore((s) => s.isConnected);

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
      if (!isConnected) return;
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
        // silently ignore
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isConnected, category, searchText],
  );

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
        title={t.resourceTitle}
        rightElement={
          <Plus color={semanticColors.primary} size={20} strokeWidth={tokens.icon.strokeWidth} />
        }
        onPressRight={() => setAttachmentSheetVisible(true)}
      >
        {/* Search */}
        <View className="mx-5 mb-2 flex-row items-center rounded-xl bg-foreground/[0.04] px-3.5 py-2.5">
          <Search color={semanticColors.muted} size={16} strokeWidth={2} />
          <TextInput
            className="ml-2.5 flex-1 text-[14px] text-foreground"
            placeholder={t.search}
            placeholderTextColor={semanticColors.muted}
            ref={searchRef}
            returnKeyType="search"
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={() => loadFiles()}
          />
          {searchText.length > 0 && (
            <TouchableOpacity hitSlop={8} onPress={() => setSearchText('')}>
              <X color={semanticColors.muted} size={16} strokeWidth={2} />
            </TouchableOpacity>
          )}
        </View>

        {/* Category pills */}
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
                  backgroundColor: active ? semanticColors.primary : semanticColors.fillTertiary,
                }}
                onPress={() => {
                  haptics.selection();
                  setCategory(tab.key);
                }}
              >
                <Text
                  className="text-[13px] font-semibold"
                  style={{ color: active ? '#fff' : semanticColors.muted }}
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
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={semanticColors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          ItemSeparatorComponent={() => <View className="mx-4 h-px bg-foreground/5" />}
          data={filtered}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              colors={[semanticColors.primary]}
              refreshing={refreshing}
              tintColor={semanticColors.primary}
              onRefresh={onRefresh}
            />
          }
          ListEmptyComponent={
            <Animated.View className="items-center px-8" entering={FadeInDown.duration(350)}>
              <View
                className="mb-4 items-center justify-center rounded-3xl bg-foreground/5"
                style={{ width: 80, height: 80 }}
              >
                <FolderOpen color={semanticColors.secondaryText} size={36} strokeWidth={1.5} />
              </View>
              <Text className="text-center text-[17px] font-semibold text-foreground">
                {t.resourceEmpty}
              </Text>
              <Text className="mt-2 text-center text-[14px] text-secondary/40">
                {t.resourceEmptyDesc}
              </Text>
            </Animated.View>
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
          renderItem={({ item }) => (
            <FileRow apiBaseUrl={apiBase} item={item} onDelete={handleDelete} onPress={handlePreview} />
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
          style={{ width: 56, height: 56, elevation: 6, backgroundColor: semanticColors.primary }}
          onPress={uploading ? undefined : handleUpload}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Plus color="#fff" size={26} strokeWidth={2.5} />
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
