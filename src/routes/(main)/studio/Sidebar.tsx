'use client';

import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { NavPanelPortal } from '@/features/NavPanel';
import SubSidebarTitleBar from '@/features/NavPanel/components/SubSidebarTitleBar';
import SideBarLayout from '@/features/NavPanel/SideBarLayout';

const StudioSidebarHeader = memo(() => {
  const { t } = useTranslation('common');
  return <SubSidebarTitleBar title={t('tab.avatoStudio')} titleTo="/studio" />;
});

const Sidebar = memo(() => {
  return (
    <NavPanelPortal navKey="studio">
      <SideBarLayout header={<StudioSidebarHeader />} />
    </NavPanelPortal>
  );
});

Sidebar.displayName = 'StudioSidebar';

export default Sidebar;
