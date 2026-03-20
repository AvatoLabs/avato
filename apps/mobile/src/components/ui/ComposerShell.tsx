import { BlurView } from 'expo-blur';
import React from 'react';
import {
  Platform,
  Text,
  TouchableOpacity,
  type TouchableOpacityProps,
  View,
  type ViewStyle,
} from 'react-native';

import { useThemeStore } from '../../store/theme';
import { useThemeColors } from '../../theme/colors';
import { tokens } from '../../theme/tokens';

interface ComposerShellProps {
  active?: boolean;
  children: React.ReactNode;
  style?: ViewStyle;
}

interface ComposerToolbarButtonProps extends TouchableOpacityProps {
  badge?: React.ReactNode;
}

interface ComposerPrimaryActionProps extends TouchableOpacityProps {
  active?: boolean;
  children: React.ReactNode;
}

export function ComposerShell({ active = false, children, style }: ComposerShellProps) {
  const colors = useThemeColors();
  const effectiveTheme = useThemeStore((s) => s.effectiveTheme);
  const useNativeBlur = Platform.OS !== 'android';
  const shellStyle: ViewStyle = {
    backgroundColor: colors.overlay,
    borderColor: active ? colors.primary : colors.primaryBorder,
    borderWidth: active ? 2 : 1,
  };

  return (
    <View className="overflow-hidden rounded-2xl" style={[shellStyle, style]}>
      {useNativeBlur ? (
        <BlurView intensity={80} tint={effectiveTheme === 'dark' ? 'dark' : 'light'}>
          {children}
        </BlurView>
      ) : (
        children
      )}
    </View>
  );
}

export function ComposerToolbarButton({
  badge,
  children,
  ...props
}: ComposerToolbarButtonProps) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.7}
      className="h-8 w-8 items-center justify-center rounded-full"
      {...props}
    >
      <View className="relative items-center justify-center">
        {children}
        {badge ? <View className="absolute -right-2 -top-1">{badge}</View> : null}
      </View>
    </TouchableOpacity>
  );
}

export function ComposerPrimaryAction({
  active = false,
  children,
  style,
  ...props
}: ComposerPrimaryActionProps) {
  const colors = useThemeColors();

  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.8}
      className="items-center justify-center rounded-full"
      style={{
        backgroundColor: active ? colors.primary : colors.fillTertiary,
        height: tokens.mobile.heights.composerAction,
        ...(style as object),
        width: tokens.mobile.heights.composerAction,
      }}
      {...props}
    >
      {children}
    </TouchableOpacity>
  );
}

export function ComposerCountBadge({
  color,
  value,
}: {
  color: string;
  value: number | string;
}) {
  const colors = useThemeColors();

  return (
    <View
      className="items-center justify-center rounded-full px-1"
      style={{
        backgroundColor: color,
        minHeight: 14,
        minWidth: 14,
      }}
    >
      <Text className="text-[9px] font-semibold" style={{ color: colors.iconOnPrimary }}>
        {value}
      </Text>
    </View>
  );
}
