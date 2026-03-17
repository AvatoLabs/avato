/**
 * Unified color tokens for theming.
 * All UI colors should reference these tokens — no hardcoded hex/rgba in components.
 * Add new theme variants (e.g. dark) by extending this structure.
 */
import { useThemeStore } from '../store/theme';

export interface ColorTokens {
  activeTabBg: string;
  assistantBubbleBg: string;
  assistantBubbleBorder: string;
  assistantBubbleText: string;
  // ── Base ─────────────────────────────────────────────────────────────
  background: string;

  // ── Borders & Dividers ────────────────────────────────────────────────
  border: string;
  borderDefault: string;
  borderSubtle: string;
  card: string;
  chatAccentBadgeBg: string;

  chatAccentBadgeText: string;
  chatAccentChipBg: string;
  chatAccentChipBorder: string;
  chatAccentQuoteBorder: string;
  chatAccentSectionBg: string;
  chatAccentSectionBorder: string;
  chatAccentSubtleBg: string;
  danger: string;
  dangerMuted: string;
  dangerSubtle: string;
  divider: string;
  fillQuaternary: string;

  // ── Surfaces (overlays, chips) ────────────────────────────────────────
  fillTertiary: string;
  foreground: string;
  iconDanger: string;
  iconMuted: string;

  // ── Icons (on light/dark surfaces) ────────────────────────────────────
  iconOnPrimary: string;
  iconOnSurface: string;
  iconSuccess: string;
  iconWarning: string;

  inactiveTabBg: string;
  info: string;
  infoMuted: string;
  infoSubtle: string;

  markdownCodeBlockBg: string;
  markdownCodeInlineBg: string;
  markdownCodeInlineColor: string;
  markdownHeading: string;
  markdownLink: string;

  // ── Markdown / Code ───────────────────────────────────────────────────
  markdownText: string;
  // ── Neutral / Text ───────────────────────────────────────────────────
  muted: string;
  overlay: string;
  overlayDark: string;
  placeholder: string;
  // ── Primary / Brand ──────────────────────────────────────────────────
  primary: string;

  primaryBorder: string;
  primaryFocused: string;
  primaryMuted: string;
  primarySubtle: string;
  secondaryText: string;
  // ── Source badges (builtin, market, custom) ────────────────────────────
  sourceBuiltin: string;
  sourceBuiltinMuted: string;
  sourceCustom: string;
  sourceCustomMuted: string;
  sourceMarket: string;
  sourceMarketMuted: string;
  // ── Semantic ─────────────────────────────────────────────────────────
  success: string;
  successMuted: string;
  successSubtle: string;
  surface: string;
  surfaceElevated: string;
  // ── Interactive states ────────────────────────────────────────────────
  switchTrackOff: string;
  switchTrackOffAlt: string;
  switchTrackOn: string;
  tertiaryText: string;

  // ── Chat / Message bubble ─────────────────────────────────────────────
  userBubbleBg: string;
  userBubbleCodeBg: string;
  userBubbleHr: string;
  userBubbleLink: string;
  userBubbleSubtleBg: string;
  userBubbleTableBg: string;

  userBubbleTableBorder: string;
  userBubbleText: string;
  userBubbleTextMuted: string;
  warning: string;
  warningMuted: string;
  warningSubtle: string;
}

