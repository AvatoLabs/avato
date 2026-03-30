import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { usePageStore } from '@/store/docs';

import { getPageScopeFromSearch } from '../usePageScope';

const DataSync = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const setShowOnlyPagesWithoutSourceSet = usePageStore((s) => s.setShowOnlyPagesWithoutSourceSet);

  useEffect(() => {
    usePageStore.setState({ navigate });

    return () => {
      usePageStore.setState({ navigate: undefined });
    };
  }, [navigate]);

  useEffect(() => {
    setShowOnlyPagesWithoutSourceSet(getPageScopeFromSearch(location.search) === 'unassigned');
  }, [location.search, setShowOnlyPagesWithoutSourceSet]);

  return null;
};

export default DataSync;
