'use client';

import { Flexbox } from '@lobehub/ui';
import { memo, useEffect, useMemo } from 'react';

import { useContentManagerUrlSync } from '@/routes/(main)/content/features/hooks/useContentManagerUrlSync';
import { useFolderPath } from '@/routes/(main)/content/features/hooks/useFolderPath';
import { useContentManagerStore } from '@/routes/(main)/content/features/store';
import { useServerConfigStore } from '@/store/serverConfig';

import { useFileScope } from '../../useFileScope';
import SourceSetListSection from '../SourceSetListSection';
import EmptyPlaceholder from './EmptyPlaceholder';
import Header from './Header';
import ListView from './ListView';
import MasonryView from './MasonryView';
import { buildExplorerQueryParams } from './queryParams';
import SearchResultsOverlay from './SearchResultsOverlay';
import { useCheckTaskStatus } from './useCheckTaskStatus';
import { useContentExplorer } from './useContentExplorer';
import { useExplorerItems } from './useExplorerItems';

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
    assetClassification,
    assetUsagePolicy,
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
    s.assetClassification,
    s.assetUsagePolicy,
    s.category,
    s.mode,
    s.viewMode,
    s.searchQuery,
    s.setSelectedFileIds,
    s.sorter,
    s.sortType,
    s.spaceId,
  ]);
  const { scope } = useFileScope(spaceId);

  const isExplorerMode = mode === 'explorer';

  // Sync store state with URL query parameters
  useContentManagerUrlSync(isExplorerMode);

  // searchQuery is still subscribed above for selection-clearing effect below

  // Get folder path for empty state check
  const { currentFolderSlug } = useFolderPath();

  const queryParams = useMemo(
    () =>
      buildExplorerQueryParams({
        assetClassification,
        assetUsagePolicy,
        category,
        currentFolderSlug,
        scope,
        sourceSetId,
        sorter,
        sortType,
        spaceId,
      }),
    [
      assetClassification,
      assetUsagePolicy,
      category,
      currentFolderSlug,
      scope,
      sourceSetId,
      sorter,
      sortType,
      spaceId,
    ],
  );

  const { data, hasResolvedData, isLoading, isValidating } = useExplorerItems({
    enabled: isExplorerMode,
    params: queryParams,
    sorter,
    sortType,
  });

  // Check task status
  useCheckTaskStatus(data, isExplorerMode);

  // Initialize folder/file navigation effects (still need hook for complex effects)
  useContentExplorer({ hasResolvedData, isLoading });

  // Clear selections when category/source-set/search changes.
  useEffect(() => {
    setSelectedFileIds([]);
  }, [
    assetClassification,
    assetUsagePolicy,
    category,
    sourceSetId,
    searchQuery,
    setSelectedFileIds,
  ]);

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
          <ListView data={data} hasResolvedData={hasResolvedData} isLoading={isLoading} />
        ) : (
          <MasonryView data={data} hasResolvedData={hasResolvedData} isLoading={isLoading} />
        )}
        <SearchResultsOverlay />
      </div>
    </Flexbox>
  );
});

ResourceExplorer.displayName = 'ResourceExplorer';

export default ResourceExplorer;
