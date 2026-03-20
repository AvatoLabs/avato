/**
 * Group Management Broadcast Render — RN version.
 * Displays instruction when multiple agents speak (from args).
 */
import { Users } from 'lucide-react-native';
import React, { memo, useMemo } from 'react';
import { View } from 'react-native';
import Markdown from 'react-native-markdown-display';

import { codeInlineRules } from '../../../lib/markdownRules';
import { getThemedMarkdownStyles } from '../../../lib/markdownStyles';
import { useThemeColors } from '../../../theme/colors';
import type { MobileBuiltinRenderProps } from '../types';

interface BroadcastArgs {
  agentIds?: string[];
  instruction?: string;
}

function parseArgs(argumentsStr?: string, content?: string): BroadcastArgs | null {
  if (argumentsStr) {
    try {
      const parsed = JSON.parse(argumentsStr) as BroadcastArgs;
      return parsed;
    } catch {
      //
    }
  }
  if (content) {
    try {
      const parsed = JSON.parse(content) as { state?: BroadcastArgs };
      return parsed.state ?? null;
    } catch {
      return null;
    }
  }
  return null;
}

const BroadcastRender = memo<MobileBuiltinRenderProps>(({ arguments: argsStr, content }) => {
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
        <Users color={colors.primary} size={16} strokeWidth={2} />
      </View>
      <Markdown rules={codeInlineRules as any} style={markdownStyles}>
        {instruction}
      </Markdown>
    </View>
  );
});

BroadcastRender.displayName = 'GroupManagementBroadcastRender';

export default BroadcastRender;
