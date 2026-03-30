'use client';

import { Flexbox, Tag, Text } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import Loading from '@/components/Loading/BrandTextLoading';
import PageExplorerPlaceholder from '@/features/PageExplorer/PageExplorerPlaceholder';
import SourceSetSurfaceNav from '@/features/SourceSetSurfaceNav';
import { pageSelectors, usePageStore } from '@/store/docs';
import { sourceSetSelectors, useSourceSetStore } from '@/store/sourceSet';
import { type PageKind, TABLE_PAGE_KIND } from '@/utils/docs';

import Content from './PageLayout/Body/AllPagesDrawer/Content';
import { usePageScope } from './usePageScope';

const useStyles = createStyles(({ css, token }) => ({
  content: css`
    overflow: hidden;
    flex: 1;
    min-height: 0;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorBgContainer};
  `,
}));

interface PageWorkspaceProps {
  pageKind: PageKind;
}

const PageWorkspace = memo<PageWorkspaceProps>(({ pageKind }) => {
  const { t } = useTranslation(['common', 'file']);
  const { styles } = useStyles();
  const { scope } = usePageScope();
  const currentSourceSetScopeId = usePageStore((s) => s.currentSourceSetScopeId);
  const filteredDocumentsSelector = useMemo(
    () => pageSelectors.getFilteredDocumentsSnapshotByKind(pageKind),
    [pageKind],
  );

  const isLoading = usePageStore(pageSelectors.isDocumentsLoading);
  const { count } = usePageStore(filteredDocumentsSelector);
  const searchKeywords = usePageStore((s) => s.searchKeywords);
  const isTablePage = pageKind === TABLE_PAGE_KIND;
  const isSearching = searchKeywords.trim().length > 0;
  const scopedSourceSet = useSourceSetStore(
    sourceSetSelectors.getSourceSetById(currentSourceSetScopeId || ''),
  );

  const scopeLabel = useMemo(() => {
    if (scope === 'unassigned') {
      return t('pageList.scope.inbox', { ns: 'file' });
    }

    if (currentSourceSetScopeId) {
      return scopedSourceSet?.name || t('pageList.sourceSet.assigned', { ns: 'file' });
    }

    return t(isTablePage ? 'pageList.tableTitle' : 'pageList.title', { ns: 'file' });
  }, [currentSourceSetScopeId, isTablePage, scope, scopedSourceSet?.name, t]);

  const countLabel = t(isTablePage ? 'pageList.tableCount' : 'pageList.pageCount', {
    count,
    ns: 'file',
  });

  if (isLoading) {
    return <Loading debugId="PagesWorkspace" />;
  }

  return (
    <>
      <Flexbox flex={1} gap={16} padding={24} style={{ minHeight: 0 }}>
        <Flexbox gap={8}>
          {currentSourceSetScopeId && (
            <SourceSetSurfaceNav
              activeSurface={'docs'}
              sourceSetId={currentSourceSetScopeId}
              spaceId={scopedSourceSet?.spaceId}
            />
          )}
          <Flexbox horizontal align={'center'} gap={8}>
            <Text as={'h2'} fontSize={24} style={{ margin: 0 }} weight={600}>
              {scopeLabel}
            </Text>
            {scope === 'unassigned' && (
              <Tag size={'small'} variant={'filled'}>
                {t('pageList.scope.inbox', { ns: 'file' })}
              </Tag>
            )}
            {currentSourceSetScopeId && (
              <Tag size={'small'} variant={'filled'}>
                {t('sourceSet.title', { ns: 'file' })}
              </Tag>
            )}
          </Flexbox>
          {currentSourceSetScopeId && scopedSourceSet?.description && (
            <Text type={'secondary'}>{scopedSourceSet.description}</Text>
          )}
          <Text type={'secondary'}>{countLabel}</Text>
        </Flexbox>
        {count === 0 && !isSearching ? (
          <PageExplorerPlaceholder
            pageKind={pageKind}
            sourceSetId={currentSourceSetScopeId || undefined}
          />
        ) : (
          <Flexbox className={styles.content}>
            <Content />
          </Flexbox>
        )}
      </Flexbox>
    </>
  );
});

PageWorkspace.displayName = 'PageWorkspace';

export default PageWorkspace;
