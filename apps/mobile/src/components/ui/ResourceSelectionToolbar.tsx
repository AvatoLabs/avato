import { Folder, FolderOpen, Link2, Trash2, X } from 'lucide-react-native';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { useThemeColors } from '../../theme/colors';
import { tokens } from '../../theme/tokens';

interface ResourceSelectionToolbarMessages {
  resourceAddToSourceSet: string;
  resourceBatchDelete: string;
  resourceBatchMove: string;
  resourceBatchShareLink: string;
  resourceMoveToSourceSet: string;
  resourceRemoveFromSourceSet: string;
  resourceTitle: string;
}

interface ResourceSelectionToolbarProps {
  availableTargetSourceSetCount: number;
  bottomPadding: number;
  messages: ResourceSelectionToolbarMessages;
  onAddToSourceSet: (ids: string[]) => void;
  onBatchDelete: () => void;
  onBatchMove: () => void;
  onBatchShareLink: () => void;
  onClearSelection: () => void;
  onMoveToSourceSet: (ids: string[]) => void;
  onRemoveFromSourceSet: (ids: string[]) => void;
  selectedCount: number;
  selectedHasSourceSetUnsupportedItems: boolean;
  selectedSourceSetEligibleIds: string[];
  selectionSummaryLabel: string;
  sourceSetCount: number;
  sourceSetId: string | null;
}

export default function ResourceSelectionToolbar({
  availableTargetSourceSetCount,
  bottomPadding,
  messages,
  selectedCount,
  selectedHasSourceSetUnsupportedItems,
  selectedSourceSetEligibleIds,
  selectionSummaryLabel,
  sourceSetCount,
  sourceSetId,
  onAddToSourceSet,
  onBatchDelete,
  onBatchMove,
  onBatchShareLink,
  onClearSelection,
  onMoveToSourceSet,
  onRemoveFromSourceSet,
}: ResourceSelectionToolbarProps) {
  const colors = useThemeColors();

  return (
    <View
      className="mb-3 rounded-[24px] border px-4 py-3"
      style={{
        backgroundColor: colors.card,
        borderColor: colors.borderSubtle,
        marginTop: 4,
        paddingBottom: bottomPadding,
      }}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text
            className="text-[11px] font-semibold uppercase tracking-[1.2px]"
            style={{ color: colors.secondaryText }}
          >
            {messages.resourceTitle}
          </Text>
          <Text className="mt-1 text-[16px] font-semibold" style={{ color: colors.foreground }}>
            {selectionSummaryLabel}
          </Text>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          className="h-9 w-9 items-center justify-center rounded-full"
          style={{ backgroundColor: colors.fillTertiary }}
          onPress={onClearSelection}
        >
          <X color={colors.secondaryText} size={18} strokeWidth={tokens.icon.strokeWidth} />
        </TouchableOpacity>
      </View>

      <View className="mt-3 flex-row flex-wrap" style={{ gap: 8 }}>
        <TouchableOpacity
          activeOpacity={0.78}
          className="flex-row items-center rounded-full px-3 py-2"
          style={{ backgroundColor: `${colors.danger}12` }}
          onPress={onBatchDelete}
        >
          <Trash2 color={colors.danger} size={15} strokeWidth={tokens.icon.strokeWidth} />
          <Text className="ml-2 text-[13px] font-semibold" style={{ color: colors.danger }}>
            {messages.resourceBatchDelete}
          </Text>
        </TouchableOpacity>

        {sourceSetId ? (
          <TouchableOpacity
            activeOpacity={0.78}
            className="flex-row items-center rounded-full px-3 py-2"
            style={{ backgroundColor: colors.primaryMuted }}
            onPress={onBatchMove}
          >
            <Folder color={colors.primary} size={15} strokeWidth={tokens.icon.strokeWidth} />
            <Text className="ml-2 text-[13px] font-semibold" style={{ color: colors.primary }}>
              {messages.resourceBatchMove}
            </Text>
          </TouchableOpacity>
        ) : null}

        {!selectedHasSourceSetUnsupportedItems &&
        sourceSetId &&
        availableTargetSourceSetCount > 0 &&
        selectedSourceSetEligibleIds.length > 0 ? (
          <TouchableOpacity
            activeOpacity={0.78}
            className="flex-row items-center rounded-full px-3 py-2"
            style={{ backgroundColor: colors.primaryMuted }}
            onPress={() => onMoveToSourceSet(selectedSourceSetEligibleIds)}
          >
            <FolderOpen color={colors.primary} size={15} strokeWidth={tokens.icon.strokeWidth} />
            <Text className="ml-2 text-[13px] font-semibold" style={{ color: colors.primary }}>
              {messages.resourceMoveToSourceSet}
            </Text>
          </TouchableOpacity>
        ) : null}

        {!selectedHasSourceSetUnsupportedItems &&
        sourceSetId &&
        selectedSourceSetEligibleIds.length > 0 ? (
          <TouchableOpacity
            activeOpacity={0.78}
            className="flex-row items-center rounded-full px-3 py-2"
            style={{ backgroundColor: `${colors.danger}12` }}
            onPress={() => onRemoveFromSourceSet(selectedSourceSetEligibleIds)}
          >
            <FolderOpen color={colors.danger} size={15} strokeWidth={tokens.icon.strokeWidth} />
            <Text className="ml-2 text-[13px] font-semibold" style={{ color: colors.danger }}>
              {messages.resourceRemoveFromSourceSet}
            </Text>
          </TouchableOpacity>
        ) : null}

        {!selectedHasSourceSetUnsupportedItems &&
        !sourceSetId &&
        sourceSetCount > 0 &&
        selectedSourceSetEligibleIds.length > 0 ? (
          <TouchableOpacity
            activeOpacity={0.78}
            className="flex-row items-center rounded-full px-3 py-2"
            style={{ backgroundColor: colors.primaryMuted }}
            onPress={() => onAddToSourceSet(selectedSourceSetEligibleIds)}
          >
            <FolderOpen color={colors.primary} size={15} strokeWidth={tokens.icon.strokeWidth} />
            <Text className="ml-2 text-[13px] font-semibold" style={{ color: colors.primary }}>
              {messages.resourceAddToSourceSet}
            </Text>
          </TouchableOpacity>
        ) : null}

        {selectedCount === 1 ? (
          <TouchableOpacity
            activeOpacity={0.78}
            className="flex-row items-center rounded-full px-3 py-2"
            style={{ backgroundColor: colors.primaryMuted }}
            onPress={onBatchShareLink}
          >
            <Link2 color={colors.primary} size={15} strokeWidth={tokens.icon.strokeWidth} />
            <Text className="ml-2 text-[13px] font-semibold" style={{ color: colors.primary }}>
              {messages.resourceBatchShareLink}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}
