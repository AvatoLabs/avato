'use client';

import { Flexbox } from '@lobehub/ui';
import { type FC } from 'react';
import { Outlet } from 'react-router-dom';

import MobileContentLayout from '@/components/server/MobileNavLayout';
import { useServerConfigStore } from '@/store/serverConfig';

import ResourceMobileHeader from './ResourceMobileHeader';
import Sidebar from './Sidebar';
import { styles } from './style';

const HomeLayout: FC = () => {
  const isMobile = useServerConfigStore((s) => s.isMobile);

  if (isMobile) {
    return (
      <MobileContentLayout withNav header={<ResourceMobileHeader />}>
        <Outlet />
      </MobileContentLayout>
    );
  }

  return (
    <>
      <Sidebar />
      <Flexbox className={styles.mainContainer} flex={1} height={'100%'}>
        <Outlet />
      </Flexbox>
    </>
  );
};

export default HomeLayout;
