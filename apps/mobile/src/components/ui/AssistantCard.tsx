import { BlurView } from 'expo-blur';
import type { LucideIcon } from 'lucide-react-native';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { useThemeStore } from '../../store/theme';
import { useThemeColors } from '../../theme/colors';
import { tokens } from '../../theme/tokens';

interface AssistantCardProps {
  description: string;
  icon: LucideIcon;
  name: string;
  onPress?: () => void;
}

/**
 * AssistantCard — Compact card for horizontal scroll in Home and Studio.
 */
export function AssistantCard({ name, description, icon: IconComp, onPress }: AssistantCardProps) {
  const effectiveTheme = useThemeStore((s) => s.effectiveTheme);
  const colors = useThemeColors();
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      className="w-[140px] rounded-xl overflow-hidden mr-3 shadow-sm active:opacity-80"
      onPress={onPress}
    >
      <BlurView
        className="flex-1 p-3.5 border border-border"
        intensity={40}
        tint={effectiveTheme === 'dark' ? 'dark' : 'light'}
      >
        <View className="w-10 h-10 rounded-full items-center justify-center mb-3" style={{ backgroundColor: colors.primarySubtle }}>
          <IconComp color={colors.primary} size={18} strokeWidth={tokens.icon.strokeWidth} />
        </View>
        <Text
          className="text-foreground text-[14px] font-semibold tracking-tight mb-1"
          numberOfLines={1}
        >
          {name}
        </Text>
        <Text className="text-secondary text-[12px] leading-[16px] font-medium" numberOfLines={2}>
          {description}
        </Text>
      </BlurView>
    </TouchableOpacity>
  );
}
