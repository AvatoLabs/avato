import { AlertCircle, ArrowRight, ScanQrCode, Server, ShieldCheck } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ScreenHeader } from '../components/ui/ScreenHeader';
import { clearTransientAppState } from '../lib/appState';
import {
  fetchMobileAuthConfig,
  type MobileAuthConfig,
  type MobileAuthProvider,
  signInWithBrowser,
} from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { getApiUrl } from '../lib/server';
import { useSessionStore } from '../store/session';
import { useUserStore } from '../store/user';
import { tokens } from '../theme/tokens';

const PASSWORD_SIGNIN_KEY = '__password__';

const getProviderActionLabel = (
  provider: MobileAuthProvider,
  t: { loginContinueWithProvider: string; loginScanWithProvider: string },
) => {
  if (provider.mode === 'qrcode') {
    return t.loginScanWithProvider.replace('{provider}', provider.label);
  }

  return t.loginContinueWithProvider.replace('{provider}', provider.label);
};

export default function LoginScreen({ navigation }: any) {
  const { t } = useI18n();
  const [authConfig, setAuthConfig] = useState<MobileAuthConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [serverUrl, setServerUrl] = useState('');
  const [error, setError] = useState('');
  const [signingInProvider, setSigningInProvider] = useState<string | null>(null);

  const continueInNoAuthMode = async () => {
    await clearTransientAppState();
    await Promise.all([
      useSessionStore.getState().fetchSessions(),
      useUserStore.getState().fetchUser(),
    ]);

    navigation.reset({
      index: 0,
      routes: [{ name: 'MainTabs' }],
    });
  };

  const loadAuthConfig = async () => {
    setLoading(true);
    setError('');

    try {
      const baseUrl = await getApiUrl();
      const nextConfig = await fetchMobileAuthConfig(baseUrl);
      setServerUrl(baseUrl);
      setAuthConfig(nextConfig);

      if (nextConfig.enableNoAuth) {
        await continueInNoAuthMode();
      }
    } catch (caughtError) {
      setAuthConfig(null);
      setError(
        caughtError instanceof Error && caughtError.message
          ? caughtError.message
          : t.serverConnectionFailed,
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAuthConfig();
  }, []);

  const handleSignIn = async (providerId?: string) => {
    setSigningInProvider(providerId || PASSWORD_SIGNIN_KEY);
    setError('');

    try {
      const baseUrl = await getApiUrl();
      const session = await signInWithBrowser({ baseUrl, providerId });

      if (!session) return;

      await clearTransientAppState();
      await Promise.all([
        useSessionStore.getState().fetchSessions(),
        useUserStore.getState().fetchUser(),
      ]);

      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
    } catch (caughtError) {
      setError(
        caughtError instanceof Error && caughtError.message ? caughtError.message : t.errorAuth,
      );
    } finally {
      setSigningInProvider(null);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        titleCompact
        title={t.loginTitle}
        rightElement={
          <Text className="text-primary font-medium text-[15px]">{t.loginChangeServer}</Text>
        }
        onPressRight={() => navigation.navigate('ServerConfig')}
      />

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        <Animated.View entering={FadeInDown.delay(50).duration(320)}>
          <View className="mx-5 mt-6 mb-4 rounded-[20px] bg-foreground/5 p-5">
            <View className="mb-3 flex-row items-center">
              <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Server color="#007aff" size={18} strokeWidth={tokens.icon.strokeWidth} />
              </View>
              <View className="flex-1">
                <Text className="text-[16px] font-semibold text-foreground tracking-tight">
                  {t.loginSubtitle}
                </Text>
                <Text className="mt-0.5 text-[13px] font-medium text-secondary/60">
                  {t.loginOpenInBrowser}
                </Text>
              </View>
            </View>
            <Text className="text-[13px] font-medium text-secondary/70">{serverUrl}</Text>
          </View>
        </Animated.View>

        {loading ? (
          <Animated.View entering={FadeInDown.delay(90).duration(320)}>
            <View className="mx-5 mt-4 items-center rounded-[20px] bg-foreground/5 px-5 py-8">
              <ActivityIndicator color="#007aff" size="small" />
              <Text className="mt-3 text-[14px] font-medium text-secondary/70">{t.loading}</Text>
            </View>
          </Animated.View>
        ) : (
          <>
            {error ? (
              <Animated.View entering={FadeInDown.delay(110).duration(320)}>
                <View className="mx-5 mb-4 flex-row rounded-[20px] bg-red-500/10 p-4">
                  <AlertCircle color="#ff3b30" size={18} strokeWidth={tokens.icon.strokeWidth} />
                  <View className="ml-3 flex-1">
                    <Text className="text-[14px] font-semibold text-red-500">{t.errorAuth}</Text>
                    <Text className="mt-1 text-[13px] font-medium text-red-500/80">{error}</Text>
                  </View>
                </View>
              </Animated.View>
            ) : null}

            {!authConfig?.enableOIDC ? (
              <Animated.View entering={FadeInDown.delay(130).duration(320)}>
                <View className="mx-5 rounded-[20px] bg-foreground/5 p-5">
                  <Text className="text-[16px] font-semibold text-foreground tracking-tight">
                    {t.loginUnsupportedTitle}
                  </Text>
                  <Text className="mt-2 text-[14px] font-medium leading-6 text-secondary/70">
                    {t.loginUnsupportedDesc}
                  </Text>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    className="mt-5 rounded-2xl bg-primary py-4 items-center"
                    onPress={() => void loadAuthConfig()}
                  >
                    <Text className="text-[15px] font-semibold text-white">{t.errorRetry}</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            ) : (
              <Animated.View entering={FadeInDown.delay(150).duration(320)}>
                <View className="mx-5 rounded-[20px] bg-foreground/5 p-4">
                  {!authConfig.disableEmailPassword ? (
                    <TouchableOpacity
                      activeOpacity={0.75}
                      className="mb-3 flex-row items-center rounded-2xl bg-background px-4 py-4"
                      disabled={!!signingInProvider}
                      onPress={() => void handleSignIn()}
                    >
                      <View className="mr-4 h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        {signingInProvider === PASSWORD_SIGNIN_KEY ? (
                          <ActivityIndicator color="#007aff" size="small" />
                        ) : (
                          <ShieldCheck
                            color="#007aff"
                            size={18}
                            strokeWidth={tokens.icon.strokeWidth}
                          />
                        )}
                      </View>
                      <View className="flex-1">
                        <Text className="text-[15px] font-semibold text-foreground tracking-tight">
                          {t.loginContinueWithEmail}
                        </Text>
                        <Text className="mt-0.5 text-[12px] font-medium text-secondary/60">
                          {t.loginOpenInBrowser}
                        </Text>
                      </View>
                      <ArrowRight color="#c0c0c0" size={18} strokeWidth={tokens.icon.strokeWidth} />
                    </TouchableOpacity>
                  ) : null}

                  {authConfig.authProviders.map((provider) => (
                    <TouchableOpacity
                      activeOpacity={0.75}
                      className="mb-3 flex-row items-center rounded-2xl bg-background px-4 py-4 last:mb-0"
                      disabled={!!signingInProvider}
                      key={provider.id}
                      onPress={() => void handleSignIn(provider.id)}
                    >
                      <View className="mr-4 h-10 w-10 items-center justify-center rounded-full bg-foreground/5">
                        {signingInProvider === provider.id ? (
                          <ActivityIndicator color="#007aff" size="small" />
                        ) : provider.mode === 'qrcode' ? (
                          <ScanQrCode
                            color="#007aff"
                            size={18}
                            strokeWidth={tokens.icon.strokeWidth}
                          />
                        ) : (
                          <ShieldCheck
                            color="#007aff"
                            size={18}
                            strokeWidth={tokens.icon.strokeWidth}
                          />
                        )}
                      </View>
                      <View className="flex-1">
                        <Text className="text-[15px] font-semibold text-foreground tracking-tight">
                          {getProviderActionLabel(provider, t)}
                        </Text>
                        <Text className="mt-0.5 text-[12px] font-medium text-secondary/60">
                          {provider.mode === 'qrcode' ? t.loginQrHint : t.loginOpenInBrowser}
                        </Text>
                      </View>
                      <ArrowRight color="#c0c0c0" size={18} strokeWidth={tokens.icon.strokeWidth} />
                    </TouchableOpacity>
                  ))}

                  {authConfig.disableEmailPassword && authConfig.authProviders.length === 0 ? (
                    <Text className="px-2 py-2 text-[13px] font-medium leading-5 text-secondary/70">
                      {t.loginMissingProviders}
                    </Text>
                  ) : null}
                </View>
              </Animated.View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
