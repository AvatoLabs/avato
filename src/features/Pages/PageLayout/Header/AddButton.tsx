'use client';

import { ActionIcon } from '@lobehub/ui';
import { SquarePenIcon } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { usePageKind } from '@/features/Pages/usePageKind';
import { usePageScope } from '@/features/Pages/usePageScope';
import { usePageSpaceId } from '@/features/Pages/usePageSpaceId';
import { usePageStore } from '@/store/docs';
import { sourceSetSelectors, useSourceSetStore } from '@/store/sourceSet';
import { TABLE_PAGE_KIND } from '@/utils/docs';

const AddButton = memo(() => {
  const { t } = useTranslation('file');
  const pageKind = usePageKind();
  const pageSpaceId = usePageSpaceId();
  const { sourceSetId } = usePageScope();
  const scopedSourceSet = useSourceSetStore(sourceSetSelectors.getSourceSetById(sourceSetId || ''));

  const [createNewPage, createNewTable] = usePageStore((s) => [s.createNewPage, s.createNewTable]);

  const handleNewDocument = () => {
    if (pageKind === TABLE_PAGE_KIND) {
      void createNewTable(t('pageList.tableUntitled'), {
        sourceSetId: sourceSetId || undefined,
        spaceId: scopedSourceSet?.spaceId ?? pageSpaceId,
      });
      return;
    }

    void createNewPage(t('pageList.untitled'), {
      sourceSetId: sourceSetId || undefined,
      spaceId: scopedSourceSet?.spaceId ?? pageSpaceId,
    });
  };

  return (
    <ActionIcon
      icon={SquarePenIcon}
      title={t(pageKind === TABLE_PAGE_KIND ? 'header.newTableButton' : 'header.newPageButton')}
      size={{
        blockSize: 32,
        size: 18,
      }}
      onClick={handleNewDocument}
    />
  );
});

export default AddButton;
