/**
 * Color scheme palettes — accent/brand colors for theming.
 * Each palette defines primary, user bubble, chat accent, and source badge colors.
 * Combined with base (light/dark) tokens to produce full ColorTokens.
 * Slate and violet have lighter dark-mode variants for visibility.
 */
export type ColorSchemeId =
  | 'amber'
  | 'blue'
  | 'dustBlue'
  | 'green'
  | 'rose'
  | 'sage'
  | 'slate'
  | 'violet';

export type EffectiveTheme = 'light' | 'dark';

export interface ColorSchemePalette {
  activeTabBg: string;
  chatAccentBadgeBg: string;
  chatAccentBadgeText: string;
  chatAccentChipBg: string;
  chatAccentChipBorder: string;
  chatAccentQuoteBorder: string;
  iconOnPrimary?: string;
  id: ColorSchemeId;
  inactiveTabBg: string;
  markdownLink: string;
  primary: string;
  primaryBorder: string;
  primaryFocused: string;
  primaryMuted: string;
  primarySubtle: string;
  sourceMarket: string;
  sourceMarketMuted: string;
  switchTrackOn: string;
  userBubbleBg: string;
  userBubbleCodeBg?: string;
  userBubbleHr?: string;
  userBubbleLink: string;
  userBubbleSubtleBg?: string;
  userBubbleTableBg?: string;
  userBubbleTableBorder?: string;
  userBubbleText?: string;
  userBubbleTextMuted?: string;
}

function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Amber user bubble: dark text on amber bg — softer than white-on-amber */
const AMBER_BUBBLE_DARK = '#1c1917';
const AMBER_BUBBLE_DARK_MUTED = 'rgba(28,25,23,0.75)';

/** Warm amber / golden — energetic accent */
const AMBER: ColorSchemePalette = {
  id: 'amber',
  primary: '#f59e0b',
  primaryBorder: withAlpha('#f59e0b', 0.2),
  primaryFocused: '#fbbf24',
  primaryMuted: withAlpha('#f59e0b', 0.4),
  primarySubtle: withAlpha('#f59e0b', 0.1),
  switchTrackOn: '#f59e0b',
  activeTabBg: '#f59e0b',
  inactiveTabBg: withAlpha('#f59e0b', 0.15),
  userBubbleBg: '#d97706',
  userBubbleCodeBg: 'rgba(28,25,23,0.12)',
  userBubbleHr: 'rgba(28,25,23,0.2)',
  userBubbleLink: '#78350f',
  userBubbleSubtleBg: 'rgba(28,25,23,0.08)',
  userBubbleTableBg: 'rgba(28,25,23,0.1)',
  userBubbleTableBorder: 'rgba(28,25,23,0.15)',
  userBubbleText: AMBER_BUBBLE_DARK,
  userBubbleTextMuted: AMBER_BUBBLE_DARK_MUTED,
  iconOnPrimary: AMBER_BUBBLE_DARK,
  markdownLink: '#f59e0b',
  chatAccentBadgeBg: withAlpha('#f59e0b', 0.12),
  chatAccentBadgeText: '#d97706',
  chatAccentChipBg: withAlpha('#f59e0b', 0.1),
  chatAccentChipBorder: withAlpha('#f59e0b', 0.2),
  chatAccentQuoteBorder: '#fbbf24',
  sourceMarket: '#f59e0b',
  sourceMarketMuted: withAlpha('#f59e0b', 0.12),
};

