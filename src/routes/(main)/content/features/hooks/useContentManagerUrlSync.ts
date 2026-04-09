import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useContentManagerStore } from '@/routes/(main)/content/features/store';
import { SortType } from '@/types/files';

const DEFAULT_SORTER = 'createdAt';
const DEFAULT_VIEW_MODE = 'list';

const getUrlSyncState = (searchParams: URLSearchParams) => ({
  sorter: (searchParams.get('sorter') || DEFAULT_SORTER) as 'name' | 'createdAt' | 'size',
  sortType: (searchParams.get('sortType') || SortType.Desc) as SortType,
  viewMode: (searchParams.get('view') || DEFAULT_VIEW_MODE) as 'list' | 'masonry',
});

/**
 * Hook to sync ContentManager store state with URL query parameters.
 * Store is the source of truth, URL is synced for bookmarking
 */
export const useContentManagerUrlSync = (enabled: boolean = true) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { sorter: urlSorter, sortType: urlSortType, viewMode: urlViewMode } =
    getUrlSyncState(searchParams);
  const isHandlingUrlChangeRef = useRef(false);

  const [sorter, sortType, viewMode, setSorter, setSortType, setViewMode] = useContentManagerStore(
    (s) => [s.sorter, s.sortType, s.viewMode, s.setSorter, s.setSortType, s.setViewMode],
  );

  // Initialize store from URL when searchParams change (URL → Store, e.g. bookmark or back navigation)
  useEffect(() => {
    if (!enabled) return;

    isHandlingUrlChangeRef.current = true;

    if (sorter !== urlSorter) setSorter(urlSorter);
    if (sortType !== urlSortType) setSortType(urlSortType);
    if (viewMode !== urlViewMode) setViewMode(urlViewMode);
  }, [enabled, urlSorter, urlSortType, urlViewMode, setSorter, setSortType, setViewMode]);

  // Sync store changes to URL (Store → URL)
  useEffect(() => {
    if (!enabled) return;

    if (isHandlingUrlChangeRef.current) {
      const isAlignedWithUrl =
        sorter === urlSorter && sortType === urlSortType && viewMode === urlViewMode;

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
    urlSorter,
    urlSortType,
    urlViewMode,
    viewMode,
  ]);
};
