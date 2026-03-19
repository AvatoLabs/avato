/**
 * GTD ExecTasks Render — RN version of lobe-gtd ExecTasks.
 * Displays multiple tasks (description, instruction) from pluginState or parsed content.
 */
import React, { memo, useMemo } from 'react';
import { Text, View } from 'react-native';

import { useThemeColors } from '../../../theme/colors';
import type { MobileBuiltinRenderProps } from '../types';

interface ExecTaskItem {
  description?: string;
  instruction?: string;
}

function parseTasks(content?: string, pluginState?: Record<string, unknown>): ExecTaskItem[] {
  const tasks = pluginState?.tasks as ExecTaskItem[] | undefined;
  if (Array.isArray(tasks) && tasks.length > 0) return tasks;
  if (content) {
    try {
      const parsed = JSON.parse(content) as {
        tasks?: ExecTaskItem[];
        state?: { tasks?: ExecTaskItem[] };
      };
      const arr = parsed.tasks ?? parsed.state?.tasks;
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }
  return [];
}

const ExecTasksRender = memo<MobileBuiltinRenderProps>(({ content, pluginState }) => {
  const colors = useThemeColors();
  const tasks = useMemo(() => parseTasks(content, pluginState), [content, pluginState]);

  if (tasks.length === 0) return null;

  return (
    <View
      className="rounded-xl border overflow-hidden"
      style={{
        backgroundColor: colors.background,
        borderColor: colors.border,
      }}
    >
      {tasks.map((task, index) => (
        <View
          key={index}
          className="px-3 py-3 flex-row gap-2"
          style={{
            borderBottomWidth: index < tasks.length - 1 ? 1 : 0,
            borderBottomColor: colors.border,
            borderStyle: 'dashed',
          }}
        >
          <Text
            className="text-[12px]"
            style={{ color: colors.tertiaryText }}
          >
            {index + 1}.
          </Text>
          <View className="flex-1">
            {task.description ? (
              <Text
                className="text-[13px] font-medium"
                style={{ color: colors.foreground }}
              >
                {task.description}
              </Text>
            ) : null}
            {task.instruction ? (
              <Text
                className="mt-0.5 text-[12px]"
                numberOfLines={2}
                style={{ color: colors.secondaryText }}
              >
                {task.instruction}
              </Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
});

ExecTasksRender.displayName = 'GTDExecTasksRender';

export default ExecTasksRender;
