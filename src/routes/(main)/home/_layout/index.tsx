import { Flexbox } from '@lobehub/ui';
import { useTheme } from 'antd-style';
import { type FC, type ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { useIsDark } from '@/hooks/useIsDark';
import { useHomeStore } from '@/store/home';

import HomeAgentIdSync from './HomeAgentIdSync';
import Sidebar from './Sidebar';
import { styles } from './style';

interface LayoutProps {
  children?: ReactNode;
}

const Layout: FC<LayoutProps> = ({ children }) => {
  const isDarkMode = useIsDark();
  const theme = useTheme(); // Keep for colorBgContainerSecondary (not in cssVar)
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isHomeRoute = pathname === '/';
  const [hasActivated, setHasActivated] = useState(isHomeRoute);
  const setNavigate = useHomeStore((s) => s.setNavigate);
  const content = children ?? <Outlet />;

  useEffect(() => {
    setNavigate(navigate);
  }, [navigate, setNavigate]);

  useEffect(() => {
    if (isHomeRoute) setHasActivated(true);
  }, [isHomeRoute]);

  // CSS 变量用于动态背景色（colorBgContainerSecondary 不在 cssVar 中）
  const cssVariables = useMemo<Record<string, string>>(
    () => ({
      '--content-bg-secondary': theme.colorBgContainerSecondary,
    }),
    [theme.colorBgContainerSecondary],
  );

  if (!hasActivated) return null;

  return (
    <Flexbox
      aria-hidden={!isHomeRoute}
      className={styles.absoluteContainer}
      height={'100%'}
      style={{ display: isHomeRoute ? 'flex' : 'none' }}
      width={'100%'}
    >
      {/* 仅首页挂载 NavPanelPortal；否则隐藏时仍挂载会与 /community 等侧栏抢占同一份 snapshot，导致侧栏导航失效 */}
      {isHomeRoute && <Sidebar />}
      <Flexbox
        className={isDarkMode ? styles.contentDark : styles.contentLight}
        flex={1}
        height={'100%'}
        style={cssVariables}
      >
        {content}
      </Flexbox>

      {isHomeRoute && <HomeAgentIdSync />}
    </Flexbox>
  );
};

export default Layout;
