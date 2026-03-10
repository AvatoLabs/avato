import { BlurView } from 'expo-blur';
import type { LucideIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

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
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      className="w-[140px] rounded-xl overflow-hidden mr-3 active:opacity-80"
      onPress={onPress}
    >
      <BlurView
        className="flex-1 p-3.5 border border-black/5 dark:border-white/10"
        intensity={isDark ? 20 : 40}
        tint={isDark ? 'dark' : 'light'}
      >
        <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center mb-3">
          <IconComp color={isDark ? '#0a84ff' : '#007aff'} size={18} strokeWidth={tokens.icon.strokeWidth} />
        </View>
        <Text className="text-foreground text-[14px] font-semibold tracking-tight mb-1" numberOfLines={1}>
          {name}
        </Text>
        <Text className="text-secondary text-[12px] leading-[16px] font-medium" numberOfLines={2}>
          {description}
        </Text>
      </BlurView>
    </TouchableOpacity>
  );
}
