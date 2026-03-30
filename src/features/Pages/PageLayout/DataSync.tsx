import { useEffect, useLayoutEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { usePageStore } from '@/store/docs';

import { getPageScopeFromSearch, getSourceSetIdFromPageScope } from '../usePageScope';

const DataSync = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [setCurrentSourceSetScopeId, setShowOnlyPagesWithoutSourceSet] = usePageStore((s) => [
    s.setCurrentSourceSetScopeId,
    s.setShowOnlyPagesWithoutSourceSet,
  ]);

  useEffect(() => {
    usePageStore.setState({ navigate });

    return () => {
      usePageStore.setState({ navigate: undefined });
    };
  }, [navigate]);

  useLayoutEffect(() => {
    const scope = getPageScopeFromSearch(location.search);
    setCurrentSourceSetScopeId(getSourceSetIdFromPageScope(scope));
    setShowOnlyPagesWithoutSourceSet(scope === 'unassigned');
  }, [location.search, setCurrentSourceSetScopeId, setShowOnlyPagesWithoutSourceSet]);

  return null;
};

export default DataSync;
