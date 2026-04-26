'use client';

import { Flexbox } from '@lobehub/ui';
import { memo, Suspense, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import SkeletonList from '@/features/NavPanel/components/SkeletonList';
import { usePageKind } from '@/features/Pages/usePageKind';
import { SpaceListSection } from '@/features/ResourceSpaces';
import { getPageRootPath } from '@/utils/docs';

import ScopeNavigation from './ScopeNavigation';

/**
 * Page list sidebar
 */
const Body = memo(() => {
  const navigate = useNavigate();
  const pageKind = usePageKind();
  const { spaceId: currentSpaceId } = useParams<{ spaceId?: string }>();

  const handleSelectSpace = useCallback(
    (spaceId: string) => {
      navigate(getPageRootPath(pageKind, spaceId));
    },
    [navigate, pageKind],
  );

  return (
    <Flexbox gap={6} paddingInline={8}>
      <Suspense fallback={<SkeletonList />}>
        <SpaceListSection currentSpaceId={currentSpaceId} onSelectSpace={handleSelectSpace} />
        <ScopeNavigation />
      </Suspense>
    </Flexbox>
  );
});

export default Body;
