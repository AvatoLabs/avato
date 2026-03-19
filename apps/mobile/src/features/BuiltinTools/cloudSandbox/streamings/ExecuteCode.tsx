/**
 * Cloud Sandbox ExecuteCode Streaming — Placeholder while code is executing.
 */
import { Code } from 'lucide-react-native';
import React, { memo } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { useI18n } from '../../../../lib/i18n';
import { useThemeColors } from '../../../../theme/colors';
import type { MobileBuiltinStreamingProps } from '../../types';

const ExecuteCodeStreaming = memo<MobileBuiltinStreamingProps>(() => {
  const { t } = useI18n();
  const colors = useThemeColors();

  return (
    <View
      className="flex-row items-center gap-2 rounded-xl border px-3 py-2.5"
      style={{
        backgroundColor: colors.overlay,
        borderColor: colors.border,
      }}
    >
      <ActivityIndicator color={colors.primary} size="small" />
      <Code color={colors.primary} size={16} strokeWidth={2} />
      <Text className="flex-1 text-[13px]" numberOfLines={1} style={{ color: colors.secondaryText }}>
        {t.chatToolStreamingExecuteCode}
      </Text>
    </View>
  );
});

ExecuteCodeStreaming.displayName = 'CloudSandboxExecuteCodeStreaming';

export default ExecuteCodeStreaming;
