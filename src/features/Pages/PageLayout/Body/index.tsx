'use client';

import { Flexbox } from '@lobehub/ui';
import { memo, Suspense } from 'react';

import SkeletonList from '@/features/NavPanel/components/SkeletonList';

import PageSpaceSection from './PageSpaceSection';
import ScopeNavigation from './ScopeNavigation';

/**
 * Page list sidebar
 */
const Body = memo(() => {
  return (
    <Flexbox gap={6} paddingInline={8}>
      <Suspense fallback={<SkeletonList />}>
        <PageSpaceSection />
        <ScopeNavigation />
      </Suspense>
    </Flexbox>
  );
});

export default Body;
