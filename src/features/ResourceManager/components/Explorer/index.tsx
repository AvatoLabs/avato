'use client';

import { Flexbox } from '@lobehub/ui';
import { memo, useEffect, useMemo } from 'react';

import { useFolderPath } from '@/routes/(main)/resource/features/hooks/useFolderPath';
import { useResourceManagerUrlSync } from '@/routes/(main)/resource/features/hooks/useResourceManagerUrlSync';
import { useResourceManagerStore } from '@/routes/(main)/resource/features/store';
import { sortFileList } from '@/routes/(main)/resource/features/store/selectors';
import { useVisibleResources } from '@/store/file/slices/resource/hooks';

import EmptyPlaceholder from './EmptyPlaceholder';
import Header from './Header';
import ListView from './ListView';
import MasonryView from './MasonryView';
import ResourceInfoPanel from './ResourceInfoPanel';
import SearchResultsOverlay from './SearchResultsOverlay';
import { useCheckTaskStatus } from './useCheckTaskStatus';
import { useExplorerHotkeys } from './useExplorerHotkeys';
import { useResourceExplorer } from './useResourceExplorer';

/**
 * Explore resource items in a library
 *
 * Works with FileTree
 *
 * It's a un-reusable component for business logic only.
 * So we depend on context, not props.
 */
const ResourceExplorer = memo(() => {
  // Sync store state with URL query parameters
  useResourceManagerUrlSync();

  // Get state from Resource Manager store
  const [
    libraryId,
    category,
    viewMode,
    searchQuery,
    setSelectedFileIds,
    showInfoPanel,
    sorter,
    sortType,
    spaceId,
  ] = useResourceManagerStore((s) => [
    s.libraryId,
    s.category,
    s.viewMode,
    s.searchQuery,
    s.setSelectedFileIds,
    s.showInfoPanel,
    s.sorter,
    s.sortType,
    s.spaceId,
  ]);

  // searchQuery is still subscribed above for selection-clearing effect below

  // Get folder path for empty state check
  const { currentFolderSlug } = useFolderPath();

  // Build query params for SWR
  const queryParams = useMemo(
    () => ({
      // Only use category filter when NOT in a specific library
      // When viewing a library, show all items regardless of category
      category: libraryId ? undefined : category,
      libraryId,
      parentId: currentFolderSlug || null,
      showFilesInKnowledgeBase: false,
      spaceId,
      sortType,
      sorter,
    }),
    [category, libraryId, currentFolderSlug, sortType, sorter, spaceId],
  );

  // Use SWR for data fetching with automatic caching and revalidation
  const { isLoading, isValidating, items, hasResolvedData } = useVisibleResources(queryParams);

  // Map ResourceItem[] to FileListItem[] for compatibility
  // TODO: Eventually update all consumers to use ResourceItem directly
  const rawData = items.map((item) => ({
    ...item,
    // Ensure all FileListItem fields are present with proper types
    chunkCount: item.chunkCount ?? null,
    chunkingError: item.chunkingError ?? null,
    chunkingStatus: (item.chunkingStatus ?? null) as any,
    embeddingError: item.embeddingError ?? null,
    embeddingStatus: (item.embeddingStatus ?? null) as any,
    finishEmbedding: item.finishEmbedding ?? false,
    url: item.url ?? '',
  }));

  // Sort data using current sort settings
  const data = sortFileList(rawData, sorter, sortType) || [];

  // Check task status
  useCheckTaskStatus(data);

  // Keyboard shortcuts (Del, F2, Ctrl+A, Esc)
  const visibleItemIds = useMemo(() => data.map((item) => item.id), [data]);
  useExplorerHotkeys({ visibleItemIds });

  // Initialize folder/file navigation effects (still need hook for complex effects)
  useResourceExplorer({ category, hasResolvedData, isLoading, libraryId });

  // Clear selections when category/library/search changes
  useEffect(() => {
    // Only clear if there are selected items to avoid unnecessary store updates
    const currentIds = useResourceManagerStore.getState().selectedFileIds;
    if (currentIds.length > 0) {
      setSelectedFileIds([]);
    }
  }, [category, libraryId, searchQuery, setSelectedFileIds]);

  const showEmptyStatus = !isLoading && !isValidating && data.length === 0 && !currentFolderSlug;

  return (
    <Flexbox height={'100%'}>
      <Header />
      <Flexbox horizontal style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {showEmptyStatus ? (
            <EmptyPlaceholder />
          ) : viewMode === 'list' ? (
            <ListView />
          ) : (
            <MasonryView />
          )}
          <SearchResultsOverlay />
        </div>
        {showInfoPanel && <ResourceInfoPanel />}
      </Flexbox>
    </Flexbox>
  );
});

ResourceExplorer.displayName = 'ResourceExplorer';

export default ResourceExplorer;
