import { useCallback } from 'react';

import { fileApi, resourceApi } from '../lib/api';
import {
  clearResourceCacheEntry,
  getResourceCacheEntry,
  type ResourceCacheEntry,
} from '../lib/resourceCache';
import { getCanonicalResourceKind } from '../lib/resourceList';
import { removeLocalCachedFile } from '../lib/resourcePreview';
import type { FileListItem } from '../types';

interface UseResourceContentMutationsProps {
  cachedResourceMap: Record<string, ResourceCacheEntry>;
  dismissPreviewForIds: (ids: Set<string>) => void;
  prunePreviewCacheState: (ids: string[]) => void;
  pruneSelectionState: (ids: string[]) => void;
  replacePreviewItem: (nextItem: FileListItem, previousId?: string) => void;
  replaceSelectionState: (nextItem: FileListItem, previousId?: string) => void;
  replaceVisibleResourceId: (previousId: string, nextId: string) => void;
  resourceItemsById: Map<string, FileListItem>;
  setFiles: React.Dispatch<React.SetStateAction<FileListItem[]>>;
  setTreeChildrenByParent: React.Dispatch<React.SetStateAction<Record<string, FileListItem[]>>>;
  setTreeExpandedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export function useResourceContentMutations({
  cachedResourceMap,
  dismissPreviewForIds,
  prunePreviewCacheState,
  pruneSelectionState,
  replacePreviewItem,
  replaceSelectionState,
  replaceVisibleResourceId,
  resourceItemsById,
  setFiles,
  setTreeChildrenByParent,
  setTreeExpandedIds,
}: UseResourceContentMutationsProps) {
  const deleteResourcesUnified = useCallback(
    async (ids: string[], trash: boolean = true) => {
      const fileIds: string[] = [];
      const documentIds: string[] = [];

      for (const id of ids) {
        const item = resourceItemsById.get(id);
        if (
          item &&
          (getCanonicalResourceKind(item) === 'document' || item.fileType === 'custom/folder')
        ) {
          documentIds.push(id);
        } else {
          fileIds.push(id);
        }
      }

      const promises: Promise<void>[] = [];
      if (fileIds.length > 0) {
        if (fileIds.length === 1) {
          promises.push(fileApi.remove(fileIds[0]!, trash));
        } else {
          promises.push(fileApi.removeFiles(fileIds, trash));
        }
      }
      if (documentIds.length > 0) {
        if (documentIds.length === 1) {
          promises.push(resourceApi.deleteDocument(documentIds[0]!, trash));
        } else {
          promises.push(resourceApi.deleteDocuments(documentIds, trash));
        }
      }

      await Promise.all(promises);
    },
    [resourceItemsById],
  );

  const purgeResourceState = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;

      const idSet = new Set(ids);

      setFiles((prev) => prev.filter((item) => !idSet.has(item.id)));
      pruneSelectionState(ids);
      setTreeExpandedIds((prev) => {
        if (prev.size === 0) return prev;
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
      setTreeChildrenByParent((prev) =>
        Object.fromEntries(
          Object.entries(prev).map(([key, items]) => [
            key,
            items.filter((item) => !idSet.has(item.id)),
          ]),
        ),
      );
      prunePreviewCacheState(ids);
      dismissPreviewForIds(idSet);
    },
    [
      dismissPreviewForIds,
      prunePreviewCacheState,
      pruneSelectionState,
      setFiles,
      setTreeChildrenByParent,
      setTreeExpandedIds,
    ],
  );

  const purgeDeletedResources = useCallback(
    async (ids: string[]) => {
      await Promise.all(
        ids.map(async (id) => {
          const cachedEntry = cachedResourceMap[id] ?? (await getResourceCacheEntry(id));
          await removeLocalCachedFile(cachedEntry);
          await clearResourceCacheEntry(id);
        }),
      );
      purgeResourceState(ids);
    },
    [cachedResourceMap, purgeResourceState],
  );

  const replaceResourceItem = useCallback(
    (nextItem: FileListItem, previousId?: string) => {
      const targetId = previousId ?? nextItem.id;

      setFiles((prev) =>
        prev.some((item) => item.id === targetId)
          ? prev.map((item) => (item.id === targetId ? nextItem : item))
          : prev,
      );
      replaceSelectionState(nextItem, previousId);
      replaceVisibleResourceId(targetId, nextItem.id);
      setTreeChildrenByParent((prev) => {
        let changed = false;
        const nextEntries = Object.entries(prev).map(([key, items]) => {
          const nextItems = items.map((item) => {
            if (item.id !== targetId) return item;
            changed = true;
            return nextItem;
          });

          return [key, nextItems] as const;
        });

        return changed ? Object.fromEntries(nextEntries) : prev;
      });
      replacePreviewItem(nextItem, targetId);
    },
    [
      replacePreviewItem,
      replaceSelectionState,
      replaceVisibleResourceId,
      setFiles,
      setTreeChildrenByParent,
    ],
  );

  return {
    deleteResourcesUnified,
    purgeDeletedResources,
    replaceResourceItem,
  };
}
