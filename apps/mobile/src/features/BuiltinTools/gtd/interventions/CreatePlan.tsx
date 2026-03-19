/**
 * GTD CreatePlan Intervention — Edit goal, description, context before approve.
 */
import React, { memo, useCallback, useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { useI18n } from '../../../../lib/i18n';
import { useThemeColors } from '../../../../theme/colors';
import type { MobileBuiltinInterventionProps } from '../../types';

interface CreatePlanArgs {
  goal?: string;
  description?: string;
  context?: string;
}

const CreatePlanIntervention = memo<MobileBuiltinInterventionProps<CreatePlanArgs>>(
  ({ args, onArgsChange, registerBeforeApprove }) => {
    const { t } = useI18n();
    const colors = useThemeColors();
    const [goal, setGoal] = useState(args?.goal ?? '');
    const [description, setDescription] = useState(args?.description ?? '');
    const [context, setContext] = useState(args?.context ?? '');

    useEffect(() => {
      setGoal(args?.goal ?? '');
      setDescription(args?.description ?? '');
      setContext(args?.context ?? '');
    }, [args?.goal, args?.description, args?.context]);

    const save = useCallback(async () => {
      const changes: CreatePlanArgs = { goal, description, context };
      await onArgsChange?.(changes);
    }, [goal, description, context, onArgsChange]);

    useEffect(() => {
      return registerBeforeApprove?.('createPlan', save);
    }, [registerBeforeApprove, save]);

    return (
      <View className="gap-3 py-2">
        <TextInput
          className="rounded-lg px-3 py-2 text-[14px]"
          placeholder={t.chatToolGtdPlanGoalPlaceholder}
          placeholderTextColor={colors.tertiaryText}
          style={{
            backgroundColor: colors.overlay,
            borderColor: colors.border,
            borderWidth: 1,
            color: colors.foreground,
          }}
          value={goal}
          onChangeText={setGoal}
        />
        <TextInput
          className="rounded-lg px-3 py-2 text-[13px]"
          placeholder={t.chatToolGtdPlanDescPlaceholder}
          placeholderTextColor={colors.tertiaryText}
          style={{
            backgroundColor: colors.overlay,
            borderColor: colors.border,
            borderWidth: 1,
            color: colors.foreground,
          }}
          value={description}
          onChangeText={setDescription}
        />
        <TextInput
          className="rounded-lg px-3 py-2 text-[13px] min-h-[80px]"
          multiline
          numberOfLines={4}
          placeholder={t.chatToolGtdPlanContextPlaceholder}
          placeholderTextColor={colors.tertiaryText}
          style={{
            backgroundColor: colors.overlay,
            borderColor: colors.border,
            borderWidth: 1,
            color: colors.foreground,
            textAlignVertical: 'top',
          }}
          value={context}
          onChangeText={setContext}
        />
      </View>
    );
  },
);

CreatePlanIntervention.displayName = 'GTDCreatePlanIntervention';

export default CreatePlanIntervention;
