import type { StyleProp, ViewStyle } from 'react-native';

import type { ResourceContentPageProps } from '../components/ui/ResourceContentPage';
import type { ResourceCacheEntry } from '../lib/resourceCache';
import type { ConversationOriginRouteParams } from '../navigation/types';
import type { FileListItem } from '../types';

interface ResourceTreeRow {
  depth: number;
  item: FileListItem;
}

interface UseResourceContentPageAssemblyProps {
  collection: {
    apiBaseUrl: string;
    cachedResourceIds: Set<string>;
    cachedResourceMap: Record<string, ResourceCacheEntry>;
    chromeHorizontalPadding: number;
    currentFolderId: string | null;
    currentFolderSlug: string | null;
    currentSourceRootLabel: string;
    data: FileListItem[] | ResourceTreeRow[];
    gridColumnCount: number;
    hasMore: boolean;
    isCurrentListEmpty: boolean;
    listExtraData: ResourceContentPageProps['collection']['extraData'];
    listStyle?: StyleProp<ViewStyle>;
    loadingMore: boolean;
    onCreateFolder: () => void;
    onDelete: (id: string, name: string, isFolderItem: boolean) => void;
    onEnterSelectMode: (item: FileListItem) => void;
    onFolderPress: (item: FileListItem) => void | Promise<void>;
    onInvalidateCache: (fileId: string) => void;
    onLoadMore: () => void | Promise<void>;
    onMoveToFolder?: (item: FileListItem) => void;
    onOpenActions: (item: FileListItem) => void;
    onPreview: (item: FileListItem) => void;
    onRefresh: () => void | Promise<void>;
    onSelect: (item: FileListItem) => void;
    onToggleExpand: (item: FileListItem) => void | Promise<void>;
    onTreeRootPress: () => void;
    onUpload: () => void;
    onViewableItemsChanged: ResourceContentPageProps['collection']['onViewableItemsChanged'];
    refreshControlRefreshing: boolean;
    remoteHeaders: Record<string, string>;
    scrollListPaddingBottom: number;
    showFolderActions: boolean;
    sourceSetId: string | null;
    treeExpandedIds: Set<string>;
    treeLoadingIds: Set<string>;
    treeMode: boolean;
    viewMode: 'grid' | 'list';
    viewabilityConfig: ResourceContentPageProps['collection']['viewabilityConfig'];
    visibleIds: Set<string>;
  };
  header: {
    activeGovernanceFilterCount: number;
    breadcrumbLabelMaxWidth: number;
    category: 'all' | 'images' | 'documents' | 'others';
    chromeContainerStyle?: StyleProp<ViewStyle>;
    currentFolderId: string | null;
    currentSourceRootLabel: string;
    currentSourceSetName: string;
    currentSpaceKind?: ResourceContentPageProps['header']['currentSpaceKind'];
    currentSpaceMemoryShortcutLabel: string;
    currentSpaceName: string;
    currentTreePathLabel: string;
    folderBreadcrumb: ResourceContentPageProps['header']['folderBreadcrumb'];
    governanceActiveTokens: ResourceContentPageProps['header']['governanceActiveTokens'];
    governanceCapabilityHint?: string;
    governanceEnabled: boolean;
    governanceFilters: ResourceContentPageProps['header']['governanceFilters'];
    governanceQuickFilters: ResourceContentPageProps['header']['governanceQuickFilters'];
    governanceWorkbenchSummary: string;
    isSourceSetScope: boolean;
    onBackToRoot: () => void;
    onClearGovernanceFilters: () => void;
    onClearSearch: () => void;
    onCollapseAllTree: () => void;
    onExpandAllTree: () => void | Promise<void>;
    onOpenCurrentSpaceMemory: () => void;
    onOpenGovernanceSheet: () => void;
    onOpenScopeLauncher: () => void;
    onOpenSourceSetManagement: () => void;
    onPressBreadcrumb: ResourceContentPageProps['header']['onPressBreadcrumb'];
    onRemoveGovernanceFilter: ResourceContentPageProps['header']['onRemoveGovernanceFilter'];
    onSearchSubmit: () => void;
    onSelectCategory: (nextCategory: 'all' | 'images' | 'documents' | 'others') => void;
    onSetScopeMode: (mode: 'tree' | 'files') => void;
    onSetSearchText: (text: string) => void;
    onToggleQuickGovernanceFilter: ResourceContentPageProps['header']['onToggleQuickGovernanceFilter'];
    onToggleViewMode: () => void;
    scopeMode: 'tree' | 'files';
    searchInputRef: ResourceContentPageProps['header']['searchInputRef'];
    searchText: string;
    searchVisible: boolean;
    showContextCard: boolean;
    showCurrentSpaceMemoryShortcut: boolean;
    sourceSetId: string | null;
    sourceSetModeItems: ResourceContentPageProps['header']['sourceSetModeItems'];
    treeMode: boolean;
    viewMode: 'grid' | 'list';
  };
  onOpenHeaderMenu: () => void;
  onToggleSearch: () => void;
  portal: ResourceContentPageProps['portal'];
  resourceOrigin: ConversationOriginRouteParams | null;
  selection: {
    availableTargetSourceSetCount: number;
    clearSelection: () => void;
    onAddToSourceSet: (ids: string[]) => void;
    onBatchDelete: () => void | Promise<void>;
    onBatchMove: () => void;
    onBatchShareLink: () => void;
    onMoveToSourceSet: (ids: string[]) => void;
    onRemoveFromSourceSet: (ids: string[]) => void | Promise<void>;
    selectMode: boolean;
    selectedCount: number;
    selectedHasSourceSetUnsupportedItems: boolean;
    selectedIds: Set<string>;
    selectedSourceSetEligibleIds: string[];
    selectionSummaryLabel: string;
    selectionToolbarBottomPadding: number;
    sourceSetCount: number;
    sourceSetId: string | null;
  };
  showInitialSkeleton: boolean;
  upload: {
    bottomPadding: number;
    onPress: () => void;
    progress: number;
    rightPadding: number;
    uploading: boolean;
    visible: boolean;
  };
}

