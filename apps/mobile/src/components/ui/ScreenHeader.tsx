import { BlurView } from 'expo-blur';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '../../lib/i18n';
import { useThemeStore } from '../../store/theme';
import { useThemeColors } from '../../theme/colors';

/** 'flat' = enterprise-style solid bg + border; 'blur' = glassmorphic */
type HeaderStyle = 'flat' | 'blur';

interface ScreenHeaderProps {
  children?: React.ReactNode;
  /** 'flat' for enterprise look (default); 'blur' for glassmorphic */
  headerStyle?: HeaderStyle;
  leftActions?: React.ReactNode;
  leftElement?: React.ReactNode;
  onPressLeft?: () => void;
  onPressRight?: () => void;
  rightAccessibilityHint?: string;
  rightAccessibilityLabel?: string;
  rightActions?: React.ReactNode;
  rightElement?: React.ReactNode;
  subtitle?: string;
  title: string;
  titleIcon?: React.ReactNode;
  titleNode?: React.ReactNode;
}

export function ScreenHeader({
  title,
  subtitle,
  children,
  leftActions,
  leftElement,
  rightElement,
  rightActions,
  rightAccessibilityLabel,
  rightAccessibilityHint,
  titleIcon,
  titleNode,
  headerStyle = 'flat',
  onPressLeft,
  onPressRight,
}: ScreenHeaderProps) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const isSubScreen = !!leftElement;
  const effectiveTheme = useThemeStore((s) => s.effectiveTheme);
  const blurTint = effectiveTheme === 'dark' ? 'dark' : 'light';
  const useFlat = headerStyle === 'flat';

  const headerContent = (content: React.ReactNode) =>
    useFlat ? (
      <View
        className="border-b"
        style={{
          backgroundColor: colors.background,
          borderColor: colors.border,
          paddingTop: insets.top,
        }}
      >
        {content}
      </View>
    ) : (
      <BlurView intensity={85} style={{ paddingTop: insets.top }} tint={blurTint}>
        {content}
      </BlurView>
    );

  const subScreenContent = (
    <>
      <View className="flex-row items-center justify-between px-5 py-3" style={{ minHeight: 64 }}>
        <TouchableOpacity
          accessibilityHint={t.accessibilityHintGoBack}
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
            <View className="mr-2.5 h-[28px] w-[28px] items-center justify-center">
              {titleIcon}
            </View>
          ) : null}
          <Text
            className="flex-1 text-[22px] font-semibold tracking-tighter"
            numberOfLines={1}
            style={{ color: colors.foreground }}
          >
            {title}
          </Text>
        </View>

        {rightActions ? (
          <View style={{ minWidth: 40 }}>{rightActions}</View>
        ) : rightElement ? (
          <TouchableOpacity
            accessibilityHint={rightAccessibilityHint}
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
    </>
  );

  const mainScreenContent = (
    <>
      <View className="px-5 pt-3 pb-2" style={{ minHeight: 56 }}>
        <View className="flex-row items-center justify-between">
          <View className="mr-3 flex-1 flex-row items-center" style={{ minHeight: 34 }}>
            {leftActions ? (
              <View className="mr-2.5 flex-row items-center justify-center">{leftActions}</View>
            ) : null}
            {titleIcon ? (
              <View className="mr-2.5 h-[28px] w-[28px] items-center justify-center">
                {titleIcon}
              </View>
            ) : null}
            {titleNode ? (
              <View className="flex-1 justify-center">{titleNode}</View>
            ) : (
              <View className="flex-1 justify-center">
                <Text
                  className="text-[22px] font-semibold tracking-tighter"
                  style={{ color: colors.foreground }}
                >
                  {title}
                </Text>
                {subtitle ? (
                  <Text
                    className="mt-0.5 text-[12px] font-medium"
                    numberOfLines={1}
                    style={{ color: colors.muted }}
                  >
                    {subtitle}
                  </Text>
                ) : null}
              </View>
            )}
          </View>
          {rightActions ? (
            <View className="flex-row items-center justify-end" style={{ minWidth: 40 }}>
              {rightActions}
            </View>
          ) : rightElement ? (
            <TouchableOpacity
              accessibilityHint={rightAccessibilityHint}
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
    </>
  );

  if (isSubScreen) {
    return headerContent(subScreenContent);
  }

  return headerContent(mainScreenContent);
}
