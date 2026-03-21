'use client';

import { Flexbox } from '@lobehub/ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useCreateNewModal } from '@/features/LibraryModal';
import EmptyNavItem from '@/features/NavPanel/components/EmptyNavItem';
import SkeletonList from '@/features/NavPanel/components/SkeletonList';
import { buildResourceLibraryPath } from '@/features/ResourceSpaces';
import { useResourceManagerStore } from '@/routes/(main)/resource/features/store';
import { useKnowledgeBaseStore } from '@/store/library';

import Item from './Item';

/**
 * Show library list in the sidebar
 */
const LibraryList = memo(() => {
  const { t } = useTranslation('file');
  const spaceId = useResourceManagerStore((s) => s.spaceId);
  const useFetchKnowledgeBaseList = useKnowledgeBaseStore((s) => s.useFetchKnowledgeBaseList);
  const { data, isLoading } = useFetchKnowledgeBaseList(spaceId);

  const navigate = useNavigate();

  const { open } = useCreateNewModal();

  const handleCreate = () => {
    open({
      onSuccess: (id) => {
        navigate(buildResourceLibraryPath(spaceId, id));
      },
      spaceId,
    });
  };

  if (isLoading) return <SkeletonList paddingInline={4} rows={3} />;

  if (data?.length === 0) return <EmptyNavItem title={t('library.new')} onClick={handleCreate} />;

  return (
    <Flexbox gap={1} paddingInline={4}>
      {data?.map((item) => (
        <Item
          description={item.description}
          id={item.id}
          key={item.id}
          name={item.name}
          spaceId={item.spaceId}
        />
      ))}
    </Flexbox>
  );
});

export default LibraryList;
