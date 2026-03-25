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
  /** 高饱和度重点色 + slate 中性底（取消 sage/mauve/sand 等莫兰迪灰） */
  { id: 'classic', neutralColor: 'slate', primaryColor: 'green' },
  { id: 'tide', neutralColor: 'slate', primaryColor: 'cyan' },
  { id: 'canopy', neutralColor: 'slate', primaryColor: 'lime' },
  { id: 'ember', neutralColor: 'slate', primaryColor: 'volcano' },
  { id: 'velvet', neutralColor: 'slate', primaryColor: 'magenta' },
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
  const isCustomPreset = preset?.id === 'custom';
  const primaryColor = isCustomPreset
    ? customPreview?.primaryColor
    : normalizeThemeColor(preset?.primaryColor);
  const neutralColor = isCustomPreset
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

  const classic = getThemePreset('classic');
  const classicPrimary = normalizeThemeColor(classic?.primaryColor);
  const classicNeutral = normalizeThemeColor(classic?.neutralColor);

  const unset = normalizedPrimary === undefined && normalizedNeutral === undefined;
  const matchesClassic =
    (classicPrimary !== undefined &&
      classicNeutral !== undefined &&
      normalizedPrimary === classicPrimary &&
      normalizedNeutral === classicNeutral) ||
    unset;

  if (matchesClassic) return 'classic';

  return (
    THEME_PRESETS.find(
      (preset) =>
        preset.id !== 'custom' &&
        preset.id !== 'classic' &&
        normalizeThemeColor(preset.primaryColor) === normalizedPrimary &&
        normalizeThemeColor(preset.neutralColor) === normalizedNeutral,
    )?.id || 'custom'
  );
};

export const serializeThemeColor = <T extends string>(value?: T) => (value ?? '') as T | '';
