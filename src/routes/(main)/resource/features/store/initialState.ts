import { type ResourceManagerMode } from '@/features/ResourceManager';
import { FilesTabs, SortType } from '@/types/files';

export type ViewMode = 'list' | 'masonry';

export interface State {
  /**
   * Current file category filter
   */
  category: FilesTabs;
  /**
   * Current folder ID for navigation
   */
  currentFolderId?: string | null;
  /**
   * Current view item ID (document ID or file ID)
   */
  currentViewItemId?: string;
  /**
   * Whether there are more files to load (pagination)
   */
  fileListHasMore: boolean;
  /**
   * Current pagination offset
   */
  fileListOffset: number;
  /**
   * Masonry view ready state
   */
  isMasonryReady: boolean;
  /**
   * View transition state
   */
  isTransitioning: boolean;
  /**
   * Current library ID
   */
  libraryId?: string;
  /**
   * View mode for displaying resources
   */
  mode: ResourceManagerMode;
  /**
   * ID of item currently being renamed (for inline editing)
   */
  pendingRenameItemId: string | null;
  /**
   * Search query for filtering files
   */
  searchQuery: string | null;
  /**
   * Selected file IDs in the file explorer
   */
  selectedFileIds: string[];
  /**
   * Whether the resource info sidebar panel is visible
   */
  showInfoPanel: boolean;
  /**
   * Field to sort files by
   */
  sorter: 'name' | 'createdAt' | 'size';
  /**
   * Sort direction (ascending or descending)
   */
  sortType: SortType;
  /**
   * Current space ID
   */
  spaceId?: string;
  /**
   * File explorer view mode (list or masonry)
   */
  viewMode: ViewMode;
}

export const initialState: State = {
  category: FilesTabs.All,
  currentFolderId: undefined,
  currentViewItemId: undefined,
  fileListHasMore: false,
  fileListOffset: 0,
  isMasonryReady: false,
  isTransitioning: false,
  libraryId: undefined,
  mode: 'explorer',
  pendingRenameItemId: null,
  searchQuery: null,
  spaceId: undefined,
  selectedFileIds: [],
  showInfoPanel: false,
  sortType: SortType.Desc,
  sorter: 'createdAt',
  viewMode: 'list',
};
