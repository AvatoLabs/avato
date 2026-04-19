import { ArrowLeft, ChevronRight, Folder, FolderOpen } from 'lucide-react-native';
import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { useI18n } from '../../lib/i18n';
import { useThemeColors } from '../../theme/colors';
import { tokens } from '../../theme/tokens';
import type { FileListItem } from '../../types';
import AdaptiveSheetModal from './AdaptiveSheetModal';

interface ResourceMoveToFolderSheetProps {
  batchMoveCount: number;
  currentFolder: { id: string; name: string } | null;
  currentRootLabel: string;
  folders: FileListItem[];
  onBack: () => void;
  onClose: () => void;
  onEnterFolder: (folder: FileListItem) => void;
  onSelectCurrent: () => void;
  onSelectRoot: () => void;
  stackDepth: number;
  visible: boolean;
}

export default function ResourceMoveToFolderSheet({
  batchMoveCount,
  currentFolder,
  currentRootLabel,
  folders,
  stackDepth,
  visible,
  onBack,
  onClose,
  onEnterFolder,
  onSelectCurrent,
  onSelectRoot,
}: ResourceMoveToFolderSheetProps) {
  const colors = useThemeColors();
  const { t } = useI18n();

  return (
    <AdaptiveSheetModal maxHeight="55%" preferredWidth={560} visible={visible} onClose={onClose}>
      <View className="items-center pt-3 pb-2">
        <View className="w-9 h-1 rounded-full bg-foreground/10" />
      </View>
      <View className="flex-row items-center justify-between px-5">
        <TouchableOpacity onPress={stackDepth > 1 ? onBack : undefined}>
          {stackDepth > 1 ? (
            <ArrowLeft color={colors.primary} size={22} strokeWidth={2} />
          ) : (
            <View style={{ width: 22 }} />
          )}
        </TouchableOpacity>
        <Text
          className="flex-1 text-center text-[18px] font-bold text-foreground"
          numberOfLines={1}
        >
          {batchMoveCount > 0
            ? t.resourceSelectCount.replace('{count}', String(batchMoveCount))
            : (currentFolder?.name ?? t.resourceMoveToFolder)}
        </Text>
        <View style={{ width: 22 }} />
      </View>
      <ScrollView className="mt-2 max-h-56">
        <TouchableOpacity
          activeOpacity={0.7}
          className="mx-5 mt-1 flex-row items-center rounded-xl px-4 py-3"
          style={{ backgroundColor: colors.fillTertiary }}
          onPress={onSelectRoot}
        >
          <FolderOpen color={colors.primary} size={22} strokeWidth={tokens.icon.strokeWidth} />
          <Text className="ml-3 text-[16px] font-medium text-foreground">{currentRootLabel}</Text>
        </TouchableOpacity>
        {currentFolder ? (
          <TouchableOpacity
            activeOpacity={0.7}
            className="mx-5 mt-1 flex-row items-center rounded-xl px-4 py-3"
            style={{ backgroundColor: `${colors.primary}20` }}
            onPress={onSelectCurrent}
          >
            <Folder color={colors.primary} size={22} strokeWidth={tokens.icon.strokeWidth} />
            <Text
              className="ml-3 flex-1 text-[16px] font-medium"
              numberOfLines={1}
              style={{ color: colors.primary }}
            >
              {currentFolder.name}
            </Text>
          </TouchableOpacity>
        ) : null}
        {folders.map((folder) => (
          <TouchableOpacity
            activeOpacity={0.7}
            className="mx-5 mt-1 flex-row items-center rounded-xl px-4 py-3"
            key={folder.id}
            style={{ backgroundColor: colors.fillTertiary }}
            onPress={() => onEnterFolder(folder)}
          >
            <Folder color={colors.muted} size={22} strokeWidth={tokens.icon.strokeWidth} />
            <Text className="ml-3 flex-1 text-[16px] font-medium text-foreground" numberOfLines={1}>
              {folder.name}
            </Text>
            <ChevronRight color={colors.muted} size={20} strokeWidth={1.5} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </AdaptiveSheetModal>
  );
}
