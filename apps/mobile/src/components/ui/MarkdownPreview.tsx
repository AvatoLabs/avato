import React, { useMemo } from 'react';
import { Platform, ScrollView, type StyleProp, View, type ViewStyle } from 'react-native';
import Markdown from 'react-native-markdown-display';

import { codeInlineRules } from '../../lib/markdownRules';
import { useThemeColors } from '../../theme/colors';

interface MarkdownPreviewProps {
  containerStyle?: StyleProp<ViewStyle>;
  content: string;
  contentMaxWidth?: number;
}

export default function MarkdownPreview({
  containerStyle,
  content,
  contentMaxWidth,
}: MarkdownPreviewProps) {
  const colors = useThemeColors();

  const markdownStyles = useMemo(
    () => ({
      body: { color: colors.foreground, fontSize: 15, lineHeight: 24 },
      blockquote: {
        backgroundColor: colors.fillTertiary,
        borderColor: colors.primary,
        borderLeftWidth: 3,
        marginBottom: 12,
        paddingHorizontal: 14,
        paddingVertical: 8,
      },
      bullet_list: { marginBottom: 12 },
      code_inline: {
        backgroundColor: colors.markdownCodeInlineBg,
        borderRadius: 4,
        color: colors.markdownCodeInlineColor,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        fontSize: 13,
        paddingHorizontal: 5,
        paddingVertical: 2,
      },
      fence: {
        backgroundColor: colors.markdownCodeBlockBg,
        borderRadius: 12,
        color: colors.foreground,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        fontSize: 13,
        lineHeight: 20,
        marginBottom: 12,
        padding: 14,
      },
      heading1: {
        color: colors.foreground,
        fontSize: 24,
        fontWeight: '700' as const,
        marginBottom: 12,
        marginTop: 20,
      },
      heading2: {
        color: colors.foreground,
        fontSize: 20,
        fontWeight: '700' as const,
        marginBottom: 10,
        marginTop: 18,
      },
      heading3: {
        color: colors.foreground,
        fontSize: 17,
        fontWeight: '600' as const,
        marginBottom: 8,
        marginTop: 14,
      },
      hr: { backgroundColor: colors.borderSubtle, height: 1, marginVertical: 16 },
      link: { color: colors.primary },
      ordered_list: { marginBottom: 12 },
      paragraph: { marginBottom: 12 },
      strong: { fontWeight: '600' as const },
      table: { borderColor: colors.borderSubtle, borderWidth: 0.5 },
      td: { borderColor: colors.borderSubtle, borderWidth: 0.5, padding: 8 },
      text: { color: colors.foreground },
      textgroup: { color: colors.foreground },
      th: { backgroundColor: colors.fillTertiary, padding: 8 },
    }),
    [colors],
  );

  return (
    <ScrollView
      className="flex-1"
      style={containerStyle}
      contentContainerStyle={{
        alignItems: contentMaxWidth ? 'center' : undefined,
        padding: 16,
        paddingBottom: 32,
      }}
    >
      <View style={{ maxWidth: contentMaxWidth, width: '100%' }}>
        <Markdown rules={codeInlineRules} style={markdownStyles}>
          {content}
        </Markdown>
      </View>
    </ScrollView>
  );
}
