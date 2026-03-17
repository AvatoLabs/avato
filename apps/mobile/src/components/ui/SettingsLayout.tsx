/**
 * SettingsLayout — Shared section/row components for Settings subpages.
 * Aligned with Memory page style: section titles, list item cards.
 */
import { ChevronRight } from 'lucide-react-native';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { semanticColors } from '../../constants/colors';
import { tokens } from '../../theme/tokens';

export interface SettingsRowProps {
  icon: React.ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;
  iconBg?: string;
  iconColor?: string;
  label: string;
  onPress?: () => void;
  subtitle?: string;
}

export function SettingsRow({
  icon: IconComp,
  iconBg = 'bg-primary/10',
  iconColor = semanticColors.primary,
  label,
  onPress,
  subtitle,
}: SettingsRowProps) {
  const content = (
    <>
      <View className={`w-8 h-8 rounded-full ${iconBg} items-center justify-center mr-4`}>
        <IconComp color={iconColor} size={16} strokeWidth={tokens.icon.strokeWidth} />
      </View>
      <View className="flex-1">
        <Text className="text-foreground text-[15.5px] font-medium tracking-tight">{label}</Text>
        {subtitle && (
          <Text className="text-secondary/70 text-[12.5px] mt-0.5 font-medium">{subtitle}</Text>
        )}
      </View>
      {onPress ? (
        <ChevronRight color={semanticColors.primary} size={18} strokeWidth={tokens.icon.strokeWidth} />
      ) : null}
    </>
  );

  if (!onPress) {
    return <View className="flex-row items-center px-5 py-3.5 mb-2 rounded-2xl bg-foreground/[0.02]">{content}</View>;
  }

  return (
    <TouchableOpacity
      activeOpacity={0.6}
      className="flex-row items-center px-5 py-3.5 mb-2 rounded-2xl bg-foreground/[0.02] active:bg-foreground/[0.04]"
      onPress={onPress}
    >
      {content}
    </TouchableOpacity>
  );
}

export interface SettingsSectionProps {
  children: React.ReactNode;
  delay?: number;
  title: string;
}

export function SettingsSection({ children, delay = 0, title }: SettingsSectionProps) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(300)}>
      <View className="mb-5 px-5">
        <Text className="px-2 mb-2 text-secondary/60 text-[11px] font-semibold uppercase tracking-widest">
          {title}
        </Text>
        <View>{children}</View>
      </View>
    </Animated.View>
  );
}
