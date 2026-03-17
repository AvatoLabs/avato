import { DefaultTheme } from '@react-navigation/native';

import { themeColors as colorTokens } from './colors';

/** @deprecated Use themeColors from theme/colors for component styling */
export const themeColors = {
  light: {
    background: colorTokens.background,
    muted: colorTokens.muted,
    primary: colorTokens.primary,
    secondary: colorTokens.secondaryText,
  },
};

export { themeColors as colorTokens } from './colors';

export const AvatoLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colorTokens.primary,
    background: colorTokens.background,
    card: colorTokens.card,
    text: colorTokens.foreground,
    border: 'transparent',
    notification: colorTokens.danger,
  },
};
