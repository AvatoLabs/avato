import { DarkTheme, DefaultTheme } from '@react-navigation/native';

export const themeColors = {
  light: {
    primary: '#007aff',
    secondary: '#8c8c8c',
    muted: '#999999',
    background: '#ffffff',
  },
  dark: {
    primary: '#0a84ff',
    secondary: '#a6a6a6',
    muted: '#666666',
    background: '#000000',
  },
};

export const MinkLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: themeColors.light.primary,
    background: themeColors.light.background,
    card: themeColors.light.background,
    text: '#1f1f1f',
    border: 'transparent',
    notification: '#ff3b30',
  },
};

export const MinkDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: themeColors.dark.primary,
    background: themeColors.dark.background,
    card: themeColors.dark.background,
    text: '#f0f0f0',
    border: 'transparent',
    notification: '#ff453a',
  },
};
