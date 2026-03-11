/**
 * FloatingParticles — Sparse floating dots that drift upward with gentle sway.
 * Inspired by reactbits.dev/backgrounds/particles.
 *
 * Each particle has independent Y drift, X sway, and opacity breathing.
 * All animation runs on the UI thread via react-native-reanimated.
 */
import { useColorScheme } from 'nativewind';
import React, { useEffect, useMemo } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const { width: W, height: H } = Dimensions.get('window');
const PARTICLE_COUNT = 15;

interface ParticleConfig {
  delay: number;
  driftSpeed: number;
  id: number;
  maxOpacity: number;
  size: number;
  swayAmount: number;
  swaySpeed: number;
  x: number;
}

function generateParticles(): ParticleConfig[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    x: Math.random() * W,
    size: 2 + Math.random() * 3,
    delay: Math.random() * 2000,
    driftSpeed: 4000 + Math.random() * 4000,
    swayAmount: 15 + Math.random() * 25,
    swaySpeed: 2000 + Math.random() * 2000,
    maxOpacity: 0.2 + Math.random() * 0.5,
  }));
}

function Particle({ config, color }: { config: ParticleConfig; color: string }) {
  const drift = useSharedValue(0);
  const sway = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    // Y axis: float upward continuously
    drift.value = withDelay(
      config.delay,
      withRepeat(withTiming(1, { duration: config.driftSpeed, easing: Easing.linear }), -1, false),
    );
    // X axis: gentle horizontal sway
    sway.value = withDelay(
      config.delay,
      withRepeat(
        withTiming(1, { duration: config.swaySpeed, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      ),
    );
    // Opacity: breathe in/out
    opacity.value = withDelay(
      config.delay,
      withRepeat(
        withTiming(config.maxOpacity, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      ),
    );
  }, [config, drift, opacity, sway]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: interpolate(sway.value, [0, 1], [-config.swayAmount, config.swayAmount]) },
      { translateY: interpolate(drift.value, [0, 1], [H + 20, -20]) },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          backgroundColor: color,
          borderRadius: config.size / 2,
          height: config.size,
          left: config.x,
          position: 'absolute',
          width: config.size,
        },
        animStyle,
      ]}
    />
  );
}

export default function FloatingParticles() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const particles = useMemo(() => generateParticles(), []);
  const color = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.12)';

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {particles.map((p) => (
        <Particle color={color} config={p} key={p.id} />
      ))}
    </View>
  );
}
