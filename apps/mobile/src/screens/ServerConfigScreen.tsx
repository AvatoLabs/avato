/**
 * ServerConfigScreen — Configure the backend server URL.
 */
import { AlertCircle, CheckCircle2, Globe, Loader2, Wifi } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image as RNImage,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '../components/ui/ScreenHeader';
import { clearTransientAppState } from '../lib/appState';
import { clearStoredAuthSession } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { getApiUrl, normalizeApiUrl, setApiUrl, testConnection } from '../lib/server';
import { useConnectionStore } from '../store/connection';
import { tokens } from '../theme/tokens';

interface Props {
  navigation: any;
  route?: any;
}

export default function ServerConfigScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
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
        setUrl(saved);
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
    setUrl(normalized);

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
        title={t.serverTitle}
        rightElement={
          !isFirstLaunch ? (
            <Text className="text-primary font-medium text-[15px]">{t.done}</Text>
          ) : undefined
        }
        onPressRight={!isFirstLaunch ? () => navigation.goBack() : undefined}
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
          {/* Info Card */}
          <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <View className="mx-5 mt-6 mb-6 rounded-[20px] bg-foreground/5 p-5">
              <View className="flex-row items-center mb-3">
                <View className="w-10 h-10 rounded-full items-center justify-center mr-3 overflow-hidden">
                  <RNImage className="w-10 h-10" source={require('../../assets/avato-icon.png')} />
                </View>
                <View className="flex-1">
                  <Text className="text-[16px] font-semibold text-foreground tracking-tight">
                    {t.serverConnect}
                  </Text>
                  <Text className="text-secondary/70 text-[13px] mt-0.5 font-medium">
                    {t.serverSubtitle}
                  </Text>
                </View>
              </View>
              <Text className="text-secondary/70 text-[13.5px] leading-5 font-medium">
                {t.serverDesc}
              </Text>
            </View>
          </Animated.View>

          {/* URL Input */}
          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <View className="mx-5 mb-4">
              <Text className="text-foreground font-medium text-[14px] mb-2 ml-1 tracking-tight">
                {t.serverUrlLabel}
              </Text>
              <View className="bg-foreground/5 rounded-2xl px-4 py-1 flex-row items-center">
                <Globe color="#999" size={18} strokeWidth={tokens.icon.strokeWidth} />
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  className="flex-1 ml-3 text-foreground text-[16px] py-3.5"
                  keyboardType="url"
                  placeholder={t.serverUrlPlaceholder}
                  placeholderTextColor="#8c8c8c"
                  returnKeyType="done"
                  value={url}
                  onChangeText={setUrl}
                />
              </View>
            </View>
          </Animated.View>

          {/* Common URLs */}
          <Animated.View entering={FadeInDown.delay(300).duration(400)}>
            <View className="mx-5 mb-6">
              <Text className="text-secondary/60 text-[12px] font-medium mb-2 ml-1 uppercase tracking-wider">
                {t.serverQuickFill}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {['http://192.168.1.100:3010', 'http://10.0.0.1:3010', 'http://localhost:3010'].map(
                  (preset) => (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      className="bg-foreground/5 px-3.5 py-2 rounded-full"
                      key={preset}
                      onPress={() => setUrl(preset)}
                    >
                      <Text className="text-foreground text-[13px] font-medium">{preset}</Text>
                    </TouchableOpacity>
                  ),
                )}
              </View>
            </View>
          </Animated.View>

          {/* Test Connection */}
          <Animated.View entering={FadeInDown.delay(400).duration(400)}>
            <TouchableOpacity
              activeOpacity={0.8}
              className="mx-5 mb-4 bg-foreground/5 rounded-2xl py-4 flex-row items-center justify-center active:opacity-70"
              disabled={testing}
              onPress={handleTest}
            >
              {testing ? (
                <Loader2
                  color="#007aff"
                  size={18}
                  strokeWidth={tokens.icon.strokeWidth}
                  style={{ marginRight: 8 }}
                />
              ) : (
                <Wifi
                  color="#007aff"
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
              <View className="mx-5 mb-4 bg-[#e8f5e9]/80 rounded-2xl p-4 flex-row items-center">
                <CheckCircle2
                  color="#4caf50"
                  size={20}
                  strokeWidth={tokens.icon.strokeWidth}
                  style={{ marginRight: 10 }}
                />
                <Text className="text-[#2e7d32] text-[14px] font-medium flex-1">
                  {t.serverSuccess}
                </Text>
              </View>
            </Animated.View>
          )}

          {status === 'error' && (
            <Animated.View entering={FadeIn.duration(300)}>
              <View className="mx-5 mb-4 bg-[#fbe9e7]/80 rounded-2xl p-4 flex-row items-start">
                <AlertCircle
                  color="#f44336"
                  size={20}
                  strokeWidth={tokens.icon.strokeWidth}
                  style={{ marginRight: 10, marginTop: 1 }}
                />
                <View className="flex-1">
                  <Text className="text-[#c62828] text-[14px] font-medium">{t.serverFailed}</Text>
                  <Text className="text-[#c62828] text-[12.5px] mt-1 opacity-80">{errorMsg}</Text>
                </View>
              </View>
            </Animated.View>
          )}

          {/* Save Button */}
          <Animated.View entering={FadeInDown.delay(500).duration(400)}>
            <TouchableOpacity
              activeOpacity={0.8}
              className="mx-5 mt-2 bg-primary rounded-2xl py-4 items-center active:opacity-90"
              onPress={handleSave}
            >
              <Text className="text-white font-semibold text-[16px]">
                {isFirstLaunch ? t.serverConnectStart : t.serverSaveConfig}
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Tips */}
          <View className="mx-5 mt-6 px-1">
            <Text className="text-secondary/50 text-[12px] leading-5 font-medium">
              {t.serverTips}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
