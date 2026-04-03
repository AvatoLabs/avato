'use client';

import { memo, useLayoutEffect } from 'react';
import { useLocation, useParams, useSearchParams } from 'react-router-dom';

import ContentManager from '@/features/ContentManager';
import { getFileScope, getSourceSetScopeId } from '@/features/ContentManager/useFileScope';
import { FilesTabs } from '@/types/files';

import { useInitFileCheck } from '../features/hooks/useInitFileCheck';
import { useContentManagerStore } from '../features/store';

const ContentHomePage = memo(() => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { spaceId } = useParams<{ spaceId?: string }>();
  const [
    category,
    currentSourceSetId,
    currentSpaceId,
    setCategory,
    setActiveSourceSetId,
    setSpaceId,
  ] = useContentManagerStore((s) => [
    s.category,
    s.sourceSetId,
    s.spaceId,
    s.setCategory,
    s.setSourceSetId,
    s.setSpaceId,
  ]);

  const categoryParam = (searchParams.get('category') as FilesTabs) || FilesTabs.Home;
  const isOnHomeRoute = !location.pathname.includes('/source-sets/');
  const scopedSourceSetId = getSourceSetScopeId(getFileScope(searchParams)) ?? undefined;
  const isRouteStateReady =
    !isOnHomeRoute ||
    (currentSpaceId === spaceId &&
      currentSourceSetId === scopedSourceSetId &&
      category === categoryParam);

  // Clear the active source set when on the home route.
  useLayoutEffect(() => {
    if (isOnHomeRoute) {
      setActiveSourceSetId(scopedSourceSetId);
      setSpaceId(spaceId);
    }
  }, [isOnHomeRoute, scopedSourceSetId, setActiveSourceSetId, setSpaceId, spaceId]);

  // Sync category from URL using useLayoutEffect
  // IMPORTANT: Only sync if we're actually on the home route (not transitioning to a source set)
  useLayoutEffect(() => {
    if (isOnHomeRoute) {
      setCategory(categoryParam);
    }
  }, [categoryParam, isOnHomeRoute, setCategory]);

  // Sync file view mode from URL
  useInitFileCheck();

  if (!isRouteStateReady) return null;

  return <ContentManager />;
});

ContentHomePage.displayName = 'ContentHomePage';

export default ContentHomePage;
