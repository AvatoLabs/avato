import type {
  ContentRouteParams,
  MainTabScreenProps,
  PortalRouteParams,
} from '../navigation/types';
import { useResourceContentActions } from './useResourceContentActions';
import { useResourceContentDataFlow } from './useResourceContentDataFlow';
import { useResourceContentOverlayComposer } from './useResourceContentOverlayComposer';
import { useResourceContentPageComposer } from './useResourceContentPageComposer';
import { useResourceContentPresentation } from './useResourceContentPresentation';
import { useResourceContentState } from './useResourceContentState';

export type ContentScreenRouteName = 'PortalContent' | 'Content';
export type ContentScreenRouteParams = (ContentRouteParams & PortalRouteParams) | undefined;

export interface UseResourceContentScreenProps {
  navigation: {
    addListener: MainTabScreenProps<'Content'>['navigation']['addListener'];
    canGoBack: () => boolean;
    goBack: () => void;
    setParams: (params?: Partial<NonNullable<ContentScreenRouteParams>>) => void;
  };
  route: {
    name: ContentScreenRouteName;
    params: ContentScreenRouteParams;
  };
}

export function useResourceContentScreen(props: UseResourceContentScreenProps) {
  const { navigation, route } = props;
  const state = useResourceContentState({ route });

  const dataFlow = useResourceContentDataFlow({
    clearOrigins: state.previewShare.clearOrigins,
    currentFolderId: state.scopeNavigation.currentFolderId,
    currentFolderSlug: state.scopeNavigation.currentFolderSlug,
    effectiveCategory: state.effectiveCategory,
    effectiveSpaceId: state.sourceSetDerived.effectiveSpaceId,
    fileScope: state.scopeNavigation.fileScope,
    folderBreadcrumb: state.scopeNavigation.folderBreadcrumb,
    governanceFilterSummaryLabels: state.governance.governanceFilterSummaryLabels,
    handleMissingSourceSetFolderOpen: state.headerControls.handleMissingSourceSetFolderOpen,
    locale: state.locale,
    navigation,
    previewItem: state.previewShare.previewItem,
    refreshCachedResources: state.previewCache.refreshCachedResources,
    refreshCurrentSpaceMemorySummary: state.spaces.refreshCurrentSpaceMemorySummary,
    releasedGovernanceFilters: state.governance.releasedGovernanceFilters,
    route,
    searchInputRef: state.searchRef,
    searchText: state.surfaceControls.searchText,
    searchVisible: state.surfaceControls.searchVisible,
    setAllSourceSets: state.setAllSourceSets,
    setSourceSetDirectoryStatus: state.setSourceSetDirectoryStatus,
    setCurrentFolderId: state.scopeNavigation.setCurrentFolderId,
    setCurrentFolderSlug: state.scopeNavigation.setCurrentFolderSlug,
    setScopeMode: state.scopeNavigation.setScopeMode,
    setTreeChildrenByParent: state.setTreeChildrenByParent,
    setTreeExpandedIds: state.setTreeExpandedIds,
    showSourceSetLoadError: () => state.toast.show('error', state.t.resourceSourceSetLoadFailed),
    sortOrder: state.surfaceControls.sortOrder,
    sorter: state.surfaceControls.sorter,
    sourceSetId: state.scopeNavigation.sourceSetId,
    spacesResolved: state.spaces.spacesResolved,
    scopeMode: state.scopeNavigation.scopeMode,
    t: state.t,
    treeChildrenByParent: state.treeChildrenByParent,
    treeExpandedIds: state.treeExpandedIds,
  });

  const actions = useResourceContentActions({
    dataFlow,
    navigation,
    route,
    state,
  });

  const presentation = useResourceContentPresentation({
    applyCachedResourceEntry: state.previewCache.applyCachedResourceEntry,
    cachedResourceIds: state.previewCache.cachedResourceIds,
    cachedResourceMap: state.previewCache.cachedResourceMap,
    currentFolderId: state.scopeNavigation.currentFolderId,
    filtered: dataFlow.collectionView.filtered,
    navigation,
    previewItem: state.previewShare.previewItem,
    resourceOrigin: state.previewShare.resourceOrigin,
    routeName: route.name,
    routeParams: route.params,
    selectMode: actions.selection.selectMode,
    selectedIds: actions.selection.selectedIds,
    treeExpandedIds: state.treeExpandedIds,
    treeMode: dataFlow.collectionView.treeMode,
    treeRows: dataFlow.collectionView.treeRows,
    visibleIds: state.previewCache.visibleIds,
  });

  const pageProps = useResourceContentPageComposer({
    actions,
    dataFlow,
    presentation,
    state,
  });

  const overlayProps = useResourceContentOverlayComposer({
    actions,
    dataFlow,
    state,
  });

  return { overlayProps, pageProps };
}
