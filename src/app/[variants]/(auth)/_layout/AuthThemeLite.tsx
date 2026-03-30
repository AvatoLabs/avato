'use client';

import 'antd/dist/reset.css';

import { ConfigProvider, ThemeProvider } from '@avatohub/ui';
import { App } from 'antd';
import { type CustomTokenParams } from 'antd-style';
import * as motion from 'motion/react-m';
import Link from 'next/link';
import { useTheme as useNextThemesTheme } from 'next-themes';
import { type PropsWithChildren } from 'react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import AntdStaticMethods from '@/components/AntdStaticMethods';
import { getChatgptDarkSurfaceTokenOverrides } from '@/const/chatgptDarkSurfaces';
import { useIsDark } from '@/hooks/useIsDark';
import { resolveSolidTextColor, resolveThemeMode } from '@/layout/GlobalProvider/themeShared';
import Image from '@/libs/next/Image';
import { useUserStore } from '@/store/user';
import { settingsSelectors, userGeneralSettingsSelectors } from '@/store/user/selectors';

interface AuthThemeLiteProps extends PropsWithChildren {
  globalCDN?: boolean;
}

const DEFAULT_AUTH_APPEARANCE = 'light';

const AuthThemeLite = memo<AuthThemeLiteProps>(({ children, globalCDN }) => {
  const isDark = useIsDark();
  const { theme: nextTheme } = useNextThemesTheme();
  const [primaryColor, neutralColor, themeMode] = useUserStore((s) => [
    userGeneralSettingsSelectors.primaryColor(s),
    userGeneralSettingsSelectors.neutralColor(s),
    settingsSelectors.currentSettings(s).general?.themeMode,
  ]);
  const [mounted, setMounted] = useState(false);
  // Keep the first client render aligned with SSR to avoid antd css-var hydration mismatches.
  const currentAppearance = mounted && isDark ? 'dark' : DEFAULT_AUTH_APPEARANCE;
  const currentThemeMode = themeMode ?? nextTheme;
  const antdThemeMode = useMemo(() => resolveThemeMode(currentThemeMode), [currentThemeMode]);
  const solidTextColor = useMemo(() => resolveSolidTextColor(primaryColor), [primaryColor]);
  const customToken = useCallback(
    ({ isDarkMode }: CustomTokenParams) =>
      getChatgptDarkSurfaceTokenOverrides(isDarkMode, solidTextColor),
    [solidTextColor],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <ThemeProvider
      appearance={currentAppearance}
      className={'auth-layout'}
      customToken={customToken}
      defaultAppearance={DEFAULT_AUTH_APPEARANCE}
      style={{ height: '100%' }}
      themeMode={antdThemeMode}
      customTheme={{
        neutralColor,
        primaryColor,
      }}
      theme={{
        cssVar: { key: 'lobe-vars' },
        token: {
          colorTextLightSolid: solidTextColor,
        },
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
