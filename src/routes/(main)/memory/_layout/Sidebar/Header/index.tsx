'use client';

import { Fragment, memo } from 'react';
import { useTranslation } from 'react-i18next';

import SubSidebarTitleBar from '@/features/NavPanel/components/SubSidebarTitleBar';

import Nav from './Nav';

const Header = memo(() => {
  const { t } = useTranslation('common');

  return (
    <Fragment>
      <SubSidebarTitleBar title={t('tab.memory')} titleTo="/memory" />
      <Nav />
    </Fragment>
  );
});

export default Header;
