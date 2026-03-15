/**
 * WelcomeScreen — First onboarding step: brand introduction.
 */
import React, { useState } from 'react';
import { Image as RNImage, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import TextType from '../../components/ui/TextType';
import { useI18n } from '../../lib/i18n';

export default function WelcomeScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const [showCTA, setShowCTA] = useState(false);

  return (
    <View
      className="flex-1 bg-background px-8"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <View className="flex-1 items-center justify-center">
        <Animated.View
          className="items-center"
          entering={FadeInUp.delay(160).duration(860).springify().damping(15).mass(0.9)}
        >
          <View
            className="w-32 h-32 rounded-[34px] bg-white items-center justify-center"
            style={{
              elevation: 12,
              shadowColor: '#0f172a',
              shadowOffset: { height: 20, width: 0 },
              shadowOpacity: 0.12,
              shadowRadius: 36,
            }}
          >
            <RNImage className="w-28 h-28" source={require('../../../assets/avato-logo.png')} />
          </View>

          <Text className="text-foreground text-[36px] font-bold tracking-tight text-center mt-8">
            {t.onboardingWelcome}
          </Text>
        </Animated.View>

        <Animated.View
          className="mt-6 w-full"
          entering={FadeInDown.delay(520).duration(460).springify().damping(16)}
        >
          <TextType
            showCursor
            containerStyle={{ minHeight: 64 }}
            cursorBlinkDuration={0.42}
            cursorCharacter="_"
            cursorStyle={{ color: '#0f172a', fontSize: 17, fontWeight: '600' }}
            initialDelay={220}
            loop={false}
            pauseDuration={600}
            text={t.onboardingWelcomeDesc}
            typingSpeed={26}
            variableSpeedEnabled={false}
            style={{
              color: '#5b6778',
              fontSize: 17,
              fontWeight: '500',
              letterSpacing: 0.2,
              lineHeight: 27,
              textAlign: 'center',
            }}
            onSentenceComplete={() => setShowCTA(true)}
          />
        </Animated.View>
      </View>

      {showCTA && (
        <Animated.View
          className="w-full pb-3"
          entering={FadeInDown.delay(120).duration(420).springify().damping(16)}
        >
          <TouchableOpacity
            activeOpacity={0.82}
            className="bg-primary rounded-2xl py-4 items-center active:bg-[#005bb5]"
            onPress={() => navigation.navigate('OnboardingProviderSetup')}
          >
            <Text className="text-white text-[16px] font-semibold">{t.onboardingGetStarted}</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}
