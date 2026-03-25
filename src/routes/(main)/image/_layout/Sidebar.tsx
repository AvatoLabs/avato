'use client';

import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { NavPanelPortal } from '@/features/NavPanel';
import SubSidebarTitleBar from '@/features/NavPanel/components/SubSidebarTitleBar';
import SideBarLayout from '@/features/NavPanel/SideBarLayout';

import ConfigPanel from './ConfigPanel';

const ImageSidebarHeader = memo(() => {
  const { t } = useTranslation('common');
  return <SubSidebarTitleBar title={t('tab.aiImage')} titleTo="/image" />;
});

const Sidebar = memo(() => {
  return (
    <NavPanelPortal navKey="image">
      <SideBarLayout body={<ConfigPanel />} header={<ImageSidebarHeader />} />
    </NavPanelPortal>
  );
});

Sidebar.displayName = 'ImageSidebar';

export default Sidebar;
