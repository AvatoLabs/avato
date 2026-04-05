import { type StateCreator } from 'zustand/vanilla';

import { type ContentManagerMode } from '@/features/ContentManager';
import { buildFilesRootPath } from '@/features/ResourceSpaces';
import { setActiveWorkspaceSpaceId } from '@/helpers/activeWorkspaceSpace';
import {
  type FileAssetClassification,
  type FileAssetReviewStatus,
  type FileAssetUsagePolicy,
  type FilesTabs,
  type SortType,
} from '@/types/files';

import { type State, type ViewMode } from './initialState';
import { initialState } from './initialState';

export type MultiSelectActionType =
  | 'addToSourceSet'
  | 'approveAssets'
  | 'archiveAssets'
  | 'moveToSourceSet'
  | 'batchChunking'
  | 'delete'
  | 'deleteSourceSet'
  | 'removeFromSourceSet';

export interface FolderCrumb {
  id: string;
  name: string;
  slug: string;
}

export interface Action {
  /**
   * Handle navigating back to list from file preview
   */
  handleBackToList: () => void;
  /**
   * Load more content items (pagination)
   */
  loadMoreContentItems: () => Promise<void>;
  /**
   * Handle multi-select actions (delete, chunking, source-set operations, etc.)
   */
  onActionClick: (type: MultiSelectActionType) => Promise<void>;
  /**
   * Set the current asset classification filter
   */
  setAssetClassification: (classification?: FileAssetClassification) => void;
  /**
   * Set the current asset review status filter
   */
  setAssetReviewStatus: (reviewStatus?: FileAssetReviewStatus) => void;
  /**
   * Set the current asset usage policy filter
   */
  setAssetUsagePolicy: (usagePolicy?: FileAssetUsagePolicy) => void;
  /**
   * Set the current file category filter
   */
  setCategory: (category: FilesTabs) => void;
  /**
   * Set the current folder ID
   */
  setCurrentFolderId: (folderId: string | null | undefined) => void;
  /**
   * Set the current view item ID
   */
  setCurrentViewItemId: (id?: string) => void;
  /**
   * Set whether there are more files to load
   */
  setFileListHasMore: (value: boolean) => void;
  /**
   * Set the pagination offset
   */
  setFileListOffset: (value: number) => void;
  /**
   * Set masonry ready state
   */
  setIsMasonryReady: (value: boolean) => void;
  /**
   * Set view transition state
   */
  setIsTransitioning: (value: boolean) => void;
  /**
   * Set the view mode
   */
  setMode: (mode: ContentManagerMode) => void;
  /**
   * Set the pending rename item ID
   */
  setPendingRenameItemId: (id: string | null) => void;
  /**
   * Set search query
   */
  setSearchQuery: (query: string | null) => void;
  /**
   * Set selected file IDs
   */
  setSelectedFileIds: (ids: string[]) => void;
  /**
   * Set the field to sort files by
   */
  setSorter: (sorter: 'name' | 'createdAt' | 'size') => void;
  /**
   * Set the sort direction
   */
  setSortType: (sortType: SortType) => void;
  /**
   * Set the current source-set ID
   */
  setSourceSetId: (id?: string) => void;
  /**
   * Set the current space ID
   */
  setSpaceId: (id?: string) => void;
  /**
   * Set the file explorer view mode
   */
  setViewMode: (viewMode: ViewMode) => void;
}

export type Store = Action & State;

type CreateStore = (
  initState?: Partial<State>,
) => StateCreator<Store, [['zustand/devtools', never]]>;

