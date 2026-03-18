import { BlurView } from 'expo-blur';
import type { LucideIcon } from 'lucide-react-native';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { useThemeStore } from '../../store/theme';
import { useThemeColors } from '../../theme/colors';
import { tokens } from '../../theme/tokens';

interface WorkflowCardProps {
  description: string;
  icon: LucideIcon;
  onPress?: () => void;
  tag?: string;
  title: string;
}

/**
 * WorkflowCard — Featured horizontal card for Studio screen's hero section.
 */
export function WorkflowCard({
  title,
  description,
  tag,
  icon: IconComp,
  onPress,
}: WorkflowCardProps) {
  const effectiveTheme = useThemeStore((s) => s.effectiveTheme);
  const colors = useThemeColors();
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      className="w-[220px] rounded-xl overflow-hidden mr-3 shadow-sm active:opacity-80"
      onPress={onPress}
    >
      <BlurView
        className="flex-1 p-4 border border-border"
        intensity={40}
        tint={effectiveTheme === 'dark' ? 'dark' : 'light'}
      >
        <View className="flex-row items-center justify-between mb-3">
          <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center">
            <IconComp color={colors.primary} size={18} strokeWidth={tokens.icon.strokeWidth} />
          </View>
          {tag && (
            <View className="bg-primary/10 px-2.5 py-1 rounded-full">
              <Text className="text-primary text-[12px] font-semibold">{tag}</Text>
            </View>
          )}
        </View>
        <Text
          className="text-foreground text-[16px] font-semibold tracking-tight mb-1"
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text className="text-secondary text-[12px] leading-[16px] font-medium" numberOfLines={2}>
          {description}
        </Text>
      </BlurView>
    </TouchableOpacity>
  );
}
