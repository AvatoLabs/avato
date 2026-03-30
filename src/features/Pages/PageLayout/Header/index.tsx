'use client';

import { Flexbox, SearchBar, Tag, Text } from '@lobehub/ui';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import SubSidebarTitleBar from '@/features/NavPanel/components/SubSidebarTitleBar';
import { usePageKind } from '@/features/Pages/usePageKind';
import { useSpaceName } from '@/features/ResourceSpaces/useSpaceName';
import { getActiveWorkspaceSpaceId } from '@/helpers/activeWorkspaceSpace';
import { pageSelectors, usePageStore } from '@/store/docs';
import { sourceSetSelectors, useSourceSetStore } from '@/store/sourceSet';
import { getPageRootPath, TABLE_PAGE_KIND } from '@/utils/docs';

import { usePageScope } from '../../usePageScope';
import Actions from '../Body/Actions';
import AddButton from './AddButton';
import Nav from './Nav';

const Header = memo(() => {
  const { t } = useTranslation(['common', 'file']);
  const pageKind = usePageKind();
  const isTablePage = pageKind === TABLE_PAGE_KIND;
  const filteredDocumentsSelector = useMemo(
    () => pageSelectors.getFilteredDocumentsSnapshotByKind(pageKind),
    [pageKind],
  );
  const { count: filteredDocumentsCount } = usePageStore(filteredDocumentsSelector);
  const spaceName = useSpaceName(getActiveWorkspaceSpaceId());
  const [searchKeywords, setSearchKeywords] = usePageStore((s) => [
    s.searchKeywords,
    s.setSearchKeywords,
  ]);
  const { scope, setScope, sourceSetId } = usePageScope();
  const sourceSetName = useSourceSetStore(
    sourceSetSelectors.getSourceSetNameById(sourceSetId || ''),
  );

  const activeScopeTag = useMemo(() => {
    if (scope === 'all') return null;

    const label =
      scope === 'unassigned'
        ? t('pageList.scope.inbox', { ns: 'file' })
        : sourceSetName || t('pageList.sourceSet.assigned', { ns: 'file' });

    return (
      <Tag
        size={'small'}
        style={{ cursor: 'pointer' }}
        variant={'filled'}
        onClick={() => setScope('all')}
      >
        {label}
      </Tag>
    );
  }, [scope, setScope, sourceSetName, t]);

  return (
    <>
      <SubSidebarTitleBar
        right={<AddButton />}
        title={t(isTablePage ? 'tab.table' : 'tab.pages')}
        titleTo={getPageRootPath(pageKind)}
      />
      <Flexbox gap={8} paddingBlock={'0 8px'} paddingInline={8}>
        {spaceName && (
          <Flexbox horizontal paddingInline={4}>
            <Tag size={'small'}>{spaceName}</Tag>
          </Flexbox>
        )}
        {activeScopeTag && (
          <Flexbox horizontal paddingInline={4}>
            {activeScopeTag}
          </Flexbox>
        )}
        <Nav />
        <SearchBar
          allowClear
          defaultValue={searchKeywords}
          placeholder={t(isTablePage ? 'searchTablePlaceholder' : 'searchPagePlaceholder', {
            ns: 'file',
          })}
          onSearch={(keyword) => setSearchKeywords(keyword)}
          onInputChange={(keyword) => {
            if (!keyword) setSearchKeywords('');
          }}
        />
        <Flexbox horizontal align={'center'} justify={'space-between'} paddingInline={4}>
          <Text fontSize={12} type={'secondary'}>
            {t(isTablePage ? 'pageList.tableCount' : 'pageList.pageCount', {
              count: filteredDocumentsCount,
              ns: 'file',
            })}
          </Text>
          <Actions />
        </Flexbox>
      </Flexbox>
    </>
  );
});

export default Header;
