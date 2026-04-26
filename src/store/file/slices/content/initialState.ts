import { type ContentItem, type ContentQueryParams, type SyncOperation } from '@/types/content';
import { type FileAssetCapabilities } from '@/types/files';

/**
 * Resource slice state
 */
export interface ResourceState {
  governanceCapabilities?: FileAssetCapabilities;
  /**
   * Pagination state
   */
  hasMore: boolean;

  /**
   * Loading states
   */
  isLoadingMore: boolean;

  isSyncing: boolean;

  /**
   * Sync status
   */
  lastSyncTime?: Date;

  offset: number;
  /**
   * Current query parameters
   */
  queryParams?: ContentQueryParams;
  /**
   * Derived sorted/filtered list (computed from map)
   * Used for rendering in UI
   */
  resourceList: ContentItem[];

  /**
   * Primary store - Map for O(1) lookups
   */
  resourceMap: Map<string, ContentItem>;

  syncError?: Error;
  /**
   * Track which resources are currently syncing
   */
  syncingIds: Set<string>;

  /**
   * Sync queue (FIFO)
   * Contains pending operations to be synced to server
   */
  syncQueue: SyncOperation[];
  total: number;
}

/**
 * Initial state for resource slice
 */
export const initialResourceState: ResourceState = {
  governanceCapabilities: undefined,
  hasMore: false,
  isLoadingMore: false,
  isSyncing: false,
  offset: 0,
  resourceList: [],
  resourceMap: new Map(),
  syncQueue: [],
  syncingIds: new Set(),
  total: 0,
};
