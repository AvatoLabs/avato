import React, { memo } from 'react';

import { NavPanelPortal } from '@/features/NavPanel';
import SideBarLayout from '@/features/NavPanel/SideBarLayout';
import MemoryScopeSection from '@/features/ResourceSpaces/MemoryScopeSection';

import Header from './Header';

const Sidebar = memo(() => {
  return (
    <NavPanelPortal navKey="memory">
      <SideBarLayout body={<MemoryScopeSection currentScope="personal" />} header={<Header />} />
    </NavPanelPortal>
  );
});

Sidebar.displayName = 'MemorySidebar';

export default Sidebar;
