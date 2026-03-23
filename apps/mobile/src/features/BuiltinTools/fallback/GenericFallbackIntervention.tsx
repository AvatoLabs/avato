/**
 * Generic fallback intervention for builtin tools that need approval.
 * Displays tool arguments in a readable format. Aligns RN with Web for tools
 * that have intervention but no custom RN form (group-management, agent-builder, local-system).
 */
import { FileJson } from 'lucide-react-native';
import React, { memo, useMemo } from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';

import { useThemeColors } from '../../../theme/colors';
import type { MobileBuiltinInterventionProps } from '../types';

const formatArgs = (args?: Record<string, unknown>): string => {
  if (!args || Object.keys(args).length === 0) return '{}';
  return JSON.stringify(args, null, 2);
};

const GenericFallbackIntervention = memo<MobileBuiltinInterventionProps>(({ args }) => {
  const colors = useThemeColors();
  const formatted = useMemo(() => formatArgs(args), [args]);

  return (
    <View
      className="rounded-xl border p-3"
      style={{
        backgroundColor: colors.overlay,
        borderColor: colors.border,
      }}
    >
      <View className="mb-2 flex-row items-center gap-2">
        <FileJson color={colors.primary} size={16} strokeWidth={2} />
        <Text
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: colors.tertiaryText }}
        >
          Parameters
        </Text>
      </View>
      <ScrollView
        horizontal
        showsVerticalScrollIndicator
        className="max-h-24"
        showsHorizontalScrollIndicator={false}
      >
        <Text
          selectable
          className="rounded-lg px-2 py-1.5 text-[11px] leading-4"
          style={{
            backgroundColor: colors.fillTertiary,
            color: colors.foreground,
            fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
          }}
        >
          {formatted}
        </Text>
      </ScrollView>
    </View>
  );
});

GenericFallbackIntervention.displayName = 'GenericFallbackIntervention';

export default GenericFallbackIntervention;
