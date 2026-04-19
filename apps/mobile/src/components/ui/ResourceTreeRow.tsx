import { Check, ChevronDown, ChevronRight, Pencil } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

import { formatMobileDate } from '../../lib/dateTime';
import { haptics } from '../../lib/haptics';
import { formatBytes } from '../../lib/resourceFile';
import { useThemeColors } from '../../theme/colors';
import { tokens } from '../../theme/tokens';
import type { FileListItem } from '../../types';
import { SelectionBadge } from './ChoiceControls';
import ResourceGovernanceBadges from './ResourceGovernanceBadges';
import ResourceThumbnail from './ResourceThumbnail';

const isFolder = (item: FileListItem) => item.fileType === 'custom/folder';
const formatDate = (isoString: string) => formatMobileDate(isoString);

interface ResourceTreeRowProps {
  apiBaseUrl: string;
  cachedLocalUri?: string | null;
  depth: number;
  isCached?: boolean;
  isExpanded: boolean;
  isFocused: boolean;
  isLoadingChildren: boolean;
  isSelected?: boolean;
  item: FileListItem;
  onFolderPress: (item: FileListItem) => void | Promise<void>;
  onInvalidateCache?: (fileId: string) => void;
  onOpenActions: (item: FileListItem) => void;
  onPreview: (item: FileListItem) => void;
  onSelect: (item: FileListItem) => void;
  onToggleExpand: (item: FileListItem) => void | Promise<void>;
  remoteHeaders?: Record<string, string>;
  selectMode?: boolean;
}

export default function ResourceTreeRow({
  apiBaseUrl,
  cachedLocalUri,
  depth,
  isCached,
  isExpanded,
  isFocused,
  isLoadingChildren,
  isSelected,
  item,
  onFolderPress,
  onInvalidateCache,
  onOpenActions,
  onPreview,
  onSelect,
  onToggleExpand,
  remoteHeaders,
  selectMode,
}: ResourceTreeRowProps) {
  const colors = useThemeColors();
  const itemIsFolder = isFolder(item);

  return (
    <TouchableOpacity
      activeOpacity={0.72}
      className="px-4 py-2"
      onLongPress={() => {
        haptics.medium();
        onSelect(item);
      }}
      onPress={() => {
        if (selectMode) {
          onSelect(item);
          return;
        }

        if (itemIsFolder) {
          void onFolderPress(item);
          return;
        }

        onPreview(item);
      }}
    >
      <View
        className="flex-row items-center rounded-2xl px-3 py-2.5"
        style={{
          backgroundColor: isFocused ? colors.fillTertiary : 'transparent',
          marginLeft: depth * 16,
        }}
      >
        <View className="mr-2 h-6 w-6 items-center justify-center">
          {itemIsFolder ? (
            isLoadingChildren ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <TouchableOpacity
                activeOpacity={0.7}
                className="h-6 w-6 items-center justify-center"
                hitSlop={8}
                onPress={() => void onToggleExpand(item)}
              >
                {isExpanded ? (
                  <ChevronDown color={colors.primary} size={16} strokeWidth={2.2} />
                ) : (
                  <ChevronRight color={colors.primary} size={16} strokeWidth={2.2} />
                )}
              </TouchableOpacity>
            )
          ) : null}
        </View>

        <View className="mr-3 h-11 w-11 items-center justify-center rounded-xl bg-foreground/5 overflow-hidden">
          {selectMode ? (
            <View className="absolute -right-1 -top-1 z-10">
              <SelectionBadge selected={!!isSelected} />
            </View>
          ) : null}
          <ResourceThumbnail
            apiBaseUrl={apiBaseUrl}
            cachedLocalUri={cachedLocalUri}
            item={item}
            remoteHeaders={remoteHeaders}
            roundedClassName="rounded-xl"
            onInvalidateCache={onInvalidateCache}
          />
          {isCached && !itemIsFolder ? (
            <View
              className="absolute -bottom-1 -right-1 rounded-full px-1.5 py-0.5"
              style={{ backgroundColor: colors.successSubtle }}
            >
              <Check color={colors.success} size={10} strokeWidth={2.6} />
            </View>
          ) : null}
        </View>

        <View className="min-w-0 flex-1">
          <Text className="text-[14px] font-medium text-foreground" numberOfLines={1}>
            {item.name}
          </Text>
          <Text
            className="mt-0.5 text-[11px]"
            numberOfLines={1}
            style={{ color: colors.secondaryText }}
          >
            {itemIsFolder
              ? formatDate(item.createdAt)
              : `${formatBytes(item.size)}  ·  ${formatDate(item.createdAt)}`}
          </Text>
          <ResourceGovernanceBadges item={item} maxVisible={2} />
        </View>
        {!selectMode ? (
          <TouchableOpacity
            accessibilityRole="button"
            className="h-8 w-8 items-center justify-center rounded-full"
            hitSlop={8}
            onPress={(event) => {
              event.stopPropagation();
              onOpenActions(item);
            }}
          >
            <Pencil color={colors.secondaryText} size={16} strokeWidth={tokens.icon.strokeWidth} />
          </TouchableOpacity>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}
