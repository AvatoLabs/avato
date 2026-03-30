'use client';

import { Flexbox, Text } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { FileText, FolderOpen, Inbox, Table2 } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import NavItem from '@/features/NavPanel/components/NavItem';
import SkeletonList from '@/features/NavPanel/components/SkeletonList';
import { usePageKind } from '@/features/Pages/usePageKind';
import { createSourceSetPageScope, usePageScope } from '@/features/Pages/usePageScope';
import { getActiveWorkspaceSpaceId } from '@/helpers/activeWorkspaceSpace';
import { useSourceSetStore } from '@/store/sourceSet';
import { TABLE_PAGE_KIND } from '@/utils/docs';

const styles = createStaticStyles(({ css, cssVar }) => ({
  sectionTitle: css`
    margin-block: 8px 4px;
    padding-inline: 12px;
    font-size: 12px;
    font-weight: 500;
    color: ${cssVar.colorTextDescription};
  `,
}));

const ScopeNavigation = memo(() => {
  const { t } = useTranslation(['common', 'file']);
  const pageKind = usePageKind();
  const activeSpaceId = getActiveWorkspaceSpaceId();
  const { scope, setScope, sourceSetId: activeSourceSetId } = usePageScope();
  const useFetchSourceSetList = useSourceSetStore((s) => s.useFetchSourceSetList);
  const { data: sourceSets = [], isLoading } = useFetchSourceSetList(activeSpaceId);
  const isTablePage = pageKind === TABLE_PAGE_KIND;

  return (
    <Flexbox gap={4} paddingInline={4}>
      <NavItem
        active={scope === 'all'}
        icon={isTablePage ? Table2 : FileText}
        title={t(isTablePage ? 'pageList.tableTitle' : 'pageList.title', { ns: 'file' })}
        onClick={() => setScope('all')}
      />
      <NavItem
        active={scope === 'unassigned'}
        icon={Inbox}
        title={t('pageList.filter.onlyUnassigned', { ns: 'file' })}
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
