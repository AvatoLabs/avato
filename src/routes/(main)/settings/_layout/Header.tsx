'use client';

import { type PropsWithChildren } from 'react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import SubSidebarTitleBar from '@/features/NavPanel/components/SubSidebarTitleBar';

const Header = memo<PropsWithChildren>(() => {
  const { t } = useTranslation('common');
  return <SubSidebarTitleBar title={t('tab.setting')} titleTo="/settings" />;
});

export default Header;
