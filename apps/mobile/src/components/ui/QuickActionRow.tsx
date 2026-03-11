import type { LucideIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React from 'react';
import { Text, View } from 'react-native';

import { haptics } from '../../lib/haptics';
import { themeColors } from '../../theme';
import { tokens } from '../../theme/tokens';
import PressableScale from './PressableScale';

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
  const colors = isDark ? themeColors.dark : themeColors.light;

  return (
    <View className="px-5 mb-6">
      <View className="flex-row gap-2">
        {actions.map((action) => {
          const IconComp = action.icon;
          return (
            <PressableScale
              className="flex-1 border border-black/5 dark:border-white/[0.06] rounded-xl py-3 items-center justify-center"
              key={action.key}
              onPress={() => {
                haptics.light();
                onPress?.(action.key);
              }}
            >
              <IconComp color={colors.secondary} size={18} strokeWidth={tokens.icon.strokeWidth} />
              <Text className="text-secondary text-[12px] font-medium mt-1.5 tracking-tight">
                {action.label}
              </Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}
