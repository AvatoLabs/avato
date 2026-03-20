/**
 * Color scheme palettes — accent/brand colors for theming.
 * Each palette defines primary, user bubble, chat accent, and source badge colors.
 * Combined with base (light/dark) tokens to produce full ColorTokens.
 * Every scheme has a dedicated dark variant to avoid washed-out or neon-heavy night palettes.
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
  primary: '#d49a2a',
  primaryBorder: withAlpha('#d49a2a', 0.24),
  primaryFocused: '#e2ae49',
  primaryMuted: withAlpha('#d49a2a', 0.42),
  primarySubtle: withAlpha('#d49a2a', 0.14),
  switchTrackOn: '#d49a2a',
  activeTabBg: '#c8891d',
  inactiveTabBg: withAlpha('#d49a2a', 0.16),
  userBubbleBg: '#b96f14',
  userBubbleCodeBg: 'rgba(28,25,23,0.14)',
  userBubbleHr: 'rgba(28,25,23,0.22)',
  userBubbleLink: '#61380d',
  userBubbleSubtleBg: 'rgba(28,25,23,0.1)',
  userBubbleTableBg: 'rgba(28,25,23,0.12)',
  userBubbleTableBorder: 'rgba(28,25,23,0.18)',
  userBubbleText: AMBER_BUBBLE_DARK,
  userBubbleTextMuted: AMBER_BUBBLE_DARK_MUTED,
  iconOnPrimary: AMBER_BUBBLE_DARK,
  markdownLink: '#b96f14',
  chatAccentBadgeBg: withAlpha('#d49a2a', 0.14),
  chatAccentBadgeText: '#a46212',
  chatAccentChipBg: withAlpha('#d49a2a', 0.12),
  chatAccentChipBorder: withAlpha('#d49a2a', 0.22),
  chatAccentQuoteBorder: '#e2ae49',
  sourceMarket: '#c8891d',
  sourceMarketMuted: withAlpha('#d49a2a', 0.14),
};

const AMBER_DARK: ColorSchemePalette = {
  id: 'amber',
  primary: '#f8c65c',
  primaryBorder: withAlpha('#f8c65c', 0.28),
  primaryFocused: '#fbd88a',
  primaryMuted: withAlpha('#f8c65c', 0.38),
  primarySubtle: withAlpha('#f8c65c', 0.16),
  switchTrackOn: '#f8c65c',
  activeTabBg: '#edb447',
  inactiveTabBg: withAlpha('#f8c65c', 0.22),
  userBubbleBg: '#c8841f',
  userBubbleCodeBg: 'rgba(28,25,23,0.12)',
  userBubbleHr: 'rgba(28,25,23,0.2)',
  userBubbleLink: '#78350f',
  userBubbleSubtleBg: 'rgba(28,25,23,0.08)',
  userBubbleTableBg: 'rgba(28,25,23,0.1)',
  userBubbleTableBorder: 'rgba(28,25,23,0.15)',
  userBubbleText: AMBER_BUBBLE_DARK,
  userBubbleTextMuted: AMBER_BUBBLE_DARK_MUTED,
  iconOnPrimary: AMBER_BUBBLE_DARK,
  markdownLink: '#f8c65c',
  chatAccentBadgeBg: withAlpha('#f8c65c', 0.18),
  chatAccentBadgeText: '#f7d892',
  chatAccentChipBg: withAlpha('#f8c65c', 0.14),
  chatAccentChipBorder: withAlpha('#f8c65c', 0.24),
  chatAccentQuoteBorder: '#f7d892',
  sourceMarket: '#f8c65c',
  sourceMarketMuted: withAlpha('#f8c65c', 0.16),
};

const BLUE: ColorSchemePalette = {
  id: 'blue',
  primary: '#2563eb',
  primaryBorder: withAlpha('#2563eb', 0.2),
  primaryFocused: '#4f84f3',
  primaryMuted: withAlpha('#2563eb', 0.36),
  primarySubtle: withAlpha('#2563eb', 0.1),
  switchTrackOn: '#2563eb',
  activeTabBg: '#1d4ed8',
  inactiveTabBg: withAlpha('#2563eb', 0.12),
  userBubbleBg: '#1d4ed8',
  userBubbleLink: '#dbeafe',
  markdownLink: '#1d4ed8',
  chatAccentBadgeBg: withAlpha('#2563eb', 0.12),
  chatAccentBadgeText: '#1d4ed8',
  chatAccentChipBg: withAlpha('#2563eb', 0.1),
  chatAccentChipBorder: withAlpha('#2563eb', 0.18),
  chatAccentQuoteBorder: '#4f84f3',
  sourceMarket: '#2563eb',
  sourceMarketMuted: withAlpha('#2563eb', 0.12),
};

const BLUE_DARK: ColorSchemePalette = {
  id: 'blue',
  primary: '#3976bf',
  primaryBorder: withAlpha('#6eb8ff', 0.3),
  primaryFocused: '#5b94da',
  primaryMuted: withAlpha('#6eb8ff', 0.42),
  primarySubtle: withAlpha('#6eb8ff', 0.18),
  switchTrackOn: '#3976bf',
  activeTabBg: '#356fb5',
  inactiveTabBg: withAlpha('#6eb8ff', 0.24),
  userBubbleBg: '#2c6fbd',
  userBubbleLink: '#d9ecff',
  markdownLink: '#7bc0ff',
  chatAccentBadgeBg: withAlpha('#6eb8ff', 0.18),
  chatAccentBadgeText: '#a8d6ff',
  chatAccentChipBg: withAlpha('#6eb8ff', 0.14),
  chatAccentChipBorder: withAlpha('#6eb8ff', 0.26),
  chatAccentQuoteBorder: '#8ccbff',
  sourceMarket: '#62b2ff',
  sourceMarketMuted: withAlpha('#62b2ff', 0.16),
};

const VIOLET: ColorSchemePalette = {
  id: 'violet',
  primary: '#7c4ee0',
  primaryBorder: withAlpha('#7c4ee0', 0.22),
  primaryFocused: '#9a76ea',
  primaryMuted: withAlpha('#7c4ee0', 0.4),
  primarySubtle: withAlpha('#7c4ee0', 0.11),
  switchTrackOn: '#7c4ee0',
  activeTabBg: '#6d35d1',
  inactiveTabBg: withAlpha('#7c4ee0', 0.14),
  userBubbleBg: '#6d35d1',
  userBubbleLink: '#ede9fe',
  markdownLink: '#6d35d1',
  chatAccentBadgeBg: withAlpha('#7c4ee0', 0.13),
  chatAccentBadgeText: '#6d35d1',
  chatAccentChipBg: withAlpha('#7c4ee0', 0.1),
  chatAccentChipBorder: withAlpha('#7c4ee0', 0.2),
  chatAccentQuoteBorder: '#9a76ea',
  sourceMarket: '#7c4ee0',
  sourceMarketMuted: withAlpha('#7c4ee0', 0.13),
};

const GREEN: ColorSchemePalette = {
  id: 'green',
  primary: '#2f9b74',
  primaryBorder: withAlpha('#2f9b74', 0.22),
  primaryFocused: '#53b48f',
  primaryMuted: withAlpha('#2f9b74', 0.4),
  primarySubtle: withAlpha('#2f9b74', 0.12),
  switchTrackOn: '#2f9b74',
  activeTabBg: '#237a5d',
  inactiveTabBg: withAlpha('#2f9b74', 0.14),
  userBubbleBg: '#237a5d',
  userBubbleLink: '#dcfce7',
  markdownLink: '#237a5d',
  chatAccentBadgeBg: withAlpha('#2f9b74', 0.13),
  chatAccentBadgeText: '#237a5d',
  chatAccentChipBg: withAlpha('#2f9b74', 0.1),
  chatAccentChipBorder: withAlpha('#2f9b74', 0.2),
  chatAccentQuoteBorder: '#53b48f',
  sourceMarket: '#2f9b74',
  sourceMarketMuted: withAlpha('#2f9b74', 0.13),
  iconOnPrimary: '#102418',
};

const GREEN_DARK: ColorSchemePalette = {
  id: 'green',
  primary: '#25845b',
  primaryBorder: withAlpha('#5ed8a2', 0.3),
  primaryFocused: '#39ad78',
  primaryMuted: withAlpha('#5ed8a2', 0.42),
  primarySubtle: withAlpha('#5ed8a2', 0.18),
  switchTrackOn: '#25845b',
  activeTabBg: '#217957',
  inactiveTabBg: withAlpha('#5ed8a2', 0.24),
  userBubbleBg: '#1f8e67',
  userBubbleLink: '#d8f8e8',
  markdownLink: '#6cddaa',
  chatAccentBadgeBg: withAlpha('#5ed8a2', 0.18),
  chatAccentBadgeText: '#a3f1cb',
  chatAccentChipBg: withAlpha('#5ed8a2', 0.14),
  chatAccentChipBorder: withAlpha('#5ed8a2', 0.24),
  chatAccentQuoteBorder: '#88e5bc',
  sourceMarket: '#5ed8a2',
  sourceMarketMuted: withAlpha('#5ed8a2', 0.16),
};

/** Enterprise-oriented neutral gray-blue palette. Lighter in dark mode. */
const SLATE_LIGHT: ColorSchemePalette = {
  id: 'slate',
  primary: '#5b6d82',
  primaryBorder: withAlpha('#5b6d82', 0.22),
  primaryFocused: '#7889a0',
  primaryMuted: withAlpha('#5b6d82', 0.38),
  primarySubtle: withAlpha('#5b6d82', 0.1),
  switchTrackOn: '#5b6d82',
  activeTabBg: '#45576b',
  inactiveTabBg: withAlpha('#5b6d82', 0.13),
  userBubbleBg: '#45576b',
  userBubbleLink: '#e2e8f0',
  markdownLink: '#45576b',
  chatAccentBadgeBg: withAlpha('#5b6d82', 0.13),
  chatAccentBadgeText: '#45576b',
  chatAccentChipBg: withAlpha('#5b6d82', 0.09),
  chatAccentChipBorder: withAlpha('#5b6d82', 0.18),
  chatAccentQuoteBorder: '#7889a0',
  sourceMarket: '#5b6d82',
  sourceMarketMuted: withAlpha('#5b6d82', 0.12),
};

