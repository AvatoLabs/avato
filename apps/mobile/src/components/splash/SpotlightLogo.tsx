/**
 * SpotlightLogo — Logo enters with spring scale + blurred glow circle pulsing behind it.
 * Inspired by reactbits.dev/components/spotlight.
 */
import { BlurView } from 'expo-blur';
import { useColorScheme } from 'nativewind';
import React, { useEffect } from 'react';
import { Image, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

export default function SpotlightLogo() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Logo entrance
  const logoScale = useSharedValue(0.5);
  const logoOpacity = useSharedValue(0);

  // Glow pulse
  const glowOpacity = useSharedValue(0);
  const glowScale = useSharedValue(0.8);

  useEffect(() => {
    // Logo spring in
    logoScale.value = withSpring(1, { damping: 8, stiffness: 100 });
    logoOpacity.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) });

    // Glow: fade in then pulse
    glowOpacity.value = withTiming(0.5, { duration: 600 }, () => {
      glowOpacity.value = withRepeat(
        withTiming(0.2, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    });
    glowScale.value = withSpring(1, { damping: 10, stiffness: 80 }, () => {
      glowScale.value = withRepeat(
        withTiming(1.1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    });
  }, [glowOpacity, glowScale, logoOpacity, logoScale]);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));

  const glowColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(129,140,248,0.12)';

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', height: 120, width: 120 }}>
      {/* Glow circle behind logo */}
      <Animated.View
        style={[
          {
            alignItems: 'center',
            borderRadius: 60,
            height: 120,
            justifyContent: 'center',
            overflow: 'hidden',
            position: 'absolute',
            width: 120,
          },
          glowStyle,
        ]}
      >
        <BlurView
          intensity={isDark ? 40 : 30}
          style={{ borderRadius: 60, flex: 1, height: 120, width: 120 }}
          tint={isDark ? 'dark' : 'light'}
        >
          <View style={{ backgroundColor: glowColor, borderRadius: 60, flex: 1 }} />
        </BlurView>
      </Animated.View>

      {/* Logo */}
      <Animated.View style={[{ zIndex: 10 }, logoStyle]}>
        <Image
          resizeMode="contain"
          source={require('../../../assets/icon.png')}
          style={{ borderRadius: 20, height: 72, width: 72 }}
        />
      </Animated.View>
    </View>
  );
}
