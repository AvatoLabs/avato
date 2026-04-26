'use client';

import { Flexbox } from '@lobehub/ui';
import { memo, useLayoutEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import { getFileScope, getSourceSetScopeId } from '@/features/ContentManager/useFileScope';
import { useContentManagerStore } from '@/routes/(main)/content/features/store';

import { TrashContent } from './TrashContent';

const TrashPage = memo(() => {
  const [searchParams] = useSearchParams();
  const { spaceId } = useParams<{ spaceId?: string }>();
  const sourceSetId = getSourceSetScopeId(getFileScope(searchParams)) ?? undefined;
  const [setSourceSetId, setSpaceId] = useContentManagerStore((s) => [
    s.setSourceSetId,
    s.setSpaceId,
  ]);

  useLayoutEffect(() => {
    setSourceSetId(sourceSetId);
    setSpaceId(spaceId);
  }, [sourceSetId, setSourceSetId, setSpaceId, spaceId]);

  return (
    <Flexbox gap={16} padding={24} width={'100%'}>
      <TrashContent sourceSetId={sourceSetId} spaceId={spaceId} variant="page" />
    </Flexbox>
  );
});

TrashPage.displayName = 'TrashPage';

export default TrashPage;
