/**
 * GTD clearTodos intervention — choose completed-only vs all (aligned with Web ClearTodos).
 */
import { Trash2 } from 'lucide-react-native';
import React, { memo, useCallback, useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { useI18n } from '../../../../lib/i18n';
import { useThemeColors } from '../../../../theme/colors';
import type { MobileBuiltinInterventionProps } from '../../types';

type ClearMode = 'all' | 'completed';

interface ClearTodosArgs {
  mode?: ClearMode;
}

const ClearTodosIntervention = memo<MobileBuiltinInterventionProps<ClearTodosArgs>>(
  ({ args, onArgsChange, registerBeforeApprove }) => {
    const { t } = useI18n();
    const colors = useThemeColors();
    const [mode, setMode] = useState<ClearMode>(args?.mode === 'all' ? 'all' : 'completed');

    useEffect(() => {
      setMode(args?.mode === 'all' ? 'all' : 'completed');
    }, [args?.mode]);

    const save = useCallback(async () => {
      await onArgsChange?.({ mode });
    }, [mode, onArgsChange]);

    useEffect(() => {
      return registerBeforeApprove?.('clearTodos', save);
    }, [registerBeforeApprove, save]);

    const selectMode = useCallback(
      async (next: ClearMode) => {
        setMode(next);
        await onArgsChange?.({ mode: next });
      },
      [onArgsChange],
    );

    return (
      <View className="gap-3 py-2">
        <View className="flex-row items-center gap-2">
          <Trash2 color={colors.warning} size={16} strokeWidth={2} />
          <Text className="text-[14px] font-semibold" style={{ color: colors.foreground }}>
            {t.chatToolGtdClearHeader}
          </Text>
        </View>
        <Text className="text-[12px]" style={{ color: colors.secondaryText }}>
          {t.chatToolGtdClearLabel}
        </Text>
        <TouchableOpacity
          activeOpacity={0.7}
          className="rounded-xl border px-3 py-2.5"
          style={{
            backgroundColor: mode === 'completed' ? colors.primarySubtle : colors.overlay,
            borderColor: mode === 'completed' ? colors.primary : colors.border,
          }}
          onPress={() => void selectMode('completed')}
        >
          <Text className="text-[13px]" style={{ color: colors.foreground }}>
            {t.chatToolGtdClearCompleted}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          className="rounded-xl border px-3 py-2.5"
          style={{
            backgroundColor: mode === 'all' ? colors.dangerMuted : colors.overlay,
            borderColor: mode === 'all' ? colors.danger : colors.border,
          }}
          onPress={() => void selectMode('all')}
        >
          <Text className="text-[13px] font-medium" style={{ color: colors.danger }}>
            {t.chatToolGtdClearAll}
          </Text>
        </TouchableOpacity>
      </View>
    );
  },
);

ClearTodosIntervention.displayName = 'ClearTodosIntervention';

export default ClearTodosIntervention;
