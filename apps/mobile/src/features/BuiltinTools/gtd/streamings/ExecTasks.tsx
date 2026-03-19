/**
 * GTD ExecTasks Streaming — Placeholder while tasks are executing.
 */
import { Play } from 'lucide-react-native';
import React, { memo } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { useI18n } from '../../../../lib/i18n';
import { useThemeColors } from '../../../../theme/colors';
import type { MobileBuiltinStreamingProps } from '../../types';

const ExecTasksStreaming = memo<MobileBuiltinStreamingProps>(({ args }) => {
  const { t } = useI18n();
  const colors = useThemeColors();
  const tasks = (args?.tasks as Array<{ description?: string }>) || [];
  const count = tasks.length;

  return (
    <View
      className="flex-row items-center gap-2 rounded-xl border px-3 py-2.5"
      style={{
        backgroundColor: colors.overlay,
        borderColor: colors.border,
      }}
    >
      <ActivityIndicator color={colors.primary} size="small" />
      <Play color={colors.primary} size={16} strokeWidth={2} />
      <Text className="flex-1 text-[13px]" style={{ color: colors.secondaryText }}>
        {t.chatToolStreamingExecTask}
        {count > 0 ? ` (${count})` : ''}
      </Text>
    </View>
  );
});

ExecTasksStreaming.displayName = 'GTDExecTasksStreaming';

export default ExecTasksStreaming;
