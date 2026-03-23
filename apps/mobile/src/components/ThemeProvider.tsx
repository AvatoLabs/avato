/**
 * ThemeProvider — applies light/dark/system + color scheme to the app.
 * Syncs with NativeWind colorScheme for instant theme switch (no restart).
 */
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { colorScheme as nativeWindColorScheme } from 'nativewind';
import React, { useEffect } from 'react';
import { Linking, View } from 'react-native';

import { navigationRef } from '../lib/navigation';
import { handleIncomingShareUrl } from '../lib/shareLinkNavigation';
import { useThemeStore } from '../store/theme';
import { getThemeTokens } from '../theme/colors';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const effectiveTheme = useThemeStore((s) => s.effectiveTheme);
  const colorScheme = useThemeStore((s) => s.colorScheme);
  const tokens = getThemeTokens(effectiveTheme, colorScheme);
  const isDark = effectiveTheme === 'dark';

  // Sync NativeWind's colorScheme so dark: variants update instantly without restart
  useEffect(() => {
    nativeWindColorScheme.set(effectiveTheme);
  }, [effectiveTheme]);

  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      handleIncomingShareUrl(url);
    });
    return () => sub.remove();
  }, []);

  const baseNavigationTheme = isDark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...baseNavigationTheme,
    dark: isDark,
    colors: {
      ...baseNavigationTheme.colors,
      primary: tokens.primary,
      background: tokens.background,
      card: tokens.card,
      text: tokens.foreground,
      border: 'transparent',
      notification: tokens.danger,
    },
  };

  const themeClass = `theme-${colorScheme}`;
  return (
    <View
      className={[isDark ? 'dark' : '', themeClass].filter(Boolean).join(' ')}
      style={{ backgroundColor: tokens.background, flex: 1 }}
    >
      <NavigationContainer
        ref={navigationRef}
        theme={navTheme}
        onReady={() => {
          void Linking.getInitialURL().then(handleIncomingShareUrl);
        }}
      >
        {children}
      </NavigationContainer>
    </View>
  );
}
