'use client';

import { type MenuProps } from '@lobehub/ui';
import { Icon } from '@lobehub/ui';
import { FileText, Filter, FolderOpen, Hash, LucideCheck, Table2 } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { usePageKind } from '@/features/Pages/usePageKind';
import { createSourceSetPageScope, usePageScope } from '@/features/Pages/usePageScope';
import { getActiveWorkspaceSpaceId } from '@/helpers/activeWorkspaceSpace';
import { usePageStore } from '@/store/docs';
import { useGlobalStore } from '@/store/global';
import { systemStatusSelectors } from '@/store/global/selectors';
import { sourceSetSelectors, useSourceSetStore } from '@/store/sourceSet';
import { TABLE_PAGE_KIND } from '@/utils/docs';

export const useDropdownMenu = (): MenuProps['items'] => {
  const { t } = useTranslation();
  const pageKind = usePageKind();
  const { scope, setScope, sourceSetId: currentSourceSetScopeId } = usePageScope();
  const showOnlyPagesWithoutSourceSet = scope === 'unassigned';
  const [createNewPage, createNewTable] = usePageStore((s) => [s.createNewPage, s.createNewTable]);
  const useFetchSourceSetList = useSourceSetStore((s) => s.useFetchSourceSetList);
  const currentSourceSet = useSourceSetStore(
    sourceSetSelectors.getSourceSetById(currentSourceSetScopeId || ''),
  );
  const currentSourceSetName = useSourceSetStore(
    sourceSetSelectors.getSourceSetNameById(currentSourceSetScopeId || ''),
  );
  const activeSpaceId = currentSourceSet?.spaceId ?? getActiveWorkspaceSpaceId();
  const { data: sourceSets = [] } = useFetchSourceSetList(activeSpaceId);

  const [pagePageSize, updateSystemStatus] = useGlobalStore((s) => [
    systemStatusSelectors.pagePageSize(s),
    s.updateSystemStatus,
  ]);

  const handleCreateInSourceSet = useCallback(
    (sourceSetId: string) => {
      if (pageKind === TABLE_PAGE_KIND) {
        const targetSourceSet = sourceSets.find((item) => item.id === sourceSetId);

        void createNewTable(t('pageList.tableUntitled', { ns: 'file' }), {
          sourceSetId,
          spaceId: targetSourceSet?.spaceId,
        });
        return;
      }

      const targetSourceSet = sourceSets.find((item) => item.id === sourceSetId);

      void createNewPage(t('pageList.untitled', { ns: 'file' }), {
        sourceSetId,
        spaceId: targetSourceSet?.spaceId,
      });
    },
    [createNewPage, createNewTable, pageKind, sourceSets, t],
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
      ...(sourceSets.length > 0
        ? [
            {
              children: sourceSets.map((item) => ({
                icon: currentSourceSetScopeId === item.id ? <Icon icon={LucideCheck} /> : <div />,
                key: `scope-source-set-${item.id}`,
                label: item.name,
                onClick: () => setScope(createSourceSetPageScope(item.id)),
              })),
              icon: <Icon icon={FolderOpen} />,
              key: 'scope-by-source-set',
              label: t('pageList.scope.bySourceSet', { ns: 'file' }),
            },
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
      const createDefaultLabel = currentSourceSetScopeId
        ? `${t(pageKind === TABLE_PAGE_KIND ? 'header.newTableButton' : 'header.newPageButton', { ns: 'file' })} · ${currentSourceSetName || t('pageList.sourceSet.assigned', { ns: 'file' })}`
        : `${t(pageKind === TABLE_PAGE_KIND ? 'header.newTableButton' : 'header.newPageButton', { ns: 'file' })} · ${t('pageList.sourceSet.unassigned', { ns: 'file' })}`;

      items.unshift({
        icon: <Icon icon={pageKind === TABLE_PAGE_KIND ? Table2 : FileText} />,
        key: 'create-default',
        label: createDefaultLabel,
        onClick: () => {
          if (pageKind === TABLE_PAGE_KIND) {
            void createNewTable(t('pageList.tableUntitled', { ns: 'file' }), {
              sourceSetId: currentSourceSetScopeId || undefined,
              spaceId: currentSourceSet?.spaceId,
            });
            return;
          }

          void createNewPage(t('pageList.untitled', { ns: 'file' }), {
            sourceSetId: currentSourceSetScopeId || undefined,
            spaceId: currentSourceSet?.spaceId,
          });
        },
      });
    }

    return items;
  }, [
    createNewPage,
    createNewTable,
    handleCreateInSourceSet,
    currentSourceSet,
    currentSourceSetName,
    currentSourceSetScopeId,
    pageKind,
    sourceSets,
    t,
    showOnlyPagesWithoutSourceSet,
    pagePageSize,
    setScope,
    updateSystemStatus,
  ]);
};