export function useResourceContentPageAssembly({
  collection,
  header,
  onOpenHeaderMenu,
  onToggleSearch,
  portal,
  resourceOrigin,
  selection,
  showInitialSkeleton,
  upload,
}: UseResourceContentPageAssemblyProps): Omit<ResourceContentPageProps, 'children'> {
  return {
    collection: {
      apiBaseUrl: collection.apiBaseUrl,
      cachedResourceIds: collection.cachedResourceIds,
      cachedResourceMap: collection.cachedResourceMap,
      chromeHorizontalPadding: collection.chromeHorizontalPadding,
      currentFolderId: collection.currentFolderId,
      currentFolderSlug: collection.currentFolderSlug,
      currentSourceRootLabel: collection.currentSourceRootLabel,
      data: collection.data,
      extraData: collection.listExtraData,
      gridColumnCount: collection.gridColumnCount,
      hasMore: collection.hasMore,
      isCurrentListEmpty: collection.isCurrentListEmpty,
      listStyle: collection.listStyle,
      loadingMore: collection.loadingMore,
      onCreateFolder: collection.onCreateFolder,
      onDelete: collection.onDelete,
      onFolderPress: collection.onFolderPress,
      onInvalidateCache: collection.onInvalidateCache,
      onLoadMore: collection.onLoadMore,
      onLongPressItem: collection.onEnterSelectMode,
      onMoveToFolder: collection.onMoveToFolder,
      onOpenActions: collection.onOpenActions,
      onPreview: collection.onPreview,
      onRefresh: collection.onRefresh,
      onSelect: collection.onSelect,
      onToggleExpand: collection.onToggleExpand,
      onTreeRootPress: collection.onTreeRootPress,
      onUpload: collection.onUpload,
      onViewableItemsChanged: collection.onViewableItemsChanged,
      refreshControlRefreshing: collection.refreshControlRefreshing,
      remoteHeaders: collection.remoteHeaders,
      scrollListPaddingBottom: collection.scrollListPaddingBottom,
      selectMode: selection.selectMode,
      selectedIds: selection.selectedIds,
      showFolderActions: collection.showFolderActions,
      sourceSetId: collection.sourceSetId,
      treeExpandedIds: collection.treeExpandedIds,
      treeLoadingIds: collection.treeLoadingIds,
      treeMode: collection.treeMode,
      viewMode: collection.viewMode,
      viewabilityConfig: collection.viewabilityConfig,
      visibleIds: collection.visibleIds,
    },
    header: {
      activeGovernanceFilterCount: header.activeGovernanceFilterCount,
      breadcrumbLabelMaxWidth: header.breadcrumbLabelMaxWidth,
      category: header.category,
      chromeContainerStyle: header.chromeContainerStyle,
      currentFolderId: header.currentFolderId,
      currentSourceRootLabel: header.currentSourceRootLabel,
      currentSourceSetName: header.currentSourceSetName,
      currentSpaceKind: header.currentSpaceKind,
      currentSpaceMemoryShortcutLabel: header.currentSpaceMemoryShortcutLabel,
      currentSpaceName: header.currentSpaceName,
      currentTreePathLabel: header.currentTreePathLabel,
      folderBreadcrumb: header.folderBreadcrumb,
      governanceActiveTokens: header.governanceActiveTokens,
      governanceCapabilityHint: header.governanceCapabilityHint,
      governanceEnabled: header.governanceEnabled,
      governanceFilters: header.governanceFilters,
      governanceQuickFilters: header.governanceQuickFilters,
      governanceWorkbenchSummary: header.governanceWorkbenchSummary,
      isSourceSetScope: header.isSourceSetScope,
      onBackToRoot: header.onBackToRoot,
      onClearGovernanceFilters: header.onClearGovernanceFilters,
      onClearSearch: header.onClearSearch,
      onCollapseAllTree: header.onCollapseAllTree,
      onExpandAllTree: header.onExpandAllTree,
      onOpenCurrentSpaceMemory: header.onOpenCurrentSpaceMemory,
      onOpenGovernanceSheet: header.onOpenGovernanceSheet,
      onOpenScopeLauncher: header.onOpenScopeLauncher,
      onOpenSourceSetManagement: header.onOpenSourceSetManagement,
      onPressBreadcrumb: header.onPressBreadcrumb,
      onRemoveGovernanceFilter: header.onRemoveGovernanceFilter,
      onSearchSubmit: header.onSearchSubmit,
      onSelectCategory: header.onSelectCategory,
      onSetScopeMode: header.onSetScopeMode,
      onSetSearchText: header.onSetSearchText,
      onToggleQuickGovernanceFilter: header.onToggleQuickGovernanceFilter,
      onToggleViewMode: header.onToggleViewMode,
      scopeMode: header.scopeMode,
      searchInputRef: header.searchInputRef,
      searchText: header.searchText,
      searchVisible: header.searchVisible,
      showContextCard: header.showContextCard,
      showCurrentSpaceMemoryShortcut: header.showCurrentSpaceMemoryShortcut,
      sourceSetId: header.sourceSetId,
      sourceSetModeItems: header.sourceSetModeItems,
      treeMode: header.treeMode,
      viewMode: header.viewMode,
    },
    onClearSelection: selection.clearSelection,
    onOpenHeaderMenu,
    onToggleSearch,
    portal,
    resourceOrigin,
    searchVisible: header.searchVisible,
    selectMode: selection.selectMode,
    selectedCount: selection.selectedCount,
    selectionToolbar:
      selection.selectMode && selection.selectedCount > 0
        ? {
            availableTargetSourceSetCount: selection.availableTargetSourceSetCount,
            bottomPadding: selection.selectionToolbarBottomPadding,
            containerStyle: header.chromeContainerStyle,
            onAddToSourceSet: selection.onAddToSourceSet,
            onBatchDelete: selection.onBatchDelete,
            onBatchMove: selection.onBatchMove,
            onBatchShareLink: selection.onBatchShareLink,
            onClearSelection: selection.clearSelection,
            onMoveToSourceSet: selection.onMoveToSourceSet,
            onRemoveFromSourceSet: selection.onRemoveFromSourceSet,
            selectedCount: selection.selectedCount,
            selectedHasSourceSetUnsupportedItems: selection.selectedHasSourceSetUnsupportedItems,
            selectedSourceSetEligibleIds: selection.selectedSourceSetEligibleIds,
            selectionSummaryLabel: selection.selectionSummaryLabel,
            sourceSetCount: selection.sourceSetCount,
            sourceSetId: selection.sourceSetId,
          }
        : undefined,
    showInitialSkeleton,
    uploadFab: {
      bottomPadding: upload.bottomPadding,
      onPress: upload.onPress,
      rightPadding: upload.rightPadding,
      uploadProgress: upload.progress,
      uploading: upload.uploading,
      visible: upload.visible,
    },
  };
}
