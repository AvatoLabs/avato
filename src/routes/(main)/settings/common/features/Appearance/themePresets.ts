import { type NeutralColors, neutralColors, type PrimaryColors, primaryColors } from '@lobehub/ui';

interface ThemePresetDefinition {
  id: string;
  isCustom?: boolean;
  neutralColor?: NeutralColors;
  primaryColor?: PrimaryColors;
}

const DEFAULT_PREVIEW_PRIMARY = primaryColors.blue;
const DEFAULT_PREVIEW_NEUTRAL = neutralColors.slate;

export const THEME_PRESETS = [
  { id: 'classic', neutralColor: undefined, primaryColor: undefined },
  { id: 'tide', neutralColor: 'slate', primaryColor: 'cyan' },
  { id: 'canopy', neutralColor: 'sage', primaryColor: 'green' },
  { id: 'ember', neutralColor: 'sand', primaryColor: 'volcano' },
  { id: 'velvet', neutralColor: 'mauve', primaryColor: 'magenta' },
  { id: 'midnight', neutralColor: 'slate', primaryColor: 'geekblue' },
  { id: 'custom', isCustom: true, neutralColor: undefined, primaryColor: undefined },
] as const satisfies readonly ThemePresetDefinition[];

export type ThemePresetId = (typeof THEME_PRESETS)[number]['id'];

export const getThemePreset = (id: ThemePresetId) =>
  THEME_PRESETS.find((preset) => preset.id === id);

export const getThemePresetPreview = (
  id: ThemePresetId,
  customPreview?: {
    neutralColor?: NeutralColors;
    primaryColor?: PrimaryColors;
  },
) => {
  const preset = getThemePreset(id);
  const primaryColor = preset?.isCustom
    ? customPreview?.primaryColor
    : normalizeThemeColor(preset?.primaryColor);
  const neutralColor = preset?.isCustom
    ? customPreview?.neutralColor
    : normalizeThemeColor(preset?.neutralColor);

  return {
    accent: primaryColor ? primaryColors[primaryColor] : DEFAULT_PREVIEW_PRIMARY,
    neutral: neutralColor ? neutralColors[neutralColor] : DEFAULT_PREVIEW_NEUTRAL,
  };
};

export const normalizeThemeColor = <T extends string>(value?: T | '') => value || undefined;

export const resolveThemePreset = (
  primaryColor?: PrimaryColors | '',
  neutralColor?: NeutralColors | '',
): ThemePresetId => {
  const normalizedPrimary = normalizeThemeColor(primaryColor);
  const normalizedNeutral = normalizeThemeColor(neutralColor);

  return (
    THEME_PRESETS.find(
      (preset) =>
        !preset.isCustom &&
        normalizeThemeColor(preset.primaryColor) === normalizedPrimary &&
        normalizeThemeColor(preset.neutralColor) === normalizedNeutral,
    )?.id || 'custom'
  );
};

export const serializeThemeColor = <T extends string>(value?: T) => (value ?? '') as T | '';
