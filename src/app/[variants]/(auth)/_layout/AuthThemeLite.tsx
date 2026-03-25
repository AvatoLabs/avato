'use client';

import 'antd/dist/reset.css';

import { ConfigProvider, ThemeProvider } from '@avatohub/ui';
import { App } from 'antd';
import * as motion from 'motion/react-m';
import Link from 'next/link';
import { type PropsWithChildren } from 'react';
import { memo, useEffect, useState } from 'react';

import AntdStaticMethods from '@/components/AntdStaticMethods';
import { useIsDark } from '@/hooks/useIsDark';
import Image from '@/libs/next/Image';

interface AuthThemeLiteProps extends PropsWithChildren {
  globalCDN?: boolean;
}

const DEFAULT_AUTH_APPEARANCE = 'light';

const AuthThemeLite = memo<AuthThemeLiteProps>(({ children, globalCDN }) => {
  const isDark = useIsDark();
  const [mounted, setMounted] = useState(false);
  // Keep the first client render aligned with SSR to avoid antd css-var hydration mismatches.
  const currentAppearance = mounted && isDark ? 'dark' : DEFAULT_AUTH_APPEARANCE;

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <ThemeProvider
      appearance={currentAppearance}
      className={'auth-layout'}
      defaultAppearance={DEFAULT_AUTH_APPEARANCE}
      defaultThemeMode={DEFAULT_AUTH_APPEARANCE}
      style={{ height: '100%' }}
      theme={{
        cssVar: { key: 'lobe-vars' },
        ...(mounted && isDark ? { token: { colorTextLightSolid: '#ffffff' } } : {}),
      }}
    >
      <App style={{ height: '100%' }}>
        <AntdStaticMethods />
        <ConfigProvider
          motion={motion}
          config={{
            aAs: Link,
            imgAs: Image,
            imgUnoptimized: true,
            proxy: globalCDN ? 'unpkg' : undefined,
          }}
        >
          {children}
        </ConfigProvider>
      </App>
    </ThemeProvider>
  );
});

AuthThemeLite.displayName = 'AuthThemeLite';

export default AuthThemeLite;
