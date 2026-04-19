import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  type StyleProp,
  Text,
  TouchableOpacity,
  type ViewStyle,
  type ViewToken,
} from 'react-native';

import type { ResourceCacheEntry } from '../../lib/resourceCache';
import { useThemeColors } from '../../theme/colors';
import type { FileListItem } from '../../types';
import ResourceFileRow from './ResourceFileRow';
import ResourceGridCard from './ResourceGridCard';
import ResourceListEmptyState from './ResourceListEmptyState';
import ResourceListRowSeparator from './ResourceListRowSeparator';
import ResourceTreeRootHeader from './ResourceTreeRootHeader';
import ResourceTreeRow from './ResourceTreeRow';

interface ResourceTreeListRow {
  depth: number;
  item: FileListItem;
}

type ResourceListRow = FileListItem | ResourceTreeListRow;

const isResourceTreeRow = (value: ResourceListRow): value is ResourceTreeListRow =>
  'depth' in value && 'item' in value;

interface ResourceCollectionListMessages {
  resourceEmpty: string;
  resourceEmptyDesc: string;
  resourceFolderEmpty: string;
  resourceFolderEmptyDesc: string;
  resourceLoadMore: string;
  resourceNewFolder: string;
  resourceSharedKindSourceSet: string;
  resourceUpload: string;
}

interface ResourceCollectionListProps {
  apiBaseUrl: string;
  cachedResourceIds: Set<string>;
  cachedResourceMap: Record<string, ResourceCacheEntry>;
  chromeHorizontalPadding: number;
  currentFolderId: string | null;
  currentFolderSlug: string | null;
  currentSourceRootLabel: string;
  data: ResourceListRow[];
  extraData: unknown;
  gridColumnCount: number;
  hasMore: boolean;
  isCurrentListEmpty: boolean;
  listStyle?: StyleProp<ViewStyle>;
  loadingMore: boolean;
  messages: ResourceCollectionListMessages;
  onCreateFolder: () => void;
  onDelete: (id: string, name: string, isFolderItem: boolean) => void;
  onFolderPress: (item: FileListItem) => void;
  onInvalidateCache: (fileId: string) => void;
  onLoadMore: () => void;
  onLongPressItem: (item: FileListItem) => void;
  onMoveToFolder?: (item: FileListItem) => void;
  onOpenActions: (item: FileListItem) => void;
  onPreview: (item: FileListItem) => void;
  onRefresh: () => void;
  onSelect: (item: FileListItem) => void;
  onToggleExpand: (item: FileListItem) => void;
  onTreeRootPress: () => void;
  onUpload: () => void;
  onViewableItemsChanged?: (info: { viewableItems: Array<ViewToken<ResourceListRow>> }) => void;
  refreshControlRefreshing: boolean;
  remoteHeaders: Record<string, string>;
  scrollListPaddingBottom: number;
  selectedIds: Set<string>;
  selectMode: boolean;
  showFolderActions: boolean;
  sourceSetId: string | null;
  treeExpandedIds: Set<string>;
  treeLoadingIds: Set<string>;
  treeMode: boolean;
  viewabilityConfig?: { itemVisiblePercentThreshold: number; minimumViewTime: number };
  viewMode: 'grid' | 'list';
  visibleIds: Set<string>;
}