const lightTokens: ColorTokens = {
  background: '#ffffff',
  foreground: '#111111',
  surface: '#ffffff',
  surfaceElevated: '#ffffff',
  card: '#ffffff',

  primary: '#007aff',
  primaryBorder: 'rgba(0,122,255,0.16)',
  primaryFocused: '#4DA3FF',
  primaryMuted: 'rgba(0,122,255,0.35)',
  primarySubtle: 'rgba(0,122,255,0.08)',

  success: '#34C759',
  successMuted: 'rgba(52,199,89,0.1)',
  successSubtle: 'rgba(52,199,89,0.04)',
  danger: '#FF3B30',
  dangerMuted: 'rgba(255,59,48,0.12)',
  dangerSubtle: 'rgba(255,59,48,0.06)',
  warning: '#FF9500',
  warningMuted: 'rgba(255,149,0,0.12)',
  warningSubtle: 'rgba(255,149,0,0.06)',
  info: '#0A84FF',
  infoMuted: 'rgba(10,132,255,0.1)',
  infoSubtle: 'rgba(10,132,255,0.04)',

  muted: '#8c8c8c',
  secondaryText: '#9ca3af',
  tertiaryText: '#8E8E93',
  placeholder: '#8c8c8c',

  border: 'rgba(0,0,0,0.05)',
  borderDefault: '#d9d9d9',
  borderSubtle: 'rgba(0,0,0,0.04)',
  divider: 'rgba(0,0,0,0.05)',

  fillTertiary: 'rgba(0,0,0,0.04)',
  fillQuaternary: 'rgba(0,0,0,0.02)',
  overlay: 'rgba(255,255,255,0.92)',
  overlayDark: 'rgba(0,0,0,0.6)',

  switchTrackOff: '#e5e5e5',
  switchTrackOffAlt: 'rgba(120,120,128,0.18)',
  switchTrackOn: '#007aff',
  activeTabBg: '#007aff',
  inactiveTabBg: 'rgba(0,122,255,0.1)',

  markdownText: '#1a1a1a',
  markdownHeading: '#111111',
  markdownCodeInlineBg: 'rgba(0,0,0,0.05)',
  markdownCodeInlineColor: '#e83e8c',
  markdownCodeBlockBg: '#f5f5f5',
  markdownLink: '#007aff',

  userBubbleBg: '#0A84FF',
  userBubbleText: '#ffffff',
  userBubbleTextMuted: 'rgba(255,255,255,0.7)',
  userBubbleCodeBg: 'rgba(255,255,255,0.2)',
  userBubbleLink: '#b3d9ff',
  userBubbleSubtleBg: 'rgba(255,255,255,0.14)',
  userBubbleTableBg: 'rgba(255,255,255,0.12)',
  userBubbleTableBorder: 'rgba(255,255,255,0.1)',
  userBubbleHr: 'rgba(255,255,255,0.15)',
  assistantBubbleBg: '#ffffff',
  assistantBubbleBorder: 'rgba(15,23,42,0.06)',
  assistantBubbleText: '#1a1a1a',
  chatAccentBadgeBg: 'rgba(37,99,235,0.1)',
  chatAccentBadgeText: '#2563eb',
  chatAccentChipBg: 'rgba(37,99,235,0.08)',
  chatAccentChipBorder: 'rgba(37,99,235,0.16)',
  chatAccentQuoteBorder: '#3b82f6',
  chatAccentSectionBg: '#ffffff',
  chatAccentSectionBorder: 'rgba(15,23,42,0.06)',
  chatAccentSubtleBg: 'rgba(15,23,42,0.035)',

  iconOnPrimary: '#ffffff',
  iconOnSurface: '#111111',
  iconMuted: '#999999',
  iconSuccess: '#34C759',
  iconDanger: '#FF3B30',
  iconWarning: '#f5a623',

  sourceBuiltin: '#059669',
  sourceBuiltinMuted: 'rgba(5,150,105,0.12)',
  sourceMarket: '#007aff',
  sourceMarketMuted: 'rgba(0,122,255,0.1)',
  sourceCustom: '#ea580c',
  sourceCustomMuted: 'rgba(234,88,12,0.12)',
};

const darkTokens: ColorTokens = {
  background: '#000000',
  foreground: '#f5f5f7',
  surface: '#1c1c1e',
  surfaceElevated: '#2c2c2e',
  card: '#1c1c1e',

  primary: '#0a84ff',
  primaryBorder: 'rgba(10,132,255,0.3)',
  primaryFocused: '#409cff',
  primaryMuted: 'rgba(10,132,255,0.4)',
  primarySubtle: 'rgba(10,132,255,0.15)',

  success: '#30d158',
  successMuted: 'rgba(48,209,88,0.2)',
  successSubtle: 'rgba(48,209,88,0.08)',
  danger: '#ff453a',
  dangerMuted: 'rgba(255,69,58,0.2)',
  dangerSubtle: 'rgba(255,69,58,0.1)',
  warning: '#ff9f0a',
  warningMuted: 'rgba(255,159,10,0.2)',
  warningSubtle: 'rgba(255,159,10,0.1)',
  info: '#64d2ff',
  infoMuted: 'rgba(100,210,255,0.2)',
  infoSubtle: 'rgba(100,210,255,0.1)',

  muted: '#8e8e93',
  secondaryText: '#98989f',
  tertiaryText: '#636366',
  placeholder: '#8e8e93',

  border: 'rgba(255,255,255,0.08)',
  borderDefault: '#38383a',
  borderSubtle: 'rgba(255,255,255,0.06)',
  divider: 'rgba(255,255,255,0.08)',

  fillTertiary: 'rgba(255,255,255,0.06)',
  fillQuaternary: 'rgba(255,255,255,0.04)',
  overlay: 'rgba(28,28,30,0.95)',
  overlayDark: 'rgba(0,0,0,0.7)',

  switchTrackOff: '#38383a',
  switchTrackOffAlt: 'rgba(120,120,128,0.32)',
  switchTrackOn: '#0a84ff',
  activeTabBg: '#0a84ff',
  inactiveTabBg: 'rgba(10,132,255,0.2)',

  markdownText: '#f5f5f7',
  markdownHeading: '#ffffff',
  markdownCodeInlineBg: 'rgba(255,255,255,0.12)',
  markdownCodeInlineColor: '#ff7eb6',
  markdownCodeBlockBg: '#2c2c2e',
  markdownLink: '#64d2ff',

  userBubbleBg: '#0a84ff',
  userBubbleText: '#ffffff',
  userBubbleTextMuted: 'rgba(255,255,255,0.8)',
  userBubbleCodeBg: 'rgba(255,255,255,0.2)',
  userBubbleLink: '#7fc8ff',
  userBubbleSubtleBg: 'rgba(255,255,255,0.15)',
  userBubbleTableBg: 'rgba(255,255,255,0.1)',
  userBubbleTableBorder: 'rgba(255,255,255,0.12)',
  userBubbleHr: 'rgba(255,255,255,0.2)',
  assistantBubbleBg: '#2c2c2e',
  assistantBubbleBorder: 'rgba(255,255,255,0.08)',
  assistantBubbleText: '#f5f5f7',
  chatAccentBadgeBg: 'rgba(100,210,255,0.2)',
  chatAccentBadgeText: '#64d2ff',
  chatAccentChipBg: 'rgba(100,210,255,0.15)',
  chatAccentChipBorder: 'rgba(100,210,255,0.3)',
  chatAccentQuoteBorder: '#64d2ff',
  chatAccentSectionBg: '#2c2c2e',
  chatAccentSectionBorder: 'rgba(255,255,255,0.08)',
  chatAccentSubtleBg: 'rgba(255,255,255,0.06)',

  iconOnPrimary: '#ffffff',
  iconOnSurface: '#f5f5f7',
  iconMuted: '#8e8e93',
  iconSuccess: '#30d158',
  iconDanger: '#ff453a',
  iconWarning: '#ff9f0a',

  sourceBuiltin: '#30d158',
  sourceBuiltinMuted: 'rgba(48,209,88,0.2)',
  sourceMarket: '#0a84ff',
  sourceMarketMuted: 'rgba(10,132,255,0.2)',
  sourceCustom: '#ff9f0a',
  sourceCustomMuted: 'rgba(255,159,10,0.2)',
};

