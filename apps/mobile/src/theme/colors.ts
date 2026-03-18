/**
 * Unified color tokens for theming.
 * All UI colors reference these tokens — no hardcoded hex/rgba in components.
 * Combines base (light/dark) + color scheme palette.
 */
import { useThemeStore } from '../store/theme';
import { type ColorSchemeId, getColorSchemePalette } from './palettes';

export interface ColorTokens {
  activeTabBg: string;
  artworkError: string;
  artworkPending: string;
  artworkProcessing: string;
  artworkSuccess: string;
  assistantBubbleBg: string;
  assistantBubbleBorder: string;
  assistantBubbleText: string;
  background: string;
  border: string;
  borderDefault: string;
  borderSubtle: string;
  cachedToken: string;
  card: string;
  chatAccentBadgeBg: string;
  chatAccentBadgeText: string;
  chatAccentChipBg: string;
  chatAccentChipBorder: string;
  chatAccentQuoteBorder: string;
  chatAccentSectionBg: string;
  chatAccentSectionBorder: string;
  chatAccentSubtleBg: string;
  codeBlockLight: string;
  danger: string;
  dangerMuted: string;
  dangerSubtle: string;
  divider: string;
  fileArchive: string;
  fillQuaternary: string;
  fillTertiary: string;
  foreground: string;
  iconDanger: string;
  iconMuted: string;
  iconOnPrimary: string;
  iconOnSurface: string;
  iconSuccess: string;
  iconWarning: string;
  inactiveTabBg: string;
  info: string;
  infoMuted: string;
  infoSubtle: string;
  // ── UI pattern tokens (abstracted from hardcoded values) ─────────────────
  inputBg: string;
  markdownCodeBlockBg: string;
  markdownCodeInlineBg: string;
  markdownCodeInlineColor: string;
  markdownHeading: string;
  markdownLink: string;
  markdownText: string;
  modalDarkBg: string;
  modalOverlay: string;
  muted: string;
  overlay: string;
  overlayDark: string;
  placeholder: string;
  primary: string;
  primaryBorder: string;
  primaryFocused: string;
  primaryMuted: string;
  primarySubtle: string;
  progressBarTrack: string;
  secondaryText: string;
  shadow: string;
  sliderThumb: string;
  sliderTrack: string;
  sliderTrackDisabled: string;
  sourceBuiltin: string;
  sourceBuiltinMuted: string;
  sourceCustom: string;
  sourceCustomMuted: string;
  sourceMarket: string;
  sourceMarketMuted: string;
  success: string;
  successMuted: string;
  successSubtle: string;
  surface: string;
  surfaceElevated: string;
  switchTrackOff: string;
  switchTrackOffAlt: string;
  switchTrackOn: string;
  tertiaryText: string;
  textDark: string;
  textGray: string;
  typingIndicator: string;
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

export type EffectiveTheme = 'light' | 'dark';

// ── Base neutral tokens (no accent colors) ────────────────────────────────
interface BaseTokens {
  artworkError: string;
  artworkPending: string;
  artworkProcessing: string;
  artworkSuccess: string;
  assistantBubbleBg: string;
  assistantBubbleBorder: string;
  assistantBubbleText: string;
  background: string;
  border: string;
  borderDefault: string;
  borderSubtle: string;
  cachedToken: string;
  card: string;
  chatAccentSectionBg: string;
  chatAccentSectionBorder: string;
  chatAccentSubtleBg: string;
  codeBlockLight: string;
  danger: string;
  dangerMuted: string;
  dangerSubtle: string;
  divider: string;
  fileArchive: string;
  fillQuaternary: string;
  fillTertiary: string;
  foreground: string;
  iconDanger: string;
  iconMuted: string;
  iconOnPrimary: string;
  iconOnSurface: string;
  iconSuccess: string;
  iconWarning: string;
  info: string;
  infoMuted: string;
  infoSubtle: string;
  inputBg: string;
  markdownCodeBlockBg: string;
  markdownCodeInlineBg: string;
  markdownCodeInlineColor: string;
  markdownHeading: string;
  markdownText: string;
  modalDarkBg: string;
  modalOverlay: string;
  muted: string;
  overlay: string;
  overlayDark: string;
  placeholder: string;
  progressBarTrack: string;
  secondaryText: string;
  shadow: string;
  sliderTrack: string;
  sliderTrackDisabled: string;
  sourceBuiltin: string;
  sourceBuiltinMuted: string;
  sourceCustom: string;
  sourceCustomMuted: string;
  success: string;
  successMuted: string;
  successSubtle: string;
  surface: string;
  surfaceElevated: string;
  switchTrackOff: string;
  switchTrackOffAlt: string;
  tertiaryText: string;
  textDark: string;
  textGray: string;
  typingIndicator: string;
  userBubbleCodeBg: string;
  userBubbleHr: string;
  userBubbleSubtleBg: string;
  userBubbleTableBg: string;
  userBubbleTableBorder: string;
  userBubbleText: string;
  userBubbleTextMuted: string;
  warning: string;
  warningMuted: string;
  warningSubtle: string;
}

const lightBase: BaseTokens = {
  background: '#ffffff',
  foreground: '#111111',
  surface: '#ffffff',
  surfaceElevated: '#ffffff',
  card: '#ffffff',
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
  markdownText: '#1a1a1a',
  markdownHeading: '#111111',
  markdownCodeInlineBg: 'rgba(0,0,0,0.05)',
  markdownCodeInlineColor: '#e83e8c',
  markdownCodeBlockBg: '#f5f5f5',
  assistantBubbleBg: '#ffffff',
  assistantBubbleBorder: 'rgba(15,23,42,0.06)',
  assistantBubbleText: '#1a1a1a',
  chatAccentSectionBg: '#ffffff',
  chatAccentSectionBorder: 'rgba(15,23,42,0.06)',
  chatAccentSubtleBg: 'rgba(15,23,42,0.035)',
  iconOnPrimary: '#ffffff',
  iconOnSurface: '#111111',
  iconMuted: '#999999',
  iconSuccess: '#34C759',
  iconDanger: '#FF3B30',
  iconWarning: '#f5a623',
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
  sourceBuiltin: '#059669',
  sourceBuiltinMuted: 'rgba(5,150,105,0.12)',
  sourceCustom: '#ea580c',
  sourceCustomMuted: 'rgba(234,88,12,0.12)',
  userBubbleText: '#ffffff',
  userBubbleTextMuted: 'rgba(255,255,255,0.7)',
  userBubbleCodeBg: 'rgba(255,255,255,0.2)',
  userBubbleSubtleBg: 'rgba(255,255,255,0.14)',
  userBubbleTableBg: 'rgba(255,255,255,0.12)',
  userBubbleTableBorder: 'rgba(255,255,255,0.1)',
  userBubbleHr: 'rgba(255,255,255,0.15)',
  inputBg: '#f8f8fa',
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
};

const darkBase: BaseTokens = {
  ...lightBase,
  background: '#000000',
  foreground: '#f5f5f7',
  surface: '#1c1c1e',
  surfaceElevated: '#2c2c2e',
  card: '#1c1c1e',
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
  markdownText: '#f5f5f7',
  markdownHeading: '#ffffff',
  markdownCodeInlineBg: 'rgba(255,255,255,0.12)',
  markdownCodeInlineColor: '#ff7eb6',
  markdownCodeBlockBg: '#2c2c2e',
  assistantBubbleBg: '#2c2c2e',
  assistantBubbleBorder: 'rgba(255,255,255,0.08)',
  assistantBubbleText: '#f5f5f7',
  chatAccentSectionBg: '#2c2c2e',
  chatAccentSectionBorder: 'rgba(255,255,255,0.08)',
  chatAccentSubtleBg: 'rgba(255,255,255,0.06)',
  iconOnSurface: '#f5f5f7',
  iconMuted: '#8e8e93',
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
  sourceBuiltin: '#30d158',
  sourceBuiltinMuted: 'rgba(48,209,88,0.2)',
  sourceCustom: '#ff9f0a',
  sourceCustomMuted: 'rgba(255,159,10,0.2)',
  userBubbleText: '#ffffff',
  userBubbleTextMuted: 'rgba(255,255,255,0.8)',
  userBubbleSubtleBg: 'rgba(255,255,255,0.15)',
  userBubbleTableBg: 'rgba(255,255,255,0.1)',
  userBubbleTableBorder: 'rgba(255,255,255,0.12)',
  userBubbleHr: 'rgba(255,255,255,0.2)',
  inputBg: '#1c1c1e',
  sliderTrack: '#38383a',
  sliderTrackDisabled: '#636366',
  typingIndicator: '#8e8e93',
  textDark: '#f5f5f7',
  textGray: '#98989f',
  progressBarTrack: '#38383a',
};

function mergeTokens(
  base: BaseTokens,
  palette: ReturnType<typeof getColorSchemePalette>,
): ColorTokens {
  return {
    ...base,
    primary: palette.primary,
    primaryBorder: palette.primaryBorder,
    primaryFocused: palette.primaryFocused,
    primaryMuted: palette.primaryMuted,
    primarySubtle: palette.primarySubtle,
    switchTrackOn: palette.switchTrackOn,
    activeTabBg: palette.activeTabBg,
    inactiveTabBg: palette.inactiveTabBg,
    userBubbleBg: palette.userBubbleBg,
    userBubbleLink: palette.userBubbleLink,
    markdownLink: palette.markdownLink,
    chatAccentBadgeBg: palette.chatAccentBadgeBg,
    chatAccentBadgeText: palette.chatAccentBadgeText,
    chatAccentChipBg: palette.chatAccentChipBg,
    chatAccentChipBorder: palette.chatAccentChipBorder,
    chatAccentQuoteBorder: palette.chatAccentQuoteBorder,
    sourceMarket: palette.sourceMarket,
    sourceMarketMuted: palette.sourceMarketMuted,
    sliderThumb: palette.primary,
  };
}

const baseMap: Record<EffectiveTheme, BaseTokens> = {
  light: lightBase,
  dark: darkBase,
};

export function getThemeTokens(
  theme: EffectiveTheme,
  colorScheme: ColorSchemeId = 'blue',
): ColorTokens {
  const base = baseMap[theme];
  const palette = getColorSchemePalette(colorScheme);
  return mergeTokens(base, palette);
}

/** @deprecated Use useThemeColors() for reactive theme. Defaults to light+blue. */
export const themeColors: ColorTokens = getThemeTokens('light', 'blue');

/** Chat accent group — convenience object. Use useThemeColors() for reactive. */
export function getChatAccent(tokens: ColorTokens) {
  return {
    badgeBg: tokens.chatAccentBadgeBg,
    badgeText: tokens.chatAccentBadgeText,
    bubbleBg: tokens.chatAccentSectionBg,
    bubbleBorder: tokens.chatAccentSectionBorder,
    chipBg: tokens.chatAccentChipBg,
    chipBorder: tokens.chatAccentChipBorder,
    elevatedBg: tokens.chatAccentSectionBg,
    quoteBorder: tokens.chatAccentQuoteBorder,
    sectionBg: tokens.chatAccentSectionBg,
    sectionBorder: tokens.chatAccentSectionBorder,
    subtleBg: tokens.chatAccentSubtleBg,
  } as const;
}

/** @deprecated Use useThemeColors(). Kept for backward compatibility. */
export const chatAccent = getChatAccent(themeColors);

/** @deprecated Use useThemeColors(). Kept for backward compatibility. */
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

/** @deprecated Use useThemeColors() which includes these. Prefer tokens.inputBg etc. */
export const uiColors = {
  inputBg: themeColors.inputBg,
  sliderThumb: themeColors.sliderThumb,
  sliderTrack: themeColors.sliderTrack,
  sliderTrackDisabled: themeColors.sliderTrackDisabled,
  shadow: themeColors.shadow,
  codeBlockLight: themeColors.codeBlockLight,
  typingIndicator: themeColors.typingIndicator,
  artworkPending: themeColors.artworkPending,
  artworkProcessing: themeColors.artworkProcessing,
  artworkSuccess: themeColors.artworkSuccess,
  artworkError: themeColors.artworkError,
  fileArchive: themeColors.fileArchive,
  textDark: themeColors.textDark,
  textGray: themeColors.textGray,
  cachedToken: themeColors.cachedToken,
  modalOverlay: themeColors.modalOverlay,
  modalDarkBg: themeColors.modalDarkBg,
  progressBarTrack: themeColors.progressBarTrack,
} as const;

/** Hook for reactive theme colors. Re-renders on theme or color scheme change. */
export function useThemeColors(): ColorTokens {
  const effectiveTheme = useThemeStore((s) => s.effectiveTheme);
  const colorScheme = useThemeStore((s) => s.colorScheme);
  return getThemeTokens(effectiveTheme, colorScheme);
}

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

export function useSemanticColors() {
  const tokens = useThemeColors();
  return getSemanticColors(tokens);
}
