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
  File,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  FolderOpen,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AttachmentSheet from '../components/ui/AttachmentSheet';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { useToast } from '../components/ui/Toast';
import { fileApi, getApiUrl } from '../lib/api';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { useConnectionStore } from '../store/connection';
import { tokens } from '../theme/tokens';
import type { FileListItem } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────
const SECONDARY_BAR_HEIGHT = 48;

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

// ── File Row ─────────────────────────────────────────────────────────

interface FileRowProps {
  apiBaseUrl: string;
  item: FileListItem;
  onDelete: (id: string, name: string) => void;
}

function FileRow({ item, onDelete, apiBaseUrl }: FileRowProps) {
  const iconColor = '#6b7280';
  const thumbnailUrl = isImage(item.fileType) ? `${apiBaseUrl}/f/${item.id}` : null;

  return (
    <View className="flex-row items-center px-4 py-3">
      {/* Thumbnail or icon */}
      <View
        className="items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800"
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

      {/* Name + meta */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          className="text-[15px] font-medium text-gray-900 dark:text-gray-100"
          numberOfLines={1}
        >
          {item.name}
        </Text>
        <Text className="mt-0.5 text-[12px] text-gray-400 dark:text-gray-500">
          {formatBytes(item.size)}
          {'  ·  '}
          {formatDate(item.createdAt)}
        </Text>
      </View>

      {/* Delete */}
      <TouchableOpacity
        className="ml-3 items-center justify-center rounded-full p-2 active:bg-red-50"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        onPress={() => onDelete(item.id, item.name)}
      >
        <Trash2 color="#ef4444" size={18} strokeWidth={tokens.icon.strokeWidth} />
      </TouchableOpacity>
    </View>
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
  const [showSearch, setShowSearch] = useState(false);
  const [apiBase, setApiBase] = useState('');
  const [attachmentSheetVisible, setAttachmentSheetVisible] = useState(false);
  const searchRef = useRef<TextInput>(null);

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
    <View className="flex-1 bg-white dark:bg-black">
      {/* Header */}
      <ScreenHeader
        title={t.resourceTitle}
        rightElement={
          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              className="items-center justify-center rounded-full p-2"
              onPress={() => {
                setShowSearch((v) => !v);
                if (!showSearch) setTimeout(() => searchRef.current?.focus(), 100);
                else setSearchText('');
              }}
            >
              <Search color="#6b7280" size={20} strokeWidth={tokens.icon.strokeWidth} />
            </TouchableOpacity>
          </View>
        }
      />

      {/* Search bar */}
      {showSearch && (
        <View className="mx-4 mb-2 flex-row items-center rounded-xl bg-gray-100 px-3 dark:bg-gray-800">
          <Search color="#9ca3af" size={16} strokeWidth={tokens.icon.strokeWidth} />
          <TextInput
            className="ml-2 flex-1 py-2.5 text-[15px] text-gray-900 dark:text-gray-100"
            placeholder={t.search}
            placeholderTextColor="#9ca3af"
            ref={searchRef}
            returnKeyType="search"
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={() => loadFiles()}
          />
          {searchText.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchText('');
              }}
            >
              <X color="#9ca3af" size={16} strokeWidth={tokens.icon.strokeWidth} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Category tabs */}
      <View className="border-b border-gray-100 dark:border-gray-800">
        <View
          className="flex-row items-end px-4"
          style={{ minHeight: SECONDARY_BAR_HEIGHT, paddingBottom: 8, paddingTop: 6 }}
        >
          {TABS.map((tab) => {
            const active = category === tab.key;
            return (
              <TouchableOpacity
                className="mr-6"
                key={tab.key}
                onPress={() => {
                  haptics.selection();
                  setCategory(tab.key);
                }}
              >
                <Text
                  className={
                    active
                      ? 'text-[14px] font-semibold text-blue-500'
                      : 'text-[14px] text-gray-500 dark:text-gray-400'
                  }
                >
                  {tab.label}
                </Text>
                {active && <View className="mt-1 h-0.5 rounded-full bg-blue-500" />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Content */}
      {loading && files.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#6b7280" size="large" />
        </View>
      ) : (
        <FlatList
          ItemSeparatorComponent={() => <View className="mx-4 h-px bg-gray-100 dark:bg-gray-800" />}
          data={filtered}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View className="items-center px-8">
              <View
                className="mb-4 items-center justify-center rounded-3xl bg-gray-100 dark:bg-gray-800"
                style={{ width: 80, height: 80 }}
              >
                <FolderOpen color="#9ca3af" size={36} strokeWidth={1.5} />
              </View>
              <Text className="text-center text-[17px] font-semibold text-gray-700 dark:text-gray-300">
                {t.resourceEmpty}
              </Text>
              <Text className="mt-2 text-center text-[14px] text-gray-400 dark:text-gray-500">
                {t.resourceEmptyDesc}
              </Text>
            </View>
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
            <FileRow apiBaseUrl={apiBase} item={item} onDelete={handleDelete} />
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
          className="items-center justify-center rounded-full bg-blue-500 shadow-lg"
          style={{ width: 56, height: 56, elevation: 6 }}
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
    </View>
  );
}
