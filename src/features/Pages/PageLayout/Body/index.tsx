'use client';

import { Flexbox } from '@lobehub/ui';
import { memo, Suspense, useEffect } from 'react';

import SkeletonList from '@/features/NavPanel/components/SkeletonList';
import {
  getActiveWorkspaceSpaceId,
  setActiveWorkspaceSpaceId,
} from '@/helpers/activeWorkspaceSpace';
import { usePageStore } from '@/store/docs';
import { sourceSetSelectors, useSourceSetStore } from '@/store/sourceSet';

import ScopeNavigation from './ScopeNavigation';

/**
 * Page list sidebar
 */
const Body = memo(() => {
  const currentSourceSetScopeId = usePageStore((s) => s.currentSourceSetScopeId);
  const scopedSourceSet = useSourceSetStore(
    sourceSetSelectors.getSourceSetById(currentSourceSetScopeId || ''),
  );
  const effectiveSpaceId = scopedSourceSet?.spaceId ?? getActiveWorkspaceSpaceId();
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
