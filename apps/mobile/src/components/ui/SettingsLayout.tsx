/**
 * SettingsLayout — Shared section/row components for Settings subpages.
 * Aligned with Memory page style: section titles, list item cards.
 */
import { ChevronRight } from 'lucide-react-native';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useThemeColors } from '../../theme/colors';
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
  iconColor,
  label,
  onPress,
  subtitle,
}: SettingsRowProps) {
  const colors = useThemeColors();
  const effectiveIconColor = iconColor ?? colors.primary;
  const isPrimaryIconBg = iconBg === 'bg-primary/10';
  const content = (
    <>
      <View
        className={`w-8 h-8 rounded-full items-center justify-center mr-4 ${!isPrimaryIconBg ? iconBg : ''}`}
        style={isPrimaryIconBg ? { backgroundColor: colors.primarySubtle } : undefined}
      >
        <IconComp color={effectiveIconColor} size={16} strokeWidth={tokens.icon.strokeWidth} />
      </View>
      <View className="flex-1">
        <Text className="text-foreground text-[15.5px] font-medium tracking-tight">{label}</Text>
        {subtitle && (
          <Text className="mt-0.5 text-[12.5px] font-medium" style={{ color: colors.secondaryText }}>
            {subtitle}
          </Text>
        )}
      </View>
      {onPress ? (
        <ChevronRight
          color={colors.secondaryText}
          size={18}
          strokeWidth={tokens.icon.strokeWidth}
        />
      ) : null}
    </>
  );

  if (!onPress) {
    return (
      <View className="flex-row items-center px-5 py-3.5 mb-2 rounded-xl bg-foreground/[0.02]">
        {content}
      </View>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.6}
      className="flex-row items-center px-5 py-3.5 mb-2 rounded-xl bg-foreground/[0.02] active:bg-foreground/[0.04]"
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
  const colors = useThemeColors();
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(300)}>
      <View className="mb-5 px-5">
        <Text
          className="mb-2 px-2 text-[13px] font-semibold tracking-tight"
          style={{ color: colors.secondaryText }}
        >
          {title}
        </Text>
        <View>{children}</View>
      </View>
    </Animated.View>
  );
}
