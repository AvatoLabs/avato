import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useContentManagerStore } from '@/routes/(main)/content/features/store';
import { SortType } from '@/types/files';

/**
 * Hook to sync ContentManager store state with URL query parameters.
 * Store is the source of truth, URL is synced for bookmarking
 */
export const useContentManagerUrlSync = (enabled: boolean = true) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [sorter, sortType, viewMode, setSorter, setSortType, setViewMode] = useContentManagerStore(
    (s) => [s.sorter, s.sortType, s.viewMode, s.setSorter, s.setSortType, s.setViewMode],
  );

  // Initialize store from URL when searchParams change (URL → Store, e.g. bookmark or back navigation)
  useEffect(() => {
    if (!enabled) return;

    const sorterParam = (searchParams.get('sorter') || 'createdAt') as
      | 'name'
      | 'createdAt'
      | 'size';
    const sortTypeParam = (searchParams.get('sortType') || SortType.Desc) as SortType;
    const viewParam = (searchParams.get('view') || 'list') as 'list' | 'masonry';

    setSorter(sorterParam);
    setSortType(sortTypeParam);
    setViewMode(viewParam);
  }, [enabled, searchParams, setSorter, setSortType, setViewMode]);

  // Sync store changes to URL (Store → URL)
  useEffect(() => {
    if (!enabled) return;

    setSearchParams(
      (prev) => {
        const newParams = new URLSearchParams(prev);

        // Sorter (clear if default)
        if (sorter === 'createdAt') {
          newParams.delete('sorter');
        } else {
          newParams.set('sorter', sorter);
        }

        // Sort type (clear if default)
        if (sortType === SortType.Desc) {
          newParams.delete('sortType');
        } else {
          newParams.set('sortType', sortType);
        }

        // View mode (clear if default)
        if (viewMode === 'list') {
          newParams.delete('view');
        } else {
          newParams.set('view', viewMode);
        }

        return newParams;
      },
      { replace: true },
    ); // Use replace to avoid polluting history
  }, [enabled, sorter, sortType, viewMode, setSearchParams]);
};
