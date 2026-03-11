/**
 * WelcomeScreen — First onboarding step: brand introduction.
 */
import React from 'react';
import { Image as RNImage, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '../../lib/i18n';

export default function WelcomeScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();

  return (
    <View
      className="flex-1 bg-background items-center justify-center px-8"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <Animated.View className="items-center" entering={FadeInUp.delay(100).duration(500)}>
        <RNImage
          className="w-28 h-28 rounded-3xl mb-8"
          source={require('../../../assets/mink-logo.png')}
        />
        <Text className="text-foreground text-3xl font-bold tracking-tight text-center">
          {t.onboardingWelcome}
        </Text>
        <Text className="text-secondary/60 text-[16px] font-medium mt-3 text-center leading-6">
          {t.onboardingWelcomeDesc}
        </Text>
      </Animated.View>

      <Animated.View className="w-full mt-12" entering={FadeInDown.delay(300).duration(400)}>
        <TouchableOpacity
          activeOpacity={0.8}
          className="bg-primary rounded-2xl py-4 items-center active:bg-[#005bb5]"
          onPress={() => navigation.navigate('OnboardingProviderSetup')}
        >
          <Text className="text-white text-[16px] font-semibold">{t.onboardingGetStarted}</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}
