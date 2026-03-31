import { useEffect, useLayoutEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { usePageSpaceId } from '@/features/Pages/usePageSpaceId';
import { setActiveWorkspaceSpaceId } from '@/helpers/activeWorkspaceSpace';
import { usePageStore } from '@/store/docs';

import { getPageScopeFromSearch, getSourceSetIdFromPageScope } from '../usePageScope';

const DataSync = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const effectiveSpaceId = usePageSpaceId();
  const [setCurrentSourceSetScopeId, setShowOnlyPagesWithoutSourceSet, useFetchDocuments] =
    usePageStore((s) => [
      s.setCurrentSourceSetScopeId,
      s.setShowOnlyPagesWithoutSourceSet,
      s.useFetchDocuments,
    ]);
  useFetchDocuments(effectiveSpaceId);

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

  useEffect(() => {
    if (!effectiveSpaceId) return;

    setActiveWorkspaceSpaceId(effectiveSpaceId);
  }, [effectiveSpaceId]);

  return null;
};

export default DataSync;