const AMBER_DARK: ColorSchemePalette = {
  id: 'amber',
  primary: '#fbbf24',
  primaryBorder: withAlpha('#fbbf24', 0.25),
  primaryFocused: '#fcd34d',
  primaryMuted: withAlpha('#fbbf24', 0.5),
  primarySubtle: withAlpha('#fbbf24', 0.12),
  switchTrackOn: '#fbbf24',
  activeTabBg: '#fbbf24',
  inactiveTabBg: withAlpha('#fbbf24', 0.18),
  userBubbleBg: '#f59e0b',
  userBubbleCodeBg: 'rgba(28,25,23,0.12)',
  userBubbleHr: 'rgba(28,25,23,0.2)',
  userBubbleLink: '#78350f',
  userBubbleSubtleBg: 'rgba(28,25,23,0.08)',
  userBubbleTableBg: 'rgba(28,25,23,0.1)',
  userBubbleTableBorder: 'rgba(28,25,23,0.15)',
  userBubbleText: AMBER_BUBBLE_DARK,
  userBubbleTextMuted: AMBER_BUBBLE_DARK_MUTED,
  iconOnPrimary: AMBER_BUBBLE_DARK,
  markdownLink: '#fbbf24',
  chatAccentBadgeBg: withAlpha('#fbbf24', 0.15),
  chatAccentBadgeText: '#fcd34d',
  chatAccentChipBg: withAlpha('#fbbf24', 0.12),
  chatAccentChipBorder: withAlpha('#fbbf24', 0.22),
  chatAccentQuoteBorder: '#fcd34d',
  sourceMarket: '#fbbf24',
  sourceMarketMuted: withAlpha('#fbbf24', 0.14),
};

const BLUE: ColorSchemePalette = {
  id: 'blue',
  primary: '#007aff',
  primaryBorder: 'rgba(0,122,255,0.16)',
  primaryFocused: '#4DA3FF',
  primaryMuted: 'rgba(0,122,255,0.35)',
  primarySubtle: 'rgba(0,122,255,0.08)',
  switchTrackOn: '#007aff',
  activeTabBg: '#007aff',
  inactiveTabBg: 'rgba(0,122,255,0.1)',
  userBubbleBg: '#0A84FF',
  userBubbleLink: '#b3d9ff',
  markdownLink: '#007aff',
  chatAccentBadgeBg: 'rgba(37,99,235,0.1)',
  chatAccentBadgeText: '#2563eb',
  chatAccentChipBg: 'rgba(37,99,235,0.08)',
  chatAccentChipBorder: 'rgba(37,99,235,0.16)',
  chatAccentQuoteBorder: '#3b82f6',
  sourceMarket: '#007aff',
  sourceMarketMuted: 'rgba(0,122,255,0.1)',
};

const VIOLET: ColorSchemePalette = {
  id: 'violet',
  primary: '#8b5cf6',
  primaryBorder: withAlpha('#8b5cf6', 0.2),
  primaryFocused: '#a78bfa',
  primaryMuted: withAlpha('#8b5cf6', 0.4),
  primarySubtle: withAlpha('#8b5cf6', 0.1),
  switchTrackOn: '#8b5cf6',
  activeTabBg: '#8b5cf6',
  inactiveTabBg: withAlpha('#8b5cf6', 0.15),
  userBubbleBg: '#7c3aed',
  userBubbleLink: '#c4b5fd',
  markdownLink: '#8b5cf6',
  chatAccentBadgeBg: withAlpha('#8b5cf6', 0.12),
  chatAccentBadgeText: '#7c3aed',
  chatAccentChipBg: withAlpha('#8b5cf6', 0.1),
  chatAccentChipBorder: withAlpha('#8b5cf6', 0.2),
  chatAccentQuoteBorder: '#a78bfa',
  sourceMarket: '#8b5cf6',
  sourceMarketMuted: withAlpha('#8b5cf6', 0.12),
};

const GREEN: ColorSchemePalette = {
  id: 'green',
  primary: '#10b981',
  primaryBorder: withAlpha('#10b981', 0.2),
  primaryFocused: '#34d399',
  primaryMuted: withAlpha('#10b981', 0.4),
  primarySubtle: withAlpha('#10b981', 0.1),
  switchTrackOn: '#10b981',
  activeTabBg: '#10b981',
  inactiveTabBg: withAlpha('#10b981', 0.15),
  userBubbleBg: '#059669',
  userBubbleLink: '#6ee7b7',
  markdownLink: '#10b981',
  chatAccentBadgeBg: withAlpha('#10b981', 0.12),
  chatAccentBadgeText: '#059669',
  chatAccentChipBg: withAlpha('#10b981', 0.1),
  chatAccentChipBorder: withAlpha('#10b981', 0.2),
  chatAccentQuoteBorder: '#34d399',
  sourceMarket: '#10b981',
  sourceMarketMuted: withAlpha('#10b981', 0.12),
};

