/**
 * Memory AddExperienceMemory Render — RN version.
 * Displays experience memory (title, summary, details) from args or content.
 */
import { Brain } from 'lucide-react-native';
import React, { memo, useMemo } from 'react';
import { Text, View } from 'react-native';

import { useThemeColors } from '../../../theme/colors';
import type { MobileBuiltinRenderProps } from '../types';

interface ExperienceData {
  title?: string;
  summary?: string;
  details?: string;
  action?: string;
  situation?: string;
}

function parseExperience(args?: string, content?: string): ExperienceData | null {
  if (args) {
    try {
      const parsed = JSON.parse(args) as ExperienceData;
      if (parsed.title || parsed.summary || parsed.action) return parsed;
    } catch {
      //
    }
  }
  if (content) {
    try {
      const parsed = JSON.parse(content) as { state?: ExperienceData };
      const d = parsed.state;
      return d ?? null;
    } catch {
      return null;
    }
  }
  return null;
}

const AddExperienceMemoryRender = memo<MobileBuiltinRenderProps>(({ arguments: argsStr, content }) => {
  const colors = useThemeColors();
  const data = useMemo(() => parseExperience(argsStr, content), [argsStr, content]);

  if (!data) return null;

  const title = data.title || data.action;
  if (!title && !data.summary && !data.details) return null;

  return (
    <View
      className="rounded-xl border p-3"
      style={{
        backgroundColor: colors.background,
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

AddExperienceMemoryRender.displayName = 'MemoryAddExperienceRender';

export default AddExperienceMemoryRender;
