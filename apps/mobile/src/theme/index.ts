import { DefaultTheme } from '@react-navigation/native';

export const themeColors = {
  light: {
    primary: '#007aff',
    secondary: '#8c8c8c',
    muted: '#999999',
    background: '#ffffff',
  },
};

export const AvatoLightTheme = {
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
