import { useCallback, useEffect, useMemo, useState } from 'react';

import type { ToastType } from '../components/ui/Toast';
import { resourceApi } from '../lib/api';
import { haptics } from '../lib/haptics';
import { getCanonicalResourceKind } from '../lib/resourceList';
import { clearResourceListCache } from '../lib/resourceListCache';
import type { FileListItem } from '../types';

interface ResourceFolderActionsMessages {
  done: string;
  newFolder: string;
  uploadFailed: string;
}

interface ResourceFolderActionsToast {
  show: (type: ToastType, message: string) => void;
}

interface UseResourceFolderActionsProps {
  clearSelection: () => void;
  currentFolderId: string | null;
  currentFolderSlug: string | null;
  effectiveSpaceId?: string;
  loadFiles: (refresh?: boolean, append?: boolean) => Promise<void>;
  messages: ResourceFolderActionsMessages;
  refreshTreeData: () => Promise<void>;
  resourceItemsById: Map<string, FileListItem>;
  selectedIds: Set<string>;
  sourceSetId: string | null;
  toast: ResourceFolderActionsToast;
}

interface FolderStackItem {
  id: string;
  name: string;
}

const BATCH_MOVE_ITEM = {
  createdAt: '',
  fileType: '',
  id: '__batch__',
  name: '',
  size: 0,
  sourceType: 'file',
  url: '',
} as FileListItem;

export function useResourceFolderActions({
  clearSelection,
  currentFolderId,
  currentFolderSlug,
  effectiveSpaceId,
  loadFiles,
  messages,
  refreshTreeData,
  resourceItemsById,
  selectedIds,
  sourceSetId,
  toast,
}: UseResourceFolderActionsProps) {
  const [createFolderVisible, setCreateFolderVisible] = useState(false);
  const [moveToFolderItem, setMoveToFolderItem] = useState<FileListItem | null>(null);
  const [moveTargetFolders, setMoveTargetFolders] = useState<FileListItem[]>([]);
  const [moveFolderStack, setMoveFolderStack] = useState<Array<FolderStackItem | null>>([null]);
  const [batchMoveIds, setBatchMoveIds] = useState<Set<string>>(() => new Set());

  const moveFolderParentId = moveFolderStack.at(-1)?.id ?? null;
  const moveFolderCurrent = useMemo(
    () => (moveFolderStack.length > 1 ? (moveFolderStack.at(-1) ?? null) : null),
    [moveFolderStack],
  );

  const resetMoveState = useCallback(() => {
    setMoveToFolderItem(null);
    setBatchMoveIds(new Set());
    setMoveFolderStack([null]);
  }, []);

  const openCreateFolder = useCallback(() => setCreateFolderVisible(true), []);
  const closeCreateFolder = useCallback(() => setCreateFolderVisible(false), []);

  const openMoveToFolder = useCallback((item: FileListItem) => {
    haptics.light();
    setMoveToFolderItem(item);
    setBatchMoveIds(new Set());
    setMoveFolderStack([null]);
  }, []);

  const handleBatchMove = useCallback(() => {
    setBatchMoveIds(new Set(selectedIds));
    setMoveToFolderItem(BATCH_MOVE_ITEM);
    setMoveFolderStack([null]);
  }, [selectedIds]);

  const closeMoveToFolder = useCallback(() => {
    resetMoveState();
  }, [resetMoveState]);

  const enterMoveFolder = useCallback((folder: FileListItem) => {
    setMoveFolderStack((stack) => [...stack, { id: folder.slug ?? folder.id, name: folder.name }]);
  }, []);

  const leaveMoveFolder = useCallback(() => {
    setMoveFolderStack((stack) => stack.slice(0, -1));
  }, []);

  useEffect(() => {
    if (moveToFolderItem && sourceSetId) {
      resourceApi
        .getKnowledgeItems({
          sourceSetId,
          parentId: moveFolderParentId,
          ...(effectiveSpaceId ? { spaceId: effectiveSpaceId } : {}),
        })
        .then((response) => {
          const folders = (response?.items ?? []).filter(
            (item) => item.fileType === 'custom/folder',
          );
          setMoveTargetFolders(folders);
        })
        .catch(() => setMoveTargetFolders([]));
    } else {
      setMoveTargetFolders([]);
      setMoveFolderStack([null]);
    }
  }, [effectiveSpaceId, moveFolderParentId, moveToFolderItem, sourceSetId]);

  const handleCreateFolder = useCallback(
    async (value: string) => {
      if (!sourceSetId) return;

      const name = value.trim() || messages.newFolder;
      setCreateFolderVisible(false);

      try {
        await resourceApi.createFolder({
          sourceSetId,
          parentId: currentFolderId ?? currentFolderSlug ?? undefined,
          title: name,
        });
        haptics.success();
        clearResourceListCache();
        await loadFiles(true);
        await refreshTreeData();
      } catch {
        toast.show('error', messages.uploadFailed);
      }
    },
    [
      currentFolderId,
      currentFolderSlug,
      loadFiles,
      messages.newFolder,
      messages.uploadFailed,
      refreshTreeData,
      sourceSetId,
      toast,
    ],
  );

  const handleMoveToFolder = useCallback(
    async (targetFolderId: string | null) => {
      const idsToMove =
        batchMoveIds.size > 0
          ? Array.from(batchMoveIds)
          : moveToFolderItem
            ? [moveToFolderItem.id]
            : [];

      resetMoveState();
      if (idsToMove.length === 0) return;

      try {
        for (const id of idsToMove) {
          const item = resourceItemsById.get(id);
          if (item && id !== BATCH_MOVE_ITEM.id) {
            await resourceApi.moveResource(id, targetFolderId, getCanonicalResourceKind(item));
          }
        }

        haptics.success();
        toast.show('success', messages.done);
        clearSelection();
        clearResourceListCache();
        await loadFiles(true);
        await refreshTreeData();
      } catch {
        toast.show('error', messages.uploadFailed);
      }
    },
    [
      batchMoveIds,
      clearSelection,
      loadFiles,
      messages.done,
      messages.uploadFailed,
      moveToFolderItem,
      refreshTreeData,
      resetMoveState,
      resourceItemsById,
      toast,
    ],
  );

  return {
    batchMoveCount: batchMoveIds.size,
    closeCreateFolder,
    closeMoveToFolder,
    createFolderVisible,
    enterMoveFolder,
    handleBatchMove,
    handleCreateFolder,
    handleMoveToFolder,
    leaveMoveFolder,
    moveFolderCurrent,
    moveFolderStackDepth: moveFolderStack.length,
    moveTargetFolders,
    moveToFolderVisible: !!moveToFolderItem || batchMoveIds.size > 0,
    openCreateFolder,
    openMoveToFolder,
  };
}
