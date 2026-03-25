'use client';

import { Flexbox } from '@lobehub/ui';
import { SearchIcon } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import NavItem from '@/features/NavPanel/components/NavItem';
import SubSidebarTitleBar from '@/features/NavPanel/components/SubSidebarTitleBar';
import { useGlobalStore } from '@/store/global';

import AddButton from './AddButton';

const Header = memo(() => {
  const { t } = useTranslation('common');
  const toggleCommandMenu = useGlobalStore((s) => s.toggleCommandMenu);
  return (
    <>
      <SubSidebarTitleBar title={t('tab.pages')} titleTo="/page" />
      <Flexbox horizontal align={'center'} gap={4} paddingBlock={4} paddingInline={4}>
        <Flexbox flex={1} style={{ minWidth: 0 }}>
          <NavItem
            icon={SearchIcon}
            key={'search'}
            title={t('tab.search')}
            onClick={() => toggleCommandMenu(true)}
          />
        </Flexbox>
        <AddButton />
      </Flexbox>
    </>
  );
});

export default Header;
