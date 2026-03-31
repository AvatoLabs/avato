'use client';

import { Flexbox, Text } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { FileText, FolderOpen, Inbox, Table2 } from 'lucide-react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import NavItem from '@/features/NavPanel/components/NavItem';
import SkeletonList from '@/features/NavPanel/components/SkeletonList';
import { usePageKind } from '@/features/Pages/usePageKind';
import { createSourceSetPageScope, usePageScope } from '@/features/Pages/usePageScope';
import { getActiveWorkspaceSpaceId } from '@/helpers/activeWorkspaceSpace';
import { pageSelectors, usePageStore } from '@/store/docs';
import { sourceSetSelectors, useSourceSetStore } from '@/store/sourceSet';
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

const ScopeNavigation = memo(() => {
  const { t } = useTranslation(['common', 'file']);
  const pageKind = usePageKind();
  const { scope, setScope, sourceSetId: activeSourceSetId } = usePageScope();
  const scopedSourceSet = useSourceSetStore(
    sourceSetSelectors.getSourceSetById(activeSourceSetId || ''),
  );
  const activeSpaceId = scopedSourceSet?.spaceId ?? getActiveWorkspaceSpaceId();
  const useFetchSourceSetList = useSourceSetStore((s) => s.useFetchSourceSetList);
  const { data: sourceSets = [], isLoading } = useFetchSourceSetList(activeSpaceId);
  const isTablePage = pageKind === TABLE_PAGE_KIND;
  const scopeCountsSelector = useMemo(
    () => pageSelectors.getScopeCountsByKind(pageKind),
    [pageKind],
  );
  const isDocumentsLoading = usePageStore(pageSelectors.isDocumentsLoading);
  const { all, bySourceSet, unassigned } = usePageStore(scopeCountsSelector);

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
        sourceSets.map((sourceSet) => (
          <NavItem
            active={activeSourceSetId === sourceSet.id}
            extra={renderCount(bySourceSet[sourceSet.id] ?? 0)}
            icon={FolderOpen}
            key={sourceSet.id}
            title={sourceSet.name}
            onClick={() => setScope(createSourceSetPageScope(sourceSet.id))}
          />
        ))
      )}
    </Flexbox>
  );
});

ScopeNavigation.displayName = 'PageScopeNavigation';

export default ScopeNavigation;
