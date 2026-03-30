import { neutralColors, primaryColors } from '@lobehub/ui';

import {
  OBSIDIAN_THEME_NEUTRAL,
  OBSIDIAN_THEME_PRIMARY,
  resolveAppearanceThemeColors,
} from '@/layout/GlobalProvider/themeShared';

type ThemePresetColor = string;

interface ThemePresetDefinition {
  id: string;
  isCustom?: boolean;
  legacyPrimaryColors?: ThemePresetColor[];
  neutralColor?: ThemePresetColor;
  primaryColor?: ThemePresetColor;
}

const DEFAULT_PREVIEW_PRIMARY = primaryColors.blue;
const DEFAULT_PREVIEW_NEUTRAL = neutralColors.slate;

export const THEME_PRESETS = [
  /** 高饱和度重点色 + slate 中性底（取消 sage/mauve/sand 等莫兰迪灰） */
  { id: 'forest', legacyPrimaryColors: ['#16A34A'], neutralColor: 'slate', primaryColor: 'green' },
  { id: 'ember', neutralColor: 'slate', primaryColor: 'volcano' },
  {
    id: 'surge',
    legacyPrimaryColors: ['#00B8FF', 'cyan'],
    neutralColor: 'slate',
    primaryColor: 'blue',
  },
  { id: 'velvet', neutralColor: 'slate', primaryColor: 'magenta' },
  { id: 'midnight', neutralColor: 'slate', primaryColor: 'geekblue' },
  { id: 'obsidian', neutralColor: OBSIDIAN_THEME_NEUTRAL, primaryColor: OBSIDIAN_THEME_PRIMARY },
  { id: 'custom', isCustom: true, neutralColor: undefined, primaryColor: undefined },
] as const satisfies readonly ThemePresetDefinition[];

export type ThemePresetId = (typeof THEME_PRESETS)[number]['id'];

export const getThemePreset = (id: ThemePresetId) =>
  THEME_PRESETS.find((preset) => preset.id === id);

export const getThemePresetPreview = (
  id: ThemePresetId,
  customPreview?: {
    neutralColor?: string;
    primaryColor?: string;
  },
  appearance: 'dark' | 'light' = 'light',
) => {
  const preset = getThemePreset(id);
  const isCustomPreset = preset?.id === 'custom';
  const resolvedThemeColors = resolveAppearanceThemeColors({
    appearance,
    neutralColor: isCustomPreset
      ? customPreview?.neutralColor
      : normalizeThemeColor(preset?.neutralColor),
    primaryColor: isCustomPreset
      ? customPreview?.primaryColor
      : normalizeThemeColor(preset?.primaryColor),
  });

  return {
    accent: resolvePreviewColor(
      resolvedThemeColors.primaryColor,
      primaryColors,
      DEFAULT_PREVIEW_PRIMARY,
    ),
    neutral: resolvePreviewColor(
      resolvedThemeColors.neutralColor,
      neutralColors,
      DEFAULT_PREVIEW_NEUTRAL,
    ),
  };
};

export const normalizeThemeColor = <T extends string>(value?: T | '') => value || undefined;

const matchesPresetPrimaryColor = (preset: ThemePresetDefinition, normalizedPrimary?: string) =>
  normalizeThemeColor(preset.primaryColor) === normalizedPrimary ||
  preset.legacyPrimaryColors?.some((value) => normalizeThemeColor(value) === normalizedPrimary);

const resolvePreviewColor = <TPalette extends Record<string, string>, TFallback extends string>(
  value: string | undefined,
  palette: TPalette,
  fallback: TFallback,
) => {
  if (!value) return fallback;

  return palette[value as keyof TPalette] ?? value;
};

export const resolveThemePreset = (primaryColor?: string, neutralColor?: string): ThemePresetId => {
  const normalizedPrimary = normalizeThemeColor(primaryColor);
  const normalizedNeutral = normalizeThemeColor(neutralColor);

  const obsidian = getThemePreset('obsidian');
  const obsidianPrimary = normalizeThemeColor(obsidian?.primaryColor);
  const obsidianNeutral = normalizeThemeColor(obsidian?.neutralColor);

  const unset = normalizedPrimary === undefined && normalizedNeutral === undefined;
  const matchesObsidian =
    (obsidianPrimary !== undefined &&
      obsidianNeutral !== undefined &&
      normalizedPrimary === obsidianPrimary &&
      normalizedNeutral === obsidianNeutral) ||
    unset;

  if (matchesObsidian) return 'obsidian';

  return (
    THEME_PRESETS.find(
      (preset) =>
        preset.id !== 'custom' &&
        preset.id !== 'obsidian' &&
        matchesPresetPrimaryColor(preset, normalizedPrimary) &&
        normalizeThemeColor(preset.neutralColor) === normalizedNeutral,
    )?.id || 'custom'
  );
};

export const serializeThemeColor = <T extends string>(value?: T) => (value ?? '') as T | '';
