import { haptics } from '../lib/haptics';
import type { ResourceContentActionsResult } from './useResourceContentActions';
import type { ResourceContentDataFlowResult } from './useResourceContentDataFlow';
import { useResourceContentPageAssembly } from './useResourceContentPageAssembly';
import type { ResourceContentPresentation } from './useResourceContentPresentation';
import type { ResourceContentStateResult } from './useResourceContentState';

interface UseResourceContentPageComposerProps {
  actions: ResourceContentActionsResult;
  dataFlow: ResourceContentDataFlowResult;
  presentation: ResourceContentPresentation;
  state: ResourceContentStateResult;
}

export function useResourceContentPageComposer({
  actions,
  dataFlow,
  presentation,
  state,
}: UseResourceContentPageComposerProps) {
  return useResourceContentPageAssembly({
    collection: {
      apiBaseUrl: dataFlow.collectionData.apiBase,
      cachedResourceIds: state.previewCache.cachedResourceIds,
      cachedResourceMap: state.previewCache.cachedResourceMap,
      chromeHorizontalPadding: state.layout.responsiveMetrics.isTablet
        ? state.layout.chromeHorizontalPadding
        : 12,
      currentFolderId: state.scopeNavigation.currentFolderId,
      currentFolderSlug: state.scopeNavigation.currentFolderSlug,
      currentSourceRootLabel: state.sourceSetDerived.currentSourceRootLabel,
      data: dataFlow.collectionView.treeMode
        ? dataFlow.collectionView.treeRows
        : dataFlow.collectionView.filtered,
      gridColumnCount: state.layout.gridColumnCount,
      hasMore: dataFlow.collectionData.hasMore,
      isCurrentListEmpty: dataFlow.collectionView.isCurrentListEmpty,
      listExtraData: presentation.listExtraData,
      listStyle: state.layout.listStyle,
      loadingMore: dataFlow.collectionData.loadingMore,
      onCreateFolder: actions.folderActions.openCreateFolder,
      onDelete: actions.selection.handleDelete,
      onEnterSelectMode: actions.selection.handleEnterSelectMode,
      onFolderPress: dataFlow.collectionView.handleFolderPressResolved,
      onInvalidateCache: state.previewCache.invalidateCachedResource,
      onLoadMore: dataFlow.collectionView.handleLoadMore,
      onMoveToFolder: state.scopeNavigation.sourceSetId
        ? actions.folderActions.openMoveToFolder
        : undefined,
      onOpenActions: actions.selection.setActionItem,
      onPreview: state.previewShare.handlePreview,
      onRefresh: dataFlow.collectionData.refreshResources,
      onSelect: actions.selection.toggleSelect,
      onToggleExpand: dataFlow.collectionView.handleTreeChevronPress,
      onTreeRootPress: dataFlow.collectionView.handleBackToRoot,
      onUpload: actions.upload.handleUpload,
      onViewableItemsChanged: state.previewCache.onViewableItemsChanged,
      refreshControlRefreshing: dataFlow.collectionData.refreshing,
      remoteHeaders: dataFlow.surfaceData.resourceAuthHeaders,
      scrollListPaddingBottom: state.layout.scrollListPaddingBottom,
      showFolderActions: !!state.scopeNavigation.sourceSetId,
      sourceSetId: state.scopeNavigation.sourceSetId,
      treeExpandedIds: state.treeExpandedIds,
      treeLoadingIds: dataFlow.collectionData.treeLoadingIds,
      treeMode: dataFlow.collectionView.treeMode,
      viewMode: state.surfaceControls.viewMode,
      viewabilityConfig: state.previewCache.viewabilityConfig,
      visibleIds: state.previewCache.visibleIds,
    },
    header: {
      activeGovernanceFilterCount: state.governance.activeGovernanceFilterCount,
      breadcrumbLabelMaxWidth: state.layout.breadcrumbLabelMaxWidth,
      category: state.category,
      chromeContainerStyle: state.layout.chromeContainerStyle,
      currentFolderId: state.scopeNavigation.currentFolderId,
      currentSourceRootLabel: state.sourceSetDerived.currentSourceRootLabel,
      currentSourceSetName: state.sourceSetDerived.currentSourceSetName,
      currentSpaceKind: state.spaces.currentSpace?.kind,
      currentSpaceMemoryShortcutLabel: state.headerControls.currentSpaceMemoryShortcutLabel,
      currentSpaceName: state.currentSpaceName,
      currentTreePathLabel: state.sourceSetDerived.currentTreePathLabel,
      folderBreadcrumb: state.scopeNavigation.folderBreadcrumb,
      governanceActiveTokens: state.governance.governanceActiveTokens,
      governanceCapabilityHint: dataFlow.surfaceData.governanceCapabilityHint,
      governanceEnabled: state.governanceEnabled,
      governanceFilters: state.governance.governanceFilters,
      governanceQuickFilters: state.governance.governanceQuickFilters,
      governanceWorkbenchSummary: dataFlow.surfaceData.governanceWorkbenchSummary,
      isSourceSetScope: state.scopeNavigation.isSourceSetScope,
      onBackToRoot: dataFlow.collectionView.handleBackToRoot,
      onClearGovernanceFilters: state.governance.clearGovernanceFilters,
      onClearSearch: state.surfaceControls.closeSearch,
      onCollapseAllTree: dataFlow.collectionView.handleCollapseAllTree,
      onExpandAllTree: () => void dataFlow.collectionView.handleExpandAllTree(),
      onOpenCurrentSpaceMemory: state.headerControls.openCurrentSpaceMemory,
      onOpenGovernanceSheet: state.governance.openGovernanceSheet,
      onOpenScopeLauncher: () => state.scopeNavigation.openScopeLauncher(),
      onOpenSourceSetManagement: () => actions.sourceSetControls.openSourceSetManagement(),
      onPressBreadcrumb: dataFlow.collectionView.handleBreadcrumbPress,
      onRemoveGovernanceFilter: state.governance.removeGovernanceFilter,
      onSearchSubmit: () => void dataFlow.collectionData.loadFiles(),
      onSelectCategory: (nextCategory) => {
        haptics.selection();
        state.setCategory(nextCategory);
      },
      onSetScopeMode: state.scopeNavigation.setScopeMode,
      onSetSearchText: state.surfaceControls.setSearchText,
      onToggleQuickGovernanceFilter: state.governance.toggleQuickGovernanceFilter,
      onToggleViewMode: state.surfaceControls.toggleViewMode,
      scopeMode: state.scopeNavigation.scopeMode,
      searchInputRef: state.searchRef,
      searchText: state.surfaceControls.searchText,
      searchVisible: state.surfaceControls.searchVisible,
      showContextCard: state.spaces.spaces.length > 0,
      showCurrentSpaceMemoryShortcut: state.spaces.showCurrentSpaceMemoryShortcut,
      sourceSetId: state.scopeNavigation.sourceSetId,
      sourceSetModeItems: state.headerControls.sourceSetModeItems,
      treeMode: dataFlow.collectionView.treeMode,
      viewMode: state.surfaceControls.viewMode,
    },
    onOpenHeaderMenu: state.surfaceControls.openHeaderMenu,
    onToggleSearch: state.surfaceControls.toggleSearch,
    portal: {
      ...presentation.portalProps,
      currentLabel: presentation.portalProps.currentLabel || state.t.resourceTitle,
    },
    resourceOrigin: state.previewShare.resourceOrigin,
    selection: {
      availableTargetSourceSetCount: state.sourceSetDerived.availableTargetSourceSets.length,
      clearSelection: actions.selection.clearSelection,
      onAddToSourceSet: (ids) => actions.sourceSetActions.openSourceSetAction(ids, 'add'),
      onBatchDelete: actions.selection.handleBatchDelete,
      onBatchMove: actions.folderActions.handleBatchMove,
      onBatchShareLink: actions.selection.handleBatchShareLink,
      onMoveToSourceSet: (ids) => actions.sourceSetActions.openSourceSetAction(ids, 'move'),
      onRemoveFromSourceSet: actions.sourceSetActions.handleRemoveFromSourceSet,
      selectMode: actions.selection.selectMode,
      selectedCount: actions.selection.selectedIds.size,
      selectedHasSourceSetUnsupportedItems: actions.selection.selectedHasSourceSetUnsupportedItems,
      selectedIds: actions.selection.selectedIds,
      selectedSourceSetEligibleIds: actions.selection.selectedSourceSetEligibleIds,
      selectionSummaryLabel: actions.selection.selectionSummaryLabel,
      selectionToolbarBottomPadding: state.layout.insets.bottom + 8,
      sourceSetCount: state.sourceSetDerived.sourceSets.length,
      sourceSetId: state.scopeNavigation.sourceSetId,
    },
    showInitialSkeleton: dataFlow.collectionView.showInitialSkeleton,
    upload: {
      bottomPadding: state.layout.bottomChrome.overlayListPaddingBottom,
      onPress: actions.upload.handleUpload,
      progress: actions.upload.uploadProgress,
      rightPadding: state.layout.floatingActionRightPadding,
      uploading: actions.upload.uploading,
      visible: !actions.selection.selectMode && !dataFlow.collectionView.isCurrentListEmpty,
    },
  });
}
