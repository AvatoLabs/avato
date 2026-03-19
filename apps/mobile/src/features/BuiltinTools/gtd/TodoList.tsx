/**
 * GTD TodoList Render — RN version of lobe-gtd TodoList.
 * Displays todo items from pluginState or parsed content.
 */
import { Check, Circle, ListTodo } from 'lucide-react-native';
import React, { memo, useMemo } from 'react';
import { Text, View } from 'react-native';

import { useI18n } from '../../../lib/i18n';
import { useThemeColors } from '../../../theme/colors';
import type { MobileBuiltinRenderProps } from '../types';

interface TodoItem {
  status?: 'todo' | 'processing' | 'completed';
  text: string;
}

interface TodoListState {
  items?: TodoItem[];
  updatedAt?: string;
}

function parseTodoState(content?: string, pluginState?: Record<string, unknown>): TodoItem[] {
  const todos = pluginState?.todos as TodoListState | undefined;
  if (todos?.items?.length) {
    return todos.items;
  }
  if (content) {
    try {
      const parsed = JSON.parse(content) as { todos?: TodoListState };
      return parsed.todos?.items ?? [];
    } catch {
      return [];
    }
  }
  return [];
}

const TodoListRender = memo<MobileBuiltinRenderProps>(({ content, pluginState }) => {
  const { t } = useI18n();
  const colors = useThemeColors();
  const items = useMemo(
    () => parseTodoState(content, pluginState),
    [content, pluginState],
  );

  if (items.length === 0) return null;

  return (
    <View
      className="rounded-xl border p-3"
      style={{
        backgroundColor: colors.background,
        borderColor: colors.border,
      }}
    >
      <View className="mb-2 flex-row items-center gap-2">
        <ListTodo color={colors.primary} size={16} strokeWidth={2} />
        <Text className="text-[12px] font-medium" style={{ color: colors.foreground }}>
          {t.chatToolGtdTodoCount.replace('{{count}}', String(items.length))}
        </Text>
      </View>
      {items.map((item, index) => {
        const isCompleted = item.status === 'completed';
        return (
          <View
            key={index}
            className="flex-row items-center gap-2 py-2"
            style={{
              borderBottomWidth: index < items.length - 1 ? 1 : 0,
              borderBottomColor: colors.border,
            }}
          >
            <View className="h-5 w-5 items-center justify-center">
              {isCompleted ? (
                <Check color={colors.iconSuccess} size={14} strokeWidth={2.5} />
              ) : (
                <Circle color={colors.tertiaryText} size={16} strokeWidth={2} />
              )}
            </View>
            <Text
              className="flex-1 text-[13px]"
              numberOfLines={2}
              style={{
                color: isCompleted ? colors.tertiaryText : colors.foreground,
                textDecorationLine: isCompleted ? 'line-through' : undefined,
              }}
            >
              {item.text}
            </Text>
          </View>
        );
      })}
    </View>
  );
});

TodoListRender.displayName = 'GTDTodoListRender';

export default TodoListRender;
