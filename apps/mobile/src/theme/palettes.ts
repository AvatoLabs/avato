/**
 * Color scheme palettes — accent/brand colors for theming.
 * Each palette defines primary, user bubble, chat accent, and source badge colors.
 * Combined with base (light/dark) tokens to produce full ColorTokens.
 */
export type ColorSchemeId = 'blue' | 'violet' | 'green' | 'slate';

export interface ColorSchemePalette {
  activeTabBg: string;
  chatAccentBadgeBg: string;
  chatAccentBadgeText: string;
  chatAccentChipBg: string;
  chatAccentChipBorder: string;
  chatAccentQuoteBorder: string;
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
  userBubbleLink: string;
}

function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

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

/** Enterprise-oriented neutral gray-blue palette */
const SLATE: ColorSchemePalette = {
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

export const COLOR_SCHEMES: Record<ColorSchemeId, ColorSchemePalette> = {
  blue: BLUE,
  violet: VIOLET,
  green: GREEN,
  slate: SLATE,
};

export function getColorSchemePalette(id: ColorSchemeId): ColorSchemePalette {
  return COLOR_SCHEMES[id];
}
