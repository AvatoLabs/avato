'use client';

import { Flexbox } from '@lobehub/ui';
import { memo, useLayoutEffect } from 'react';
import { useParams } from 'react-router-dom';

import { useResourceManagerStore } from '@/routes/(main)/resource/features/store';

import { TrashContent } from './TrashContent';

const TrashPage = memo(() => {
  const { id: knowledgeBaseId, spaceId } = useParams<{ id?: string; spaceId?: string }>();
  const [setLibraryId, setSpaceId] = useResourceManagerStore((s) => [s.setLibraryId, s.setSpaceId]);

  useLayoutEffect(() => {
    setLibraryId(knowledgeBaseId);
    setSpaceId(spaceId);
  }, [knowledgeBaseId, setLibraryId, setSpaceId, spaceId]);

  return (
    <Flexbox gap={16} padding={24} width={'100%'}>
      <TrashContent knowledgeBaseId={knowledgeBaseId} spaceId={spaceId} variant="page" />
    </Flexbox>
  );
});

TrashPage.displayName = 'TrashPage';

export default TrashPage;
