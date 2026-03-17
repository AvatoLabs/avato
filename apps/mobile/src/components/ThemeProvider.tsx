/**
 * ThemeProvider — applies light/dark/system theme to the app.
 * Wraps root with dark class for NativeWind and provides correct Navigation theme.
 */
import { NavigationContainer } from '@react-navigation/native';
import React from 'react';
import { View } from 'react-native';

import { useThemeStore } from '../store/theme';
import { AvatoDarkTheme, AvatoLightTheme } from '../theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const effectiveTheme = useThemeStore((s) => s.effectiveTheme);
  const navTheme = effectiveTheme === 'dark' ? AvatoDarkTheme : AvatoLightTheme;
  const isDark = effectiveTheme === 'dark';

  return (
    <View className={isDark ? 'dark' : ''} style={{ flex: 1 }}>
      <NavigationContainer theme={navTheme}>{children}</NavigationContainer>
    </View>
  );
}
