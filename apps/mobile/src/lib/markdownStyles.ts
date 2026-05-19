import { Platform } from 'react-native';

export interface ThemedMarkdownColors {
  border: string;
  divider: string;
  fillTertiary: string;
  foreground: string;
  markdownCodeBlockBg: string;
  markdownCodeInlineBg: string;
  markdownCodeInlineColor: string;
  primary: string;
}

export interface ThemedMarkdownStyleOptions {
  bodyColor?: string;
  fontSize?: number;
  headingColor?: string;
  lineHeight?: number;
}

export function getThemedMarkdownStyles(
  colors: ThemedMarkdownColors,
  options: ThemedMarkdownStyleOptions = {},
) {
  const bodyColor = options.bodyColor ?? colors.foreground;
  const headingColor = options.headingColor ?? bodyColor;
  const fontSize = options.fontSize ?? 15;
  const lineHeight = options.lineHeight ?? 24;
  const codeFont = Platform.OS === 'ios' ? 'Menlo' : 'monospace';
  const codeFontSize = Math.max(fontSize - 2, 11);
  const codeLineHeight = Math.max(lineHeight - 4, 16);

  return {
    body: { color: bodyColor, fontSize, lineHeight },
    text: { color: bodyColor },
    textgroup: { color: bodyColor },
    heading1: {
      color: headingColor,
      fontSize: 24,
      fontWeight: '700' as const,
      marginBottom: 12,
      marginTop: 20,
    },
    heading2: {
      color: headingColor,
      fontSize: 20,
      fontWeight: '700' as const,
      marginBottom: 10,
      marginTop: 18,
    },
    heading3: {
      color: headingColor,
      fontSize: 17,
      fontWeight: '600' as const,
      marginBottom: 8,
      marginTop: 14,
    },
    paragraph: { marginBottom: 12 },
    bullet_list: { marginBottom: 12 },
    ordered_list: { marginBottom: 12 },
    list_item: { marginBottom: 4 },
    code_inline: {
      backgroundColor: colors.markdownCodeInlineBg,
      borderRadius: 4,
      color: colors.markdownCodeInlineColor,
      fontFamily: codeFont,
      fontSize: codeFontSize,
      paddingHorizontal: 5,
      paddingVertical: 2,
    },
    fence: {
      backgroundColor: colors.markdownCodeBlockBg,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 0.5,
      color: bodyColor,
      fontFamily: codeFont,
      fontSize: codeFontSize,
      lineHeight: codeLineHeight,
      marginBottom: 12,
      padding: 14,
    },
    code_block: {
      color: bodyColor,
      fontFamily: codeFont,
      fontSize: codeFontSize,
      lineHeight: codeLineHeight,
    },
    blockquote: {
      backgroundColor: colors.fillTertiary,
      borderLeftColor: colors.primary,
      borderLeftWidth: 3,
      marginBottom: 12,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    blockquote_content: {
      color: bodyColor,
      fontSize,
      lineHeight,
    },
    hr: { backgroundColor: colors.divider, height: 1, marginVertical: 16 },
    link: { color: colors.primary },
    strong: { fontWeight: '600' as const },
    table: { borderColor: colors.divider, borderWidth: 0.5 },
    th: {
      backgroundColor: colors.fillTertiary,
      color: headingColor,
      fontWeight: '600' as const,
      padding: 8,
    },
    td: {
      borderColor: colors.divider,
      borderWidth: 0.5,
      color: bodyColor,
      padding: 8,
    },
  };
}
