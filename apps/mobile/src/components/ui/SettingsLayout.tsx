/**
 * SettingsLayout — Shared section/row components for Settings subpages.
 * Aligned with Memory page style: section titles, list item cards.
 */
import { ChevronRight } from 'lucide-react-native';
import React from 'react';
import { Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { getResponsiveLayoutMetrics } from '../../lib/responsiveLayout';
import { useThemeColors } from '../../theme/colors';
import { enteringSection } from '../../theme/motion';
import { tokens } from '../../theme/tokens';

export interface SettingsRowProps {
  /** Destructive row — label uses danger color (e.g. reset app). */
  danger?: boolean;
  icon: React.ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;
  iconBg?: string;
  iconColor?: string;
  /** Icon glyph size; container stays 32×32. Default 16 (aligned with main settings list). */
  iconSize?: number;
  label: string;
  onPress?: () => void;
  subtitle?: string;
}

export function SettingsRow({
  danger = false,
  icon: IconComp,
  iconBg = 'bg-primary/10',
  iconColor,
  iconSize = 16,
  label,
  onPress,
  subtitle,
}: SettingsRowProps) {
  const colors = useThemeColors();
  const effectiveIconColor = iconColor ?? colors.primary;
  const isPrimaryIconBg = iconBg === 'bg-primary/10';
  const labelColor = danger ? colors.danger : colors.foreground;
  const content = (
    <>
      <View
        className={`w-8 h-8 rounded-full items-center justify-center mr-4 ${!isPrimaryIconBg ? iconBg : ''}`}
        style={isPrimaryIconBg ? { backgroundColor: colors.primarySubtle } : undefined}
      >
        <IconComp
          color={effectiveIconColor}
          size={iconSize}
          strokeWidth={tokens.icon.strokeWidth}
        />
      </View>
      <View className="flex-1">
        <Text className="text-[15.5px] font-medium tracking-tight" style={{ color: labelColor }}>
          {label}
        </Text>
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
  /** Optional muted line under the section title (e.g. explain duplicate entries). */
  description?: string;
  title: string;
}

export function SettingsSection({ children, delay = 0, description, title }: SettingsSectionProps) {
  const colors = useThemeColors();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const responsiveMetrics = getResponsiveLayoutMetrics(screenWidth, screenHeight);

  return (
    <Animated.View entering={enteringSection(delay)}>
      <View
        className="mb-5 px-5"
        style={{
          alignSelf: 'center',
          maxWidth: responsiveMetrics.settingsMaxWidth,
          width: '100%',
        }}
      >
        <Text
          className="mb-2 px-2 text-[13px] font-semibold tracking-tight"
          style={{ color: colors.secondaryText }}
        >
          {title}
        </Text>
        {description ? (
          <Text
            className="mb-2 px-2 text-[12px] font-medium leading-snug"
            style={{ color: colors.tertiaryText }}
          >
            {description}
          </Text>
        ) : null}
        <View>{children}</View>
      </View>
    </Animated.View>
  );
}
