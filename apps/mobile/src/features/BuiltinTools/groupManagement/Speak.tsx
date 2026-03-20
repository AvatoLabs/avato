/**
 * Group Management Speak Render — RN version.
 * Displays instruction when a specific agent speaks (from args).
 */
import { MessageCircle } from 'lucide-react-native';
import React, { memo, useMemo } from 'react';
import { View } from 'react-native';
import Markdown from 'react-native-markdown-display';

import { codeInlineRules } from '../../../lib/markdownRules';
import { getThemedMarkdownStyles } from '../../../lib/markdownStyles';
import { useThemeColors } from '../../../theme/colors';
import type { MobileBuiltinRenderProps } from '../types';

interface SpeakArgs {
  agentId?: string;
  instruction?: string;
}

function parseArgs(argumentsStr?: string, content?: string): SpeakArgs | null {
  if (argumentsStr) {
    try {
      const parsed = JSON.parse(argumentsStr) as SpeakArgs;
      return parsed;
    } catch {
      //
    }
  }
  if (content) {
    try {
      const parsed = JSON.parse(content) as { state?: SpeakArgs };
      return parsed.state ?? null;
    } catch {
      return null;
    }
  }
  return null;
}

const SpeakRender = memo<MobileBuiltinRenderProps>(({ arguments: argsStr, content }) => {
  const colors = useThemeColors();
  const args = useMemo(() => parseArgs(argsStr, content), [argsStr, content]);
  const instruction = args?.instruction?.trim();
  const markdownStyles = useMemo(
    () =>
      getThemedMarkdownStyles(colors, {
        bodyColor: colors.secondaryText,
        fontSize: 13,
        headingColor: colors.foreground,
        lineHeight: 20,
      }),
    [colors],
  );

  if (!instruction) return null;

  return (
    <View
      className="rounded-xl border p-3"
      style={{
        backgroundColor: colors.overlay,
        borderColor: colors.border,
      }}
    >
      <View className="mb-2 flex-row items-center gap-2">
        <MessageCircle color={colors.primary} size={16} strokeWidth={2} />
      </View>
      <Markdown rules={codeInlineRules as any} style={markdownStyles}>
        {instruction}
      </Markdown>
    </View>
  );
});

SpeakRender.displayName = 'GroupManagementSpeakRender';

export default SpeakRender;
