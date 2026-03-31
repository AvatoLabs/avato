'use client';

import { Flexbox, SearchBar, Text } from '@lobehub/ui';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import SubSidebarTitleBar from '@/features/NavPanel/components/SubSidebarTitleBar';
import { usePageKind } from '@/features/Pages/usePageKind';
import { usePageSpaceId } from '@/features/Pages/usePageSpaceId';
import { SpaceSurfaceTitle } from '@/features/ResourceSpaces';
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
  const { sourceSetId } = usePageScope();
  const scopedSourceSet = useSourceSetStore(sourceSetSelectors.getSourceSetById(sourceSetId || ''));

  return (
    <>
      <SubSidebarTitleBar
        right={<AddButton />}
        titleTo={getPageRootPath(pageKind, pageSpaceId)}
        title={
          <SpaceSurfaceTitle
            spaceId={scopedSourceSet?.spaceId ?? pageSpaceId}
            surfaceLabel={t(isTablePage ? 'tab.table' : 'tab.pages')}
          />
        }
      />
      <Flexbox gap={8} paddingBlock={'0 8px'} paddingInline={8}>
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
