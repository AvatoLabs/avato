'use client';

import { Flexbox } from '@lobehub/ui';
import { memo, useLayoutEffect } from 'react';
import { useParams } from 'react-router-dom';

import { useContentManagerStore } from '@/routes/(main)/content/features/store';

import { TrashContent } from './TrashContent';

const TrashPage = memo(() => {
  const { id: sourceSetId, spaceId } = useParams<{ id?: string; spaceId?: string }>();
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
