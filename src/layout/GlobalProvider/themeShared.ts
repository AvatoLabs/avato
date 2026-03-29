import { type ThemeMode } from '@lobechat/types';
import { type PrimaryColors, primaryColors } from '@lobehub/ui';

import { getContrastingTextColor } from '../../utils/contrast';

const DEFAULT_PRIMARY_COLOR: PrimaryColors = 'blue';

export const resolveThemeMode = (themeMode?: ThemeMode | string) => {
  switch (themeMode) {
    case 'light': {
      return 'light';
    }
    case 'dark': {
      return 'dark';
    }
    case 'system':
    default: {
      return 'auto';
    }
  }
};

export const resolvePrimaryColorValue = (
  primaryColor?: PrimaryColors,
  fallbackPrimaryColor?: PrimaryColors,
) => {
  const resolvedPrimaryColor = primaryColor ?? fallbackPrimaryColor ?? DEFAULT_PRIMARY_COLOR;
  return primaryColors[resolvedPrimaryColor];
};

export const resolveSolidTextColor = (
  primaryColor?: PrimaryColors,
  fallbackPrimaryColor?: PrimaryColors,
) => getContrastingTextColor(resolvePrimaryColorValue(primaryColor, fallbackPrimaryColor));
