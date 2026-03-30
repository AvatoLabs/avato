'use client';

import { type MenuProps } from '@lobehub/ui';
import { Icon } from '@lobehub/ui';
import { FileText, Filter, FolderOpen, Hash, LucideCheck, Table2 } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { usePageKind } from '@/features/Pages/usePageKind';
import { usePageScope } from '@/features/Pages/usePageScope';
import { getActiveWorkspaceSpaceId } from '@/helpers/activeWorkspaceSpace';
import { usePageStore } from '@/store/docs';
import { useGlobalStore } from '@/store/global';
import { systemStatusSelectors } from '@/store/global/selectors';
import { useSourceSetStore } from '@/store/sourceSet';
import { TABLE_PAGE_KIND } from '@/utils/docs';

export const useDropdownMenu = (): MenuProps['items'] => {
  const { t } = useTranslation();
  const pageKind = usePageKind();
  const { scope, setScope } = usePageScope();
  const activeSpaceId = getActiveWorkspaceSpaceId();
  const showOnlyPagesWithoutSourceSet = scope === 'unassigned';
  const [createNewPage, createNewTable] = usePageStore((s) => [s.createNewPage, s.createNewTable]);
  const useFetchSourceSetList = useSourceSetStore((s) => s.useFetchSourceSetList);
  const { data: sourceSets = [] } = useFetchSourceSetList(activeSpaceId);

  const [pagePageSize, updateSystemStatus] = useGlobalStore((s) => [
    systemStatusSelectors.pagePageSize(s),
    s.updateSystemStatus,
  ]);

  const handleCreateInSourceSet = useCallback(
    (sourceSetId: string) => {
      if (pageKind === TABLE_PAGE_KIND) {
        void createNewTable(t('pageList.tableUntitled', { ns: 'file' }), { sourceSetId });
        return;
      }

      void createNewPage(t('pageList.untitled', { ns: 'file' }), { sourceSetId });
    },
    [createNewPage, createNewTable, pageKind, t],
  );

  return useMemo(() => {
    const pageSizeOptions = [20, 40, 60, 100];
    const pageSizeItems = pageSizeOptions.map((size) => ({
      icon: pagePageSize === size ? <Icon icon={LucideCheck} /> : <div />,
      key: `pageSize-${size}`,
      label: t('pageList.pageSizeItem', { count: size, ns: 'file' }),
      onClick: () => {
        updateSystemStatus({ pagePageSize: size });
      },
    }));

    const items: MenuProps['items'] = [
      ...(sourceSets.length > 0
        ? [
            {
              children: sourceSets.map((item) => ({
                key: `create-in-${item.id}`,
                label: item.name,
                onClick: () => handleCreateInSourceSet(item.id),
              })),
              icon: <Icon icon={FolderOpen} />,
              key: 'create-in-source-set',
              label: t('pageList.createInSourceSet', { ns: 'file' }),
            },
            { type: 'divider' as const },
          ]
        : []),
      {
        icon: showOnlyPagesWithoutSourceSet ? <Icon icon={LucideCheck} /> : <Icon icon={Filter} />,
        key: 'only-unassigned',
        label: t('pageList.filter.onlyUnassigned', { ns: 'file' }),
        onClick: () => {
          setScope(showOnlyPagesWithoutSourceSet ? 'all' : 'unassigned');
        },
      },
      {
        type: 'divider',
      },
      {
        children: pageSizeItems,
        icon: <Icon icon={Hash} />,
        key: 'displayItems',
        label: t('common:navPanel.displayItems'),
      },
    ];

    if (sourceSets.length > 0) {
      items.unshift({
        icon: <Icon icon={pageKind === TABLE_PAGE_KIND ? Table2 : FileText} />,
        key: 'create-default',
        label: `${t(pageKind === TABLE_PAGE_KIND ? 'header.newTableButton' : 'header.newPageButton', { ns: 'file' })} · ${t('pageList.sourceSet.unassigned', { ns: 'file' })}`,
        onClick: () => {
          if (pageKind === TABLE_PAGE_KIND) {
            void createNewTable(t('pageList.tableUntitled', { ns: 'file' }));
            return;
          }

          void createNewPage(t('pageList.untitled', { ns: 'file' }));
        },
      });
    }

    return items;
  }, [
    createNewPage,
    createNewTable,
    handleCreateInSourceSet,
    pageKind,
    sourceSets,
    t,
    showOnlyPagesWithoutSourceSet,
    pagePageSize,
    setScope,
    updateSystemStatus,
  ]);
};
