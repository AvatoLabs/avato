'use client';

import { memo } from 'react';

import ContentManager from '@/features/ContentManager';

import {
  useContentManagerUrlSync,
  useIsRouteStateReady,
} from '../features/hooks/useContentManagerUrlSync';
import { useInitFileCheck } from '../features/hooks/useInitFileCheck';

const ContentHomePage = memo(() => {
  // Centralized URL ↔ Store sync (replaces scattered useLayoutEffect calls)
  useContentManagerUrlSync();

  // Check if store is hydrated from URL before rendering
  const isRouteStateReady = useIsRouteStateReady();

  // Sync file view mode from URL
  useInitFileCheck();

  if (!isRouteStateReady) return null;

  return <ContentManager />;
});

ContentHomePage.displayName = 'ContentHomePage';

export default ContentHomePage;
