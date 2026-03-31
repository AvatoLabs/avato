'use client';

import { Flexbox } from '@lobehub/ui';
import { memo, Suspense, useEffect } from 'react';

import SkeletonList from '@/features/NavPanel/components/SkeletonList';
import { usePageSpaceId } from '@/features/Pages/usePageSpaceId';
import { setActiveWorkspaceSpaceId } from '@/helpers/activeWorkspaceSpace';
import { usePageStore } from '@/store/docs';

import ScopeNavigation from './ScopeNavigation';

/**
 * Page list sidebar
 */
const Body = memo(() => {
  const effectiveSpaceId = usePageSpaceId();
  const useFetchDocuments = usePageStore((s) => s.useFetchDocuments);
  useFetchDocuments(effectiveSpaceId);

  useEffect(() => {
    if (!effectiveSpaceId) return;

    setActiveWorkspaceSpaceId(effectiveSpaceId);
  }, [effectiveSpaceId]);

  return (
    <Flexbox gap={6} paddingInline={8}>
      <Suspense fallback={<SkeletonList />}>
        <ScopeNavigation />
      </Suspense>
    </Flexbox>
  );
});

export default Body;
