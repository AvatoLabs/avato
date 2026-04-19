import { useCallback, useMemo, useState } from 'react';

type SorterType = 'createdAt' | 'name' | 'size';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'list' | 'grid';

interface ResourceSurfaceControlMessages {
  resourceSortName: string;
  resourceSortNewest: string;
  resourceSortOldest: string;
  resourceSortSize: string;
}

export function useResourceSurfaceControls({
  messages,
}: {
  messages: ResourceSurfaceControlMessages;
}) {
  const [headerMenuVisible, setHeaderMenuVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [sorter, setSorter] = useState<SorterType>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [sortMenuVisible, setSortMenuVisible] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const sortLabel = useMemo(() => {
    if (sorter === 'createdAt') {
      return sortOrder === 'desc' ? messages.resourceSortNewest : messages.resourceSortOldest;
    }
    if (sorter === 'name') {
      return `${messages.resourceSortName} ${sortOrder === 'asc' ? 'A-Z' : 'Z-A'}`;
    }

    return `${messages.resourceSortSize} ${sortOrder === 'asc' ? '↑' : '↓'}`;
  }, [messages, sortOrder, sorter]);

  const closeHeaderMenu = useCallback(() => setHeaderMenuVisible(false), []);
  const openHeaderMenu = useCallback(() => setHeaderMenuVisible(true), []);
  const closeSortMenu = useCallback(() => setSortMenuVisible(false), []);
  const openSortMenu = useCallback(() => setSortMenuVisible(true), []);

  const handleSelectSort = useCallback((nextSorter: SorterType, nextOrder: SortOrder) => {
    setSorter(nextSorter);
    setSortOrder(nextOrder);
    setSortMenuVisible(false);
  }, []);

  const toggleSearch = useCallback(() => {
    setSearchVisible((value) => {
      const next = !value;
      if (!next) setSearchText('');
      return next;
    });
  }, []);

  const closeSearch = useCallback(() => {
    setSearchVisible(false);
    setSearchText('');
  }, []);

  const toggleViewMode = useCallback(() => {
    setViewMode((mode) => (mode === 'list' ? 'grid' : 'list'));
  }, []);

  return {
    closeHeaderMenu,
    closeSearch,
    closeSortMenu,
    handleSelectSort,
    headerMenuVisible,
    openHeaderMenu,
    openSortMenu,
    searchText,
    searchVisible,
    setSearchText,
    sortLabel,
    sortMenuVisible,
    sortOrder,
    sorter,
    toggleSearch,
    toggleViewMode,
    viewMode,
  };
}
