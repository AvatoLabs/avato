/**
 * ResourcePickerSheet — Pick files from workspace (inbox or library, folders, paginated).
 */
import { ArrowLeft, Check, ChevronRight, FolderOpen } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { knowledgeBaseApi, resourceApi } from '../../lib/api';
import { haptics } from '../../lib/haptics';
import { useI18n } from '../../lib/i18n';
import { useThemeColors } from '../../theme/colors';
import { enteringModalContent } from '../../theme/motion';
import type { FileListItem, KnowledgeBaseItem } from '../../types';

const PAGE_SIZE = 50;

interface ResourcePickerSheetProps {
  onClose: () => void;
  onSelect: (items: FileListItem[]) => void;
  visible: boolean;
}

function isFolder(item: FileListItem) {
  return item.fileType === 'custom/folder';
}

export default function ResourcePickerSheet({
  visible,
  onClose,
  onSelect,
}: ResourcePickerSheetProps) {
  const colors = useThemeColors();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [libraries, setLibraries] = useState<KnowledgeBaseItem[]>([]);
  const [activeKb, setActiveKb] = useState<KnowledgeBaseItem | null>(null);
  const [folderStack, setFolderStack] = useState<string[]>([]);
  const [rows, setRows] = useState<FileListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [locationMenuVisible, setLocationMenuVisible] = useState(false);

  const parentId = folderStack.length === 0 ? null : folderStack.at(-1)!;

  const locationLabel = useMemo(() => {
    if (!activeKb) return t.resourceLibraryInbox;
    return activeKb.name || t.resourceLibrarySelect;
  }, [activeKb, t.resourceLibraryInbox, t.resourceLibrarySelect]);

  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const mergeById = useCallback((prev: FileListItem[], next: FileListItem[]) => {
    const seen = new Set(prev.map((r) => r.id));
    const added = next.filter((r) => !seen.has(r.id));
    return [...prev, ...added];
  }, []);

  const queryParams = useMemo(
    () => ({
      limit: PAGE_SIZE,
      parentId,
      ...(activeKb
        ? {
            knowledgeBaseId: activeKb.id,
            ...(activeKb.spaceId ? { spaceId: activeKb.spaceId } : {}),
          }
        : {}),
    }),
    [activeKb, parentId],
  );

  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      const result = await resourceApi.getKnowledgeItems({ ...queryParams, offset: 0 });
      const items = result?.items ?? [];
      setRows(items);
      setHasMore(result?.hasMore ?? false);
    } catch {
      setRows([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [queryParams]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const offset = rowsRef.current.length;
      const result = await resourceApi.getKnowledgeItems({ ...queryParams, offset });
      const items = result?.items ?? [];
      setHasMore(result?.hasMore ?? false);
      setRows((prev) => mergeById(prev, items));
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loading, loadingMore, mergeById, queryParams]);

  useEffect(() => {
    if (!visible) return;
    void (async () => {
      try {
        const list = await knowledgeBaseApi.list();
        setLibraries(list ?? []);
      } catch {
        setLibraries([]);
      }
    })();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    setSelected(new Set());
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    void loadInitial();
  }, [visible, loadInitial]);

  const openFolder = useCallback((id: string) => {
    haptics.selection();
    setFolderStack((s) => [...s, id]);
  }, []);

  const goBackFolder = useCallback(() => {
    haptics.selection();
    setFolderStack((s) => (s.length > 0 ? s.slice(0, -1) : s));
  }, []);

  const pickLocation = useCallback((kb: KnowledgeBaseItem | null) => {
    haptics.selection();
    setActiveKb(kb);
    setFolderStack([]);
    setLocationMenuVisible(false);
  }, []);

  const toggleSelect = useCallback((item: FileListItem) => {
    if (isFolder(item)) return;
    if (item.sourceType !== 'file' || item.id.startsWith('docs_')) return;
    haptics.selection();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    const pickable = rows.filter(
      (i) => !isFolder(i) && i.sourceType === 'file' && !i.id.startsWith('docs_'),
    );
    const picked = pickable.filter((i) => selected.has(i.id));
    haptics.success();
    onClose();
    onSelect(picked);
  }, [onClose, onSelect, rows, selected]);

  const selectableFiles = useMemo(
    () => rows.filter((i) => !isFolder(i) && i.sourceType === 'file' && !i.id.startsWith('docs_')),
    [rows],
  );

  const renderItem = useCallback(
    ({ item }: { item: FileListItem }) => {
      if (isFolder(item)) {
        return (
          <TouchableOpacity
            activeOpacity={0.7}
            className="flex-row items-center px-4 py-3 border-b border-foreground/5"
            onPress={() => openFolder(item.id)}
          >
            <FolderOpen color={colors.primary} size={20} strokeWidth={2} />
            <Text className="text-foreground text-[15px] font-medium flex-1 ml-3" numberOfLines={1}>
              {item.name}
            </Text>
            <ChevronRight color={colors.muted} size={18} />
          </TouchableOpacity>
        );
      }

      const isSelected = selected.has(item.id);
      return (
        <TouchableOpacity
          activeOpacity={0.7}
          className="flex-row items-center px-4 py-3 border-b border-foreground/5"
          onPress={() => toggleSelect(item)}
        >
          <View
            className="mr-3 h-6 w-6 items-center justify-center rounded-md border-2"
            style={{
              borderColor: isSelected ? colors.primary : colors.border,
              backgroundColor: isSelected ? colors.primary : 'transparent',
            }}
          >
            {isSelected && <Check color={colors.iconOnPrimary} size={14} strokeWidth={2.5} />}
          </View>
          <View className="flex-1">
            <Text className="text-foreground text-[15px] font-medium" numberOfLines={1}>
              {item.name}
            </Text>
            <Text className="text-[12px] mt-0.5" style={{ color: colors.secondaryText }}>
              {item.fileType} · {(item.size / 1024).toFixed(1)} KB
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [colors, openFolder, selected, toggleSelect],
  );

  const listData = useMemo(() => {
    const folders = rows.filter((i) => isFolder(i));
    const files = rows.filter(
      (i) => !isFolder(i) && i.sourceType === 'file' && !i.id.startsWith('docs_'),
    );
    return [...folders, ...files];
  }, [rows]);

  return (
    <Modal
      accessibilityViewIsModal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
    >
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        <Animated.View
          entering={enteringModalContent()}
          style={{ maxHeight: '85%', paddingBottom: Math.max(insets.bottom, 16) }}
        >
          <Pressable className="bg-card rounded-t-2xl" onPress={(e) => e.stopPropagation()}>
            <View className="items-center pt-3 pb-1">
              <View className="w-9 h-1 rounded-full bg-foreground/10" />
            </View>

            <View className="px-5 pb-2 pt-2">
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center gap-2 flex-1 min-w-0">
                  {(folderStack.length > 0 || activeKb) && (
                    <TouchableOpacity
                      accessibilityRole="button"
                      className="p-1"
                      hitSlop={10}
                      onPress={() => {
                        if (folderStack.length > 0) goBackFolder();
                        else setActiveKb(null);
                      }}
                    >
                      <ArrowLeft color={colors.primary} size={22} strokeWidth={2} />
                    </TouchableOpacity>
                  )}
                  <View className="flex-1 min-w-0">
                    <Text
                      className="text-foreground text-[18px] font-bold tracking-tight"
                      numberOfLines={1}
                    >
                      {t.fileFromWorkspace}
                    </Text>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      className="mt-1"
                      onPress={() => setLocationMenuVisible(true)}
                    >
                      <Text
                        className="text-[13px] font-medium"
                        numberOfLines={1}
                        style={{ color: colors.primary }}
                      >
                        {t.resourcePickerPickLocation}: {locationLabel}
                        {folderStack.length > 0 ? ` · ${folderStack.length}` : ''}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <TouchableOpacity
                  activeOpacity={0.7}
                  className="rounded-full px-4 py-2 ml-2"
                  disabled={selected.size === 0}
                  style={{
                    backgroundColor: selected.size > 0 ? colors.primary : colors.fillTertiary,
                  }}
                  onPress={handleConfirm}
                >
                  <Text
                    className="text-[15px] font-semibold"
                    style={{
                      color: selected.size > 0 ? colors.iconOnPrimary : colors.muted,
                    }}
                  >
                    {t.done} {selected.size > 0 ? `(${selected.size})` : ''}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text className="text-[13px] leading-5 mb-2" style={{ color: colors.secondaryText }}>
                {t.fileFromWorkspaceDesc}
              </Text>

              <View className="mt-1 max-h-[420px] rounded-2xl overflow-hidden bg-foreground/5">
                {loading ? (
                  <View className="items-center justify-center py-12">
                    <ActivityIndicator color={colors.primary} size="large" />
                    <Text className="text-[14px] mt-3" style={{ color: colors.secondaryText }}>
                      {t.loading}
                    </Text>
                  </View>
                ) : listData.length === 0 && selectableFiles.length === 0 ? (
                  <View className="items-center justify-center py-12">
                    <FolderOpen color={colors.muted} size={40} strokeWidth={1.5} />
                    <Text className="text-[14px] mt-3" style={{ color: colors.secondaryText }}>
                      {t.resourceEmpty}
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={listData}
                    keyExtractor={(i) => i.id}
                    renderItem={renderItem}
                    showsVerticalScrollIndicator={false}
                    ListFooterComponent={
                      hasMore ? (
                        <TouchableOpacity
                          className="py-3 items-center"
                          disabled={loadingMore}
                          onPress={() => void loadMore()}
                        >
                          {loadingMore ? (
                            <ActivityIndicator color={colors.primary} size="small" />
                          ) : (
                            <Text
                              className="text-[14px] font-semibold"
                              style={{ color: colors.primary }}
                            >
                              {t.resourceLoadMore}
                            </Text>
                          )}
                        </TouchableOpacity>
                      ) : null
                    }
                  />
                )}
              </View>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>

      <Modal
        transparent
        animationType="fade"
        visible={locationMenuVisible}
        onRequestClose={() => setLocationMenuVisible(false)}
      >
        <Pressable
          className="flex-1 bg-black/50 justify-end"
          onPress={() => setLocationMenuVisible(false)}
        >
          <Pressable
            className="bg-card rounded-t-2xl max-h-[60%]"
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="text-foreground text-[16px] font-bold px-5 pt-4 pb-2">
              {t.resourceLibrarySelect}
            </Text>
            <FlatList
              data={[
                { id: '__inbox__', name: t.resourceLibraryInbox } as KnowledgeBaseItem,
                ...libraries,
              ]}
              keyExtractor={(i) => i.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  className="px-5 py-3.5 border-b border-foreground/5"
                  onPress={() => pickLocation(item.id === '__inbox__' ? null : item)}
                >
                  <Text className="text-[15px] text-foreground" numberOfLines={1}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </Modal>
  );
}
