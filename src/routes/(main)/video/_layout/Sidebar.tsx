'use client';

import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { NavPanelPortal } from '@/features/NavPanel';
import SubSidebarTitleBar from '@/features/NavPanel/components/SubSidebarTitleBar';
import SideBarLayout from '@/features/NavPanel/SideBarLayout';

import ConfigPanel from './ConfigPanel';

const VideoSidebarHeader = memo(() => {
  const { t } = useTranslation('common');
  return <SubSidebarTitleBar title={t('tab.video')} titleTo="/video" />;
});

const Sidebar = memo(() => {
  return (
    <NavPanelPortal navKey="video">
      <SideBarLayout body={<ConfigPanel />} header={<VideoSidebarHeader />} />
    </NavPanelPortal>
  );
});

Sidebar.displayName = 'VideoSidebar';

export default Sidebar;
