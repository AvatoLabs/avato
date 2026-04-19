import { useCallback } from 'react';
import { Alert } from 'react-native';

import { fileApi, resourceApi } from '../lib/api';
import {
  createChatContextSelectionFromResource,
  isChatContextEligibleResource,
} from '../lib/chatContext';
import { haptics } from '../lib/haptics';
import { navigateToNotebook } from '../lib/navigation';
import { appendCurrentPortalStackWithOrigin } from '../lib/portalNavigation';
import { isMarkdownFile } from '../lib/resourceFile';
import { getCanonicalResourceKind } from '../lib/resourceList';
import { clearResourceListCache } from '../lib/resourceListCache';
import { ensureNotebookDocumentFromFile } from '../lib/resourcePreview';
import type { ConversationOriginRouteParams } from '../navigation/types';
import type { ChatContextSelection, FileListItem } from '../types';

const isFolder = (item: FileListItem) => item.fileType === 'custom/folder';

interface ResourceSelectionActionMessages {
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

interface UseResourceSelectionActionsProps {
  actionItem: FileListItem | null;
  addChatContextSelection: (context: ChatContextSelection) => void;
  clearSelection: () => void;
  closeActionSheet: () => void;
  closeRenameModal: () => void;
  deleteResourcesUnified: (ids: string[], trash?: boolean) => Promise<void>;
  loadFiles: (silent?: boolean, append?: boolean) => Promise<void>;
  messages: ResourceSelectionActionMessages;
  openItemShareSheet: (item: FileListItem) => void;
  openManageShareFromItem: (item: FileListItem) => void;
  purgeDeletedResources: (ids: string[]) => Promise<void>;
  refreshTreeData: () => Promise<void>;
  replaceResourceItem: (nextItem: FileListItem, previousId?: string) => void;
  resourceItemsById: Map<string, FileListItem>;
  resourceOrigin?: ConversationOriginRouteParams | null;
  routeName: string;
  routeParams: unknown;
  selectedIds: Set<string>;
  setFiles: React.Dispatch<React.SetStateAction<FileListItem[]>>;
  showToast: (type: 'error' | 'info' | 'success', message: string) => void;
}

export function useResourceSelectionActions({
  actionItem,
  addChatContextSelection,
  clearSelection,
  closeActionSheet,
  closeRenameModal,
  deleteResourcesUnified,
  loadFiles,
  messages,
  openItemShareSheet,
  openManageShareFromItem,
  purgeDeletedResources,
  refreshTreeData,
  replaceResourceItem,
  resourceItemsById,
  resourceOrigin,
  routeName,
  routeParams,
  selectedIds,
  setFiles,
  showToast,
}: UseResourceSelectionActionsProps) {
  const handleDelete = useCallback(
    (id: string, name: string, isFolderItem: boolean) => {
      haptics.warning();
      const confirmTitle = isFolderItem
        ? messages.resourceFolderDeleteConfirm
        : messages.resourceDeleteConfirm;
      const confirmDesc = isFolderItem
        ? messages.resourceFolderDeleteDesc
        : messages.resourceDeleteDesc;

      Alert.alert(confirmTitle, `"${name}"\n${confirmDesc}`, [
        { text: messages.cancel, style: 'cancel' },
        {
          text: messages.delete,
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteResourcesUnified([id]);
              haptics.success();
              await purgeDeletedResources([id]);
              clearResourceListCache();
              await loadFiles(true);
              await refreshTreeData();
            } catch {
              showToast('error', messages.resourceDeleteFailed);
            }
          },
        },
      ]);
    },
    [
      deleteResourcesUnified,
      loadFiles,
      messages,
      purgeDeletedResources,
      refreshTreeData,
      showToast,
    ],
  );

  const handleBatchDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    const hasFolders = ids.some((id) => {
      const item = resourceItemsById.get(id);
      return item?.fileType === 'custom/folder';
    });
    const confirmTitle = hasFolders
      ? messages.resourceFolderDeleteConfirm
      : messages.resourceDeleteConfirm;
    const confirmDesc = hasFolders
      ? messages.resourceFolderDeleteDesc
      : messages.resourceDeleteDesc;

    Alert.alert(confirmTitle, `${ids.length} items\n${confirmDesc}`, [
      { text: messages.cancel, style: 'cancel' },
      {
        text: messages.delete,
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteResourcesUnified(ids);
            haptics.success();
            await purgeDeletedResources(ids);
            clearSelection();
            clearResourceListCache();
            await loadFiles(true);
            await refreshTreeData();
          } catch {
            showToast('error', messages.resourceDeleteFailed);
          }
        },
      },
    ]);
  }, [
    clearSelection,
    deleteResourcesUnified,
    loadFiles,
    messages,
    purgeDeletedResources,
    refreshTreeData,
    resourceItemsById,
    selectedIds,
    showToast,
  ]);

  const handleRenameSubmit = useCallback(
    async (newName: string) => {
      if (!actionItem || !newName.trim()) return;
      closeRenameModal();
      const trimmedName = newName.trim();

      try {
        if (isFolder(actionItem) || getCanonicalResourceKind(actionItem) === 'document') {
          await resourceApi.updateDocument(actionItem.id, { title: trimmedName });
        } else {
          await fileApi.update(actionItem.id, { name: trimmedName });
        }
        haptics.success();
        setFiles((prev) =>
          prev.map((item) => (item.id === actionItem.id ? { ...item, name: trimmedName } : item)),
        );
        clearResourceListCache();
        await refreshTreeData();
        showToast('success', messages.resourceRenamed);
      } catch {
        showToast('error', messages.resourceRenameFailed);
      }
    },
    [
      actionItem,
      closeRenameModal,
      messages.resourceRenameFailed,
      messages.resourceRenamed,
      refreshTreeData,
      setFiles,
      showToast,
    ],
  );

  const handleConvertActionItemToDocument = useCallback(async () => {
    if (
      !actionItem ||
      isFolder(actionItem) ||
      getCanonicalResourceKind(actionItem) !== 'file' ||
      !isMarkdownFile(actionItem.fileType, actionItem.name)
    ) {
      return;
    }

    try {
      const ensuredDocument = await ensureNotebookDocumentFromFile(actionItem);
      if (!ensuredDocument) {
        showToast('error', messages.errorNetwork);
        return;
      }

      const { documentId, nextItem } = ensuredDocument;
      replaceResourceItem(nextItem, actionItem.id);
      closeActionSheet();
      haptics.success();
      showToast('success', messages.fileEditAsDocumentSuccess);
      navigateToNotebook(
        appendCurrentPortalStackWithOrigin(routeName, routeParams, { documentId }, resourceOrigin),
      );
    } catch {
      showToast('error', messages.errorNetwork);
    }
  }, [
    actionItem,
    closeActionSheet,
    messages.errorNetwork,
    messages.fileEditAsDocumentSuccess,
    replaceResourceItem,
    resourceOrigin,
    routeName,
    routeParams,
    showToast,
  ]);

  const handleShareFromActionSheet = useCallback(
    (item: FileListItem) => {
      closeActionSheet();
      openItemShareSheet(item);
    },
    [closeActionSheet, openItemShareSheet],
  );

  const handleManageShareFromItem = useCallback(
    (item: FileListItem) => {
      closeActionSheet();
      openManageShareFromItem(item);
    },
    [closeActionSheet, openManageShareFromItem],
  );

  const handleAddToChatContext = useCallback(
    async (item: FileListItem) => {
      closeActionSheet();
      if (!isChatContextEligibleResource(item)) return;

      try {
        const context = await createChatContextSelectionFromResource(item);
        if (!context) {
          showToast('error', messages.fileUploadFailed);
          return;
        }

        addChatContextSelection(context);
        haptics.success();
        showToast('success', messages.fileAddToChatContextSuccess);
      } catch {
        showToast('error', messages.fileUploadFailed);
      }
    },
    [
      addChatContextSelection,
      closeActionSheet,
      messages.fileAddToChatContextSuccess,
      messages.fileUploadFailed,
      showToast,
    ],
  );

  const handleBatchShareLink = useCallback(() => {
    if (selectedIds.size !== 1) return;
    const onlyId = Array.from(selectedIds)[0];
    const item = onlyId ? resourceItemsById.get(onlyId) : undefined;
    if (!item) return;
    openItemShareSheet(item);
    clearSelection();
  }, [clearSelection, openItemShareSheet, resourceItemsById, selectedIds]);

  return {
    handleAddToChatContext,
    handleBatchDelete,
    handleBatchShareLink,
    handleConvertActionItemToDocument,
    handleDelete,
    handleManageShareFromItem,
    handleRenameSubmit,
    handleShareFromActionSheet,
  };
}
