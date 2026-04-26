'use client';

import { useMemo } from 'react';
import { useParams } from 'react-router-dom';

import { usePageStore } from '@/store/docs';
import { sourceSetSelectors, useSourceSetStore } from '@/store/sourceSet';

export const usePageSpaceId = () => {
  const { spaceId: routeSpaceId } = useParams<{ spaceId?: string }>();
  const currentSourceSetScopeId = usePageStore((s) => s.currentSourceSetScopeId);
  const scopedSourceSet = useSourceSetStore(
    sourceSetSelectors.getSourceSetById(currentSourceSetScopeId || ''),
  );

  return useMemo(
    () => routeSpaceId ?? scopedSourceSet?.spaceId ?? undefined,
    [routeSpaceId, scopedSourceSet?.spaceId],
  );
};
