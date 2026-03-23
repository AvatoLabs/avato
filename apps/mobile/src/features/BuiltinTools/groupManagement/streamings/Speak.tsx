/**
 * Group Management Speak Streaming — RN version.
 * Shown while speak tool is executing.
 */
import { MessageCircle } from 'lucide-react-native';
import React, { memo } from 'react';
import { ActivityIndicator, View } from 'react-native';
import Markdown from 'react-native-markdown-display';

import { codeInlineRules } from '../../../../lib/markdownRules';
import { getThemedMarkdownStyles } from '../../../../lib/markdownStyles';
import { useThemeColors } from '../../../../theme/colors';
import type { MobileBuiltinStreamingProps } from '../../types';

const SpeakStreaming = memo<MobileBuiltinStreamingProps>(({ args }) => {
  const colors = useThemeColors();
  const instruction = (args?.instruction as string) || '';
  const markdownStyles = React.useMemo(
    () =>
      getThemedMarkdownStyles(colors, {
        bodyColor: colors.secondaryText,
        fontSize: 13,
        lineHeight: 20,
      }),
    [colors],
  );

  if (!instruction) return null;

  return (
    <View
      className="flex-row items-start gap-2 rounded-xl border px-3 py-2.5"
      style={{
        backgroundColor: colors.overlay,
        borderColor: colors.border,
      }}
    >
      <ActivityIndicator color={colors.primary} size="small" />
      <MessageCircle color={colors.primary} size={16} strokeWidth={2} />
      <View className="flex-1">
        <Markdown rules={codeInlineRules as any} style={markdownStyles}>
          {instruction}
        </Markdown>
      </View>
    </View>
  );
});

SpeakStreaming.displayName = 'GroupManagementSpeakStreaming';

export default SpeakStreaming;
