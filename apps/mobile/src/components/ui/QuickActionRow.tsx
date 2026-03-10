import type { LucideIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { tokens } from '../../theme/tokens';

interface QuickAction {
  icon: LucideIcon;
  key: string;
  label: string;
}

interface QuickActionRowProps {
  actions: QuickAction[];
  onPress?: (key: string) => void;
}

/**
 * QuickActionRow — Horizontal row of 4 action pills for the home screen.
 */
export function QuickActionRow({ actions, onPress }: QuickActionRowProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View className="px-5 mb-6">
      <View className="flex-row gap-2">
        {actions.map((action) => {
          const IconComp = action.icon;
          return (
            <TouchableOpacity
              activeOpacity={0.7}
              className="flex-1 bg-foreground/5 dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-xl py-3 items-center justify-center active:bg-foreground/10"
              key={action.key}
              onPress={() => onPress?.(action.key)}
            >
              <IconComp
                color={isDark ? '#a6a6a6' : '#8c8c8c'}
                size={18}
                strokeWidth={tokens.icon.strokeWidth}
              />
              <Text className="text-secondary text-[12px] font-medium mt-1.5 tracking-tight">
                {action.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
