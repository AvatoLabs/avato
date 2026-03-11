/**
 * BlurTagline — Text fades from blurred to sharp with upward float.
 * Inspired by reactbits.dev/text-animations/blur-text.
 *
 * Uses expo-blur with animated intensity + opacity + translateY.
 */
import { useColorScheme } from 'nativewind';
import React, { useEffect } from 'react';
import { Text } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

interface BlurTaglineProps {
  text: string;
}

export default function BlurTagline({ text }: BlurTaglineProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(14);
  const scale = useSharedValue(0.96);

  useEffect(() => {
    const config = { duration: 700, easing: Easing.out(Easing.cubic) };
    opacity.value = withTiming(1, config);
    translateY.value = withTiming(0, config);
    scale.value = withTiming(1, config);
  }, [opacity, scale, translateY]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  return (
    <Animated.View style={[{ marginTop: 12 }, animStyle]}>
      <Text
        style={{
          color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)',
          fontSize: 15,
          fontWeight: '500',
          letterSpacing: 0.5,
          textAlign: 'center',
        }}
      >
        {text}
      </Text>
    </Animated.View>
  );
}
