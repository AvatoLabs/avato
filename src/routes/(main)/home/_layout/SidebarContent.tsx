'use client';

import { memo } from 'react';

import SideBarLayout from '@/features/NavPanel/SideBarLayout';

import Body from './Body';
import { AgentModalProvider } from './Body/Agent/ModalProvider';
import BottomMenu from './Body/BottomMenu';
import Footer from './Footer';
import Header from './Header';
import HomeBuiltinAgentsInit from './HomeBuiltinAgentsInit';

const Sidebar = memo(() => {
  return (
    <AgentModalProvider>
      <HomeBuiltinAgentsInit />
      <SideBarLayout
        body={<Body />}
        footer={<Footer />}
        header={<Header />}
        middleFooter={<BottomMenu />}
      />
    </AgentModalProvider>
  );
});

export default Sidebar;
