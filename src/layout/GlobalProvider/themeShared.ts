import { type ThemeMode } from '@lobechat/types';
import { type NeutralColors, type PrimaryColors, primaryColors } from '@lobehub/ui';

const DEFAULT_PRIMARY_COLOR: PrimaryColors = 'blue';
export const OBSIDIAN_THEME_PRIMARY = '#000000';
export const OBSIDIAN_THEME_NEUTRAL: NeutralColors = 'slate';
const OBSIDIAN_DARK_PRIMARY = '#ffffff';
const LEGACY_THEME_PRIMARY_ALIASES: Record<string, PrimaryColors> = {
  '#00b8ff': 'cyan',
  '#16a34a': 'green',
};
const LIGHT_SOLID_TEXT = '#141414';

const normalizeHex = (value?: string) => value?.trim().toLowerCase();

export const resolveThemeMode = (themeMode?: ThemeMode | string) => {
  switch (themeMode) {
    case 'light': {
      return 'light';
    }
    case 'dark': {
      return 'dark';
    }
    default: {
      return 'auto';
    }
  }
};

export const resolveThemeAppearance = ({
  isDark,
  themeMode,
}: {
  isDark: boolean;
  themeMode?: ThemeMode | string;
}) => {
  if (themeMode === 'light' || themeMode === 'dark') return themeMode;

  return isDark ? 'dark' : 'light';
};

export const resolvePrimaryColorValue = (primaryColor?: string, fallbackPrimaryColor?: string) => {
  const resolvedPrimaryColor =
    resolveThemePrimaryAlias(primaryColor ?? fallbackPrimaryColor) ?? DEFAULT_PRIMARY_COLOR;
  return primaryColors[resolvedPrimaryColor as PrimaryColors] ?? resolvedPrimaryColor;
};

export const resolveThemePrimaryAlias = (primaryColor?: string) => {
  const normalized = normalizeHex(primaryColor);

  if (!normalized) return undefined;

  return LEGACY_THEME_PRIMARY_ALIASES[normalized] ?? primaryColor;
};

export const isObsidianTheme = (primaryColor?: string, neutralColor?: string) =>
  normalizeHex(primaryColor) === OBSIDIAN_THEME_PRIMARY &&
  (neutralColor ?? OBSIDIAN_THEME_NEUTRAL) === OBSIDIAN_THEME_NEUTRAL;

export const resolveAppearanceThemeColors = ({
  appearance,
  neutralColor,
  primaryColor,
}: {
  appearance: 'dark' | 'light';
  neutralColor?: string;
  primaryColor?: string;
}) => ({
  neutralColor,
  primaryColor: (() => {
    const resolvedPrimaryColor = resolveThemePrimaryAlias(primaryColor);

    if (!isObsidianTheme(resolvedPrimaryColor, neutralColor)) return resolvedPrimaryColor;

    return appearance === 'dark' ? OBSIDIAN_DARK_PRIMARY : OBSIDIAN_THEME_PRIMARY;
  })(),
});

export const resolveSolidTextColor = (primaryColor?: string, fallbackPrimaryColor?: string) =>
  normalizeHex(primaryColor ?? fallbackPrimaryColor) === OBSIDIAN_DARK_PRIMARY
    ? LIGHT_SOLID_TEXT
    : '#ffffff';
