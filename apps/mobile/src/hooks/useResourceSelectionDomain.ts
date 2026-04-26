import type { ResourceCacheEntry } from '../lib/resourceCache';
import type { ConversationOriginRouteParams } from '../navigation/types';
import type { ChatContextSelection, FileListItem } from '../types';
import { useResourceContentMutations } from './useResourceContentMutations';
import { useResourceSelectionActions } from './useResourceSelectionActions';
import { useResourceSelectionDerived } from './useResourceSelectionDerived';
import { useResourceSelectionState } from './useResourceSelectionState';

interface ResourceSelectionMessages {
  cancel: string;
  delete: string;
  errorNetwork: string;
  fileAddToChatContextSuccess: string;
  fileEditAsDocumentSuccess: string;
  fileUploadFailed: string;
  resourceDeleteConfirm: string;
  resourceDeleteDesc: string;
  resourceDeleteFailed: string;
  resourceFolderDeleteConfirm: string;
  resourceFolderDeleteDesc: string;
  resourceRenamed: string;
  resourceRenameFailed: string;
}

interface UseResourceSelectionDomainProps {
  addChatContextSelection: (context: ChatContextSelection) => void;
  cachedResourceMap: Record<string, ResourceCacheEntry>;
  deleteSelectionLabelTemplate: string;
  dismissPreviewForIds: (ids: Set<string>) => void;
  loadFiles: (silent?: boolean, append?: boolean) => Promise<void>;
  messages: ResourceSelectionMessages;
  openItemShareSheet: (item: FileListItem) => void;
  openManageShareFromItem: (item: FileListItem) => void;
  prunePreviewCacheState: (ids: string[]) => void;
  refreshTreeData: () => Promise<void>;
  replacePreviewItem: (nextItem: FileListItem, previousId?: string) => void;
  replaceVisibleResourceId: (previousId: string, nextId: string) => void;
  resourceItemsById: Map<string, FileListItem>;
  resourceOrigin?: ConversationOriginRouteParams | null;
  routeName: string;
  routeParams: unknown;
  setFiles: React.Dispatch<React.SetStateAction<FileListItem[]>>;
  setTreeChildrenByParent: React.Dispatch<React.SetStateAction<Record<string, FileListItem[]>>>;
  setTreeExpandedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  showToast: (type: 'error' | 'info' | 'success', message: string) => void;
}

export function useResourceSelectionDomain({
  addChatContextSelection,
  cachedResourceMap,
  deleteSelectionLabelTemplate,
  dismissPreviewForIds,
  loadFiles,
  messages,
  openItemShareSheet,
  openManageShareFromItem,
  prunePreviewCacheState,
  refreshTreeData,
  replacePreviewItem,
  replaceVisibleResourceId,
  resourceItemsById,
  resourceOrigin,
  routeName,
  routeParams,
  setFiles,
  setTreeChildrenByParent,
  setTreeExpandedIds,
  showToast,
}: UseResourceSelectionDomainProps) {
  const selectionState = useResourceSelectionState();

  const mutations = useResourceContentMutations({
    cachedResourceMap,
    dismissPreviewForIds,
    prunePreviewCacheState,
    pruneSelectionState: selectionState.pruneSelectionState,
    replacePreviewItem,
    replaceSelectionState: selectionState.replaceSelectionState,
    replaceVisibleResourceId,
    resourceItemsById,
    setFiles,
    setTreeChildrenByParent,
    setTreeExpandedIds,
  });

  const actions = useResourceSelectionActions({
    actionItem: selectionState.actionItem,
    addChatContextSelection,
    clearSelection: selectionState.clearSelection,
    closeActionSheet: selectionState.closeActionSheet,
    closeRenameModal: selectionState.closeRenameModal,
    deleteResourcesUnified: mutations.deleteResourcesUnified,
    loadFiles,
    messages,
    openItemShareSheet,
    openManageShareFromItem,
    purgeDeletedResources: mutations.purgeDeletedResources,
    refreshTreeData,
    replaceResourceItem: mutations.replaceResourceItem,
    resourceItemsById,
    resourceOrigin,
    routeName,
    routeParams,
    selectedIds: selectionState.selectedIds,
    setFiles,
    showToast,
  });

  const derived = useResourceSelectionDerived({
    resourceItemsById,
    selectedIds: selectionState.selectedIds,
    selectionCountLabelTemplate: deleteSelectionLabelTemplate,
  });

  return {
    ...selectionState,
    ...mutations,
    ...actions,
    ...derived,
  };
}
