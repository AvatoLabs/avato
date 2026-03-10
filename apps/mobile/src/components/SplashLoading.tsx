import React, { useEffect } from 'react';
import { Image,Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

export default function SplashLoading() {
  const breathScale = useSharedValue(0.92);
  const breathOpacity = useSharedValue(0.8);
  const spinRotation = useSharedValue(0);

  useEffect(() => {
    // Breathing animation for logo
    breathScale.value = withRepeat(
      withTiming(1.04, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    breathOpacity.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );

    // Spinning ring animation
    spinRotation.value = withRepeat(
      withTiming(360, { duration: 6000, easing: Easing.linear }),
      -1,
      false
    );

    return () => {
      // Cancel animations on unmount to prevent infinite loop crashes on Android
      cancelAnimation(breathScale);
      cancelAnimation(breathOpacity);
      cancelAnimation(spinRotation);
    };
  }, []);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathScale.value }],
    opacity: breathOpacity.value,
  }));

  const spinAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spinRotation.value}deg` }],
  }));

  return (
    <View className="flex-1 items-center justify-center bg-background">
      <View className="items-center justify-center gap-6">
        <View className="relative w-16 h-16 items-center justify-center">
          {/* Dashed outer spinner */}
          <Animated.View
            className="absolute rounded-full border-2 border-foreground opacity-25 dark:border-white/40 border-dashed"
            style={[
              { width: 88, height: 88, borderStyle: 'dashed' },
              spinAnimatedStyle,
            ]}
          />
          {/* Pulsing inner logo */}
          <Animated.View className="z-10" style={logoAnimatedStyle}>
            <Image
              className="w-16 h-16 rounded-2xl"
              resizeMode="contain"
              source={require('../../assets/icon.png')}
            />
          </Animated.View>
        </View>

        <Text className="text-[22px] font-extrabold text-foreground tracking-wide opacity-80 mt-2">
          MinkHub
        </Text>
      </View>
    </View>
  );
}
