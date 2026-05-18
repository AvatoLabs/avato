import { useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import { getFileScope, getSourceSetScopeId } from '@/features/ContentManager/useFileScope';
import { setActiveWorkspaceSpaceId } from '@/helpers/activeWorkspaceSpace';
import {
  type FileAssetClassification,
  type FileAssetReviewStatus,
  type FileAssetUsagePolicy,
  FilesTabs,
  SortType,
} from '@/types/files';

import { useContentManagerStore } from '../store';

const DEFAULT_SORTER = 'createdAt';
const DEFAULT_VIEW_MODE = 'list';

/**
 * Derives all route-driven state from URL params.
 * This is the single source of truth for which URL values map to store state.
 */
const getUrlSyncState = (searchParams: URLSearchParams, spaceId?: string) => ({
  assetClassification:
    (searchParams.get('assetClassification') as FileAssetClassification | null) || undefined,
  assetRightsOwner: searchParams.get('assetRightsOwner')?.trim() || undefined,
  assetReviewStatus:
    (searchParams.get('assetReviewStatus') as FileAssetReviewStatus | null) || undefined,
  assetUsagePolicy:
    (searchParams.get('assetUsagePolicy') as FileAssetUsagePolicy | null) || undefined,
  category: (searchParams.get('category') as FilesTabs) || FilesTabs.Home,
  sourceSetId: getSourceSetScopeId(getFileScope(searchParams)) ?? undefined,
  spaceId,
  sorter: (searchParams.get('sorter') || DEFAULT_SORTER) as 'name' | 'createdAt' | 'size',
  sortType: (searchParams.get('sortType') || SortType.Desc) as SortType,
  viewMode: (searchParams.get('view') || DEFAULT_VIEW_MODE) as 'list' | 'masonry',
});

/**
 * Hook to sync ContentManager store state with URL query parameters.
 *
 * URL → Store: Source of truth. The URL always wins on hydration/navigation.
 * Store → URL: Only for sort/view preferences, so they survive bookmarking.
 *
 * This hook consolidates ALL URL-to-store synchronization that was previously
 * scattered across ContentHomePage and TrashPage via useLayoutEffect.
 */
export const useContentManagerUrlSync = (enabled: boolean = true) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { spaceId } = useParams<{ spaceId?: string }>();

  const urlState = getUrlSyncState(searchParams, spaceId);

  const isHandlingUrlChangeRef = useRef(false);

  const [
    // Sort/view state (bidirectional sync)
    sorter,
    sortType,
    viewMode,
    setSorter,
    setSortType,
    setViewMode,
    // Route-driven state — setters (URL → Store only)
    setSourceSetId,
    setSpaceId,
    setAssetClassification,
    setAssetRightsOwner,
    setAssetReviewStatus,
    setAssetUsagePolicy,
    setCategory,
  ] = useContentManagerStore((s) => [
    s.sorter,
    s.sortType,
    s.viewMode,
    s.setSorter,
    s.setSortType,
    s.setViewMode,
    s.setSourceSetId,
    s.setSpaceId,
    s.setAssetClassification,
    s.setAssetRightsOwner,
    s.setAssetReviewStatus,
    s.setAssetUsagePolicy,
    s.setCategory,
  ]);

  // ── URL → Store: Hydrate store from URL on navigation ──────────────
  // Use stable setter refs so this effect only re-runs when URL values change.
  useEffect(() => {
    if (!enabled) return;

    isHandlingUrlChangeRef.current = true;

    // Read current store state via getState() to avoid subscribing to store values
    // as dependencies, which would cause this effect to re-fire on store writes.
    const store = useContentManagerStore.getState();

    // Sort/view preferences
    if (store.sorter !== urlState.sorter) setSorter(urlState.sorter);
    if (store.sortType !== urlState.sortType) setSortType(urlState.sortType);
    if (store.viewMode !== urlState.viewMode) setViewMode(urlState.viewMode);

    // Route-driven state (URL is the single source of truth)
    if (store.sourceSetId !== urlState.sourceSetId) setSourceSetId(urlState.sourceSetId);
    if (store.spaceId !== spaceId) {
      if (spaceId) setActiveWorkspaceSpaceId(spaceId);
      setSpaceId(spaceId);
    }
    if (store.assetClassification !== urlState.assetClassification)
      setAssetClassification(urlState.assetClassification);
    if (store.assetRightsOwner !== urlState.assetRightsOwner)
      setAssetRightsOwner(urlState.assetRightsOwner);
    if (store.assetReviewStatus !== urlState.assetReviewStatus)
      setAssetReviewStatus(urlState.assetReviewStatus);
    if (store.assetUsagePolicy !== urlState.assetUsagePolicy)
      setAssetUsagePolicy(urlState.assetUsagePolicy);
    if (store.category !== urlState.category) setCategory(urlState.category);
  }, [
    enabled,
    urlState.sorter,
    urlState.sortType,
    urlState.viewMode,
    urlState.sourceSetId,
    urlState.assetClassification,
    urlState.assetRightsOwner,
    urlState.assetReviewStatus,
    urlState.assetUsagePolicy,
    urlState.category,
    spaceId,
    setSorter,
    setSortType,
    setViewMode,
    setSourceSetId,
    setSpaceId,
    setAssetClassification,
    setAssetRightsOwner,
    setAssetReviewStatus,
    setAssetUsagePolicy,
    setCategory,
  ]);

  // ── Store → URL: Only sync sort/view preferences back for bookmarking ──
  useEffect(() => {
    if (!enabled) return;

    if (isHandlingUrlChangeRef.current) {
      const isAlignedWithUrl =
        sorter === urlState.sorter &&
        sortType === urlState.sortType &&
        viewMode === urlState.viewMode;

      if (!isAlignedWithUrl) return;

      isHandlingUrlChangeRef.current = false;
    }

    const nextParams = new URLSearchParams(searchParams.toString());

    if (sorter === DEFAULT_SORTER) nextParams.delete('sorter');
    else nextParams.set('sorter', sorter);

    if (sortType === SortType.Desc) nextParams.delete('sortType');
    else nextParams.set('sortType', sortType);

    if (viewMode === DEFAULT_VIEW_MODE) nextParams.delete('view');
    else nextParams.set('view', viewMode);

    if (nextParams.toString() === searchParams.toString()) return;

    setSearchParams(nextParams, { replace: true });
  }, [
    enabled,
    searchParams,
    setSearchParams,
    sorter,
    sortType,
    urlState.sorter,
    urlState.sortType,
    urlState.viewMode,
    viewMode,
  ]);
};

/**
 * Check whether the ContentManager store is fully synchronized with the URL.
 * Used to prevent rendering with stale state.
 */
export const useIsRouteStateReady = (): boolean => {
  const [searchParams] = useSearchParams();
  const { spaceId } = useParams<{ spaceId?: string }>();

  const urlState = getUrlSyncState(searchParams, spaceId);

  const [
    currentSourceSetId,
    currentSpaceId,
    currentAssetClassification,
    currentAssetRightsOwner,
    currentAssetReviewStatus,
    currentAssetUsagePolicy,
    currentCategory,
  ] = useContentManagerStore((s) => [
    s.sourceSetId,
    s.spaceId,
    s.assetClassification,
    s.assetRightsOwner,
    s.assetReviewStatus,
    s.assetUsagePolicy,
    s.category,
  ]);

  return (
    currentSpaceId === spaceId &&
    currentSourceSetId === urlState.sourceSetId &&
    currentAssetClassification === urlState.assetClassification &&
    currentAssetRightsOwner === urlState.assetRightsOwner &&
    currentAssetReviewStatus === urlState.assetReviewStatus &&
    currentAssetUsagePolicy === urlState.assetUsagePolicy &&
    currentCategory === urlState.category
  );
};
