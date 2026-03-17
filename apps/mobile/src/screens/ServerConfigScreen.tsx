/**
 * ServerConfigScreen — Configure the backend server URL.
 */
import { AlertCircle, ArrowLeft, CheckCircle2, Globe, Loader2, Wifi } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { ScreenHeader } from '../components/ui/ScreenHeader';
import { semanticColors } from '../constants/colors';
import { clearTransientAppState } from '../lib/appState';
import { clearStoredAuthSession } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import {
  formatApiUrlForInput,
  getApiUrl,
  normalizeApiUrl,
  setApiUrl,
  testConnection,
} from '../lib/server';
import { useConnectionStore } from '../store/connection';
import { tokens } from '../theme/tokens';

interface Props {
  navigation: any;
  route?: any;
}

export default function ServerConfigScreen({ navigation, route }: Props) {
  const isFirstLaunch = route?.params?.firstLaunch ?? false;
  const { t } = useI18n();

  const [url, setUrl] = useState('');
  const [initialUrl, setInitialUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    getApiUrl().then((saved) => {
      if (saved) {
        setInitialUrl(saved);
        setUrl(formatApiUrlForInput(saved));
      }
    });
  }, []);

  const handleTest = async () => {
    if (!url.trim()) {
      Alert.alert(t.validationError, t.validationEnterUrl);
      return;
    }

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

    if (isFirstLaunch || urlChanged) {
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    } else {
      navigation.goBack();
    }
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        leftElement={
          !isFirstLaunch ? (
            <ArrowLeft color={semanticColors.primary} size={22} strokeWidth={tokens.icon.strokeWidth} />
          ) : undefined
        }
        title={t.serverTitle}
        onPressLeft={!isFirstLaunch ? () => navigation.goBack() : undefined}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* URL Input */}
          <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <View className="mx-5 mt-6 mb-4">
              <Text className="text-foreground font-medium text-[14px] mb-2 ml-1 tracking-tight">
                {t.serverUrlLabel}
              </Text>
              <View className="bg-foreground/[0.04] rounded-2xl px-4 py-1 flex-row items-center">
                <Globe color={semanticColors.muted} size={18} strokeWidth={tokens.icon.strokeWidth} />
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  className="flex-1 ml-3 text-foreground text-[16px] py-3.5"
                  keyboardType="url"
                  placeholder={t.serverUrlPlaceholder}
                  placeholderTextColor={semanticColors.muted}
                  returnKeyType="done"
                  value={url}
                  onChangeText={setUrl}
                />
              </View>
            </View>
          </Animated.View>

          {/* Test Connection */}
          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <TouchableOpacity
              activeOpacity={0.8}
              className="mx-5 mb-4 bg-foreground/[0.04] rounded-2xl py-4 flex-row items-center justify-center active:opacity-70"
              disabled={testing}
              onPress={handleTest}
            >
              {testing ? (
                <Loader2
                  color={semanticColors.primary}
                  size={18}
                  strokeWidth={tokens.icon.strokeWidth}
                  style={{ marginRight: 8 }}
                />
              ) : (
                <Wifi
                  color={semanticColors.primary}
                  size={18}
                  strokeWidth={tokens.icon.strokeWidth}
                  style={{ marginRight: 8 }}
                />
              )}
              <Text className="text-primary font-medium text-[15px]">
                {testing ? t.serverTesting : t.serverTestConnection}
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Status */}
          {status === 'success' && (
            <Animated.View entering={FadeIn.duration(300)}>
              <View className="mx-5 mb-4 rounded-2xl p-4 flex-row items-center bg-foreground/[0.04]">
                <CheckCircle2
                  color={semanticColors.primary}
                  size={20}
                  strokeWidth={tokens.icon.strokeWidth}
                  style={{ marginRight: 10 }}
                />
                <Text className="text-primary text-[14px] font-medium flex-1">
                  {t.serverSuccess}
                </Text>
              </View>
            </Animated.View>
          )}

          {status === 'error' && (
            <Animated.View entering={FadeIn.duration(300)}>
              <View className="mx-5 mb-4 rounded-2xl p-4 flex-row items-start bg-foreground/[0.04]">
                <AlertCircle
                  color={semanticColors.danger}
                  size={20}
                  strokeWidth={tokens.icon.strokeWidth}
                  style={{ marginRight: 10, marginTop: 1 }}
                />
                <View className="flex-1">
                  <Text className="text-[14px] font-medium" style={{ color: semanticColors.danger }}>
                    {t.serverFailed}
                  </Text>
                  <Text className="text-[12.5px] mt-1 opacity-80" style={{ color: semanticColors.danger }}>
                    {errorMsg}
                  </Text>
                </View>
              </View>
            </Animated.View>
          )}

          {/* Save Button */}
          <Animated.View entering={FadeInDown.delay(300).duration(400)}>
            <TouchableOpacity
              activeOpacity={0.8}
              className="mx-5 mt-2 rounded-2xl py-4 items-center active:opacity-90"
              style={{ backgroundColor: semanticColors.primary }}
              onPress={handleSave}
            >
              <Text className="text-white font-semibold text-[16px]">
                {isFirstLaunch ? t.serverConnectStart : t.serverSaveConfig}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
