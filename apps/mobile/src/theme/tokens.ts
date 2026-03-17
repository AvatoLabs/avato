import { themeColors } from './colors';

export const tokens = {
  // Spacing
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },

  // Radii
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
  },

  // Icon styling
  icon: {
    strokeWidth: 1.25, // Ultra-thin
    size: {
      sm: 16,
      md: 20,
      lg: 24,
      xl: 28,
    },
  },

  // Opacities for surface layering (monochrome)
  opacity: {
    hover: 'bg-foreground/5',
    active: 'active:bg-foreground/10',
    surface: 'bg-foreground/5',
    surfaceElevated: 'bg-foreground/10',
  },

  // Semantic colors — markdown & code blocks
  markdownColors: {
    text: themeColors.markdownText,
    heading: themeColors.markdownHeading,
    codeInlineBg: themeColors.markdownCodeInlineBg,
    codeInlineColor: themeColors.markdownCodeInlineColor,
    codeBlockBg: themeColors.markdownCodeBlockBg,
    codeBlockBorder: themeColors.border,
    link: themeColors.markdownLink,
  },

  // Typography
  typography: {
    weight: {
      regular: '400',
      medium: '500',
      semibold: '600',
    },
  },
};
