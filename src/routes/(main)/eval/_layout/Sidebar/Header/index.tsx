'use client';

import { memo, type PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';

import SubSidebarTitleBar from '@/features/NavPanel/components/SubSidebarTitleBar';

const Header = memo<PropsWithChildren>(() => {
  const { t } = useTranslation('common');
  return <SubSidebarTitleBar title={t('tab.eval')} titleTo="/eval" />;
});

export default Header;