export default function ResourceCollectionList({
  apiBaseUrl,
  cachedResourceIds,
  cachedResourceMap,
  chromeHorizontalPadding,
  currentFolderId,
  currentFolderSlug,
  currentSourceRootLabel,
  data,
  extraData,
  gridColumnCount,
  hasMore,
  isCurrentListEmpty,
  listStyle,
  loadingMore,
  messages,
  refreshControlRefreshing,
  remoteHeaders,
  scrollListPaddingBottom,
  selectMode,
  selectedIds,
  showFolderActions,
  sourceSetId,
  treeExpandedIds,
  treeLoadingIds,
  treeMode,
  viewMode,
  viewabilityConfig,
  visibleIds,
  onCreateFolder,
  onDelete,
  onFolderPress,
  onInvalidateCache,
  onLoadMore,
  onLongPressItem,
  onMoveToFolder,
  onOpenActions,
  onPreview,
  onRefresh,
  onSelect,
  onToggleExpand,
  onTreeRootPress,
  onUpload,
  onViewableItemsChanged,
}: ResourceCollectionListProps) {
  const colors = useThemeColors();

  return (
    <FlatList<ResourceListRow>
      ItemSeparatorComponent={
        !treeMode && viewMode === 'list' ? ResourceListRowSeparator : undefined
      }
      data={data}
      extraData={extraData}
      key={treeMode ? 'tree' : viewMode === 'grid' ? `grid-${gridColumnCount}` : viewMode}
      keyExtractor={(item) => (isResourceTreeRow(item) ? item.item.id : item.id)}
      numColumns={!treeMode && viewMode === 'grid' ? gridColumnCount : 1}
      style={listStyle}
      viewabilityConfig={treeMode ? undefined : viewabilityConfig}
      ListEmptyComponent={
        <ResourceListEmptyState
          inFolder={Boolean(currentFolderId || currentFolderSlug)}
          sourceSetId={sourceSetId}
          messages={{
            resourceEmpty: messages.resourceEmpty,
            resourceEmptyDesc: messages.resourceEmptyDesc,
            resourceFolderEmpty: messages.resourceFolderEmpty,
            resourceFolderEmptyDesc: messages.resourceFolderEmptyDesc,
            resourceNewFolder: messages.resourceNewFolder,
            resourceUpload: messages.resourceUpload,
          }}
          onCreateFolder={onCreateFolder}
          onUpload={onUpload}
        />
      }
      ListFooterComponent={
        !treeMode && hasMore ? (
          <TouchableOpacity
            activeOpacity={0.7}
            className="items-center justify-center py-4"
            disabled={loadingMore}
            onPress={onLoadMore}
          >
            {loadingMore ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Text style={{ color: colors.primary }}>{messages.resourceLoadMore}</Text>
            )}
          </TouchableOpacity>
        ) : null
      }
      ListHeaderComponent={
        treeMode ? (
          <ResourceTreeRootHeader
            currentFolderId={currentFolderId}
            rootLabel={currentSourceRootLabel}
            subtitle={messages.resourceSharedKindSourceSet}
            onPress={onTreeRootPress}
          />
        ) : undefined
      }
      columnWrapperStyle={
        !treeMode && viewMode === 'grid'
          ? {
              justifyContent: 'space-between',
              paddingHorizontal: chromeHorizontalPadding,
            }
          : undefined
      }
      contentContainerStyle={
        isCurrentListEmpty
          ? {
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingBottom: scrollListPaddingBottom,
            }
          : { paddingBottom: scrollListPaddingBottom }
      }
      refreshControl={
        <RefreshControl
          colors={[colors.primary]}
          refreshing={refreshControlRefreshing}
          tintColor={colors.primary}
          onRefresh={onRefresh}
        />
      }
      renderItem={({ item }) =>
        isResourceTreeRow(item) ? (
          <ResourceTreeRow
            apiBaseUrl={apiBaseUrl}
            cachedLocalUri={cachedResourceMap[item.item.id]?.localUri}
            depth={item.depth}
            isCached={cachedResourceIds.has(item.item.id)}
            isExpanded={treeExpandedIds.has(item.item.id)}
            isFocused={currentFolderId === item.item.id}
            isLoadingChildren={treeLoadingIds.has(item.item.id)}
            isSelected={selectedIds.has(item.item.id)}
            item={item.item}
            remoteHeaders={remoteHeaders}
            selectMode={selectMode}
            onFolderPress={onFolderPress}
            onInvalidateCache={onInvalidateCache}
            onOpenActions={onOpenActions}
            onPreview={onPreview}
            onSelect={selectMode ? onSelect : onLongPressItem}
            onToggleExpand={onToggleExpand}
          />
        ) : viewMode === 'grid' ? (
          <ResourceGridCard
            apiBaseUrl={apiBaseUrl}
            cachedLocalUri={cachedResourceMap[item.id]?.localUri}
            isCached={cachedResourceIds.has(item.id)}
            isSelected={selectedIds.has(item.id)}
            item={item}
            remoteHeaders={remoteHeaders}
            selectMode={selectMode}
            onFolderPress={onFolderPress}
            onInvalidateCache={onInvalidateCache}
            onOpenActions={onOpenActions}
            onPreview={onPreview}
            onSelect={selectMode ? onSelect : onLongPressItem}
          />
        ) : (
          <ResourceFileRow
            apiBaseUrl={apiBaseUrl}
            cachedLocalUri={cachedResourceMap[item.id]?.localUri}
            isCached={cachedResourceIds.has(item.id)}
            isSelected={selectedIds.has(item.id)}
            isVisible={visibleIds.size === 0 || visibleIds.has(item.id)}
            item={item}
            remoteHeaders={remoteHeaders}
            selectMode={selectMode}
            showFolderActions={showFolderActions}
            onDelete={onDelete}
            onFolderPress={onFolderPress}
            onInvalidateCache={onInvalidateCache}
            onLongPressItem={onLongPressItem}
            onMoveToFolder={onMoveToFolder}
            onOpenActions={onOpenActions}
            onPress={onPreview}
            onSelect={selectMode ? onSelect : undefined}
          />
        )
      }
      onEndReached={!treeMode && hasMore && !loadingMore ? onLoadMore : undefined}
      onEndReachedThreshold={0.3}
      onViewableItemsChanged={treeMode ? undefined : onViewableItemsChanged}
    />
  );
}
