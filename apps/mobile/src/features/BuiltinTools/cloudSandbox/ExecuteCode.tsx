/**
 * Cloud Sandbox ExecuteCode Render — RN version.
 * Displays code + output/stderr from args and pluginState.
 */
import { Code } from 'lucide-react-native';
import React, { memo, useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { useThemeColors } from '../../../theme/colors';
import type { MobileBuiltinRenderProps } from '../types';

function parseExecuteState(content?: string, pluginState?: Record<string, unknown>) {
  const output = pluginState?.output as string | undefined;
  const stderr = pluginState?.stderr as string | undefined;
  if (output !== undefined || stderr !== undefined) return { output, stderr };
  if (content) {
    try {
      const parsed = JSON.parse(content) as { state?: { output?: string; stderr?: string } };
      const s = parsed.state;
      return { output: s?.output, stderr: s?.stderr };
    } catch {
      return { output: undefined, stderr: undefined };
    }
  }
  return { output: undefined, stderr: undefined };
}

function parseCode(args?: string): { code?: string; language?: string } {
  if (!args) return {};
  try {
    const parsed = JSON.parse(args) as { code?: string; language?: string };
    return { code: parsed.code, language: parsed.language };
  } catch {
    return {};
  }
}

const ExecuteCodeRender = memo<MobileBuiltinRenderProps>(({ arguments: argsStr, content, pluginState }) => {
  const colors = useThemeColors();
  const { code, language } = useMemo(() => parseCode(argsStr), [argsStr]);
  const { output, stderr } = useMemo(
    () => parseExecuteState(content, pluginState),
    [content, pluginState],
  );

  const hasCode = !!code?.trim();
  const hasOutput = !!output?.trim();
  const hasStderr = !!stderr?.trim();
  if (!hasCode && !hasOutput && !hasStderr) return null;

  const lang = language || 'python';

  return (
    <View
      className="rounded-xl border overflow-hidden"
      style={{
        backgroundColor: colors.background,
        borderColor: colors.border,
      }}
    >
      {hasCode ? (
        <View className="px-3 py-2" style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <View className="flex-row items-center gap-2 mb-1.5">
            <Code color={colors.primary} size={14} strokeWidth={2} />
            <Text className="text-[11px] font-medium uppercase" style={{ color: colors.tertiaryText }}>
              {lang}
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Text
              selectable
              className="text-[12px]"
              style={{
                color: colors.markdownText,
                fontFamily: 'Menlo',
              }}
            >
              {code}
            </Text>
          </ScrollView>
        </View>
      ) : null}
      {hasOutput ? (
        <View className="px-3 py-2" style={{ borderBottomWidth: hasStderr ? 1 : 0, borderBottomColor: colors.border }}>
          <Text className="text-[11px] font-medium uppercase mb-1" style={{ color: colors.tertiaryText }}>
            Output
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Text
              selectable
              className="text-[12px]"
              style={{
                color: colors.markdownText,
                fontFamily: 'Menlo',
              }}
            >
              {output}
            </Text>
          </ScrollView>
        </View>
      ) : null}
      {hasStderr ? (
        <View className="px-3 py-2">
          <Text className="text-[11px] font-medium uppercase mb-1" style={{ color: colors.danger }}>
            Stderr
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Text
              selectable
              className="text-[12px]"
              style={{
                color: colors.danger,
                fontFamily: 'Menlo',
              }}
            >
              {stderr}
            </Text>
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
});

ExecuteCodeRender.displayName = 'CloudSandboxExecuteCodeRender';

export default ExecuteCodeRender;
