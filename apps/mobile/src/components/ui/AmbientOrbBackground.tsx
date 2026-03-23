/**
 * Full-screen ambient “mesh” layer: a few large soft orbs with slow drift.
 * Light / dark use different opacity ranges so light stays airy and dark reads as glow.
 */
import React, { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useThemeStore } from '../../store/theme';
import { useThemeColors } from '../../theme/colors';

interface OrbConfig {
  backgroundColor: string;
  drift: number;
  duration: number;
  left: number | `${number}%`;
  phase: number;
  scaleAmp: number;
  size: number;
  top: number | `${number}%`;
}

function AmbientOrb({
  backgroundColor,
  drift,
  duration,
  left,
  opacityMax,
  opacityMin,
  phase,
  reduceMotion,
  scaleAmp,
  size,
  top,
}: OrbConfig & {
  opacityMax: number;
  opacityMin: number;
  reduceMotion: boolean;
}) {
  const progress = useSharedValue(reduceMotion ? 0.5 : 0);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 0.5;
      return;
    }
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, {
        duration,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );
    // `progress` is a Reanimated shared value ref, not a reactive dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- progress omitted intentionally
  }, [duration, reduceMotion]);

  const half = size / 2;

  const animatedStyle = useAnimatedStyle(() => {
    const t = progress.value * Math.PI * 2 + phase;
    const opacityRange = (opacityMax - opacityMin) / 2;
    const opacityMid = opacityMin + opacityRange;

    return {
      opacity: opacityMid + Math.sin(t * 1.12) * opacityRange * 0.85,
      transform: [
        { translateX: Math.sin(t * 0.88) * drift },
        { translateY: Math.cos(t * 0.74) * drift * 0.82 },
        { scale: 1 + Math.sin(t * 1.03) * scaleAmp },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          backgroundColor,
          borderRadius: half,
          height: size,
          left,
          marginLeft: -half,
          marginTop: -half,
          position: 'absolute',
          top,
          width: size,
        },
        animatedStyle,
      ]}
    />
  );
}

export default function AmbientOrbBackground() {
  const colors = useThemeColors();
  const effectiveTheme = useThemeStore((s) => s.effectiveTheme);
  const isDark = effectiveTheme === 'dark';
  const [reduceMotion, setReduceMotion] = React.useState(false);

  useEffect(() => {
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    return () => sub.remove();
  }, []);

  const opacityMin = isDark ? 0.1 : 0.045;
  const opacityMax = isDark ? 0.26 : 0.11;

  const secondaryOpacityMin = isDark ? 0.06 : 0.03;
  const secondaryOpacityMax = isDark ? 0.14 : 0.065;

  const orbsPrimary: OrbConfig[] = [
    {
      backgroundColor: colors.primary,
      drift: 22,
      duration: 18_000,
      left: -70,
      phase: 0,
      scaleAmp: 0.05,
      size: 300,
      top: -50,
    },
    {
      backgroundColor: colors.primary,
      drift: 28,
      duration: 22_000,
      left: '68%',
      phase: 2.1,
      scaleAmp: 0.065,
      size: 280,
      top: '10%',
    },
    {
      backgroundColor: colors.primary,
      drift: 18,
      duration: 15_000,
      left: '28%',
      phase: 4.2,
      scaleAmp: 0.045,
      size: 240,
      top: '58%',
    },
  ];

  const orbsAccent: OrbConfig[] = [
    {
      backgroundColor: colors.info,
      drift: 20,
      duration: 19_500,
      left: '82%',
      phase: 1.4,
      scaleAmp: 0.055,
      size: 200,
      top: '38%',
    },
    {
      backgroundColor: colors.primaryMuted,
      drift: 24,
      duration: 21_000,
      left: -55,
      phase: 3.3,
      scaleAmp: 0.05,
      size: 260,
      top: -35,
    },
  ];

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFillObject, { overflow: 'hidden', zIndex: 0 }]}
    >
      {orbsPrimary.map((orb, i) => (
        <AmbientOrb
          key={`p-${i}`}
          {...orb}
          opacityMax={opacityMax}
          opacityMin={opacityMin}
          reduceMotion={reduceMotion}
        />
      ))}
      {orbsAccent.map((orb, i) => (
        <AmbientOrb
          key={`a-${i}`}
          {...orb}
          opacityMax={secondaryOpacityMax}
          opacityMin={secondaryOpacityMin}
          reduceMotion={reduceMotion}
        />
      ))}
    </View>
  );
}