const SLATE_DARK: ColorSchemePalette = {
  id: 'slate',
  primary: '#69778c',
  primaryBorder: withAlpha('#b7c4d7', 0.3),
  primaryFocused: '#8d9ab0',
  primaryMuted: withAlpha('#b7c4d7', 0.42),
  primarySubtle: withAlpha('#b7c4d7', 0.18),
  switchTrackOn: '#69778c',
  activeTabBg: '#617085',
  inactiveTabBg: withAlpha('#b7c4d7', 0.22),
  userBubbleBg: '#5b687c',
  userBubbleLink: '#e1e8f2',
  markdownLink: '#c7d2e1',
  chatAccentBadgeBg: withAlpha('#b7c4d7', 0.18),
  chatAccentBadgeText: '#d6e0ee',
  chatAccentChipBg: withAlpha('#b7c4d7', 0.14),
  chatAccentChipBorder: withAlpha('#b7c4d7', 0.24),
  chatAccentQuoteBorder: '#d6e0ee',
  sourceMarket: '#b7c4d7',
  sourceMarketMuted: withAlpha('#b7c4d7', 0.16),
};

/** Violet palette. Brighter in dark mode. */
const VIOLET_LIGHT: ColorSchemePalette = {
  ...VIOLET,
};

const VIOLET_DARK: ColorSchemePalette = {
  id: 'violet',
  primary: '#875fd6',
  primaryBorder: withAlpha('#c09bff', 0.3),
  primaryFocused: '#ab86f0',
  primaryMuted: withAlpha('#c09bff', 0.42),
  primarySubtle: withAlpha('#c09bff', 0.18),
  switchTrackOn: '#875fd6',
  activeTabBg: '#7a54c2',
  inactiveTabBg: withAlpha('#c09bff', 0.24),
  userBubbleBg: '#7244d8',
  userBubbleLink: '#eadfff',
  markdownLink: '#c8a8ff',
  chatAccentBadgeBg: withAlpha('#c09bff', 0.18),
  chatAccentBadgeText: '#dcc5ff',
  chatAccentChipBg: withAlpha('#c09bff', 0.14),
  chatAccentChipBorder: withAlpha('#c09bff', 0.26),
  chatAccentQuoteBorder: '#d9c3ff',
  sourceMarket: '#bf9bff',
  sourceMarketMuted: withAlpha('#bf9bff', 0.16),
};

