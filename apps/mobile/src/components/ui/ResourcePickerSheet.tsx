/**
 * ResourcePickerSheet — Pick files from workspace to attach to chat.
 */
import { Check, FolderOpen } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
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

import { resourceApi } from '../../lib/api';
import { haptics } from '../../lib/haptics';
import { useI18n } from '../../lib/i18n';
import { useThemeColors } from '../../theme/colors';
import { enteringModalContent } from '../../theme/motion';
import type { FileListItem } from '../../types';

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
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<FileListItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const result = await resourceApi.getKnowledgeItems({
        limit: 100,
        offset: 0,
      });
      // Chat attachment requires files.id (messages_files.file_id FK -> files.id).
      const files = (result?.items ?? []).filter(
        (i) => !isFolder(i) && i.sourceType === 'file' && !i.id.startsWith('docs_'),
      );
      setItems(files);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setSelected(new Set());
      void loadItems();
    }
  }, [visible, loadItems]);

  const toggleSelect = useCallback((item: FileListItem) => {
    if (isFolder(item)) return;
    haptics.selection();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    haptics.success();
    const picked = items.filter((i) => selected.has(i.id));
    onClose();
    onSelect(picked);
  }, [items, selected, onClose, onSelect]);

  const renderItem = useCallback(
    ({ item }: { item: FileListItem }) => {
      const isSelected = selected.has(item.id);
      return (
        <TouchableOpacity
          activeOpacity={0.7}
          className="flex-row items-center px-4 py-3"
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
    [selected, colors, toggleSelect],
  );

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
          style={{ maxHeight: '80%', paddingBottom: Math.max(insets.bottom, 16) }}
        >
          <Pressable
            className="bg-card rounded-t-2xl"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="items-center pt-3 pb-1">
              <View className="w-9 h-1 rounded-full bg-foreground/10" />
            </View>

            <View className="px-5 pb-2 pt-2">
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-foreground text-[18px] font-bold tracking-tight">
                    {t.fileFromWorkspace}
                  </Text>
                  <Text className="text-[13px] leading-5 mt-1" style={{ color: colors.secondaryText }}>
                    {t.fileFromWorkspaceDesc}
                  </Text>
                </View>
                <TouchableOpacity
                  activeOpacity={0.7}
                  className="rounded-full px-4 py-2"
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

              <View className="mt-4 max-h-72 rounded-2xl overflow-hidden bg-foreground/5">
                {loading ? (
                  <View className="items-center justify-center py-12">
                    <ActivityIndicator color={colors.primary} size="large" />
                    <Text className="text-[14px] mt-3" style={{ color: colors.secondaryText }}>{t.loading}</Text>
                  </View>
                ) : items.length === 0 ? (
                  <View className="items-center justify-center py-12">
                    <FolderOpen color={colors.muted} size={40} strokeWidth={1.5} />
                    <Text className="text-[14px] mt-3" style={{ color: colors.secondaryText }}>{t.resourceEmpty}</Text>
                  </View>
                ) : (
                  <FlatList
                    data={items}
                    keyExtractor={(i) => i.id}
                    renderItem={renderItem}
                    showsVerticalScrollIndicator={false}
                  />
                )}
              </View>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
