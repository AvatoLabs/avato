/**
 * SettingsLayout — Shared section/row components for Settings subpages.
 * Aligned with Memory page style: section titles, list item cards.
 */
import { ChevronRight } from 'lucide-react-native';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { useThemeColors } from '../../theme/colors';
import { enteringSection } from '../../theme/motion';
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
          <Text
            className="mt-0.5 text-[12.5px] font-medium"
            style={{ color: colors.secondaryText }}
          >
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
      <View
        className="mb-2 flex-row items-center rounded-xl px-5 py-3.5"
        style={{
          backgroundColor: colors.fillQuaternary,
          borderColor: colors.borderSubtle,
          borderWidth: 1,
        }}
      >
        {content}
      </View>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.72}
      className="mb-2 flex-row items-center rounded-xl px-5 py-3.5"
      style={{
        backgroundColor: colors.fillQuaternary,
        borderColor: colors.borderSubtle,
        borderWidth: 1,
      }}
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
    <Animated.View entering={enteringSection(delay)}>
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
