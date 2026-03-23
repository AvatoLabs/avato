/**
 * Generic fallback render for builtin tools without RN-specific implementations.
 * Used for: lobe-agent-builder, lobe-agent-management, lobe-group-agent-builder, lobe-local-system.
 * Displays arguments (formatted JSON) and result content in a readable layout.
 */
import { Settings } from 'lucide-react-native';
import React, { memo, useMemo } from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import Markdown from 'react-native-markdown-display';

import { codeInlineRules } from '../../../lib/markdownRules';
import { getThemedMarkdownStyles } from '../../../lib/markdownStyles';
import { useThemeColors } from '../../../theme/colors';
import type { MobileBuiltinRenderProps } from '../types';

const formatArgs = (argsStr?: string): string => {
  if (!argsStr) return '{}';
  try {
    const parsed = JSON.parse(argsStr);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return argsStr;
  }
};

const GenericFallbackRender = memo<MobileBuiltinRenderProps>(
  ({ arguments: argsStr, content, error }) => {
    const colors = useThemeColors();
    const formattedArgs = useMemo(() => formatArgs(argsStr), [argsStr]);
    const hasArgs = formattedArgs && formattedArgs !== '{}';
    const hasContent = content?.trim();
    const hasError = error != null;
    const errorMessage =
      typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: unknown }).message)
        : error != null
          ? String(error)
          : undefined;

    const markdownStyles = useMemo(
      () =>
        getThemedMarkdownStyles(colors, {
          bodyColor: colors.secondaryText,
          fontSize: 13,
          lineHeight: 20,
        }),
      [colors],
    );

    if (!hasArgs && !hasContent && !hasError) return null;

    return (
      <View
        className="rounded-xl border p-3"
        style={{
          backgroundColor: colors.overlay,
          borderColor: colors.border,
        }}
      >
        <View className="mb-2 flex-row items-center gap-2">
          <Settings color={colors.primary} size={16} strokeWidth={2} />
        </View>

        {hasError && errorMessage ? (
          <Text className="mb-2 text-[13px]" style={{ color: colors.danger }}>
            {errorMessage}
          </Text>
        ) : null}

        {hasArgs ? (
          <View className="mb-2">
            <Text
              className="mb-1 text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: colors.tertiaryText }}
            >
              Arguments
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <Text
                selectable
                className="rounded-lg px-2 py-1.5 text-[11px] leading-4"
                style={{
                  backgroundColor: colors.fillTertiary,
                  color: colors.foreground,
                  fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                }}
              >
                {formattedArgs}
              </Text>
            </ScrollView>
          </View>
        ) : null}

        {hasContent && !hasError ? (
          <View>
            <Text
              className="mb-1 text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: colors.tertiaryText }}
            >
              Result
            </Text>
            <Markdown rules={codeInlineRules as any} style={markdownStyles}>
              {content}
            </Markdown>
          </View>
        ) : null}
      </View>
    );
  },
);

GenericFallbackRender.displayName = 'GenericFallbackRender';

export default GenericFallbackRender;
