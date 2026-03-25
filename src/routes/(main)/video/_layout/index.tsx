import { Flexbox } from '@lobehub/ui';
import { type FC, lazy, Suspense } from 'react';
import { Outlet } from 'react-router-dom';

import { styles } from './style';

/** 拆 chunk：避免与侧栏/话题面板同包导致动态 import 单文件过大或依赖链解析失败 */
const Sidebar = lazy(() => import('./Sidebar'));
const TopicSidebar = lazy(() => import('./TopicSidebar'));

const Layout: FC = () => {
  return (
    <>
      <Suspense fallback={null}>
        <Sidebar />
      </Suspense>
      <Flexbox horizontal className={styles.mainContainer} flex={1} height={'100%'}>
        <Flexbox className={styles.contentContainer} flex={1} height={'100%'}>
          <Outlet />
        </Flexbox>
        <Suspense fallback={null}>
          <TopicSidebar />
        </Suspense>
      </Flexbox>
    </>
  );
};

export default Layout;
