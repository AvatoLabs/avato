'use client';

import { useEffect } from 'react';
import { type SWRResponse } from 'swr';
import { subscribeWithSelector } from 'zustand/middleware';
import { shallow } from 'zustand/shallow';
import { createWithEqualityFn } from 'zustand/traditional';

import { useFileStore } from '@/store/file';
import {
  type FileGovernanceSummary,
  type FileListItem,
  type QueryFileListParams,
} from '@/types/files';

import { type FolderCrumb } from './action';
import { store } from './action';

export type { State } from './initialState';

// Create a global store instance instead of context-based
export const useContentManagerStore = createWithEqualityFn(subscribeWithSelector(store()), shallow);

export { selectors } from './selectors';

/**
 * Hook wrappers that delegate to FileStore hooks and sync pagination state
 * These must be separate functions, not stored in Zustand state
 */

export const useContentManagerFetchContentItems = (
  params: QueryFileListParams,
): SWRResponse<FileListItem[]> => {
  const result = useFileStore((s) => s.useFetchKnowledgeItems)(params);

  // Sync pagination state from FileStore to ContentManagerStore using subscription.
  // This ensures the sync happens reactively when FileStore updates, not just during render
  const fileListHasMore = useFileStore((s) => s.fileListHasMore);
  const fileListOffset = useFileStore((s) => s.fileListOffset);

  useEffect(() => {
    const contentManagerStore = useContentManagerStore.getState();
    contentManagerStore.setFileListHasMore?.(fileListHasMore);
    contentManagerStore.setFileListOffset?.(fileListOffset);
  }, [fileListHasMore, fileListOffset]);

  return result;
};

export const useContentManagerFetchGovernanceSummary = (
  params: QueryFileListParams | null,
): SWRResponse<FileGovernanceSummary | undefined> => {
  return useFileStore((s) => s.useFetchKnowledgeGovernanceSummary)(params);
};

export const useContentManagerFetchContentItem = (
  id?: string,
): SWRResponse<FileListItem | undefined> => {
  return useFileStore((s) => s.useFetchKnowledgeItem)(id);
};

export const useContentManagerFetchContentFolderBreadcrumb = (
  slug?: string | null,
  spaceId?: string,
): SWRResponse<FolderCrumb[]> => {
  return useFileStore((s) => s.useFetchFolderBreadcrumb)(slug, spaceId);
};
