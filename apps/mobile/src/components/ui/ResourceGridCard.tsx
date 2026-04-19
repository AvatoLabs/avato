import { Check, Pencil } from 'lucide-react-native';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

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

interface ResourceGridCardProps {
  apiBaseUrl: string;
  cachedLocalUri?: string | null;
  isCached?: boolean;
  isSelected?: boolean;
  item: FileListItem;
  onFolderPress: (item: FileListItem) => void;
  onInvalidateCache?: (fileId: string) => void;
  onOpenActions: (item: FileListItem) => void;
  onPreview: (item: FileListItem) => void;
  onSelect: (item: FileListItem) => void;
  remoteHeaders?: Record<string, string>;
  selectMode?: boolean;
}

export default function ResourceGridCard({
  apiBaseUrl,
  cachedLocalUri,
  isCached,
  isSelected,
  item,
  onFolderPress,
  onInvalidateCache,
  onOpenActions,
  onPreview,
  onSelect,
  remoteHeaders,
  selectMode,
}: ResourceGridCardProps) {
  const colors = useThemeColors();
  const itemIsFolder = isFolder(item);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      className="flex-1 m-1 items-center rounded-xl bg-foreground/5 p-3"
      style={{ minWidth: 0 }}
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
          onFolderPress(item);
          return;
        }

        onPreview(item);
      }}
    >
      <View className="h-14 w-14 items-center justify-center">
        <View className="h-14 w-14 items-center justify-center rounded-lg bg-foreground/5 overflow-hidden">
          {selectMode ? (
            <View className="absolute -right-1 -top-1 z-10">
              <SelectionBadge selected={!!isSelected} />
            </View>
          ) : null}
          <ResourceThumbnail
            isVisible
            apiBaseUrl={apiBaseUrl}
            cachedLocalUri={cachedLocalUri}
            item={item}
            remoteHeaders={remoteHeaders}
            roundedClassName="rounded-lg"
            size={56}
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
      </View>
      {!selectMode ? (
        <TouchableOpacity
          accessibilityRole="button"
          className="absolute right-2 top-2 z-10 h-7 w-7 items-center justify-center rounded-full"
          style={{ backgroundColor: colors.overlay }}
          onPress={(event) => {
            event.stopPropagation();
            onOpenActions(item);
          }}
        >
          <Pencil color={colors.secondaryText} size={14} strokeWidth={tokens.icon.strokeWidth} />
        </TouchableOpacity>
      ) : null}
      <Text className="mt-1 text-center text-[11px] text-foreground" numberOfLines={2}>
        {item.name}
      </Text>
      <Text
        className="mt-0.5 text-center text-[10px]"
        numberOfLines={1}
        style={{ color: colors.secondaryText }}
      >
        {itemIsFolder ? formatDate(item.createdAt) : formatBytes(item.size)}
      </Text>
      <View className="items-center">
        <ResourceGovernanceBadges item={item} maxVisible={2} />
      </View>
    </TouchableOpacity>
  );
}
