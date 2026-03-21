import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image as RNImage, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useToast } from '../components/ui/Toast';
import { clearTransientAppState } from '../lib/appState';
import {
  fetchMobileAuthConfig,
  type MobileAuthConfig,
  type MobileAuthProvider,
  signInWithProvider,
} from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { getApiUrl } from '../lib/server';
import type { RootStackScreenProps } from '../navigation/types';
import { useAgentStore } from '../store/agent';
import { useSessionStore } from '../store/session';
import { useUserStore } from '../store/user';
import { useThemeColors } from '../theme/colors';
import { tokens } from '../theme/tokens';

const PASSWORD_SIGNIN_KEY = '__password__';
const USER_SYNC_RETRY_DELAY_MS = 300;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const humanizeAuthError = (
  error: unknown,
  providerLabel: string | undefined,
  t: ReturnType<typeof useI18n.getState>['t'],
) => {
  const message = error instanceof Error ? error.message : '';

  if (!message) return t.errorAuth;
  if (message.includes('err_code=4401')) {
    return t.loginFeishuConfigMismatch;
  }
  if (
    message.includes('Failed to load auth config') ||
    message.includes('Unable to reach the mobile sign-in endpoint') ||
    message.includes('Network request failed') ||
    message.includes('Connection failed')
  ) {
    return t.serverConnectionFailed;
  }
  if (message.includes('Unable to launch the Feishu app')) {
    return t.loginProviderLaunchFailed.replace('{provider}', providerLabel || 'Feishu');
  }
  if (message.includes('Feishu authorization failed')) {
    return t.loginProviderFailed.replace('{provider}', providerLabel || 'Feishu');
  }
  if (
    message.includes('did not return an authorization code') ||
    message.includes('Authentication was not completed')
  ) {
    return t.loginIncomplete;
  }
  if (message.includes('not configured on this server')) {
    return t.loginUnsupportedDesc;
  }
  if (message.includes('no providers are configured')) {
    return t.loginMissingProviders;
  }

  return message.length <= 120 ? message : t.errorAuth;
};

const getPrimaryProvider = (config: MobileAuthConfig | null) =>
  config?.authProviders.length ? config.authProviders[0] : undefined;

const getPrimaryActionLabel = (
  authConfig: MobileAuthConfig | null,
  provider: MobileAuthProvider | undefined,
  t: ReturnType<typeof useI18n.getState>['t'],
) => {
  if (!authConfig) return t.errorRetry;
  if (!authConfig.enableOIDC) return t.errorRetry;
  if (!provider && authConfig.disableEmailPassword) return t.errorRetry;
  if (!provider) return t.loginContinueWithEmail;

  return t.loginContinueWithProvider.replace('{provider}', provider.label);
};

