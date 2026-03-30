import { getActiveWorkspaceSpaceId } from '@/helpers/activeWorkspaceSpace';
import { fileService } from '@/services/file';
import { useFileStore } from '@/store/file';
import { type ContentItem } from '@/types/content';

import { type TreeItem } from './types';

export const sortTreeItems = <T extends TreeItem>(items: T[]): T[] => {
  return [...items].sort((a, b) => {
    // Folders first
    if (a.isFolder && !b.isFolder) return -1;
    if (!a.isFolder && b.isFolder) return 1;
    // Then alphabetically by name
    return a.name.localeCompare(b.name);
  });
};

export const contentItemToTreeItem = (item: ContentItem): TreeItem => {
  return {
    fileId: item.fileId ?? null,
    fileType: item.fileType,
    id: item.id,
    isFolder: item.fileType === 'custom/folder',
    metadata: item.metadata,
    name: item.name,
    slug: item.slug,
    sourceType: item.sourceType,
    url: item.url || '',
  };
};

// Module-level state to persist expansion across re-renders
const treeState = new Map<
  string,
  {
    expandedFolders: Set<string>;
    folderChildrenCache: Map<string, TreeItem[]>;
    loadedFolders: Set<string>;
    loadingFolders: Set<string>;
  }
>();

export const TREE_REFRESH_EVENT = 'resource-tree-refresh';

export const emitTreeRefresh = (sourceSetId: string) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(TREE_REFRESH_EVENT, {
      detail: { sourceSetId },
    }),
  );
};

export const getTreeState = (sourceSetId: string) => {
  if (!treeState.has(sourceSetId)) {
    treeState.set(sourceSetId, {
      expandedFolders: new Set(),
      folderChildrenCache: new Map(),
      loadedFolders: new Set(),
      loadingFolders: new Set(),
    });
  }
  return treeState.get(sourceSetId)!;
};

/** Remove cached tree state for a library (call when switching away or after delete) */
export const clearTreeStateForSourceSet = (sourceSetId: string) => {
  treeState.delete(sourceSetId);
};

/**
 * Clear and reload all expanded folders
 * This should be called along with file store's refreshFileList()
 * Tree state uses document ids as the only folder key.
 */
export const clearTreeFolderCache = async (
  sourceSetId: string,
  spaceId = getActiveWorkspaceSpaceId(),
) => {
  const state = treeState.get(sourceSetId);
  if (!state) return;

  const { resourceList } = useFileStore.getState();

  const buildChildrenFromStore = (parentId: string | null) => {
    const items = resourceList
      .filter((item) => item.sourceSetId === sourceSetId && (item.parentId ?? null) === parentId)
      .map(contentItemToTreeItem);

    return sortTreeItems(items);
  };

  // Get list of all currently expanded folders before clearing
  const expandedFoldersList = Array.from(state.expandedFolders);

  // Clear all caches
  state.folderChildrenCache.clear();
  state.loadedFolders.clear();

  // Reload each expanded folder
  for (const folderKey of expandedFoldersList) {
    // Prefer local store (explorer data) to avoid stale remote state
    const localChildren = buildChildrenFromStore(folderKey);
    if (localChildren.length > 0) {
      state.folderChildrenCache.set(folderKey, localChildren);
      state.loadedFolders.add(folderKey);
      continue;
    }

    // Fallback to remote fetch if store has no data (e.g., initial load)
    try {
      const response = await fileService.getKnowledgeItems({
        spaceId,
        sourceSetId,
        parentId: folderKey,
        showFilesInSourceSet: false,
      });

      if (response?.items) {
        const childItems = response.items.map((item) => ({
          fileId: item.fileId ?? null,
          fileType: item.fileType,
          id: item.id,
          isFolder: item.fileType === 'custom/folder',
          metadata: item.metadata,
          name: item.name,
          slug: item.slug,
          sourceType: item.sourceType,
          url: item.url,
        }));

        // Sort children: folders first, then files
        const sortedChildren = childItems.sort((a, b) => {
          if (a.isFolder && !b.isFolder) return -1;
          if (!a.isFolder && b.isFolder) return 1;
          return a.name.localeCompare(b.name);
        });

        state.folderChildrenCache.set(folderKey, sortedChildren);
        state.loadedFolders.add(folderKey);
      }
    } catch (error) {
      console.error(`Failed to reload folder ${folderKey}:`, error);
    }
  }

  // Revalidate SWR caches for root and expanded folders to keep list and tree in sync
  try {
    const { mutate } = await import('swr');
    const revalidateFolder = (parentId: string | null) =>
      mutate(
        [
          'useFetchKnowledgeItems',
          {
            spaceId,
            sourceSetId,
            parentId,
            showFilesInSourceSet: false,
          },
        ],
        undefined,
        { revalidate: true },
      );

    await Promise.all([
      revalidateFolder(null),
      ...expandedFoldersList.map((folderKey) => revalidateFolder(folderKey)),
    ]);
  } catch (error) {
    console.error('Failed to revalidate tree SWR cache:', error);
  }

  emitTreeRefresh(sourceSetId);
};
