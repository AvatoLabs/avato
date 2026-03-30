'use client';

import { Flexbox } from '@lobehub/ui';
import { memo, Suspense } from 'react';

import SkeletonList from '@/features/NavPanel/components/SkeletonList';
import { getActiveWorkspaceSpaceId } from '@/helpers/activeWorkspaceSpace';
import { usePageStore } from '@/store/docs';
import { useSourceSetStore } from '@/store/sourceSet';

import ScopeNavigation from './ScopeNavigation';

/**
 * Page list sidebar
 */
const Body = memo(() => {
  const useFetchDocuments = usePageStore((s) => s.useFetchDocuments);
  const useFetchSourceSetList = useSourceSetStore((s) => s.useFetchSourceSetList);
  const currentSourceSetScopeId = usePageStore((s) => s.currentSourceSetScopeId);
  useFetchDocuments();
  useFetchSourceSetList(getActiveWorkspaceSpaceId());

  return (
    <Flexbox gap={6} paddingInline={8}>
      <Suspense fallback={<SkeletonList />}>
        <ScopeNavigation key={currentSourceSetScopeId ?? 'all'} />
      </Suspense>
    </Flexbox>
  );
});

export default Body;
