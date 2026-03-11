/**
 * SplashScreen — Orchestrator that sequences all splash effects in phases.
 *
 * Timeline:
 *   0.0s  Phase 0: Canvas
 *   0.2s  Phase 1: Aurora background fades in
 *   0.5s  Phase 2: Floating particles begin
 *   0.8s  Phase 3: Logo spotlight enters
 *   1.2s  Phase 4: DecryptedText decodes "MinkHub"
 *   1.8s  Phase 5: BlurTagline reveals "Your AI Workspace"
 *   2.5s  Phase 6: Exit — whole view scales up + fades out
 */
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import AuroraBackground from './AuroraBackground';
import BlurTagline from './BlurTagline';
import DecryptedText from './DecryptedText';
import FloatingParticles from './FloatingParticles';
import SpotlightLogo from './SpotlightLogo';

interface SplashScreenProps {
  onFinish?: () => void;
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const [phase, setPhase] = useState(0);

  // Exit animation values
  const exitOpacity = useSharedValue(1);
  const exitScale = useSharedValue(1);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200), // Aurora
      setTimeout(() => setPhase(2), 500), // Particles
      setTimeout(() => setPhase(3), 800), // Logo Spotlight
      setTimeout(() => setPhase(4), 1200), // DecryptedText
      setTimeout(() => setPhase(5), 1800), // BlurTagline
      setTimeout(() => {
        // Phase 6: exit animation
        setPhase(6);
        exitOpacity.value = withTiming(0, { duration: 400, easing: Easing.in(Easing.cubic) });
        exitScale.value = withTiming(1.08, { duration: 400, easing: Easing.in(Easing.cubic) });
      }, 2400),
      setTimeout(() => {
        onFinish?.();
      }, 2800),
    ];
    return () => timers.forEach(clearTimeout);
  }, [exitOpacity, exitScale, onFinish]);

  const exitStyle = useAnimatedStyle(() => ({
    opacity: exitOpacity.value,
    transform: [{ scale: exitScale.value }],
  }));

  return (
    <Animated.View style={[{ flex: 1, backgroundColor: '#f0f0ff' }, exitStyle]}>
      {/* Background layers */}
      {phase >= 1 && <AuroraBackground />}
      {phase >= 2 && <FloatingParticles />}

      {/* Center content */}
      <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}>
        {phase >= 3 && <SpotlightLogo />}
        {phase >= 4 && <DecryptedText text="MinkHub" />}
        {phase >= 5 && <BlurTagline text="Your AI Workspace" />}
      </View>
    </Animated.View>
  );
}
