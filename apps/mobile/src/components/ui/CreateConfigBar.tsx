import { ChevronRight, Sparkles } from 'lucide-react-native';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { useThemeColors } from '../../theme/colors';
import { tokens } from '../../theme/tokens';

interface CreateConfigBarProps {
  label: string;
  onPress: () => void;
  summary?: string;
}

export function CreateConfigBar({ label, onPress, summary }: CreateConfigBarProps) {
  const colors = useThemeColors();

  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.78}
      className="mx-4 mb-2 flex-row items-center rounded-2xl px-4 py-3"
      style={{
        backgroundColor: colors.fillQuaternary,
        borderColor: colors.borderSubtle,
        borderWidth: 1,
      }}
      onPress={onPress}
    >
      <View
        className="mr-3 h-9 w-9 items-center justify-center rounded-full"
        style={{ backgroundColor: colors.primaryMuted }}
      >
        <Sparkles color={colors.primary} size={16} strokeWidth={tokens.icon.strokeWidth} />
      </View>

      <View className="flex-1">
        <Text className="text-[14px] font-semibold text-foreground" numberOfLines={1}>
          {label}
        </Text>
        {summary ? (
          <Text
            className="mt-0.5 text-[11px]"
            numberOfLines={1}
            style={{ color: colors.secondaryText }}
          >
            {summary}
          </Text>
        ) : null}
      </View>

      <ChevronRight color={colors.secondaryText} size={18} strokeWidth={tokens.icon.strokeWidth} />
    </TouchableOpacity>
  );
}