/** Morandi dusty rose — soft muted pink */
const ROSE: ColorSchemePalette = {
  id: 'rose',
  primary: '#c48c97',
  primaryBorder: withAlpha('#c48c97', 0.26),
  primaryFocused: '#d6a8b1',
  primaryMuted: withAlpha('#c48c97', 0.46),
  primarySubtle: withAlpha('#c48c97', 0.12),
  switchTrackOn: '#c48c97',
  activeTabBg: '#a76474',
  inactiveTabBg: withAlpha('#c48c97', 0.16),
  userBubbleBg: '#995b68',
  userBubbleLink: '#fdecef',
  markdownLink: '#a76474',
  chatAccentBadgeBg: withAlpha('#c48c97', 0.15),
  chatAccentBadgeText: '#995b68',
  chatAccentChipBg: withAlpha('#c48c97', 0.11),
  chatAccentChipBorder: withAlpha('#c48c97', 0.21),
  chatAccentQuoteBorder: '#d6a8b1',
  sourceMarket: '#b87582',
  sourceMarketMuted: withAlpha('#c48c97', 0.13),
  iconOnPrimary: '#1f2937',
};

const ROSE_DARK: ColorSchemePalette = {
  id: 'rose',
  primary: '#996965',
  primaryBorder: withAlpha('#e0b7b4', 0.3),
  primaryFocused: '#bb8b86',
  primaryMuted: withAlpha('#e0b7b4', 0.42),
  primarySubtle: withAlpha('#e0b7b4', 0.18),
  switchTrackOn: '#996965',
  activeTabBg: '#8d5f5b',
  inactiveTabBg: withAlpha('#e0b7b4', 0.24),
  userBubbleBg: '#976b68',
  userBubbleLink: '#f3dedc',
  markdownLink: '#e8c2bf',
  chatAccentBadgeBg: withAlpha('#e0b7b4', 0.18),
  chatAccentBadgeText: '#edd0cd',
  chatAccentChipBg: withAlpha('#e0b7b4', 0.14),
  chatAccentChipBorder: withAlpha('#e0b7b4', 0.24),
  chatAccentQuoteBorder: '#ebcdca',
  sourceMarket: '#e0b7b4',
  sourceMarketMuted: withAlpha('#e0b7b4', 0.16),
};

