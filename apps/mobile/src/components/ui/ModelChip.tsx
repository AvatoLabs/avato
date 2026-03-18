import React from 'react';
import { Text, TouchableOpacity } from 'react-native';

import { useThemeColors } from '../../theme/colors';

interface ModelChipProps {
  active?: boolean;
  name: string;
  onPress?: () => void;
  provider: string;
}

function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return hex.length === 7 ? `${hex}${a}` : hex;
}

/**
 * ModelChip — Small pill showing model name + provider for horizontal scroll.
 */
export function ModelChip({ name, provider, active = false, onPress }: ModelChipProps) {
  const colors = useThemeColors();
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      className={`px-4 py-2 rounded-xl mr-2.5 border active:opacity-80 ${
        active ? '' : 'border-border'
      }`}
      style={
        active
          ? { backgroundColor: colors.primarySubtle, borderColor: withAlpha(colors.primary, 0.2) }
          : { backgroundColor: colors.fillTertiary, borderColor: colors.border }
      }
      onPress={onPress}
    >
      <Text
        className="text-[14px] font-semibold tracking-tight"
        style={{ color: active ? colors.primary : colors.foreground }}
      >
        {name}
      </Text>
      <Text
        className="text-[12px] font-medium mt-0.5"
        style={{ color: active ? withAlpha(colors.primary, 0.7) : colors.secondaryText }}
      >
        {provider}
      </Text>
    </TouchableOpacity>
  );
}
