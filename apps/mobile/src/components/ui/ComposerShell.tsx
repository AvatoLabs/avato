import { BlurView } from 'expo-blur';
import React, { useEffect } from 'react';
import {
  Platform,
  Text,
  TouchableOpacity,
  type TouchableOpacityProps,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { useThemeStore } from '../../store/theme';
import { useThemeColors } from '../../theme/colors';
import { tokens } from '../../theme/tokens';

interface ComposerShellProps {
  active?: boolean;
  children: React.ReactNode;
  style?: ViewStyle;
}

interface ComposerIconButtonProps extends Omit<TouchableOpacityProps, 'style'> {
  active?: boolean;
  badge?: React.ReactNode;
  containerStyle?: ViewStyle;
}

interface ComposerToolbarPillProps extends Omit<TouchableOpacityProps, 'style'> {
  active?: boolean;
  containerStyle?: ViewStyle;
  label: string;
  leading?: React.ReactNode;
  maxWidth?: number;
  trailing?: React.ReactNode;
}

interface ComposerPrimaryActionProps extends Omit<TouchableOpacityProps, 'style'> {
  active?: boolean;
  children: React.ReactNode;
  containerStyle?: ViewStyle;
  /** When set, renders a wider pill with icon + label (e.g. Generate). */
  label?: string;
  labelStyle?: { color?: string; fontSize?: number; fontWeight?: '400' | '500' | '600' | '700' };
}

const COMPOSER_RADIUS = tokens.radius.xl;
const TOOLBAR_ICON_SIZE = 32;
const TOOLBAR_PILL_HEIGHT = 32;
const TOOLBAR_PILL_RADIUS = TOOLBAR_PILL_HEIGHT / 2;
const TOOLBAR_HIT_SLOP = 8;
const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

const useComposerProgress = (active: boolean, spring = tokens.motion.spring.gentle, mass = 1) => {
  const progress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(active ? 1 : 0, {
      ...spring,
      mass,
    });
  }, [active, mass, progress, spring]);

  return progress;
};

export function ComposerShell({ active = false, children, style }: ComposerShellProps) {
  const colors = useThemeColors();
  const effectiveTheme = useThemeStore((s) => s.effectiveTheme);
  const useNativeBlur = Platform.OS !== 'android';
  const progress = useComposerProgress(active);

  const shellAnimatedStyle = useAnimatedStyle(() => ({
    elevation: 2 + progress.value * 10,
    shadowColor: colors.shadow,
    shadowOffset: { height: 8 + progress.value * 10, width: 0 },
    shadowOpacity: 0.08 + progress.value * 0.1,
    shadowRadius: 18 + progress.value * 10,
    transform: [{ scale: 1 + progress.value * 0.006 }, { translateY: -progress.value * 2 }],
  }));

  const haloAnimatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value * 0.75,
    transform: [{ scale: 0.985 + progress.value * 0.04 }],
  }));

  const shellInnerAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: colors.overlay,
    borderColor: interpolateColor(
      progress.value,
      [0, 1],
      [colors.borderSubtle, colors.primaryBorder],
    ),
    borderWidth: 1,
  }));

  return (
    <Animated.View style={[shellAnimatedStyle, style]}>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            backgroundColor: colors.primarySubtle,
            borderRadius: COMPOSER_RADIUS + 4,
            bottom: -2,
            left: -2,
            position: 'absolute',
            right: -2,
            top: -2,
          },
          haloAnimatedStyle,
        ]}
      />
      <Animated.View
        className="overflow-hidden"
        style={[shellInnerAnimatedStyle, { borderRadius: COMPOSER_RADIUS }]}
      >
        {useNativeBlur ? (
          <BlurView
            intensity={active ? 92 : 78}
            tint={effectiveTheme === 'dark' ? 'dark' : 'light'}
          >
            {children}
          </BlurView>
        ) : (
          children
        )}
      </Animated.View>
    </Animated.View>
  );
}

export function ComposerIconButton({
  active = false,
  badge,
  children,
  containerStyle,
  ...props
}: ComposerIconButtonProps) {
  const colors = useThemeColors();
  const progress = useComposerProgress(active);
  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [colors.fillTertiary, colors.primarySubtle],
    ),
    borderColor: interpolateColor(
      progress.value,
      [0, 1],
      [colors.borderSubtle, colors.primaryBorder],
    ),
    borderWidth: 1,
    transform: [
      { scale: interpolate(progress.value, [0, 1], [1, 1.04]) },
      { translateY: interpolate(progress.value, [0, 1], [0, -0.5]) },
    ],
  }));

  return (
    <AnimatedTouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.72}
      hitSlop={TOOLBAR_HIT_SLOP}
      style={[
        {
          alignItems: 'center',
          borderRadius: TOOLBAR_ICON_SIZE / 2,
          justifyContent: 'center',
          overflow: 'hidden',
          height: TOOLBAR_ICON_SIZE,
          width: TOOLBAR_ICON_SIZE,
        },
        animatedStyle,
        containerStyle,
      ]}
      {...props}
    >
      <View
        pointerEvents="none"
        style={{
          alignItems: 'center',
          height: TOOLBAR_ICON_SIZE,
          justifyContent: 'center',
          width: TOOLBAR_ICON_SIZE,
        }}
      >
        {children}
        {badge ? <View className="absolute -right-1.5 -top-0.5">{badge}</View> : null}
      </View>
    </AnimatedTouchableOpacity>
  );
}