/** Enterprise-oriented neutral gray-blue palette. Lighter in dark mode. */
const SLATE_LIGHT: ColorSchemePalette = {
  id: 'slate',
  primary: '#475569',
  primaryBorder: withAlpha('#475569', 0.2),
  primaryFocused: '#64748b',
  primaryMuted: withAlpha('#475569', 0.4),
  primarySubtle: withAlpha('#475569', 0.08),
  switchTrackOn: '#475569',
  activeTabBg: '#475569',
  inactiveTabBg: withAlpha('#475569', 0.12),
  userBubbleBg: '#334155',
  userBubbleLink: '#94a3b8',
  markdownLink: '#475569',
  chatAccentBadgeBg: withAlpha('#475569', 0.12),
  chatAccentBadgeText: '#334155',
  chatAccentChipBg: withAlpha('#475569', 0.08),
  chatAccentChipBorder: withAlpha('#475569', 0.16),
  chatAccentQuoteBorder: '#64748b',
  sourceMarket: '#475569',
  sourceMarketMuted: withAlpha('#475569', 0.1),
};

const SLATE_DARK: ColorSchemePalette = {
  id: 'slate',
  primary: '#94a3b8',
  primaryBorder: withAlpha('#94a3b8', 0.25),
  primaryFocused: '#cbd5e1',
  primaryMuted: withAlpha('#94a3b8', 0.5),
  primarySubtle: withAlpha('#94a3b8', 0.12),
  switchTrackOn: '#94a3b8',
  activeTabBg: '#94a3b8',
  inactiveTabBg: withAlpha('#94a3b8', 0.15),
  userBubbleBg: '#64748b',
  userBubbleLink: '#cbd5e1',
  markdownLink: '#94a3b8',
  chatAccentBadgeBg: withAlpha('#94a3b8', 0.15),
  chatAccentBadgeText: '#cbd5e1',
  chatAccentChipBg: withAlpha('#94a3b8', 0.12),
  chatAccentChipBorder: withAlpha('#94a3b8', 0.22),
  chatAccentQuoteBorder: '#cbd5e1',
  sourceMarket: '#94a3b8',
  sourceMarketMuted: withAlpha('#94a3b8', 0.14),
};

/** Violet palette. Brighter in dark mode. */
const VIOLET_LIGHT: ColorSchemePalette = {
  ...VIOLET,
};

const VIOLET_DARK: ColorSchemePalette = {
  id: 'violet',
  primary: '#a78bfa',
  primaryBorder: withAlpha('#a78bfa', 0.25),
  primaryFocused: '#c4b5fd',
  primaryMuted: withAlpha('#a78bfa', 0.5),
  primarySubtle: withAlpha('#a78bfa', 0.12),
  switchTrackOn: '#a78bfa',
  activeTabBg: '#a78bfa',
  inactiveTabBg: withAlpha('#a78bfa', 0.18),
  userBubbleBg: '#8b5cf6',
  userBubbleLink: '#ddd6fe',
  markdownLink: '#a78bfa',
  chatAccentBadgeBg: withAlpha('#a78bfa', 0.15),
  chatAccentBadgeText: '#c4b5fd',
  chatAccentChipBg: withAlpha('#a78bfa', 0.12),
  chatAccentChipBorder: withAlpha('#a78bfa', 0.22),
  chatAccentQuoteBorder: '#c4b5fd',
  sourceMarket: '#a78bfa',
  sourceMarketMuted: withAlpha('#a78bfa', 0.14),
};

/** Morandi dusty rose — soft muted pink */
const ROSE: ColorSchemePalette = {
  id: 'rose',
  primary: '#c9a9a6',
  primaryBorder: withAlpha('#c9a9a6', 0.25),
  primaryFocused: '#d4b8b5',
  primaryMuted: withAlpha('#c9a9a6', 0.45),
  primarySubtle: withAlpha('#c9a9a6', 0.1),
  switchTrackOn: '#c9a9a6',
  activeTabBg: '#c9a9a6',
  inactiveTabBg: withAlpha('#c9a9a6', 0.14),
  userBubbleBg: '#b87d7a',
  userBubbleLink: '#e8d4d2',
  markdownLink: '#c9a9a6',
  chatAccentBadgeBg: withAlpha('#c9a9a6', 0.14),
  chatAccentBadgeText: '#b87d7a',
  chatAccentChipBg: withAlpha('#c9a9a6', 0.1),
  chatAccentChipBorder: withAlpha('#c9a9a6', 0.2),
  chatAccentQuoteBorder: '#d4b8b5',
  sourceMarket: '#c9a9a6',
  sourceMarketMuted: withAlpha('#c9a9a6', 0.12),
};

