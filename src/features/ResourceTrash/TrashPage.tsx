'use client';

import { Flexbox } from '@lobehub/ui';
import { memo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import { getFileScope, getSourceSetScopeId } from '@/features/ContentManager/useFileScope';
import { useContentManagerUrlSync } from '@/routes/(main)/content/features/hooks/useContentManagerUrlSync';

import { TrashContent } from './TrashContent';

const TrashPage = memo(() => {
  const [searchParams] = useSearchParams();
  const { spaceId } = useParams<{ spaceId?: string }>();
  const sourceSetId = getSourceSetScopeId(getFileScope(searchParams)) ?? undefined;

  // Centralized URL → Store sync (replaces manual useLayoutEffect)
  useContentManagerUrlSync();

  return (
    <Flexbox gap={16} padding={24} width={'100%'}>
      <TrashContent sourceSetId={sourceSetId} spaceId={spaceId} variant="page" />
    </Flexbox>
  );
});

TrashPage.displayName = 'TrashPage';

export default TrashPage;