/** Morandi sage green — muted dusty green */
const SAGE: ColorSchemePalette = {
  id: 'sage',
  primary: '#91a47f',
  primaryBorder: withAlpha('#91a47f', 0.26),
  primaryFocused: '#acbd9a',
  primaryMuted: withAlpha('#91a47f', 0.46),
  primarySubtle: withAlpha('#91a47f', 0.12),
  switchTrackOn: '#91a47f',
  activeTabBg: '#6f8560',
  inactiveTabBg: withAlpha('#91a47f', 0.16),
  userBubbleBg: '#647755',
  userBubbleLink: '#edf5e7',
  markdownLink: '#6f8560',
  chatAccentBadgeBg: withAlpha('#91a47f', 0.15),
  chatAccentBadgeText: '#647755',
  chatAccentChipBg: withAlpha('#91a47f', 0.11),
  chatAccentChipBorder: withAlpha('#91a47f', 0.2),
  chatAccentQuoteBorder: '#acbd9a',
  sourceMarket: '#7c916c',
  sourceMarketMuted: withAlpha('#91a47f', 0.13),
  iconOnPrimary: '#1d2718',
};

const SAGE_DARK: ColorSchemePalette = {
  id: 'sage',
  primary: '#6d7b5d',
  primaryBorder: withAlpha('#b8c5a9', 0.3),
  primaryFocused: '#8d9b7d',
  primaryMuted: withAlpha('#b8c5a9', 0.42),
  primarySubtle: withAlpha('#b8c5a9', 0.18),
  switchTrackOn: '#6d7b5d',
  activeTabBg: '#647255',
  inactiveTabBg: withAlpha('#b8c5a9', 0.24),
  userBubbleBg: '#69765b',
  userBubbleLink: '#e4ecd8',
  markdownLink: '#c3d1b3',
  chatAccentBadgeBg: withAlpha('#b8c5a9', 0.18),
  chatAccentBadgeText: '#dce6cf',
  chatAccentChipBg: withAlpha('#b8c5a9', 0.14),
  chatAccentChipBorder: withAlpha('#b8c5a9', 0.24),
  chatAccentQuoteBorder: '#d1dbc4',
  sourceMarket: '#b8c5a9',
  sourceMarketMuted: withAlpha('#b8c5a9', 0.16),
};

