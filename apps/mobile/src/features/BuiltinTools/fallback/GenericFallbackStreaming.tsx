/**
 * Generic fallback streaming placeholder for builtin tools.
 * Used when tool is executing but no tool-specific streaming component exists.
 * Aligns RN with Web: agent-builder, agent-management, group-agent-builder, local-system, etc.
 */
import { Loader2 } from 'lucide-react-native';
import React, { memo } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { useI18n } from '../../../lib/i18n';
import { useThemeColors } from '../../../theme/colors';
import type { MobileBuiltinStreamingProps } from '../types';

const GenericFallbackStreaming = memo<MobileBuiltinStreamingProps>(() => {
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
      <Loader2 color={colors.primary} size={16} strokeWidth={2} />
      <Text
        className="flex-1 text-[13px]"
        numberOfLines={1}
        style={{ color: colors.secondaryText }}
      >
        {t.chatToolStreamingRunning}
      </Text>
    </View>
  );
});

GenericFallbackStreaming.displayName = 'GenericFallbackStreaming';

export default GenericFallbackStreaming;
