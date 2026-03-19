/**
 * GTD ExecTask Render — RN version of lobe-gtd ExecTask.
 * Displays single task (description, instruction) from pluginState or parsed content.
 */
import React, { memo, useMemo } from 'react';
import { Text, View } from 'react-native';

import { useThemeColors } from '../../../theme/colors';
import type { MobileBuiltinRenderProps } from '../types';

interface ExecTaskItem {
  description?: string;
  instruction?: string;
}

function parseTask(content?: string, pluginState?: Record<string, unknown>): ExecTaskItem | null {
  const task = pluginState?.task as ExecTaskItem | undefined;
  if (task && (task.description || task.instruction)) return task;
  if (content) {
    try {
      const parsed = JSON.parse(content) as { task?: ExecTaskItem; state?: { task?: ExecTaskItem } };
      const t = parsed.task ?? parsed.state?.task;
      return t ?? null;
    } catch {
      return null;
    }
  }
  return null;
}

const ExecTaskRender = memo<MobileBuiltinRenderProps>(({ content, pluginState }) => {
  const colors = useThemeColors();
  const task = useMemo(() => parseTask(content, pluginState), [content, pluginState]);

  if (!task) return null;

  return (
    <View
      className="rounded-xl border px-3 py-2.5"
      style={{
        backgroundColor: colors.background,
        borderColor: colors.border,
      }}
    >
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
          className="mt-1 text-[12px]"
          numberOfLines={2}
          style={{ color: colors.secondaryText }}
        >
          {task.instruction}
        </Text>
      ) : null}
    </View>
  );
});

ExecTaskRender.displayName = 'GTDExecTaskRender';

export default ExecTaskRender;
