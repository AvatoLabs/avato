/**
 * GTD AddTodo Intervention — Edit todo items before approve.
 */
import { Plus } from 'lucide-react-native';
import React, { memo, useCallback, useEffect, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useI18n } from '../../../../lib/i18n';
import { useThemeColors } from '../../../../theme/colors';
import type { MobileBuiltinInterventionProps } from '../../types';

interface TodoItem {
  status?: string;
  text: string;
}

interface CreateTodosArgs {
  adds?: string[];
  items?: TodoItem[];
}

const AddTodoIntervention = memo<MobileBuiltinInterventionProps<CreateTodosArgs>>(
  ({ args, onArgsChange, registerBeforeApprove }) => {
    const { t } = useI18n();
    const colors = useThemeColors();
    const defaultItems: TodoItem[] =
      args?.items ?? args?.adds?.map((text) => ({ status: 'todo', text })) ?? [];
    const [items, setItems] = useState<TodoItem[]>(defaultItems);
    const [newText, setNewText] = useState('');

    useEffect(() => {
      const next =
        args?.items ?? args?.adds?.map((text) => ({ status: 'todo', text })) ?? [];
      setItems(next);
    }, [args?.items, args?.adds]);

    const save = useCallback(async () => {
      await onArgsChange?.({ items });
    }, [items, onArgsChange]);

    useEffect(() => {
      return registerBeforeApprove?.('addTodo', save);
    }, [registerBeforeApprove, save]);

    const addItem = useCallback(() => {
      const text = newText.trim();
      if (!text) return;
      setItems((prev) => [...prev, { status: 'todo', text }]);
      setNewText('');
    }, [newText]);

    const updateItem = useCallback((index: number, text: string) => {
      setItems((prev) =>
        prev.map((item, i) => (i === index ? { ...item, text } : item)),
      );
    }, []);

    const removeItem = useCallback((index: number) => {
      setItems((prev) => prev.filter((_, i) => i !== index));
    }, []);

    return (
      <View className="gap-2 py-2">
        {items.map((item, index) => (
          <View
            key={index}
            className="flex-row items-center gap-2"
            style={{
              backgroundColor: colors.overlay,
              borderColor: colors.border,
              borderRadius: 8,
              borderWidth: 1,
              paddingHorizontal: 12,
              paddingVertical: 8,
            }}
          >
            <TextInput
              className="flex-1 text-[13px]"
              placeholder={t.chatToolGtdAddTodoPlaceholder}
              placeholderTextColor={colors.tertiaryText}
              style={{ color: colors.foreground }}
              value={item.text}
              onChangeText={(text) => updateItem(index, text)}
            />
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => removeItem(index)}
              hitSlop={{ bottom: 8, left: 8, right: 8, top: 8 }}
            >
              <Text className="text-[12px]" style={{ color: colors.danger }}>
                ×
              </Text>
            </TouchableOpacity>
          </View>
        ))}
        <View className="flex-row items-center gap-2">
          <TextInput
            className="flex-1 rounded-lg px-3 py-2 text-[13px]"
            placeholder={t.chatToolGtdAddTodoPlaceholder}
            placeholderTextColor={colors.tertiaryText}
            style={{
              backgroundColor: colors.overlay,
              borderColor: colors.border,
              borderWidth: 1,
              color: colors.foreground,
            }}
            value={newText}
            onChangeText={setNewText}
            onSubmitEditing={addItem}
          />
          <TouchableOpacity
            activeOpacity={0.7}
            className="rounded-lg p-2"
            style={{ backgroundColor: colors.primaryMuted }}
            onPress={addItem}
          >
            <Plus color={colors.primary} size={18} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>
    );
  },
);

AddTodoIntervention.displayName = 'GTDAddTodoIntervention';

export default AddTodoIntervention;
