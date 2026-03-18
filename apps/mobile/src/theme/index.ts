import { DefaultTheme } from '@react-navigation/native';

import { getThemeTokens } from './colors';

const lightTokens = getThemeTokens('light', 'blue');
const darkTokens = getThemeTokens('dark', 'blue');

export { themeColors as colorTokens, getChatAccent, getThemeTokens } from './colors';
export { COLOR_SCHEMES, type ColorSchemeId, getColorSchemePalette } from './palettes';

export const AvatoLightTheme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    primary: lightTokens.primary,
    background: lightTokens.background,
    card: lightTokens.card,
    text: lightTokens.foreground,
    border: 'transparent',
    notification: lightTokens.danger,
  },
};

export const AvatoDarkTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: darkTokens.primary,
    background: darkTokens.background,
    card: darkTokens.card,
    text: darkTokens.foreground,
    border: 'transparent',
    notification: darkTokens.danger,
  },
};