export function ComposerToolbarPill({
  active = false,
  containerStyle,
  label,
  leading,
  maxWidth = 116,
  trailing,
  ...props
}: ComposerToolbarPillProps) {
  const colors = useThemeColors();
  const progress = useComposerProgress(active);
  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [colors.fillTertiary, colors.primarySubtle],
    ),
    borderColor: interpolateColor(
      progress.value,
      [0, 1],
      [colors.borderSubtle, colors.primaryBorder],
    ),
    borderWidth: 1,
    transform: [
      { scale: interpolate(progress.value, [0, 1], [1, 1.02]) },
      { translateY: interpolate(progress.value, [0, 1], [0, -0.5]) },
    ],
  }));

  return (
    <AnimatedTouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.72}
      hitSlop={TOOLBAR_HIT_SLOP}
      style={[
        {
          alignItems: 'center',
          borderRadius: TOOLBAR_PILL_RADIUS,
          flexDirection: 'row',
          height: TOOLBAR_PILL_HEIGHT,
          justifyContent: 'center',
          maxWidth,
          minWidth: 82,
          paddingHorizontal: 12,
        },
        animatedStyle,
        containerStyle,
      ]}
      {...props}
    >
      {leading ? <View style={{ marginRight: 6 }}>{leading}</View> : null}
      <Text
        numberOfLines={1}
        style={{
          color: colors.foreground,
          flexShrink: 1,
          fontSize: 13,
          fontWeight: '600',
          letterSpacing: -0.1,
        }}
      >
        {label}
      </Text>
      {trailing ? <View style={{ marginLeft: 4 }}>{trailing}</View> : null}
    </AnimatedTouchableOpacity>
  );
}

export function ComposerPrimaryAction({
  active = false,
  children,
  containerStyle,
  label,
  labelStyle,
  ...props
}: ComposerPrimaryActionProps) {
  const colors = useThemeColors();
  const progress = useComposerProgress(active, tokens.motion.spring.snappy);
  const actionSize = tokens.mobile.heights.composerAction;
  const labeled = Boolean(label);

  const actionAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [colors.fillTertiary, colors.primary],
    ),
    borderColor: interpolateColor(
      progress.value,
      [0, 1],
      [colors.borderSubtle, colors.primaryBorder],
    ),
    borderWidth: 1,
    elevation: interpolate(progress.value, [0, 1], [0, 8]),
    shadowColor: colors.shadow,
    shadowOffset: { height: interpolate(progress.value, [0, 1], [0, 8]), width: 0 },
    shadowOpacity: interpolate(progress.value, [0, 1], [0.02, 0.18]),
    shadowRadius: interpolate(progress.value, [0, 1], [6, 18]),
    transform: [
      { scale: interpolate(progress.value, [0, 1], [1, 1.06]) },
      { translateY: interpolate(progress.value, [0, 1], [0, -1.5]) },
    ],
  }));

  return (
    <AnimatedTouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.84}
      style={[
        {
          alignItems: 'center',
          borderRadius: actionSize / 2,
          flexDirection: labeled ? 'row' : undefined,
          gap: labeled ? 6 : undefined,
          height: actionSize,
          justifyContent: 'center',
          minWidth: labeled ? undefined : actionSize,
          overflow: 'hidden',
          paddingHorizontal: labeled ? 12 : undefined,
          width: labeled ? undefined : actionSize,
        },
        actionAnimatedStyle,
        containerStyle,
      ]}
      {...props}
    >
      {children}
      {labeled ? (
        <Text
          numberOfLines={1}
          style={{
            color: labelStyle?.color ?? (active ? colors.iconOnPrimary : colors.muted),
            fontSize: labelStyle?.fontSize ?? 13,
            fontWeight: labelStyle?.fontWeight ?? '700',
            letterSpacing: -0.2,
            maxWidth: 120,
          }}
        >
          {label}
        </Text>
      ) : null}
    </AnimatedTouchableOpacity>
  );
}

export function ComposerToolbarButton(props: ComposerIconButtonProps) {
  return <ComposerIconButton {...props} />;
}

export function ComposerCountBadge({ color, value }: { color: string; value: number | string }) {
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
