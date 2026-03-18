/**
 * ServerConfigScreen — Configure the backend server URL.
 *
 * Unified Connect screen: URL config, test, save. First-launch flow continues
 * to Login or MainTabs (no-auth) after successful connection.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Globe,
  Loader2,
  Server,
  Wifi,
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import PressableScale from '../components/ui/PressableScale';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import {
  clearTransientAppState,
  migrateDeprecatedStorageKeys,
  ONBOARDING_KEY,
  syncMobileBootstrapState,
} from '../lib/appState';
import { clearStoredAuthSession, fetchMobileAuthConfig } from '../lib/auth';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import {
  formatApiUrlForInput,
  getApiUrl,
  normalizeApiUrl,
  setApiUrl,
  testConnection,
} from '../lib/server';
import { useConnectionStore } from '../store/connection';
import { useThemeColors } from '../theme/colors';
import { tokens } from '../theme/tokens';

interface Props {
  navigation: any;
  route?: any;
}

export default function ServerConfigScreen({ navigation, route }: Props) {
  const isFirstLaunch = route?.params?.firstLaunch ?? false;
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const colors = useThemeColors();

  const [url, setUrl] = useState('');
  const [initialUrl, setInitialUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let cancelled = false;
    getApiUrl().then((saved) => {
      if (!cancelled && saved) {
        setInitialUrl(saved);
        setUrl(formatApiUrlForInput(saved));
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleTest = async () => {
    if (!url.trim()) {
      Alert.alert(t.validationError, t.validationEnterUrl);
      return;
    }

    haptics.light();
    Keyboard.dismiss();
    setTesting(true);
    setStatus('idle');
    setErrorMsg('');

    try {
      const ok = await testConnection(url.trim());
      if (ok) {
        setStatus('success');
      } else {
        setStatus('error');
        setErrorMsg(t.serverHealthcheckFailed);
      }
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err?.message || t.serverConnectionFailed);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!url.trim()) {
      Alert.alert(t.validationError, t.validationEnterUrl);
      return;
    }

    haptics.medium();
    let normalized = url.trim().replace(/\/+$/, '');
    normalized = normalizeApiUrl(normalized);

    const normalizedInitialUrl = normalizeApiUrl(initialUrl);
    const urlChanged = normalized !== normalizedInitialUrl;

    await setApiUrl(normalized);
    setInitialUrl(normalized);
    setUrl(formatApiUrlForInput(normalized));

    if (urlChanged) {
      await clearStoredAuthSession();
      await clearTransientAppState();
    }

    // Update global connection state so ProfileScreen reflects the change
    useConnectionStore.getState().checkConnection();

    if (isFirstLaunch) {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
      try {
        const authConfig = await fetchMobileAuthConfig(normalized);
        if (authConfig.enableNoAuth) {
          await syncMobileBootstrapState();
          void migrateDeprecatedStorageKeys();
          navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
          return;
        }
      } catch {
        /* fall through to Login on auth config failure */
      }
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      return;
    }

    if (urlChanged) {
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    } else {
      navigation.goBack();
    }
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={t.serverTitle}
        leftElement={
          !isFirstLaunch ? (
            <ArrowLeft color={colors.primary} size={22} strokeWidth={tokens.icon.strokeWidth} />
          ) : undefined
        }
        onPressLeft={!isFirstLaunch ? () => navigation.goBack() : undefined}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 64 : 0}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 48, paddingTop: 8 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero — welcoming intro */}
          <Animated.View entering={FadeInDown.delay(40).duration(tokens.motion.duration.normal)}>
            <View className="mx-5 mt-4 mb-6 items-center">
              <View
                className="mb-4 items-center justify-center rounded-xl"
                style={{
                  backgroundColor: colors.primarySubtle,
                  width: 64,
                  height: 64,
                }}
              >
                <Server color={colors.primary} size={28} strokeWidth={tokens.icon.strokeWidth} />
              </View>
              <Text className="text-foreground text-center text-[18px] font-semibold tracking-tight">
                {t.serverSubtitle}
              </Text>
              <Text
                className="text-secondary/70 mt-2 text-center text-[13px] leading-5"
                style={{ maxWidth: 280 }}
              >
                {t.serverDesc}
              </Text>
            </View>
          </Animated.View>

          {/* URL Input Card */}
          <Animated.View entering={FadeInDown.delay(80).duration(tokens.motion.duration.normal)}>
            <View
              className="mx-5 mb-4 overflow-hidden rounded-xl"
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.borderSubtle,
              }}
            >
              <View className="px-4 pt-4 pb-2">
                <Text
                  className="text-foreground text-[12px] font-medium uppercase tracking-wider"
                  style={{ color: colors.secondaryText }}
                >
                  {t.serverUrlLabel}
                </Text>
              </View>
              <View className="flex-row items-center px-4 pb-4">
                <View
                  className="mr-3 h-10 w-10 items-center justify-center rounded-xl"
                  style={{ backgroundColor: colors.fillTertiary }}
                >
                  <Globe color={colors.muted} size={18} strokeWidth={tokens.icon.strokeWidth} />
                </View>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  className="flex-1 text-foreground text-[16px] py-2"
                  keyboardType="url"
                  placeholder={t.serverUrlPlaceholder}
                  placeholderTextColor={colors.placeholder}
                  returnKeyType="done"
                  value={url}
                  onChangeText={setUrl}
                />
              </View>
            </View>
          </Animated.View>

          {/* Test Connection — secondary outline style */}
          <Animated.View entering={FadeInDown.delay(120).duration(tokens.motion.duration.normal)}>
            <PressableScale
              className="mx-5 mb-4 flex-row items-center justify-center rounded-xl py-3.5"
              disabled={testing}
              style={{
                backgroundColor: colors.primarySubtle,
                borderWidth: 1,
                borderColor: colors.primaryBorder,
              }}
              onPress={handleTest}
            >
              {testing ? (
                <Loader2
                  color={colors.primary}
                  size={18}
                  strokeWidth={tokens.icon.strokeWidth}
                  style={{ marginRight: 8 }}
                />
              ) : (
                <Wifi
                  color={colors.primary}
                  size={18}
                  strokeWidth={tokens.icon.strokeWidth}
                  style={{ marginRight: 8 }}
                />
              )}
              <Text className="font-semibold text-[15px]" style={{ color: colors.primary }}>
                {testing ? t.serverTesting : t.serverTestConnection}
              </Text>
            </PressableScale>
          </Animated.View>

          {/* Status — success */}
          {status === 'success' && (
            <Animated.View entering={FadeIn.duration(280)}>
              <View
                className="mx-5 mb-4 flex-row items-center rounded-xl p-4"
                style={{
                  backgroundColor: colors.successSubtle,
                  borderWidth: 1,
                  borderColor: colors.successMuted,
                }}
              >
                <CheckCircle2
                  color={colors.success}
                  size={22}
                  strokeWidth={tokens.icon.strokeWidth}
                  style={{ marginRight: 12 }}
                />
                <Text className="flex-1 text-[14px] font-medium" style={{ color: colors.success }}>
                  {t.serverSuccess}
                </Text>
              </View>
            </Animated.View>
          )}

          {/* Status — error */}
          {status === 'error' && (
            <Animated.View entering={FadeIn.duration(280)}>
              <View
                className="mx-5 mb-4 flex-row items-start rounded-xl p-4"
                style={{
                  backgroundColor: colors.dangerSubtle,
                  borderWidth: 1,
                  borderColor: colors.dangerMuted,
                }}
              >
                <AlertCircle
                  color={colors.danger}
                  size={22}
                  strokeWidth={tokens.icon.strokeWidth}
                  style={{ marginRight: 12, marginTop: 1 }}
                />
                <View className="flex-1">
                  <Text className="text-[14px] font-semibold" style={{ color: colors.danger }}>
                    {t.serverFailed}
                  </Text>
                  <Text className="mt-1.5 text-[13px] leading-5" style={{ color: colors.danger }}>
                    {errorMsg}
                  </Text>
                </View>
              </View>
            </Animated.View>
          )}

          {/* Save Button — primary CTA */}
          <Animated.View entering={FadeInDown.delay(240).duration(350)}>
            <PressableScale
              className="mx-5 mt-4 items-center justify-center rounded-xl py-4"
              style={{ backgroundColor: colors.primary }}
              onPress={handleSave}
            >
              <Text className="text-white font-semibold text-[16px]">
                {isFirstLaunch ? t.serverConnectStart : t.serverSaveConfig}
              </Text>
            </PressableScale>
          </Animated.View>

          {/* Tips — subtle */}
          <Animated.View entering={FadeInDown.delay(300).duration(350)}>
            <View
              className="mx-5 mt-6 rounded-xl px-4 py-3"
              style={{ backgroundColor: colors.fillQuaternary }}
            >
              <Text className="text-secondary/60 text-[12px] leading-5">{t.serverTips}</Text>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
