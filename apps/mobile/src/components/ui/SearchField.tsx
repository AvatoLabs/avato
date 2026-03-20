import { Search } from 'lucide-react-native';
import React, { useState } from 'react';
import { Platform, TextInput, type TextInputProps, View } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useThemeColors } from '../../theme/colors';
import { tokens } from '../../theme/tokens';

interface SearchFieldProps extends TextInputProps {
  containerClassName?: string;
  rightElement?: React.ReactNode;
  size?: 'compact' | 'default';
}

export const SearchField = ({
  ref,
  containerClassName = '',
  rightElement,
  size = 'default',
  onBlur,
  onFocus,
  style,
  ...props
}: SearchFieldProps & { ref?: React.RefObject<TextInput | null> }) => {
  const colors = useThemeColors();
  const [focused, setFocused] = useState(false);
  const compact = size === 'compact';
  const height = compact
    ? tokens.mobile.heights.filterChip
    : tokens.mobile.heights.segmentedControl;
  const iconSize = compact ? tokens.icon.size.sm : tokens.icon.size.md;
  const horizontalPadding = compact ? 14 : 16;
  const inputFontSize = compact ? tokens.typography.mobile.body - 1 : tokens.typography.mobile.body;
  const focusProgress = useSharedValue(0);

  const animatedContainerStyle = useAnimatedStyle(
    () => ({
      backgroundColor: interpolateColor(
        focusProgress.value,
        [0, 1],
        [colors.inputBg, colors.background],
      ),
      borderColor: interpolateColor(
        focusProgress.value,
        [0, 1],
        [colors.borderSubtle, colors.primaryBorder],
      ),
      elevation: Platform.OS === 'android' ? 1 + focusProgress.value * 4 : 0,
      shadowColor: colors.primary,
      shadowOffset: {
        height: 2 + focusProgress.value * 4,
        width: 0,
      },
      shadowOpacity: Platform.OS === 'ios' ? 0.02 + focusProgress.value * 0.1 : 0,
      shadowRadius: 4 + focusProgress.value * 10,
      transform: [{ scale: 1 + focusProgress.value * 0.01 }, { translateY: -focusProgress.value }],
    }),
    [colors.background, colors.borderSubtle, colors.inputBg, colors.primary, colors.primaryBorder],
  );

  return (
    <Animated.View
      className={`flex-row items-center rounded-full ${containerClassName}`}
      style={[
        {
          borderWidth: 1,
          minHeight: height,
          paddingHorizontal: horizontalPadding,
        },
        animatedContainerStyle,
      ]}
    >
      <Search
        color={focused ? colors.primary : colors.secondaryText}
        size={iconSize}
        strokeWidth={tokens.icon.strokeWidth}
      />
      <TextInput
        accessibilityLabel={props.accessibilityLabel ?? props.placeholder ?? 'Search'}
        placeholderTextColor={colors.placeholder}
        ref={ref}
        selectionColor={colors.primary}
        style={[
          {
            color: colors.foreground,
            flex: 1,
            fontSize: inputFontSize,
            fontWeight: tokens.typography.weight.medium as any,
            marginLeft: tokens.spacing.sm,
            paddingVertical: 0,
          },
          style,
        ]}
        {...props}
        onBlur={(event) => {
          setFocused(false);
          focusProgress.value = withTiming(0, {
            duration: tokens.motion.duration.normal,
            easing: Easing.out(Easing.cubic),
          });
          onBlur?.(event);
        }}
        onFocus={(event) => {
          setFocused(true);
          focusProgress.value = withTiming(1, {
            duration: tokens.motion.duration.normal,
            easing: Easing.out(Easing.cubic),
          });
          onFocus?.(event);
        }}
      />
      {rightElement ? <View className="ml-2">{rightElement}</View> : null}
    </Animated.View>
  );
};

SearchField.displayName = 'SearchField';
