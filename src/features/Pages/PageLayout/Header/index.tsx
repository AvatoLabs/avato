'use client';

import { Flexbox, SearchBar, Tag, Text } from '@lobehub/ui';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import SubSidebarTitleBar from '@/features/NavPanel/components/SubSidebarTitleBar';
import { usePageKind } from '@/features/Pages/usePageKind';
import { usePageSpaceId } from '@/features/Pages/usePageSpaceId';
import { useSpaceName } from '@/features/ResourceSpaces/useSpaceName';
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
  const isDocumentsLoading = usePageStore(pageSelectors.isDocumentsLoading);
  const [searchKeywords, setSearchKeywords] = usePageStore((s) => [
    s.searchKeywords,
    s.setSearchKeywords,
  ]);
  const pageSpaceId = usePageSpaceId();
  const { scope, setScope, sourceSetId } = usePageScope();
  const scopedSourceSet = useSourceSetStore(sourceSetSelectors.getSourceSetById(sourceSetId || ''));
  const spaceName = useSpaceName(scopedSourceSet?.spaceId ?? pageSpaceId);
  const sourceSetName = useSourceSetStore(
    sourceSetSelectors.getSourceSetNameById(sourceSetId || ''),
  );

  const activeScopeTag = useMemo(() => {
    if (scope === 'all' || scope === 'unassigned') return null;

    const label = sourceSetName || t('pageList.sourceSet.assigned', { ns: 'file' });

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
        titleTo={getPageRootPath(pageKind, pageSpaceId)}
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
            {isDocumentsLoading
              ? ''
              : t(isTablePage ? 'pageList.tableCount' : 'pageList.pageCount', {
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
