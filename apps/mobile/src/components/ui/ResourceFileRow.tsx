import { Check, ChevronRight, Pencil } from 'lucide-react-native';
import React, { memo } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';

import { formatMobileDate } from '../../lib/dateTime';
import { haptics } from '../../lib/haptics';
import { useI18n } from '../../lib/i18n';
import { formatBytes } from '../../lib/resourceFile';
import { useThemeColors } from '../../theme/colors';
import { tokens } from '../../theme/tokens';
import type { FileListItem } from '../../types';
import { SelectionBadge } from './ChoiceControls';
import ResourceGovernanceBadges from './ResourceGovernanceBadges';
import ResourceThumbnail from './ResourceThumbnail';

const isFolder = (item: FileListItem) => item.fileType === 'custom/folder';
const formatDate = (isoString: string) => formatMobileDate(isoString);

export interface ResourceFileRowProps {
  apiBaseUrl: string;
  cachedLocalUri?: string | null;
  isCached?: boolean;
  isSelected?: boolean;
  isVisible?: boolean;
  item: FileListItem;
  onDelete: (id: string, name: string, isFolder: boolean) => void;
  onFolderPress?: (item: FileListItem) => void;
  onInvalidateCache?: (fileId: string) => void;
  onLongPressItem?: (item: FileListItem) => void;
  onMoveToFolder?: (item: FileListItem) => void;
  onOpenActions?: (item: FileListItem) => void;
  onPress: (item: FileListItem) => void;
  onSelect?: (item: FileListItem) => void;
  remoteHeaders?: Record<string, string>;
  selectMode?: boolean;
  showFolderActions?: boolean;
}

const ResourceFileRow = memo(
  ({
    apiBaseUrl,
    cachedLocalUri,
    isCached,
    isSelected,
    isVisible = true,
    item,
    onDelete,
    onFolderPress,
    onInvalidateCache,
    onLongPressItem,
    onMoveToFolder,
    onOpenActions,
    onPress,
    onSelect,
    remoteHeaders,
    selectMode,
    showFolderActions,
  }: ResourceFileRowProps) => {
    const colors = useThemeColors();
    const { t } = useI18n();
    const itemIsFolder = isFolder(item);

    const handlePress = () => {
      if (selectMode && onSelect) {
        onSelect(item);
      } else if (itemIsFolder && onFolderPress) {
        onFolderPress(item);
      } else {
        onPress(item);
      }
    };

    return (
      <TouchableOpacity
        accessibilityLabel={itemIsFolder ? item.name : `${item.name}, ${formatBytes(item.size)}`}
        accessibilityRole="button"
        activeOpacity={0.6}
        className="flex-row items-center px-5 py-3 bg-background"
        onPress={handlePress}
        onLongPress={() => {
          haptics.medium();

          if (selectMode && onSelect) {
            onSelect(item);
          } else if (onLongPressItem) {
            onLongPressItem(item);
          } else if (itemIsFolder && !onOpenActions) {
            onDelete(item.id, item.name, true);
          } else if (!onOpenActions && showFolderActions && onMoveToFolder) {
            Alert.alert(item.name, undefined, [
              { text: t.cancel, style: 'cancel' },
              {
                text: t.delete,
                style: 'destructive',
                onPress: () => onDelete(item.id, item.name, false),
              },
              { text: t.resourceMoveToFolder, onPress: () => onMoveToFolder(item) },
            ]);
          } else {
            onDelete(item.id, item.name, false);
          }
        }}
      >
        <View className="mr-3 h-12 w-12 items-center justify-center rounded-xl bg-foreground/5">
          {selectMode ? (
            <View className="absolute -right-1 -top-1 z-10">
              <SelectionBadge selected={!!isSelected} />
            </View>
          ) : null}
          <ResourceThumbnail
            apiBaseUrl={apiBaseUrl}
            cachedLocalUri={cachedLocalUri}
            isVisible={isVisible}
            item={item}
            remoteHeaders={remoteHeaders}
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
          <Text className="text-[15px] font-medium text-foreground" numberOfLines={1}>
            {item.name}
          </Text>
          <Text className="mt-0.5 text-[12px]" style={{ color: colors.secondaryText }}>
            {itemIsFolder
              ? formatDate(item.createdAt)
              : `${formatBytes(item.size)}  ·  ${formatDate(item.createdAt)}`}
          </Text>
          <ResourceGovernanceBadges item={item} />
        </View>

        {onOpenActions && !selectMode ? (
          <TouchableOpacity
            accessibilityRole="button"
            className="ml-2 h-8 w-8 items-center justify-center rounded-full"
            hitSlop={8}
            onPress={(event) => {
              event.stopPropagation();
              onOpenActions(item);
            }}
          >
            <Pencil color={colors.secondaryText} size={16} strokeWidth={tokens.icon.strokeWidth} />
          </TouchableOpacity>
        ) : itemIsFolder && !selectMode ? (
          <View className="ml-2">
            <ChevronRight color={colors.secondaryText} size={18} strokeWidth={1.5} />
          </View>
        ) : null}
      </TouchableOpacity>
    );
  },
);

ResourceFileRow.displayName = 'ResourceFileRow';

export default ResourceFileRow;
