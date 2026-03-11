/**
 * AuroraBackground — 3-layer animated gradient drift inspired by reactbits.dev/backgrounds/aurora.
 *
 * Each layer is a LinearGradient with animated start/end coordinates that drift
 * in different directions, creating an organic aurora borealis effect.
 * Runs entirely on the UI thread via react-native-reanimated.
 */
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const { width: W, height: H } = Dimensions.get('window');

const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient);

export default function AuroraBackground() {
  // Each layer drifts at a different period
  const t1 = useSharedValue(0);
  const t2 = useSharedValue(0);
  const t3 = useSharedValue(0);
  const fadeIn = useSharedValue(0);

  useEffect(() => {
    // Entrance fade
    fadeIn.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) });

    // Continuous drift timers (0→1→0, reversing)
    t1.value = withRepeat(
      withTiming(1, { duration: 6000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    t2.value = withRepeat(
      withTiming(1, { duration: 8000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    t3.value = withRepeat(
      withTiming(1, { duration: 10000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [fadeIn, t1, t2, t3]);

  // Layer 1: Base gradient — gentle diagonal drift
  const layer1Style = useAnimatedStyle(() => ({
    opacity: fadeIn.value * 1,
    transform: [
      { translateX: interpolate(t1.value, [0, 1], [-20, 20]) },
      { translateY: interpolate(t1.value, [0, 1], [-10, 10]) },
    ],
  }));

  // Layer 2: Mid accent — counter-drift + breathing opacity
  const layer2Style = useAnimatedStyle(() => ({
    opacity: fadeIn.value * interpolate(t2.value, [0, 0.5, 1], [0.25, 0.5, 0.25]),
    transform: [
      { translateX: interpolate(t2.value, [0, 1], [30, -30]) },
      { translateY: interpolate(t2.value, [0, 1], [20, -20]) },
      { scale: interpolate(t2.value, [0, 0.5, 1], [1, 1.15, 1]) },
    ],
  }));

  // Layer 3: Top veil — slow diagonal sweep
  const layer3Style = useAnimatedStyle(() => ({
    opacity: fadeIn.value * interpolate(t3.value, [0, 0.5, 1], [0.15, 0.35, 0.15]),
    transform: [
      { translateX: interpolate(t3.value, [0, 1], [-40, 40]) },
      { translateY: interpolate(t3.value, [0, 1], [15, -25]) },
      { rotate: `${interpolate(t3.value, [0, 1], [-3, 3])}deg` },
    ],
  }));

  const colors1: [string, string, string] = ['#f0f0ff', '#e0e7ff', '#c4b5fd'];
  const colors2: [string, string, string] = ['transparent', '#818cf8', 'transparent'];
  const colors3: [string, string, string] = ['transparent', '#a5b4fc', 'transparent'];

  return (
    <>
      {/* Layer 1: Base */}
      <Animated.View style={[styles.layer, layer1Style]}>
        <AnimatedGradient
          colors={colors1}
          end={{ x: 0.9, y: 1 }}
          start={{ x: 0.1, y: 0 }}
          style={styles.gradient}
        />
      </Animated.View>

      {/* Layer 2: Accent */}
      <Animated.View style={[styles.layer, layer2Style]}>
        <AnimatedGradient
          colors={colors2}
          end={{ x: 1, y: 0.7 }}
          start={{ x: 0, y: 0.3 }}
          style={styles.gradient}
        />
      </Animated.View>

      {/* Layer 3: Veil */}
      <Animated.View style={[styles.layer, layer3Style]}>
        <AnimatedGradient
          colors={colors3}
          end={{ x: 0.5, y: 1 }}
          start={{ x: 0.5, y: 0 }}
          style={styles.gradient}
        />
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  gradient: {
    height: H + 60,
    width: W + 80,
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
    left: -40,
    top: -30,
  },
});
