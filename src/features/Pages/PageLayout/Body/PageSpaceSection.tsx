'use client';

import { memo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { usePageKind } from '@/features/Pages/usePageKind';
import { SpaceListSection } from '@/features/ResourceSpaces';
import { getPageRootPath } from '@/utils/docs';

const PageSpaceSection = memo(() => {
  const navigate = useNavigate();
  const pageKind = usePageKind();
  const { spaceId: currentSpaceId } = useParams<{ spaceId?: string }>();

  const handleSelectSpace = useCallback(
    (spaceId: string) => {
      navigate(getPageRootPath(pageKind, spaceId));
    },
    [navigate, pageKind],
  );

  return <SpaceListSection currentSpaceId={currentSpaceId} onSelectSpace={handleSelectSpace} />;
});

PageSpaceSection.displayName = 'PageSpaceSection';

export default PageSpaceSection;
