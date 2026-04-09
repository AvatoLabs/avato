'use client';

import { ActionIcon, DropdownMenu, Flexbox, Icon, type MenuProps, Text } from '@lobehub/ui';
import { App } from 'antd';
import { createStaticStyles } from 'antd-style';
import { FileText, FolderOpen, Table2 } from 'lucide-react';
import { memo, type ReactNode, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { RESOURCE_ENTRY_ICONS } from '@/config/contentIcons';
import EmptyNavItem from '@/features/NavPanel/components/EmptyNavItem';
import NavItem from '@/features/NavPanel/components/NavItem';
import SkeletonList from '@/features/NavPanel/components/SkeletonList';
import { usePageKind } from '@/features/Pages/usePageKind';
import { createSourceSetPageScope, usePageScope } from '@/features/Pages/usePageScope';
import { usePageSpaceId } from '@/features/Pages/usePageSpaceId';
import { useSpaceItem } from '@/features/ResourceSpaces/useSpaceItem';
import { useCreateSourceSetModal } from '@/features/SourceSetModal';
import { pageSelectors, usePageStore } from '@/store/docs';
import { useSourceSetStore } from '@/store/sourceSet';
import { type SourceSetItem } from '@/types/sourceSet';
import { TABLE_PAGE_KIND } from '@/utils/docs';

const styles = createStaticStyles(({ css, cssVar }) => ({
  sectionTitle: css`
    margin-block: 8px 4px;
    padding-inline: 12px;
    font-size: 12px;
    font-weight: 500;
    color: ${cssVar.colorTextDescription};
  `,
  count: css`
    min-width: 16px;
    text-align: end;
  `,
}));

interface SourceSetScopeItemProps {
  active: boolean;
  count?: ReactNode;
  onClick: () => void;
  sourceSet: SourceSetItem;
}

const SourceSetScopeItem = memo<SourceSetScopeItemProps>(
  ({ active, count, onClick, sourceSet }) => {
    const { t } = useTranslation(['common', 'file', 'sourceSet']);
    const { message, modal } = App.useApp();
    const { open } = useCreateSourceSetModal();
    const removeSourceSet = useSourceSetStore((s) => s.removeSourceSet);
    const isLoading = useSourceSetStore((s) => s.sourceSetLoadingIds.includes(sourceSet.id));

    const handleEdit = useCallback(() => {
      open({
        id: sourceSet.id,
        initialValues: {
          description: sourceSet.description || '',
          name: sourceSet.name,
        },
        spaceId: sourceSet.spaceId || undefined,
      });
    }, [open, sourceSet.description, sourceSet.id, sourceSet.name, sourceSet.spaceId]);

    const handleDelete = useCallback(() => {
      modal.confirm({
        centered: true,
        okButtonProps: { danger: true },
        onOk: async () => {
          try {
            await removeSourceSet(sourceSet.id);
          } catch (error) {
            console.error('Failed to remove source set:', error);
            message.error(t('sourceSet.list.removeError', { ns: 'file' }));
          }
        },
        title: t('sourceSet.list.confirmRemoveSourceSet', { ns: 'file' }),
      });
    }, [message, modal, removeSourceSet, sourceSet.id, t]);

    const menuItems = useMemo<MenuProps['items']>(
      () => [
        {
          icon: <Icon icon={RESOURCE_ENTRY_ICONS.edit} />,
          key: 'rename',
          label: t('rename', { ns: 'common' }),
          onClick: handleEdit,
        },
        {
          icon: <Icon icon={RESOURCE_ENTRY_ICONS.page} />,
          key: 'edit-details',
          label: t('editDetails', { ns: 'sourceSet' }),
          onClick: handleEdit,
        },
        { type: 'divider' },
        {
          danger: true,
          icon: <Icon icon={RESOURCE_ENTRY_ICONS.trash} />,
          key: 'delete',
          label: t('delete', { ns: 'common' }),
          onClick: handleDelete,
        },
      ],
      [handleDelete, handleEdit, t],
    );

    return (
      <NavItem
        active={active}
        contextMenuItems={menuItems}
        extra={count}
        icon={FolderOpen}
        loading={isLoading}
        title={sourceSet.name}
        actions={
          <DropdownMenu items={menuItems} nativeButton={false}>
            <ActionIcon icon={RESOURCE_ENTRY_ICONS.more} size={'small'} />
          </DropdownMenu>
        }
        onClick={onClick}
      />
    );
  },
);

SourceSetScopeItem.displayName = 'SourceSetScopeItem';

const ScopeNavigation = memo(() => {
  const { t } = useTranslation(['common', 'file']);
  const pageKind = usePageKind();
  const pageSpaceId = usePageSpaceId();
  const { scope, setScope, sourceSetId: activeSourceSetId } = usePageScope();
  const useFetchSourceSetList = useSourceSetStore((s) => s.useFetchSourceSetList);
  const { data: sourceSets = [], isLoading } = useFetchSourceSetList(pageSpaceId);
  const { open: openCreateSourceSetModal } = useCreateSourceSetModal();
  const { space } = useSpaceItem(pageSpaceId);
  const isTablePage = pageKind === TABLE_PAGE_KIND;
  const scopeCountsSelector = useMemo(
    () => pageSelectors.getScopeCountsByKind(pageKind),
    [pageKind],
  );
  const isDocumentsLoading = usePageStore(pageSelectors.isDocumentsLoading);
  const { all, bySourceSet, unassigned } = usePageStore(scopeCountsSelector);
  const sortedSourceSets = useMemo(
    () => [...sourceSets].sort((left, right) => left.name.localeCompare(right.name)),
    [sourceSets],
  );
  const shouldShowUnassignedScope =
    scope === 'unassigned' || (space?.kind === 'personal' && unassigned > 0);

  const renderCount = (count: number) =>
    isDocumentsLoading ? undefined : (
      <Text className={styles.count} fontSize={12} type={'secondary'}>
        {count}
      </Text>
    );

  return (
    <Flexbox gap={4} paddingInline={4}>
      <NavItem
        active={scope === 'all'}
        extra={renderCount(all)}
        icon={isTablePage ? Table2 : FileText}
        title={t(isTablePage ? 'pageList.scope.allTables' : 'pageList.scope.allDocs', {
          ns: 'file',
        })}
        onClick={() => setScope('all')}
      />

      {pageSpaceId && (
        <Text className={styles.sectionTitle}>{t('sourceSet.title', { ns: 'file' })}</Text>
      )}

      {isLoading ? (
        <SkeletonList rows={4} />
      ) : sortedSourceSets.length === 0 ? (
        pageSpaceId ? (
          <EmptyNavItem
            title={t('sourceSet.new', { ns: 'file' })}
            onClick={() => openCreateSourceSetModal({ spaceId: pageSpaceId })}
          />
        ) : null
      ) : (
        sortedSourceSets.map((sourceSet) => (
          <SourceSetScopeItem
            active={activeSourceSetId === sourceSet.id}
            count={renderCount(bySourceSet[sourceSet.id] ?? 0)}
            key={sourceSet.id}
            sourceSet={sourceSet}
            onClick={() => {
              setScope(createSourceSetPageScope(sourceSet.id), { spaceId: sourceSet.spaceId });
            }}
          />
        ))
      )}

      {shouldShowUnassignedScope && (
        <NavItem
          active={scope === 'unassigned'}
          extra={renderCount(unassigned)}
          icon={RESOURCE_ENTRY_ICONS.folder}
          title={t('pageList.scope.unassigned', { ns: 'file' })}
          onClick={() => setScope('unassigned')}
        />
      )}
    </Flexbox>
  );
});

ScopeNavigation.displayName = 'PageScopeNavigation';

export default ScopeNavigation;
