/**
 * SplashScreen — Orchestrator that sequences all splash effects in phases.
 *
 * Timeline:
 *   0.0s  Phase 0: Canvas
 *   0.2s  Phase 1: Aurora background fades in
 *   0.5s  Phase 2: Floating particles begin
 *   0.8s  Phase 3: Logo spotlight enters
 *   1.2s  Phase 4: DecryptedText decodes "Avato"
 *   1.8s  Phase 5: BlurTagline reveals the brand line
 *   2.5s+ Phase 6: Exit waits for app bootstrap, then fades out
 */
import React, { useEffect, useRef, useState } from 'react';
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
  readyToExit?: boolean;
}

export default function SplashScreen({ onFinish, readyToExit = true }: SplashScreenProps) {
  const [phase, setPhase] = useState(0);
  const [isIntroComplete, setIsIntroComplete] = useState(false);
  const hasExitedRef = useRef(false);

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
      setTimeout(() => setIsIntroComplete(true), 2200),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (!isIntroComplete || !readyToExit || hasExitedRef.current) return;

    hasExitedRef.current = true;
    setPhase(6);
    exitOpacity.value = withTiming(0, { duration: 420, easing: Easing.in(Easing.cubic) });
    exitScale.value = withTiming(1.08, { duration: 420, easing: Easing.in(Easing.cubic) });

    const timer = setTimeout(() => {
      onFinish?.();
    }, 440);

    return () => clearTimeout(timer);
  }, [exitOpacity, exitScale, isIntroComplete, onFinish, readyToExit]);

  const exitStyle = useAnimatedStyle(() => ({
    opacity: exitOpacity.value,
    transform: [{ scale: exitScale.value }],
  }));

  return (
    <Animated.View style={[{ flex: 1, backgroundColor: '#f8f9fb' }, exitStyle]}>
      {/* Background layers */}
      {phase >= 1 && <AuroraBackground />}
      {phase >= 2 && <FloatingParticles />}

      {/* Center content */}
      <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}>
        {phase >= 3 && <SpotlightLogo />}
        {phase >= 4 && <DecryptedText text="Avato" />}
        {phase >= 5 && <BlurTagline text="Orchestrate the next AI workflow." />}
      </View>
    </Animated.View>
  );
}
