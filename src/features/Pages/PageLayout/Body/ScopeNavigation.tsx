'use client';

import { ActionIcon, DropdownMenu, Flexbox, Icon, type MenuProps, Tag, Text } from '@lobehub/ui';
import { App } from 'antd';
import { createStaticStyles } from 'antd-style';
import { FileText, FolderOpen, Inbox, Table2 } from 'lucide-react';
import { memo, type ReactNode, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { RESOURCE_ENTRY_ICONS } from '@/config/contentIcons';
import NavItem from '@/features/NavPanel/components/NavItem';
import SkeletonList from '@/features/NavPanel/components/SkeletonList';
import { usePageKind } from '@/features/Pages/usePageKind';
import { createSourceSetPageScope, usePageScope } from '@/features/Pages/usePageScope';
import { useSpaceName } from '@/features/ResourceSpaces/useSpaceName';
import { useCreateSourceSetModal } from '@/features/SourceSetModal';
import {
  getActiveWorkspaceSpaceId,
  setActiveWorkspaceSpaceId,
} from '@/helpers/activeWorkspaceSpace';
import { pageSelectors, usePageStore } from '@/store/docs';
import { sourceSetSelectors, useSourceSetStore } from '@/store/sourceSet';
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
  showSpaceTag?: boolean;
  sourceSet: SourceSetItem;
}

const SourceSetScopeItem = memo<SourceSetScopeItemProps>(
  ({ active, count, onClick, showSpaceTag, sourceSet }) => {
    const { t } = useTranslation(['common', 'file', 'sourceSet']);
    const { modal } = App.useApp();
    const { open } = useCreateSourceSetModal();
    const spaceName = useSpaceName(showSpaceTag ? sourceSet.spaceId : undefined);
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
          await removeSourceSet(sourceSet.id);
        },
        title: t('sourceSet.list.confirmRemoveSourceSet', { ns: 'file' }),
      });
    }, [modal, removeSourceSet, sourceSet.id, t]);

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
        slots={
          showSpaceTag && spaceName
            ? {
                titlePrefix: (
                  <Tag size={'small'} variant={'outlined'}>
                    {spaceName}
                  </Tag>
                ),
              }
            : undefined
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
  const { scope, setScope, sourceSetId: activeSourceSetId } = usePageScope();
  const scopedSourceSet = useSourceSetStore(
    sourceSetSelectors.getSourceSetById(activeSourceSetId || ''),
  );
  const activeSpaceId = scopedSourceSet?.spaceId ?? getActiveWorkspaceSpaceId();
  const useFetchSourceSetList = useSourceSetStore((s) => s.useFetchSourceSetList);
  const { data: sourceSets = [], isLoading } = useFetchSourceSetList();
  const isTablePage = pageKind === TABLE_PAGE_KIND;
  const scopeCountsSelector = useMemo(
    () => pageSelectors.getScopeCountsByKind(pageKind),
    [pageKind],
  );
  const isDocumentsLoading = usePageStore(pageSelectors.isDocumentsLoading);
  const { all, bySourceSet, unassigned } = usePageStore(scopeCountsSelector);
  const shouldShowSpaceTags = useMemo(
    () => new Set(sourceSets.map((item) => item.spaceId).filter(Boolean)).size > 1,
    [sourceSets],
  );
  const sortedSourceSets = useMemo(
    () =>
      [...sourceSets].sort((left, right) => {
        const leftInCurrentSpace = left.spaceId === activeSpaceId;
        const rightInCurrentSpace = right.spaceId === activeSpaceId;

        if (leftInCurrentSpace !== rightInCurrentSpace) return leftInCurrentSpace ? -1 : 1;

        return left.name.localeCompare(right.name);
      }),
    [activeSpaceId, sourceSets],
  );

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
      <NavItem
        active={scope === 'unassigned'}
        extra={renderCount(unassigned)}
        icon={Inbox}
        title={t('pageList.scope.inbox', { ns: 'file' })}
        onClick={() => setScope('unassigned')}
      />

      {(isLoading || sourceSets.length > 0) && (
        <Text className={styles.sectionTitle}>{t('sourceSet.title', { ns: 'file' })}</Text>
      )}

      {isLoading ? (
        <SkeletonList rows={4} />
      ) : (
        sortedSourceSets.map((sourceSet) => (
          <SourceSetScopeItem
            active={activeSourceSetId === sourceSet.id}
            key={sourceSet.id}
            sourceSet={sourceSet}
            count={
              sourceSet.spaceId === activeSpaceId
                ? renderCount(bySourceSet[sourceSet.id] ?? 0)
                : undefined
            }
            showSpaceTag={Boolean(
              sourceSet.spaceId &&
              shouldShowSpaceTags &&
              (!activeSpaceId || sourceSet.spaceId !== activeSpaceId),
            )}
            onClick={() => {
              setActiveWorkspaceSpaceId(sourceSet.spaceId || undefined);
              setScope(createSourceSetPageScope(sourceSet.id));
            }}
          />
        ))
      )}
    </Flexbox>
  );
});

ScopeNavigation.displayName = 'PageScopeNavigation';

export default ScopeNavigation;
