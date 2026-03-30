'use client';

import { ActionIcon, DropdownMenu, Icon, type MenuProps } from '@lobehub/ui';
import { FileText, FolderOpen, SquarePenIcon, Table2 } from 'lucide-react';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { usePageKind } from '@/features/Pages/usePageKind';
import { getActiveWorkspaceSpaceId } from '@/helpers/activeWorkspaceSpace';
import { usePageStore } from '@/store/docs';
import { useSourceSetStore } from '@/store/sourceSet';
import { TABLE_PAGE_KIND } from '@/utils/docs';

const AddButton = memo(() => {
  const { t } = useTranslation('file');
  const pageKind = usePageKind();
  const activeSpaceId = getActiveWorkspaceSpaceId();

  const [createNewPage, createNewTable] = usePageStore((s) => [s.createNewPage, s.createNewTable]);
  const useFetchSourceSetList = useSourceSetStore((s) => s.useFetchSourceSetList);
  const { data: sourceSets = [] } = useFetchSourceSetList(activeSpaceId);

  const handleNewDocument = useCallback(
    (sourceSetId?: string) => {
      if (pageKind === TABLE_PAGE_KIND) {
        void createNewTable(t('pageList.tableUntitled'), { sourceSetId });
        return;
      }

      void createNewPage(t('pageList.untitled'), { sourceSetId });
    },
    [createNewPage, createNewTable, pageKind, t],
  );

  const items = useMemo<MenuProps['items']>(() => {
    const createCurrentTypeItem = {
      icon: <Icon icon={pageKind === TABLE_PAGE_KIND ? Table2 : FileText} />,
      key: 'create-default',
      label: `${t(pageKind === TABLE_PAGE_KIND ? 'header.newTableButton' : 'header.newPageButton')} · ${t('pageList.sourceSet.unassigned')}`,
      onClick: () => handleNewDocument(),
    };

    if (sourceSets.length === 0) return [createCurrentTypeItem];

    return [
      createCurrentTypeItem,
      { type: 'divider' },
      {
        children: sourceSets.map((item) => ({
          key: `create-in-${item.id}`,
          label: item.name,
          onClick: () => handleNewDocument(item.id),
        })),
        icon: <Icon icon={FolderOpen} />,
        key: 'create-in-source-set',
        label: t('pageList.createInSourceSet'),
      },
    ];
  }, [handleNewDocument, pageKind, sourceSets, t]);

  return (
    <DropdownMenu items={items}>
      <ActionIcon
        icon={SquarePenIcon}
        title={t(pageKind === TABLE_PAGE_KIND ? 'header.newTableButton' : 'header.newPageButton')}
        size={{
          blockSize: 32,
          size: 18,
        }}
      />
    </DropdownMenu>
  );
});

export default AddButton;
