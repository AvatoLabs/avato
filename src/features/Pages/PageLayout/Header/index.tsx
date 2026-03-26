'use client';

import { Flexbox } from '@lobehub/ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import SubSidebarTitleBar from '@/features/NavPanel/components/SubSidebarTitleBar';
import { usePageKind } from '@/features/Pages/usePageKind';
import { getPageRootPath, TABLE_PAGE_KIND } from '@/utils/page';

import AddButton from './AddButton';
import Nav from './Nav';

const Header = memo(() => {
  const { t } = useTranslation('common');
  const pageKind = usePageKind();

  return (
    <>
      <SubSidebarTitleBar
        title={t(pageKind === TABLE_PAGE_KIND ? 'tab.table' : 'tab.pages')}
        titleTo={getPageRootPath(pageKind)}
      />
      <Flexbox horizontal align={'center'} gap={4} paddingBlock={4} paddingInline={4}>
        <Flexbox flex={1} style={{ minWidth: 0 }}>
          <Nav />
        </Flexbox>
        <AddButton />
      </Flexbox>
    </>
  );
});

export default Header;
