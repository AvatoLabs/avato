import { useCallback } from 'react';

import { clearResourceListCache } from '../lib/resourceListCache';
import type { ResourceContentDataFlowResult } from './useResourceContentDataFlow';
import type { UseResourceContentScreenProps } from './useResourceContentScreen';
import type { ResourceContentStateResult } from './useResourceContentState';
import { useResourceEntryFlows } from './useResourceEntryFlows';
import { useResourceFolderActions } from './useResourceFolderActions';
import { useResourceSelectionDomain } from './useResourceSelectionDomain';
import { useResourceSourceSetActions } from './useResourceSourceSetActions';
import { useResourceSourceSetControls } from './useResourceSourceSetControls';
import { useResourceTrash } from './useResourceTrash';
import { useResourceUploadActions } from './useResourceUploadActions';

interface UseResourceContentActionsProps {
  dataFlow: ResourceContentDataFlowResult;
  navigation: UseResourceContentScreenProps['navigation'];
  route: UseResourceContentScreenProps['route'];
  state: ResourceContentStateResult;
}

export function useResourceContentActions({
  dataFlow,
  navigation,
  route,
  state,
}: UseResourceContentActionsProps) {
  const selection = useResourceSelectionDomain({
    addChatContextSelection: state.addChatContextSelection,
    cachedResourceMap: state.previewCache.cachedResourceMap,
    deleteSelectionLabelTemplate: state.t.resourceSelectCount,
    dismissPreviewForIds: state.previewShare.dismissPreviewForIds,
    loadFiles: dataFlow.collectionData.loadFiles,
    messages: state.messages.selectionMessages,
    openItemShareSheet: state.previewShare.openItemShareSheet,
    openManageShareFromItem: state.previewShare.openManageShareFromItem,
    prunePreviewCacheState: state.previewCache.prunePreviewCacheState,
    refreshTreeData: dataFlow.collectionData.refreshTreeData,
    replacePreviewItem: state.previewShare.replacePreviewItem,
    replaceVisibleResourceId: state.previewCache.replaceVisibleResourceId,
    resourceItemsById: dataFlow.surfaceData.resourceItemsById,
    resourceOrigin: state.previewShare.resourceOrigin,
    routeName: route.name,
    routeParams: route.params,
    setFiles: dataFlow.collectionData.setFiles,
    setTreeChildrenByParent: state.setTreeChildrenByParent,
    setTreeExpandedIds: state.setTreeExpandedIds,
    showToast: state.toast.show,
  });

  const upload = useResourceUploadActions({
    currentFolderId: state.scopeNavigation.currentFolderId,
    currentFolderSlug: state.scopeNavigation.currentFolderSlug,
    effectiveSpaceId: state.sourceSetDerived.effectiveSpaceId,
    loadFiles: dataFlow.collectionData.loadFiles,
    messages: state.messages.uploadMessages,
    refreshCachedResources: state.previewCache.refreshCachedResources,
    refreshTreeData: dataFlow.collectionData.refreshTreeData,
    setFiles: dataFlow.collectionData.setFiles,
    showToast: state.toast.show,
    sourceSetId: state.scopeNavigation.sourceSetId,
  });

  const entryFlows = useResourceEntryFlows({
    activateSourceSet: state.scopeNavigation.activateSourceSet,
    applyFileScope: state.scopeNavigation.applyFileScope,
    closeSharedWithMe: state.previewShare.closeSharedWithMe,
    loadFolderBreadcrumb: state.spaces.loadFolderBreadcrumb,
    loadSourceSets: dataFlow.surfaceData.loadSourceSets,
    messages: state.messages.entryFlowMessages,
    navigation,
    openPreviewWithOrigin: state.previewShare.openPreviewWithOrigin,
    resourceOrigin: state.previewShare.resourceOrigin,
    routeName: route.name,
    routeParams: route.params,
    setActiveSpaceId: state.scopeNavigation.setActiveSpaceId,
    setCurrentFolderId: state.scopeNavigation.setCurrentFolderId,
    setCurrentFolderSlug: state.scopeNavigation.setCurrentFolderSlug,
    setResourceOrigin: state.previewShare.setResourceOrigin,
    showToast: state.toast.show,
  });

  const trash = useResourceTrash({
    effectiveSpaceId: state.sourceSetDerived.effectiveSpaceId,
    loadFiles: dataFlow.collectionData.loadFiles,
    messages: state.messages.trashMessages,
    refreshTreeData: dataFlow.collectionData.refreshTreeData,
    sourceSetId: state.scopeNavigation.sourceSetId,
    toast: state.toast,
  });

  const folderActions = useResourceFolderActions({
    clearSelection: selection.clearSelection,
    currentFolderId: state.scopeNavigation.currentFolderId,
    currentFolderSlug: state.scopeNavigation.currentFolderSlug,
    effectiveSpaceId: state.sourceSetDerived.effectiveSpaceId,
    loadFiles: dataFlow.collectionData.loadFiles,
    messages: state.messages.folderActionMessages,
    refreshTreeData: dataFlow.collectionData.refreshTreeData,
    resourceItemsById: dataFlow.surfaceData.resourceItemsById,
    selectedIds: selection.selectedIds,
    sourceSetId: state.scopeNavigation.sourceSetId,
    toast: state.toast,
  });

  const refreshResourceSurface = useCallback(async () => {
    clearResourceListCache();
    await Promise.all([
      dataFlow.collectionData.loadFiles(true),
      dataFlow.collectionData.refreshTreeData(),
      dataFlow.surfaceData.loadSourceSets(),
    ]);
  }, [
    dataFlow.collectionData.loadFiles,
    dataFlow.collectionData.refreshTreeData,
    dataFlow.surfaceData.loadSourceSets,
  ]);

  const sourceSetActions = useResourceSourceSetActions({
    activateSourceSet: state.scopeNavigation.activateSourceSet,
    activeSpaceId: state.scopeNavigation.activeSpaceId,
    applyFileScope: state.scopeNavigation.applyFileScope,
    clearSelection: selection.clearSelection,
    currentSourceSetName: state.sourceSetDerived.currentSourceSetName,
    loadSourceSets: dataFlow.surfaceData.loadSourceSets,
    messages: state.messages.sourceSetActionMessages,
    refreshResourceSurface,
    removeSourceSetCache: state.scopeNavigation.removeSourceSetCache,
    resourceItemsById: dataFlow.surfaceData.resourceItemsById,
    sourceSetId: state.scopeNavigation.sourceSetId,
    toast: state.toast,
  });

  const sourceSetControls = useResourceSourceSetControls({
    closeScopeLauncher: state.scopeNavigation.closeScopeLauncher,
    openCreateSourceSetModalBase: sourceSetActions.openCreateSourceSetModal,
    openSourceSetManagementBase: sourceSetActions.openSourceSetManagement,
    setScopeLauncherVisible: state.scopeNavigation.setScopeLauncherVisible,
  });

  return {
    entryFlows,
    folderActions,
    refreshResourceSurface,
    selection,
    sourceSetActions,
    sourceSetControls,
    trash,
    upload,
  };
}

export type ResourceContentActionsResult = ReturnType<typeof useResourceContentActions>;
