import { FileText, Folder, Trash2, X } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { TrashedDocumentItem } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { useThemeColors } from '../../theme/colors';
import { tokens } from '../../theme/tokens';
import AdaptiveSheetModal from './AdaptiveSheetModal';

interface ResourceTrashSheetProps {
  items: TrashedDocumentItem[];
  loading: boolean;
  onClose: () => void;
  onRestore: (id: string) => void | Promise<void>;
  restoringId: string | null;
  visible: boolean;
}

export default function ResourceTrashSheet({
  items,
  loading,
  restoringId,
  visible,
  onClose,
  onRestore,
}: ResourceTrashSheetProps) {
  const colors = useThemeColors();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  return (
    <AdaptiveSheetModal
      overflowHidden
      maxHeight="82%"
      paddingBottom={insets.bottom + 12}
      preferredWidth={720}
      visible={visible}
      onClose={onClose}
    >
      <View className="items-center pt-3 pb-2">
        <View className="h-1 w-9 rounded-full bg-foreground/10" />
      </View>
      <View className="flex-row items-center border-b border-foreground/10 px-4 pb-3">
        <TouchableOpacity
          accessibilityRole="button"
          className="h-10 w-10 items-center justify-center rounded-full active:bg-foreground/5"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={onClose}
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
      {loading ? (
        <View className="items-center justify-center py-16">
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : items.length === 0 ? (
        <View className="items-center px-6 py-16">
          <Trash2 color={colors.muted} size={40} strokeWidth={1.5} />
          <Text className="mt-4 text-center text-[16px] font-medium text-foreground">
            {t.resourceTrashEmpty}
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(row) => row.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item: row }) => {
            const isFolderItem = row.fileType === 'custom/folder';
            const displayName = row.title?.trim() || row.filename?.trim() || 'Untitled';
            const busy = restoringId === row.id;

            return (
              <View className="flex-row items-center border-b border-foreground/5 px-4 py-3.5">
                {isFolderItem ? (
                  <Folder color={colors.muted} size={22} strokeWidth={tokens.icon.strokeWidth} />
                ) : (
                  <FileText color={colors.muted} size={22} strokeWidth={tokens.icon.strokeWidth} />
                )}
                <Text className="ml-3 flex-1 text-[15px] text-foreground" numberOfLines={2}>
                  {displayName}
                </Text>
                <TouchableOpacity
                  activeOpacity={0.7}
                  className="ml-2 rounded-xl px-3 py-2"
                  disabled={restoringId !== null}
                  style={{
                    backgroundColor: colors.primarySubtle,
                    opacity: restoringId !== null && !busy ? 0.5 : 1,
                  }}
                  onPress={() => void onRestore(row.id)}
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
    </AdaptiveSheetModal>
  );
}
