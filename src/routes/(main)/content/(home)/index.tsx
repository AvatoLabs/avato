'use client';

import { memo, useLayoutEffect } from 'react';
import { useLocation, useParams, useSearchParams } from 'react-router-dom';

import ContentManager from '@/features/ContentManager';
import { FilesTabs } from '@/types/files';

import { useInitFileCheck } from '../features/hooks/useInitFileCheck';
import { useContentManagerStore } from '../features/store';

const ContentHomePage = memo(() => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { spaceId } = useParams<{ spaceId?: string }>();
  const [setCategory, setActiveSourceSetId, setSpaceId] = useContentManagerStore((s) => [
    s.setCategory,
    s.setSourceSetId,
    s.setSpaceId,
  ]);

  const categoryParam = (searchParams.get('category') as FilesTabs) || FilesTabs.Home;

  // Clear the active source set when on the home route.
  useLayoutEffect(() => {
    const isOnHomeRoute = !location.pathname.includes('/source-sets/');
    if (isOnHomeRoute) {
      setActiveSourceSetId(undefined);
      setSpaceId(spaceId);
    }
  }, [location.pathname, setActiveSourceSetId, setSpaceId, spaceId]);

  // Sync category from URL using useLayoutEffect
  // IMPORTANT: Only sync if we're actually on the home route (not transitioning to a source set)
  useLayoutEffect(() => {
    const isOnHomeRoute = !location.pathname.includes('/source-sets/');
    if (isOnHomeRoute) {
      setCategory(categoryParam);
    }
  }, [categoryParam, setCategory, location.pathname]);

  // Sync file view mode from URL
  useInitFileCheck();

  return <ContentManager />;
});

ContentHomePage.displayName = 'ContentHomePage';

export default ContentHomePage;
