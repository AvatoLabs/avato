/**
 * CompletionScreen — Final onboarding step: all set!
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CheckCircle } from 'lucide-react-native';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '../../lib/i18n';
import { hasConfiguredUrl } from '../../lib/server';

const ONBOARDING_KEY = 'avato_onboarding_complete';

export default function CompletionScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();

  const handleStart = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    const hasUrl = await hasConfiguredUrl();
    navigation.reset({
      index: 0,
      routes: [
        hasUrl ? { name: 'Login' } : { name: 'ServerConfig', params: { firstLaunch: true } },
      ],
    });
  };

  return (
    <View
      className="flex-1 bg-background items-center justify-center px-8"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <Animated.View className="items-center" entering={FadeInUp.delay(100).duration(500)}>
        <View
          className="w-20 h-20 rounded-full items-center justify-center mb-6"
          style={{ backgroundColor: 'rgba(0,122,255,0.08)' }}
        >
          <CheckCircle color="#007aff" size={48} strokeWidth={1.5} />
        </View>
        <Text className="text-foreground text-2xl font-bold tracking-tight text-center">
          {t.onboardingComplete}
        </Text>
        <Text className="text-secondary/60 text-[15px] font-medium mt-3 text-center leading-6">
          {t.onboardingCompleteDesc}
        </Text>
      </Animated.View>

      <Animated.View className="w-full mt-12" entering={FadeInDown.delay(300).duration(400)}>
        <TouchableOpacity
          activeOpacity={0.8}
          className="bg-primary rounded-2xl py-4 items-center active:bg-[#005bb5]"
          onPress={handleStart}
        >
          <Text className="text-white text-[16px] font-semibold">{t.onboardingStartChatting}</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}
