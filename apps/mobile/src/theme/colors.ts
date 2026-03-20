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
  background: '#f7f8fc',
  foreground: '#111827',
  surface: '#ffffff',
  surfaceElevated: '#ffffff',
  card: '#ffffff',
  muted: '#6b7280',
  secondaryText: '#8a94a6',
  tertiaryText: '#98a2b3',
  placeholder: '#97a1b2',
  border: 'rgba(15,23,42,0.08)',
  borderDefault: '#d7deea',
  borderSubtle: 'rgba(15,23,42,0.05)',
  divider: 'rgba(15,23,42,0.08)',
  fillTertiary: 'rgba(15,23,42,0.05)',
  fillQuaternary: 'rgba(15,23,42,0.025)',
  overlay: 'rgba(249,250,254,0.92)',
  overlayDark: 'rgba(2,6,23,0.52)',
  switchTrackOff: '#dbe2ea',
  switchTrackOffAlt: 'rgba(120,120,128,0.16)',
  markdownText: '#1a2233',
  markdownHeading: '#0f172a',
  markdownCodeInlineBg: 'rgba(15,23,42,0.05)',
  markdownCodeInlineColor: '#e83e8c',
  markdownCodeBlockBg: '#f3f5fa',
  assistantBubbleBg: '#ffffff',
  assistantBubbleBorder: 'rgba(15,23,42,0.08)',
  assistantBubbleText: '#172033',
  chatAccentSectionBg: '#ffffff',
  chatAccentSectionBorder: 'rgba(15,23,42,0.08)',
  chatAccentSubtleBg: 'rgba(15,23,42,0.035)',
  iconOnPrimary: '#ffffff',
  iconOnSurface: '#111827',
  iconMuted: '#7f8898',
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
  inputBg: '#f4f6fb',
  sliderTrack: '#d6deea',
  sliderTrackDisabled: '#bcc7d6',
  shadow: '#0f172a',
  codeBlockLight: '#eef2f8',
  typingIndicator: '#667085',
  artworkPending: '#f59e0b',
  artworkProcessing: '#3b82f6',
  artworkSuccess: '#10b981',
  artworkError: '#ef4444',
  fileArchive: '#f97316',
  textDark: '#1f2937',
  textGray: '#667085',
  cachedToken: '#d97706',
  modalOverlay: 'rgba(15,23,42,0.32)',
  modalDarkBg: '#1c1c1e',
  progressBarTrack: '#d7deea',
};

const darkBase: BaseTokens = {
  ...lightBase,
  background: '#0b0e14',
  foreground: '#f3f6fb',
  surface: '#11161f',
  surfaceElevated: '#161c28',
  card: '#10151e',
  muted: '#8b95a7',
  secondaryText: '#a5aec0',
  tertiaryText: '#6e788c',
  placeholder: '#7b8598',
  border: 'rgba(166,181,209,0.14)',
  borderDefault: '#2a3344',
  borderSubtle: 'rgba(166,181,209,0.09)',
  divider: 'rgba(166,181,209,0.1)',
  fillTertiary: 'rgba(166,181,209,0.1)',
  fillQuaternary: 'rgba(166,181,209,0.06)',
  overlay: 'rgba(14,18,27,0.94)',
  overlayDark: 'rgba(0,0,0,0.76)',
  switchTrackOff: '#2a3344',
  switchTrackOffAlt: 'rgba(146,161,187,0.28)',
  markdownText: '#e8edf7',
  markdownHeading: '#fafcff',
  markdownCodeInlineBg: 'rgba(166,181,209,0.14)',
  markdownCodeInlineColor: '#ff9ac6',
  markdownCodeBlockBg: '#161c28',
  assistantBubbleBg: '#121823',
  assistantBubbleBorder: 'rgba(166,181,209,0.12)',
  assistantBubbleText: '#f3f6fb',
  chatAccentSectionBg: '#131a25',
  chatAccentSectionBorder: 'rgba(166,181,209,0.12)',
  chatAccentSubtleBg: 'rgba(166,181,209,0.08)',
  iconOnSurface: '#f3f6fb',
  iconMuted: '#8f98ab',
  success: '#4ade80',
  successMuted: 'rgba(74,222,128,0.22)',
  successSubtle: 'rgba(74,222,128,0.1)',
  danger: '#ff6b62',
  dangerMuted: 'rgba(255,107,98,0.22)',
  dangerSubtle: 'rgba(255,107,98,0.1)',
  warning: '#ffb347',
  warningMuted: 'rgba(255,179,71,0.2)',
  warningSubtle: 'rgba(255,179,71,0.1)',
  info: '#7bc4ff',
  infoMuted: 'rgba(123,196,255,0.2)',
  infoSubtle: 'rgba(123,196,255,0.1)',
  sourceBuiltin: '#5adaa2',
  sourceBuiltinMuted: 'rgba(90,218,162,0.18)',
  sourceCustom: '#ffb768',
  sourceCustomMuted: 'rgba(255,183,104,0.18)',
  userBubbleText: '#fdfeff',
  userBubbleTextMuted: 'rgba(253,254,255,0.8)',
  userBubbleCodeBg: 'rgba(255,255,255,0.12)',
  userBubbleSubtleBg: 'rgba(255,255,255,0.14)',
  userBubbleTableBg: 'rgba(255,255,255,0.09)',
  userBubbleTableBorder: 'rgba(255,255,255,0.12)',
  userBubbleHr: 'rgba(255,255,255,0.18)',
  inputBg: '#0f141d',
  sliderTrack: '#2c3546',
  sliderTrackDisabled: '#4e586c',
  shadow: '#000000',
  codeBlockLight: '#1e2634',
  typingIndicator: '#96a0b4',
  textDark: '#f3f6fb',
  textGray: '#a5aec0',
  cachedToken: '#ffb347',
  modalOverlay: 'rgba(3,6,12,0.62)',
  modalDarkBg: '#151c28',
  progressBarTrack: '#2c3546',
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
    ...(palette.userBubbleText != null && { userBubbleText: palette.userBubbleText }),
    ...(palette.userBubbleTextMuted != null && {
      userBubbleTextMuted: palette.userBubbleTextMuted,
    }),
    ...(palette.userBubbleCodeBg != null && { userBubbleCodeBg: palette.userBubbleCodeBg }),
    ...(palette.userBubbleSubtleBg != null && { userBubbleSubtleBg: palette.userBubbleSubtleBg }),
    ...(palette.userBubbleTableBg != null && { userBubbleTableBg: palette.userBubbleTableBg }),
    ...(palette.userBubbleTableBorder != null && {
      userBubbleTableBorder: palette.userBubbleTableBorder,
    }),
    ...(palette.userBubbleHr != null && { userBubbleHr: palette.userBubbleHr }),
    ...(palette.iconOnPrimary != null && { iconOnPrimary: palette.iconOnPrimary }),
    info: palette.primary,
    markdownLink: palette.markdownLink,
    chatAccentBadgeBg: palette.chatAccentBadgeBg,
    chatAccentBadgeText: palette.chatAccentBadgeText,
    chatAccentChipBg: palette.chatAccentChipBg,
    chatAccentChipBorder: palette.chatAccentChipBorder,
    chatAccentQuoteBorder: palette.chatAccentQuoteBorder,
    sourceMarket: palette.sourceMarket,
    sourceMarketMuted: palette.sourceMarketMuted,
    sliderThumb: palette.primary,
    markdownCodeInlineBg: palette.primarySubtle,
    markdownCodeInlineColor: palette.primary,
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
  const palette = getColorSchemePalette(colorScheme, theme);
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
