'use client';

import { Flexbox, SearchBar, Tag, Text } from '@lobehub/ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import SubSidebarTitleBar from '@/features/NavPanel/components/SubSidebarTitleBar';
import { usePageKind } from '@/features/Pages/usePageKind';
import { useSpaceName } from '@/features/ResourceSpaces/useSpaceName';
import { getActiveWorkspaceSpaceId } from '@/helpers/activeWorkspaceSpace';
import { pageSelectors, usePageStore } from '@/store/docs';
import { getPageRootPath, TABLE_PAGE_KIND } from '@/utils/docs';

import Actions from '../Body/Actions';
import AddButton from './AddButton';
import Nav from './Nav';

const Header = memo(() => {
  const { t } = useTranslation(['common', 'file']);
  const pageKind = usePageKind();
  const isTablePage = pageKind === TABLE_PAGE_KIND;
  const filteredDocumentsCount = usePageStore(pageSelectors.filteredDocumentsCountByKind(pageKind));
  const spaceName = useSpaceName(getActiveWorkspaceSpaceId());
  const [searchKeywords, setSearchKeywords] = usePageStore((s) => [
    s.searchKeywords,
    s.setSearchKeywords,
  ]);

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
            {t('pageList.pageCount', { count: filteredDocumentsCount, ns: 'file' })}
          </Text>
          <Actions />
        </Flexbox>
      </Flexbox>
    </>
  );
});

export default Header;
