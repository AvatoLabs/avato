'use client';

import { Flexbox } from '@lobehub/ui';
import { memo, useEffect, useMemo } from 'react';

import { useContentManagerUrlSync } from '@/routes/(main)/content/features/hooks/useContentManagerUrlSync';
import { useFolderPath } from '@/routes/(main)/content/features/hooks/useFolderPath';
import { useContentManagerStore } from '@/routes/(main)/content/features/store';
import { sortFileList } from '@/routes/(main)/content/features/store/selectors';
import { useVisibleResources } from '@/store/file/slices/content/hooks';
import { useServerConfigStore } from '@/store/serverConfig';

import SourceSetListSection from '../SourceSetListSection';
import EmptyPlaceholder from './EmptyPlaceholder';
import Header from './Header';
import ListView from './ListView';
import MasonryView from './MasonryView';
import { buildExplorerQueryParams } from './queryParams';
import SearchResultsOverlay from './SearchResultsOverlay';
import { useCheckTaskStatus } from './useCheckTaskStatus';
import { useContentExplorer } from './useContentExplorer';

/**
 * Explore content items inside a source set or space view.
 *
 * Works with FileTree
 *
 * It's a un-reusable component for business logic only.
 * So we depend on context, not props.
 */
const ResourceExplorer = memo(() => {
  // Get state from Resource Manager store
  const [
    sourceSetId,
    category,
    mode,
    viewMode,
    searchQuery,
    setSelectedFileIds,
    sorter,
    sortType,
    spaceId,
  ] = useContentManagerStore((s) => [
    s.sourceSetId,
    s.category,
    s.mode,
    s.viewMode,
    s.searchQuery,
    s.setSelectedFileIds,
    s.sorter,
    s.sortType,
    s.spaceId,
  ]);

  const isExplorerMode = mode === 'explorer';

  // Sync store state with URL query parameters
  useContentManagerUrlSync(isExplorerMode);

  // searchQuery is still subscribed above for selection-clearing effect below

  // Get folder path for empty state check
  const { currentFolderSlug } = useFolderPath();

  // Build query params for SWR
  const queryParams = useMemo(
    () =>
      buildExplorerQueryParams({
        category,
        currentFolderSlug,
        sourceSetId,
        sorter,
        sortType,
        spaceId,
      }),
    [category, sourceSetId, currentFolderSlug, sortType, sorter, spaceId],
  );

  // Use SWR for data fetching with automatic caching and revalidation
  const { hasResolvedData, isLoading, isValidating, items } = useVisibleResources(
    queryParams,
    isExplorerMode,
  );

  // Map ContentItem[] to FileListItem[] for compatibility
  // TODO: Eventually update all consumers to use ContentItem directly
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
  useCheckTaskStatus(data, isExplorerMode);

  // Initialize folder/file navigation effects (still need hook for complex effects)
  useContentExplorer({ category, sourceSetId });

  // Clear selections when category/source-set/search changes.
  useEffect(() => {
    setSelectedFileIds([]);
  }, [category, sourceSetId, searchQuery, setSelectedFileIds]);

  const showEmptyStatus =
    hasResolvedData && !isLoading && !isValidating && data.length === 0 && !currentFolderSlug;
  const isMobile = useServerConfigStore((s) => s.isMobile);
  const showSourceSetListSection = isMobile && !sourceSetId;

  return (
    <Flexbox height={'100%'} style={{ minHeight: 0 }}>
      <Header />
      {showSourceSetListSection && <SourceSetListSection />}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
        {showEmptyStatus ? (
          <EmptyPlaceholder />
        ) : viewMode === 'list' ? (
          <ListView />
        ) : (
          <MasonryView />
        )}
        <SearchResultsOverlay />
      </div>
    </Flexbox>
  );
});

ResourceExplorer.displayName = 'ResourceExplorer';

export default ResourceExplorer;
