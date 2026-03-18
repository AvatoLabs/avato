/**
 * ThemeProvider — applies light/dark/system + color scheme to the app.
 * Wraps root with dark class for NativeWind and provides correct Navigation theme.
 */
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import React from 'react';
import { View } from 'react-native';

import { navigationRef } from '../lib/navigation';
import { useThemeStore } from '../store/theme';
import { getThemeTokens } from '../theme/colors';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const effectiveTheme = useThemeStore((s) => s.effectiveTheme);
  const colorScheme = useThemeStore((s) => s.colorScheme);
  const tokens = getThemeTokens(effectiveTheme, colorScheme);
  const isDark = effectiveTheme === 'dark';

  const navTheme = {
    ...DefaultTheme,
    dark: isDark,
    colors: {
      ...DefaultTheme.colors,
      primary: tokens.primary,
      background: tokens.background,
      card: tokens.card,
      text: tokens.foreground,
      border: 'transparent',
      notification: tokens.danger,
    },
  };

  const themeClass = colorScheme === 'blue' ? '' : `theme-${colorScheme}`;
  return (
    <View
      className={[isDark ? 'dark' : '', themeClass].filter(Boolean).join(' ')}
      style={{ flex: 1 }}
    >
      <NavigationContainer ref={navigationRef} theme={navTheme}>
        {children}
      </NavigationContainer>
    </View>
  );
}
