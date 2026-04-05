import { type ContentManagerMode } from '@/features/ContentManager';
import {
  type FileAssetClassification,
  type FileAssetUsagePolicy,
  FilesTabs,
  SortType,
} from '@/types/files';

export type ViewMode = 'list' | 'masonry';

export interface State {
  /**
   * Current asset classification filter
   */
  assetClassification?: FileAssetClassification;
  /**
   * Current asset usage policy filter
   */
  assetUsagePolicy?: FileAssetUsagePolicy;
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
   * View mode for displaying resources
   */
  mode: ContentManagerMode;
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
   * Field to sort files by
   */
  sorter: 'name' | 'createdAt' | 'size';
  /**
   * Sort direction (ascending or descending)
   */
  sortType: SortType;
  /**
   * Current source-set ID
   */
  sourceSetId?: string;
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
  assetClassification: undefined,
  assetUsagePolicy: undefined,
  category: FilesTabs.Home,
  currentFolderId: undefined,
  currentViewItemId: undefined,
  fileListHasMore: false,
  fileListOffset: 0,
  isMasonryReady: false,
  isTransitioning: false,
  sourceSetId: undefined,
  mode: 'explorer',
  pendingRenameItemId: null,
  searchQuery: null,
  spaceId: undefined,
  selectedFileIds: [],
  sortType: SortType.Desc,
  sorter: 'createdAt',
  viewMode: 'list',
};
