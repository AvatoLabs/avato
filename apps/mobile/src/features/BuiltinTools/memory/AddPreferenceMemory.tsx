/**
 * Memory AddPreferenceMemory Render — RN version.
 * Displays preference memory (title, summary, details) from args or content.
 */
import { Heart } from 'lucide-react-native';
import React, { memo, useMemo } from 'react';
import { Text, View } from 'react-native';

import { useThemeColors } from '../../../theme/colors';
import type { MobileBuiltinRenderProps } from '../types';

interface PreferenceData {
  title?: string;
  summary?: string;
  details?: string;
}

function parsePreference(args?: string, content?: string): PreferenceData | null {
  if (args) {
    try {
      const parsed = JSON.parse(args) as PreferenceData;
      if (parsed.title || parsed.summary) return parsed;
    } catch {
      //
    }
  }
  if (content) {
    try {
      const parsed = JSON.parse(content) as { state?: PreferenceData };
      return parsed.state ?? null;
    } catch {
      return null;
    }
  }
  return null;
}

const AddPreferenceMemoryRender = memo<MobileBuiltinRenderProps>(({ arguments: argsStr, content }) => {
  const colors = useThemeColors();
  const data = useMemo(() => parsePreference(argsStr, content), [argsStr, content]);

  if (!data) return null;

  if (!data.title && !data.summary && !data.details) return null;

  return (
    <View
      className="rounded-xl border p-3"
      style={{
        backgroundColor: colors.background,
        borderColor: colors.border,
      }}
    >
      <View className="flex-row items-center gap-2 mb-2">
        <Heart color={colors.primary} size={16} strokeWidth={2} />
        <Text className="text-[13px] font-semibold" style={{ color: colors.foreground }}>
          {data.title || 'Preference'}
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

AddPreferenceMemoryRender.displayName = 'MemoryAddPreferenceRender';

export default AddPreferenceMemoryRender;