/** Morandi sage green — muted dusty green */
const SAGE: ColorSchemePalette = {
  id: 'sage',
  primary: '#9ca88f',
  primaryBorder: withAlpha('#9ca88f', 0.25),
  primaryFocused: '#b5c0a8',
  primaryMuted: withAlpha('#9ca88f', 0.45),
  primarySubtle: withAlpha('#9ca88f', 0.1),
  switchTrackOn: '#9ca88f',
  activeTabBg: '#9ca88f',
  inactiveTabBg: withAlpha('#9ca88f', 0.14),
  userBubbleBg: '#7d8a6e',
  userBubbleLink: '#d4ddc8',
  markdownLink: '#9ca88f',
  chatAccentBadgeBg: withAlpha('#9ca88f', 0.14),
  chatAccentBadgeText: '#7d8a6e',
  chatAccentChipBg: withAlpha('#9ca88f', 0.1),
  chatAccentChipBorder: withAlpha('#9ca88f', 0.2),
  chatAccentQuoteBorder: '#b5c0a8',
  sourceMarket: '#9ca88f',
  sourceMarketMuted: withAlpha('#9ca88f', 0.12),
};

/** Morandi dusty blue — soft muted blue-gray */
const DUST_BLUE: ColorSchemePalette = {
  id: 'dustBlue',
  primary: '#8b9dc3',
  primaryBorder: withAlpha('#8b9dc3', 0.25),
  primaryFocused: '#a8b5d4',
  primaryMuted: withAlpha('#8b9dc3', 0.45),
  primarySubtle: withAlpha('#8b9dc3', 0.1),
  switchTrackOn: '#8b9dc3',
  activeTabBg: '#8b9dc3',
  inactiveTabBg: withAlpha('#8b9dc3', 0.14),
  userBubbleBg: '#6b7da8',
  userBubbleLink: '#c8d0e8',
  markdownLink: '#8b9dc3',
  chatAccentBadgeBg: withAlpha('#8b9dc3', 0.14),
  chatAccentBadgeText: '#6b7da8',
  chatAccentChipBg: withAlpha('#8b9dc3', 0.1),
  chatAccentChipBorder: withAlpha('#8b9dc3', 0.2),
  chatAccentQuoteBorder: '#a8b5d4',
  sourceMarket: '#8b9dc3',
  sourceMarketMuted: withAlpha('#8b9dc3', 0.12),
};

const paletteMap: Record<
  ColorSchemeId,
  { light: ColorSchemePalette; dark: ColorSchemePalette }
> = {
  amber: { light: AMBER, dark: AMBER_DARK },
  blue: { light: BLUE, dark: BLUE },
  dustBlue: { light: DUST_BLUE, dark: DUST_BLUE },
  green: { light: GREEN, dark: GREEN },
  rose: { light: ROSE, dark: ROSE },
  sage: { light: SAGE, dark: SAGE },
  slate: { light: SLATE_LIGHT, dark: SLATE_DARK },
  violet: { light: VIOLET_LIGHT, dark: VIOLET_DARK },
};

export const COLOR_SCHEMES: Record<ColorSchemeId, ColorSchemePalette> = {
  amber: AMBER,
  blue: BLUE,
  dustBlue: DUST_BLUE,
  green: GREEN,
  rose: ROSE,
  sage: SAGE,
  slate: SLATE_LIGHT,
  violet: VIOLET_LIGHT,
};

export function getColorSchemePalette(
  id: ColorSchemeId,
  theme: EffectiveTheme = 'light',
): ColorSchemePalette {
  const entry = paletteMap[id];
  if (!entry) return paletteMap.blue.light;
  return theme === 'dark' ? entry.dark : entry.light;
}
