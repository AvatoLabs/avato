import { BlurView } from 'expo-blur';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { semanticColors } from '../../constants/colors';
import { useI18n } from '../../lib/i18n';
import { useThemeStore } from '../../store/theme';

interface ScreenHeaderProps {
  children?: React.ReactNode;
  leftElement?: React.ReactNode;
  onPressLeft?: () => void;
  onPressRight?: () => void;
  rightAccessibilityLabel?: string;
  rightActions?: React.ReactNode;
  rightElement?: React.ReactNode;
  subtitle?: string;
  title: string;
  titleIcon?: React.ReactNode;
}

export function ScreenHeader({
  title,
  subtitle,
  children,
  leftElement,
  rightElement,
  rightActions,
  rightAccessibilityLabel,
  titleIcon,
  onPressLeft,
  onPressRight,
}: ScreenHeaderProps) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const isSubScreen = !!leftElement;
  const effectiveTheme = useThemeStore((s) => s.effectiveTheme);
  const blurTint = effectiveTheme === 'dark' ? 'dark' : 'light';

  if (isSubScreen) {
    return (
      <BlurView intensity={85} style={{ paddingTop: insets.top }} tint={blurTint}>
        <View className="flex-row items-center justify-between px-5 py-3" style={{ minHeight: 64 }}>
          <TouchableOpacity
            accessibilityLabel={t.accessibilityGoBack}
            accessibilityRole="button"
            activeOpacity={0.6}
            className="-ml-2 h-10 items-center justify-center px-1"
            disabled={!onPressLeft}
            style={{ minWidth: 40 }}
            onPress={onPressLeft}
          >
            {leftElement}
          </TouchableOpacity>

          <View className="ml-1 flex-1 flex-row items-center" style={{ minHeight: 34 }}>
            {titleIcon ? (
              <View className="mr-2 items-center justify-center" style={{ minHeight: 28 }}>
                {titleIcon}
              </View>
            ) : null}
            <Text
              className="flex-1 text-[22px] font-extrabold text-foreground tracking-tighter"
              numberOfLines={1}
            >
              {title}
            </Text>
          </View>

          {rightActions ? (
            <View style={{ minWidth: 40 }}>{rightActions}</View>
          ) : rightElement ? (
            <TouchableOpacity
              accessibilityLabel={rightAccessibilityLabel}
              accessibilityRole="button"
              activeOpacity={0.6}
              className="-mr-2 h-10 items-end justify-center px-1"
              disabled={!onPressRight}
              style={{ minWidth: 40 }}
              onPress={onPressRight}
            >
              {rightElement}
            </TouchableOpacity>
          ) : (
            <View style={{ minWidth: 40 }} />
          )}
        </View>
        {children}
      </BlurView>
    );
  }

  return (
    <BlurView intensity={85} style={{ paddingTop: insets.top }} tint={blurTint}>
      <View className="px-5 py-3" style={{ minHeight: 72 }}>
        <View className="flex-row items-center justify-between">
          <View className="flex-1 mr-3 flex-row items-center min-h-[34px]">
            {titleIcon ? (
              <View
                className="mr-2 items-center justify-center self-start"
                style={{ minHeight: 28, paddingTop: subtitle ? 0 : 0 }}
              >
                {titleIcon}
              </View>
            ) : null}
            <View className="flex-1 justify-center">
              <Text className="text-[22px] font-extrabold text-foreground tracking-tighter">
                {title}
              </Text>
              {subtitle ? (
                <Text
                  className="mt-0.5 text-[12px] font-medium"
                  numberOfLines={1}
                  style={{ color: semanticColors.muted }}
                >
                  {subtitle}
                </Text>
              ) : null}
            </View>
          </View>
          {rightActions ? (
            <View className="flex-row items-center justify-end" style={{ minWidth: 40 }}>
              {rightActions}
            </View>
          ) : rightElement ? (
            <TouchableOpacity
              accessibilityLabel={rightAccessibilityLabel}
              accessibilityRole="button"
              activeOpacity={0.6}
              className="w-10 h-10 items-center justify-center -mr-2"
              disabled={!onPressRight}
              onPress={onPressRight}
            >
              {rightElement}
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      {children}
    </BlurView>
  );
}
