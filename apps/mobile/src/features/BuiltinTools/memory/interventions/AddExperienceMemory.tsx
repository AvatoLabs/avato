/**
 * Memory AddExperienceMemory Intervention — Display experience data before approve.
 * Read-only review (matches Web behavior).
 */
import { Brain } from 'lucide-react-native';
import React, { memo } from 'react';
import { Text, View } from 'react-native';

import { useThemeColors } from '../../../../theme/colors';
import type { MobileBuiltinInterventionProps } from '../../types';

interface AddExperienceMemoryArgs {
  title?: string;
  summary?: string;
  details?: string;
  action?: string;
  situation?: string;
}

const AddExperienceMemoryIntervention = memo<
  MobileBuiltinInterventionProps<AddExperienceMemoryArgs>
>(({ args }) => {
  const colors = useThemeColors();
  const data = args ?? {};
  const title = data.title || data.action;

  if (!title && !data.summary && !data.details) return null;

  return (
    <View
      className="rounded-xl border p-3"
      style={{
        backgroundColor: colors.overlay,
        borderColor: colors.border,
      }}
    >
      <View className="flex-row items-center gap-2 mb-2">
        <Brain color={colors.primary} size={16} strokeWidth={2} />
        <Text className="text-[13px] font-semibold" style={{ color: colors.foreground }}>
          {title || 'Experience'}
        </Text>
      </View>
      {data.summary ? (
        <Text className="text-[12px] mb-1.5" style={{ color: colors.secondaryText }}>
          {data.summary}
        </Text>
      ) : null}
      {data.details ? (
        <Text className="text-[12px]" numberOfLines={4} style={{ color: colors.tertiaryText }}>
          {data.details}
        </Text>
      ) : null}
    </View>
  );
});

AddExperienceMemoryIntervention.displayName = 'MemoryAddExperienceMemoryIntervention';

export default AddExperienceMemoryIntervention;
