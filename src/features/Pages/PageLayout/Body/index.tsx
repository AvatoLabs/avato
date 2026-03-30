'use client';

import { Flexbox } from '@lobehub/ui';
import { memo, Suspense } from 'react';

import SkeletonList from '@/features/NavPanel/components/SkeletonList';
import { usePageStore } from '@/store/docs';

import ScopeNavigation from './ScopeNavigation';

/**
 * Page list sidebar
 */
const Body = memo(() => {
  const useFetchDocuments = usePageStore((s) => s.useFetchDocuments);
  useFetchDocuments();

  return (
    <Flexbox gap={6} paddingInline={8}>
      <Suspense fallback={<SkeletonList />}>
        <ScopeNavigation />
      </Suspense>
    </Flexbox>
  );
});

export default Body;