// Additional tokens for specific UI patterns
export const uiColors = {
  inputBg: '#f8f8fa',
  sliderThumb: '#007aff',
  sliderTrack: '#e0e0e0',
  sliderTrackDisabled: '#ccc',
  shadow: '#000000',
  codeBlockLight: '#f5f6f8',
  typingIndicator: '#636366',
  artworkPending: '#f59e0b',
  artworkProcessing: '#3b82f6',
  artworkSuccess: '#10b981',
  artworkError: '#ef4444',
  fileArchive: '#f97316',
  textDark: '#333333',
  textGray: '#666666',
  cachedToken: '#FF9500',
  modalOverlay: 'rgba(0,0,0,0.4)',
  modalDarkBg: '#1c1c1e',
  progressBarTrack: '#333333',
} as const;

export type EffectiveTheme = 'light' | 'dark';

const themeMap: Record<EffectiveTheme, ColorTokens> = {
  light: lightTokens,
  dark: darkTokens,
};

export function getThemeTokens(theme: EffectiveTheme): ColorTokens {
  return themeMap[theme];
}

/** Current theme — defaults to light when used outside ThemeProvider. Use useThemeColors() for reactive theme. */
export const themeColors: ColorTokens = lightTokens;

/** Chat accent group — convenience object for MessageBubble etc. */
export const chatAccent = {
  badgeBg: lightTokens.chatAccentBadgeBg,
  badgeText: lightTokens.chatAccentBadgeText,
  bubbleBg: lightTokens.chatAccentSectionBg,
  bubbleBorder: lightTokens.chatAccentSectionBorder,
  chipBg: lightTokens.chatAccentChipBg,
  chipBorder: lightTokens.chatAccentChipBorder,
  elevatedBg: lightTokens.chatAccentSectionBg,
  quoteBorder: lightTokens.chatAccentQuoteBorder,
  sectionBg: lightTokens.chatAccentSectionBg,
  sectionBorder: lightTokens.chatAccentSectionBorder,
  subtleBg: lightTokens.chatAccentSubtleBg,
} as const;

/** @deprecated Use useThemeColors().semanticColors instead. Kept for backward compatibility. */
export const semanticColors = {
  border: themeColors.border,
  danger: themeColors.danger,
  fillTertiary: themeColors.fillTertiary,
  foreground: themeColors.foreground,
  muted: themeColors.muted,
  primary: themeColors.primary,
  secondaryText: themeColors.secondaryText,
  surface: themeColors.surface,
} as const;

/** Hook for reactive theme colors. Use when component needs to re-render on theme change. */
export function useThemeColors(): ColorTokens {
  const effectiveTheme = useThemeStore((s) => s.effectiveTheme);
  return getThemeTokens(effectiveTheme);
}

/** Semantic colors derived from current theme tokens. Use useSemanticColors() for reactive version. */
export function getSemanticColors(tokens: ColorTokens) {
  return {
    border: tokens.border,
    danger: tokens.danger,
    fillTertiary: tokens.fillTertiary,
    foreground: tokens.foreground,
    muted: tokens.muted,
    primary: tokens.primary,
    secondaryText: tokens.secondaryText,
    surface: tokens.surface,
  } as const;
}
