import React from 'react';
import { Text, TouchableOpacity, type TouchableOpacityProps, View } from 'react-native';

import { useThemeColors } from '../../theme/colors';

interface QuickActionChipProps extends TouchableOpacityProps {
  active?: boolean;
  icon?: React.ReactNode;
  label: string;
}

/** Hex alpha: 20% = 33, 10% = 1A */
function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return hex.length === 7 ? `${hex}${a}` : hex;
}

/**
 * A pill-shaped button for quick actions, tags, or tabs, using subtle layering.
 */
export function QuickActionChip({
  label,
  icon,
  active = false,
  className = '',
  ...props
}: QuickActionChipProps) {
  const colors = useThemeColors();
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      className={`flex-row items-center px-4 py-2 rounded-full border ${
        active ? '' : 'border-transparent active:bg-foreground/10'
      } ${className}`}
      style={
        active
          ? { backgroundColor: colors.primarySubtle, borderColor: withAlpha(colors.primary, 0.2) }
          : { backgroundColor: colors.fillTertiary }
      }
      {...props}
    >
      {icon && <View className="mr-1.5">{icon}</View>}
      <Text
        className="text-[14px] font-medium"
        style={{ color: active ? colors.primary : colors.foreground }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
