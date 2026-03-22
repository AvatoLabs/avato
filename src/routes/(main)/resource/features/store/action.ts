import { type StateCreator } from 'zustand/vanilla';

import { type ResourceManagerMode } from '@/features/ResourceManager';
import { setActiveWorkspaceSpaceId } from '@/helpers/activeWorkspaceSpace';
import { type FilesTabs, type SortType } from '@/types/files';

import { type State, type ViewMode } from './initialState';
import { initialState } from './initialState';

export type MultiSelectActionType =
  | 'addToKnowledgeBase'
  | 'moveToOtherKnowledgeBase'
  | 'batchChunking'
  | 'delete'
  | 'deleteLibrary'
  | 'removeFromKnowledgeBase';

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
   * Load more knowledge items (pagination)
   */
  loadMoreKnowledgeItems: () => Promise<void>;
  /**
   * Handle multi-select actions (delete, chunking, KB operations, etc.)
   */
  onActionClick: (type: MultiSelectActionType) => Promise<void>;
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
   * Set the current library ID
   */
  setLibraryId: (id?: string) => void;
  /**
   * Set the view mode
   */
  setMode: (mode: ResourceManagerMode) => void;
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

  loadMoreKnowledgeItems: async () => {
    const { fileListHasMore } = get();

    // Don't load if there's no more data
    if (!fileListHasMore) return;

    const { useFileStore } = await import('@/store/file');
    const fileStore = useFileStore.getState();

    // Delegate to FileStore's loadMoreKnowledgeItems
    await fileStore.loadMoreKnowledgeItems();

    // Sync pagination state back to ResourceManagerStore
    set({
      fileListHasMore: fileStore.fileListHasMore,
      fileListOffset: fileStore.fileListOffset,
    });
  },

  onActionClick: async (type) => {
    const { selectedFileIds, libraryId } = get();
    const { useFileStore } = await import('@/store/file');
    const { useKnowledgeBaseStore } = await import('@/store/library');
    const { isChunkingUnsupported } = await import('@/utils/isChunkingUnsupported');

    const fileStore = useFileStore.getState();
    const kbStore = useKnowledgeBaseStore.getState();

    switch (type) {
      case 'delete': {
        await fileStore.deleteResources(selectedFileIds);

        set({ selectedFileIds: [] });
        return;
      }

      case 'removeFromKnowledgeBase': {
        if (!libraryId) return;
        await kbStore.removeFilesFromKnowledgeBase(libraryId, selectedFileIds);
        set({ selectedFileIds: [] });
        return;
      }

      case 'addToKnowledgeBase': {
        // Modal operations need to be handled in component layer
        // Store just marks that action was requested
        // Component will handle opening modal via useAddFilesToKnowledgeBaseModal hook
        return;
      }

      case 'moveToOtherKnowledgeBase': {
        // Modal operations need to be handled in component layer
        // Store just marks that action was requested
        // Component will handle opening modal via useAddFilesToKnowledgeBaseModal hook
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

      case 'deleteLibrary': {
        if (!libraryId) return;
        await kbStore.removeKnowledgeBase(libraryId);
        // Navigate to knowledge base page using window.location
        // (can't use useNavigate hook from store)
        if (typeof window !== 'undefined') {
          window.location.href = '/knowledge';
        }
        return;
      }
    }
  },

  setCategory: (category) => {
    if (get().category === category) return;
    set({ category });
  },

  setCurrentFolderId: (currentFolderId) => {
    if (get().currentFolderId === currentFolderId) return;
    set({ currentFolderId });
  },

  setCurrentViewItemId: (currentViewItemId) => {
    if (get().currentViewItemId === currentViewItemId) return;
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
    if (get().isMasonryReady === isMasonryReady) return;
    set({ isMasonryReady });
  },

  setIsTransitioning: (isTransitioning) => {
    if (get().isTransitioning === isTransitioning) return;
    set({ isTransitioning });
  },

  setLibraryId: (libraryId) => {
    const state = get();
    if (state.libraryId === libraryId) return;
    // Batch libraryId + pagination reset into a single set() call
    set({
      fileListHasMore: false,
      fileListOffset: 0,
      libraryId,
    });

    // Note: No need to manually refresh - Explorer's useEffect will automatically
    // call fetchResources when libraryId changes
  },

  setMode: (mode) => {
    if (get().mode === mode) return;
    set({ mode });
  },

  setPendingRenameItemId: (pendingRenameItemId) => {
    if (get().pendingRenameItemId === pendingRenameItemId) return;
    set({ pendingRenameItemId });
  },

  setSearchQuery: (searchQuery) => {
    if (get().searchQuery === searchQuery) return;
    set({ searchQuery });
  },

  setSpaceId: (spaceId) => {
    setActiveWorkspaceSpaceId(spaceId);
    if (get().spaceId === spaceId) return;
    set({ spaceId });
  },

  setSelectedFileIds: (selectedFileIds) => {
    set({ selectedFileIds });
  },

  setSortType: (sortType) => {
    if (get().sortType === sortType) return;
    set({ sortType });
  },

  setSorter: (sorter) => {
    if (get().sorter === sorter) return;
    set({ sorter });
  },

  setViewMode: (viewMode) => {
    if (get().viewMode === viewMode) return;
    set({ viewMode });
  },
});
