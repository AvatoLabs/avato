'use client';

import { Flexbox, SearchBar } from '@lobehub/ui';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import SkeletonList from '@/features/NavPanel/components/SkeletonList';
import SideBarDrawer from '@/features/NavPanel/SideBarDrawer';
import { usePageKind } from '@/features/Pages/usePageKind';
import dynamic from '@/libs/next/dynamic';
import { TABLE_PAGE_KIND } from '@/utils/docs';

const Content = dynamic(() => import('./Content'), {
  loading: () => (
    <Flexbox gap={1} paddingBlock={1} paddingInline={4}>
      <SkeletonList rows={3} />
    </Flexbox>
  ),
  ssr: false,
});

interface AllPagesDrawerProps {
  onClose: () => void;
  open: boolean;
}

const AllPagesDrawer = memo<AllPagesDrawerProps>(({ open, onClose }) => {
  const { t } = useTranslation('file');
  const pageKind = usePageKind();
  const isTablePage = pageKind === TABLE_PAGE_KIND;
  const [searchKeyword, setSearchKeyword] = useState('');

  return (
    <SideBarDrawer
      open={open}
      title={t(isTablePage ? 'pageList.tableTitle' : 'pageList.title')}
      subHeader={
        <Flexbox paddingBlock={'0 8px'} paddingInline={8}>
          <SearchBar
            allowClear
            defaultValue={searchKeyword}
            placeholder={t(isTablePage ? 'searchTablePlaceholder' : 'searchPagePlaceholder')}
            onSearch={(keyword) => setSearchKeyword(keyword)}
            onInputChange={(keyword) => {
              if (!keyword) setSearchKeyword('');
            }}
          />
        </Flexbox>
      }
      onClose={onClose}
    >
      <Content searchKeyword={searchKeyword} />
    </SideBarDrawer>
  );
});

AllPagesDrawer.displayName = 'AllPagesDrawer';

export default AllPagesDrawer;