const syncUserAfterLogin = async () => {
  let lastError: unknown;

  for (const attempt of [0, 1]) {
    try {
      const user = await useUserStore.getState().fetchUser({ throwOnError: true });

      if (!user) throw new Error('user state is empty after login');
      return user;
    } catch (error) {
      lastError = error;
      if (attempt === 0) {
        await sleep(USER_SYNC_RETRY_DELAY_MS);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('failed to sync user after login');
};

const syncAfterMobileLogin = async () => {
  const [sessionsResult, userResult, agentsResult] = await Promise.allSettled([
    useSessionStore.getState().fetchSessions({ throwOnError: true }),
    syncUserAfterLogin(),
    useAgentStore.getState().loadAgents(),
  ]);

  if (sessionsResult.status === 'rejected') {
    console.warn('[LoginScreen] sessions sync failed after login:', sessionsResult.reason);
  }
  if (userResult.status === 'rejected') {
    console.warn('[LoginScreen] user sync failed after login:', userResult.reason);
    throw userResult.reason;
  }
  if (agentsResult.status === 'rejected') {
    console.warn('[LoginScreen] agents sync failed after login:', agentsResult.reason);
  }
};

export default function LoginScreen({ navigation }: RootStackScreenProps<'Login'>) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const toast = useToast();
  const colors = useThemeColors();
  const [authConfig, setAuthConfig] = useState<MobileAuthConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingInProvider, setSigningInProvider] = useState<string | null>(null);

  const continueInNoAuthMode = useCallback(async () => {
    await clearTransientAppState({ preserveUserProfile: true });
    await syncAfterMobileLogin();

    navigation.reset({
      index: 0,
      routes: [{ name: 'MainTabs' }],
    });
  }, [navigation]);

  const loadAuthConfig = useCallback(async () => {
    setLoading(true);

    try {
      const baseUrl = await getApiUrl();
      const nextConfig = await fetchMobileAuthConfig(baseUrl);
      setAuthConfig(nextConfig);

      if (nextConfig.enableNoAuth) {
        await continueInNoAuthMode();
      }
    } catch (caughtError) {
      setAuthConfig(null);
      toast.show('error', humanizeAuthError(caughtError, undefined, t));
    } finally {
      setLoading(false);
    }
  }, [continueInNoAuthMode, t, toast]);

  useEffect(() => {
    void loadAuthConfig();
  }, [loadAuthConfig]);

  const primaryProvider = useMemo(() => getPrimaryProvider(authConfig), [authConfig]);

  const handleSignIn = useCallback(
    async (providerId?: string) => {
      setSigningInProvider(providerId || PASSWORD_SIGNIN_KEY);

      try {
        const baseUrl = await getApiUrl();
        const session = await signInWithProvider({ authConfig, baseUrl, providerId });

        if (!session) return;

        await clearTransientAppState({ preserveUserProfile: true });
        await syncAfterMobileLogin();

        navigation.reset({
          index: 0,
          routes: [{ name: 'MainTabs' }],
        });
      } catch (caughtError) {
        toast.show(
          'error',
          humanizeAuthError(caughtError, primaryProvider?.label || providerId, t),
        );
      } finally {
        setSigningInProvider(null);
      }
    },
    [authConfig, navigation, primaryProvider?.label, t, toast],
  );

  const handlePrimaryPress = useCallback(async () => {
    if (loading || signingInProvider) return;

    if (!authConfig) {
      await loadAuthConfig();
      return;
    }

    if (!authConfig.enableOIDC) {
      toast.show('error', t.loginUnsupportedDesc);
      return;
    }

    if (primaryProvider) {
      await handleSignIn(primaryProvider.id);
      return;
    }

    if (!authConfig.disableEmailPassword) {
      await handleSignIn();
      return;
    }

    toast.show('error', t.loginMissingProviders);
  }, [
    authConfig,
    handleSignIn,
    loadAuthConfig,
    loading,
    primaryProvider,
    signingInProvider,
    t,
    toast,
  ]);

  const primaryLabel = getPrimaryActionLabel(authConfig, primaryProvider, t);
  const isBusy = loading || !!signingInProvider;

  return (
    <View
      className="flex-1 px-8"
      style={{
        backgroundColor: colors.background,
        paddingTop: insets.top,
        paddingBottom: insets.bottom + 8,
      }}
    >
      <View className="flex-1 items-center justify-center">
        <Animated.View
          className="items-center"
          entering={FadeInUp.delay(80)
            .duration(tokens.motion.duration.hero)
            .springify()
            .damping(15)
            .mass(0.9)}
        >
          <View
            className="h-32 w-32 items-center justify-center rounded-[34px]"
            style={{
              backgroundColor: colors.surface,
              elevation: 12,
              shadowColor: colors.shadow,
              shadowOffset: { height: 20, width: 0 },
              shadowOpacity: 0.12,
              shadowRadius: 36,
            }}
          >
            <RNImage
              className="h-28 w-28"
              source={require('../../assets/avato-logo.png')}
              style={{ tintColor: colors.foreground }}
            />
          </View>

          <Text
            className="mt-3 text-center text-[36px] font-bold tracking-tight"
            style={{ color: colors.foreground }}
          >
            Avato
          </Text>
          <Text
            className="mt-4 text-center text-[17px] font-medium leading-7"
            style={{ color: colors.secondaryText }}
          >
            {t.loginDesc}
          </Text>
        </Animated.View>

        <Animated.View
          className="mt-10 w-full"
          entering={FadeInDown.delay(180)
            .duration(tokens.motion.duration.hero)
            .springify()
            .damping(16)}
        >
          <TouchableOpacity
            activeOpacity={0.82}
            className="items-center rounded-2xl py-4"
            disabled={isBusy}
            style={{ backgroundColor: colors.primary }}
            onPress={() => void handlePrimaryPress()}
          >
            {isBusy ? (
              <ActivityIndicator color={colors.iconOnPrimary} size="small" />
            ) : (
              <Text className="text-[16px] font-semibold" style={{ color: colors.iconOnPrimary }}>
                {primaryLabel}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            className="mt-4 items-center"
            onPress={() => navigation.navigate('ServerConfig')}
          >
            <Text className="text-[14px] font-medium" style={{ color: colors.primary }}>
              {t.loginChangeServer}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}