export const store: CreateStore = (publicState) => (set, get) => ({
  ...initialState,
  ...publicState,

  handleBackToList: () => {
    set({ currentViewItemId: undefined, mode: 'explorer' });
  },

  loadMoreContentItems: async () => {
    const { fileListHasMore } = get();

    // Don't load if there's no more data
    if (!fileListHasMore) return;

    const { useFileStore } = await import('@/store/file');
    const fileStore = useFileStore.getState();

    // Delegate to FileStore's loadMoreContentItems
    await fileStore.loadMoreContentItems();

    // Sync pagination state back to ContentManagerStore
    set({
      fileListHasMore: fileStore.fileListHasMore,
      fileListOffset: fileStore.fileListOffset,
    });
  },

  onActionClick: async (type) => {
    const { selectedFileIds, sourceSetId, spaceId } = get();
    const { useFileStore } = await import('@/store/file');
    const { useSourceSetStore } = await import('@/store/sourceSet');
    const { isChunkingUnsupported } = await import('@/utils/isChunkingUnsupported');

    const fileStore = useFileStore.getState();
    const sourceSetStore = useSourceSetStore.getState();

    switch (type) {
      case 'delete': {
        await fileStore.deleteContentItems(selectedFileIds);

        set({ selectedFileIds: [] });
        return;
      }

      case 'approveAssets': {
        await fileStore.approveFileAssets(selectedFileIds);
        set({ selectedFileIds: [] });
        return;
      }

      case 'archiveAssets': {
        await fileStore.archiveFileAssets(selectedFileIds);
        set({ selectedFileIds: [] });
        return;
      }

      case 'removeFromSourceSet': {
        if (!sourceSetId) return;
        await sourceSetStore.removeFilesFromSourceSet(sourceSetId, selectedFileIds);
        set({ selectedFileIds: [] });
        return;
      }

      case 'addToSourceSet': {
        // Modal operations need to be handled in component layer
        // Store just marks that action was requested
        // Component will handle opening the add-to-source-set modal.
        return;
      }

      case 'moveToSourceSet': {
        // Modal operations need to be handled in component layer
        // Store just marks that action was requested
        // Component will handle opening the move-to-source-set modal.
        return;
      }

      case 'batchChunking': {
        const chunkableFileIds = selectedFileIds.filter((id) => {
          const resource = fileStore.resourceMap?.get(id);
          return resource && !isChunkingUnsupported(resource.fileType);
        });
        await fileStore.parseFilesToChunks(chunkableFileIds, { skipExist: true });
        set({ selectedFileIds: [] });
        return;
      }

      case 'deleteSourceSet': {
        if (!sourceSetId) return;
        await sourceSetStore.removeSourceSet(sourceSetId);
        // Clear tree cache before navigation
        const { clearTreeStateForSourceSet } =
          await import('@/features/ContentManager/components/SourceSetTree/treeState');
        clearTreeStateForSourceSet(sourceSetId);
        // Navigate to resource home via SPA navigation
        const { useGlobalStore } = await import('@/store/global');
        useGlobalStore.getState().navigate?.(buildFilesRootPath(spaceId));
        return;
      }
    }
  },

  setAssetClassification: (assetClassification) => {
    if (get().assetClassification === assetClassification) return;

    set({ assetClassification });
  },

  setAssetReviewStatus: (assetReviewStatus) => {
    if (get().assetReviewStatus === assetReviewStatus) return;

    set({ assetReviewStatus });
  },

  setAssetUsagePolicy: (assetUsagePolicy) => {
    if (get().assetUsagePolicy === assetUsagePolicy) return;

    set({ assetUsagePolicy });
  },

  setCategory: (category) => {
    if (get().category === category) return;

    set({ category });
  },

  setCurrentFolderId: (currentFolderId) => {
    set({ currentFolderId });
  },

  setCurrentViewItemId: (currentViewItemId) => {
    set({ currentViewItemId });
  },

  setFileListHasMore: (fileListHasMore) => {
    if (get().fileListHasMore === fileListHasMore) return;

    set({ fileListHasMore });
  },

  setFileListOffset: (fileListOffset) => {
    if (get().fileListOffset === fileListOffset) return;

    set({ fileListOffset });
  },

  setIsMasonryReady: (isMasonryReady) => {
    set({ isMasonryReady });
  },

  setIsTransitioning: (isTransitioning) => {
    set({ isTransitioning });
  },

  setSourceSetId: (sourceSetId) => {
    const prevId = get().sourceSetId;
    if (prevId === sourceSetId) return;

    set({ sourceSetId });

    // Reset pagination state when switching source sets to prevent stale data.
    set({
      fileListHasMore: false,
      fileListOffset: 0,
    });

    // Clear tree cache when navigating back to home to prevent memory buildup.
    if (prevId && !sourceSetId) {
      import('@/features/ContentManager/components/SourceSetTree/treeState').then(
        ({ clearTreeStateForSourceSet }) => clearTreeStateForSourceSet(prevId),
      );
    }

    // No manual refresh is needed; the explorer reacts to source-set changes.
  },

  setMode: (mode) => {
    set({ mode });
  },

  setPendingRenameItemId: (pendingRenameItemId) => {
    set({ pendingRenameItemId });
  },

  setSearchQuery: (searchQuery) => {
    set({ searchQuery });
  },

  setSpaceId: (spaceId) => {
    if (get().spaceId === spaceId) return;

    setActiveWorkspaceSpaceId(spaceId);
    set({ spaceId });
  },

  setSelectedFileIds: (selectedFileIds) => {
    set({ selectedFileIds });
  },

  setSortType: (sortType) => {
    set({ sortType });
  },

  setSorter: (sorter) => {
    set({ sorter });
  },

  setViewMode: (viewMode) => {
    set({ viewMode });
  },
});
