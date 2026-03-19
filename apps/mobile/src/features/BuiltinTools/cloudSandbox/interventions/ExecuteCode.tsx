/**
 * Cloud Sandbox ExecuteCode Intervention — Display code and language before approve.
 * Read-only review (matches Web behavior).
 */
import { Code } from 'lucide-react-native';
import React, { memo } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { useThemeColors } from '../../../../theme/colors';
import type { MobileBuiltinInterventionProps } from '../../types';

interface ExecuteCodeArgs {
  code?: string;
  language?: 'javascript' | 'python' | 'typescript';
}

const languageDisplayNames: Record<string, string> = {
  javascript: 'JavaScript',
  python: 'Python',
  typescript: 'TypeScript',
};

const ExecuteCodeIntervention = memo<MobileBuiltinInterventionProps<ExecuteCodeArgs>>(
  ({ args }) => {
    const colors = useThemeColors();
    const { code, language = 'python' } = args ?? {};
    const displayLanguage = languageDisplayNames[language] || language;

    if (!code?.trim()) return null;

    return (
      <View
        className="rounded-xl border overflow-hidden"
        style={{
          backgroundColor: colors.overlay,
          borderColor: colors.border,
        }}
      >
        <View
          className="flex-row items-center gap-2 px-3 py-2"
          style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}
        >
          <Code color={colors.primary} size={14} strokeWidth={2} />
          <Text className="text-[11px] font-medium uppercase" style={{ color: colors.tertiaryText }}>
            {displayLanguage}
          </Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-3 py-2">
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
    );
  },
);

ExecuteCodeIntervention.displayName = 'CloudSandboxExecuteCodeIntervention';

export default ExecuteCodeIntervention;
