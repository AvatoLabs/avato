/**
 * ProviderSetupScreen — Onboarding step 2: connect to server.
 */
import { ArrowLeft, Check, Server } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { setApiUrl, testConnection } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { tokens } from '../../theme/tokens';

export default function ProviderSetupScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();

  const [serverUrl, setServerUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleTest = async () => {
    if (!serverUrl.trim()) return;
    setTesting(true);
    setSuccess(false);
    const ok = await testConnection(serverUrl.trim());
    setTesting(false);
    setSuccess(ok);
  };

  const handleContinue = async () => {
    if (serverUrl.trim()) {
      await setApiUrl(serverUrl.trim());
    }
    navigation.navigate('OnboardingCompletion');
  };

  const handleSkip = () => {
    navigation.navigate('OnboardingCompletion');
  };

  return (
    <View
      className="flex-1 bg-background px-6"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      {/* Header */}
      <View className="flex-row items-center py-3">
        <TouchableOpacity
          activeOpacity={0.7}
          className="w-9 h-9 items-center justify-center rounded-full active:bg-foreground/10"
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft color="#111" size={22} strokeWidth={tokens.icon.strokeWidth} />
        </TouchableOpacity>
      </View>

      <Animated.View className="mt-6" entering={FadeInDown.delay(50).duration(350)}>
        <View className="w-14 h-14 rounded-2xl bg-primary/10 items-center justify-center mb-5">
          <Server color="#007aff" size={28} strokeWidth={tokens.icon.strokeWidth} />
        </View>
        <Text className="text-foreground text-2xl font-bold tracking-tight">
          {t.onboardingSetupProvider}
        </Text>
        <Text className="text-secondary/60 text-[15px] font-medium mt-2 leading-6">
          {t.onboardingSetupProviderDesc}
        </Text>
      </Animated.View>

      <Animated.View className="mt-8" entering={FadeInDown.delay(150).duration(350)}>
        <Text className="text-secondary/60 text-[12px] font-medium uppercase tracking-wider mb-2 px-1">
          {t.serverUrlLabel}
        </Text>
        <View className="bg-foreground/5 rounded-xl px-4 py-3">
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            className="text-foreground text-[16px]"
            placeholder={t.serverUrlPlaceholder}
            placeholderTextColor="#8c8c8c"
            value={serverUrl}
            onChangeText={setServerUrl}
          />
        </View>

        {/* Test Connection */}
        <TouchableOpacity
          activeOpacity={0.7}
          className="mt-4 flex-row items-center justify-center py-3 rounded-xl bg-foreground/5"
          disabled={testing}
          onPress={handleTest}
        >
          {testing ? (
            <ActivityIndicator color="#007aff" size="small" />
          ) : success ? (
            <View className="flex-row items-center">
              <Check color="#4caf50" size={18} strokeWidth={tokens.icon.strokeWidth} />
              <Text className="text-green-600 text-[14px] font-medium ml-2">{t.serverSuccess}</Text>
            </View>
          ) : (
            <Text className="text-primary text-[14px] font-medium">{t.serverTestConnection}</Text>
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* Bottom buttons */}
      <View className="flex-1 justify-end pb-6">
        <Animated.View entering={FadeInDown.delay(250).duration(350)}>
          <TouchableOpacity
            activeOpacity={0.8}
            className="bg-primary rounded-2xl py-4 items-center active:bg-[#005bb5] mb-3"
            onPress={handleContinue}
          >
            <Text className="text-white text-[16px] font-semibold">{t.confirm}</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7} className="py-3 items-center" onPress={handleSkip}>
            <Text className="text-secondary/50 text-[14px] font-medium">{t.onboardingSkip}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}