/** Morandi dusty blue — soft muted blue-gray */
const DUST_BLUE: ColorSchemePalette = {
  id: 'dustBlue',
  primary: '#7f95c1',
  primaryBorder: withAlpha('#7f95c1', 0.26),
  primaryFocused: '#9db0d5',
  primaryMuted: withAlpha('#7f95c1', 0.46),
  primarySubtle: withAlpha('#7f95c1', 0.12),
  switchTrackOn: '#7f95c1',
  activeTabBg: '#5d74a2',
  inactiveTabBg: withAlpha('#7f95c1', 0.16),
  userBubbleBg: '#5d74a2',
  userBubbleLink: '#eef3ff',
  markdownLink: '#5d74a2',
  chatAccentBadgeBg: withAlpha('#7f95c1', 0.15),
  chatAccentBadgeText: '#4f6796',
  chatAccentChipBg: withAlpha('#7f95c1', 0.11),
  chatAccentChipBorder: withAlpha('#7f95c1', 0.21),
  chatAccentQuoteBorder: '#9db0d5',
  sourceMarket: '#6d84b3',
  sourceMarketMuted: withAlpha('#7f95c1', 0.13),
  iconOnPrimary: '#172033',
};

const DUST_BLUE_DARK: ColorSchemePalette = {
  id: 'dustBlue',
  primary: '#6274a0',
  primaryBorder: withAlpha('#b4c4e8', 0.3),
  primaryFocused: '#8397c7',
  primaryMuted: withAlpha('#b4c4e8', 0.42),
  primarySubtle: withAlpha('#b4c4e8', 0.18),
  switchTrackOn: '#6274a0',
  activeTabBg: '#586993',
  inactiveTabBg: withAlpha('#b4c4e8', 0.24),
  userBubbleBg: '#6376a2',
  userBubbleLink: '#e1e8f8',
  markdownLink: '#c1cff0',
  chatAccentBadgeBg: withAlpha('#b4c4e8', 0.18),
  chatAccentBadgeText: '#d2dcf5',
  chatAccentChipBg: withAlpha('#b4c4e8', 0.14),
  chatAccentChipBorder: withAlpha('#b4c4e8', 0.24),
  chatAccentQuoteBorder: '#d5dff7',
  sourceMarket: '#b4c4e8',
  sourceMarketMuted: withAlpha('#b4c4e8', 0.16),
};

const paletteMap: Record<ColorSchemeId, { light: ColorSchemePalette; dark: ColorSchemePalette }> = {
  amber: { light: AMBER, dark: AMBER_DARK },
  blue: { light: BLUE, dark: BLUE_DARK },
  dustBlue: { light: DUST_BLUE, dark: DUST_BLUE_DARK },
  green: { light: GREEN, dark: GREEN_DARK },
  rose: { light: ROSE, dark: ROSE_DARK },
  sage: { light: SAGE, dark: SAGE_DARK },
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
