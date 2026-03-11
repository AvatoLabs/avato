/**
 * TypingIndicator — Animated bouncing dots that show when AI is generating.
 *
 * Runs entirely on the UI thread via react-native-reanimated for 60fps.
 */
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

interface TypingIndicatorProps {
  color?: string;
  dotSize?: number;
}

const DOT_COUNT = 3;
const DURATION = 350;
const STAGGER = 140;

function Dot({ color, delay, size }: { color: string; delay: number; size: number }) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withRepeat(
        withSequence(withTiming(-4, { duration: DURATION }), withTiming(0, { duration: DURATION })),
        -1,
        false,
      ),
    );
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: DURATION }),
          withTiming(0.4, { duration: DURATION }),
        ),
        -1,
        false,
      ),
    );
  }, [delay, opacity, translateY]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          backgroundColor: color,
          borderRadius: size / 2,
          height: size,
          width: size,
        },
        animStyle,
      ]}
    />
  );
}

export default function TypingIndicator({ color = '#8e8e93', dotSize = 7 }: TypingIndicatorProps) {
  return (
    <View
      style={{
        alignItems: 'center',
        flexDirection: 'row',
        gap: 4,
        height: 24,
        justifyContent: 'center',
      }}
    >
      {Array.from({ length: DOT_COUNT }).map((_, i) => (
        <Dot color={color} delay={i * STAGGER} key={i} size={dotSize} />
      ))}
    </View>
  );
}
