import './global.css';

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemeProvider } from './src/components/ThemeProvider';
import { ToastContainer, useToast } from './src/components/ui/Toast';
import {
  migrateDeprecatedStorageKeys,
  ONBOARDING_KEY,
  syncMobileBootstrapState,
} from './src/lib/appState';
import { fetchMobileAuthConfig, getValidAuthSession } from './src/lib/auth';
import { useI18n } from './src/lib/i18n';
import { AppErrorBoundary, initAppLogger } from './src/lib/logger';
import { getApiUrl, hasConfiguredUrl } from './src/lib/server';
import RootNavigator from './src/navigation';
import { useConnectionStore } from './src/store/connection';
import { useThemeStore } from './src/store/theme';
import { useThemeColors } from './src/theme/colors';

ExpoSplashScreen.preventAutoHideAsync().catch(() => {});

// Suppress known harmless errors in development
if (__DEV__) {
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    const message = args.map((a) => (a instanceof Error ? a.message : String(a))).join(' ');
    // Ignore expo-keep-awake activity errors (harmless when Activity is destroyed)
    if (message.includes('ExpoKeepAwake') && message.includes('activity is no longer available')) {
      return;
    }
    originalError(...args);
  };
}

function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const t = useI18n((s) => s.t);
  const colors = useThemeColors();
  return (
    <View style={{ position: 'absolute', top: insets.top, left: 0, right: 0, zIndex: 999 }}>
      <View style={{ backgroundColor: colors.danger, paddingVertical: 6, alignItems: 'center' }}>
        <Text style={{ color: colors.iconOnPrimary, fontSize: 13, fontWeight: '600' }}>
          {t.errorOffline}
        </Text>
      </View>
    </View>
  );
}

function AppCrashFallback() {
  const insets = useSafeAreaInsets();
  const t = useI18n((s) => s.t);
  const { background, foreground, secondaryText } = useThemeColors();

  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: background,
        flex: 1,
        justifyContent: 'center',
        paddingBottom: insets.bottom,
        paddingHorizontal: 24,
        paddingTop: insets.top,
      }}
    >
      <Text style={{ color: foreground, fontSize: 22, fontWeight: '700', marginBottom: 12 }}>
        {t.errorUnknown}
      </Text>
      <Text style={{ color: secondaryText, fontSize: 14, textAlign: 'center' }}>
        {t.logsCrashHint}
      </Text>
    </View>
  );
}

export default function App() {
  const [isBootReady, setIsBootReady] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const wasOffline = useRef(false);
  const [initialRoute, setInitialRoute] = useState<
    'Login' | 'MainTabs' | 'OnboardingWelcome' | 'ServerConfig'
  >('MainTabs');
  const loadLocale = useI18n((s) => s.loadLocale);
  const t = useI18n((s) => s.t);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      // Only check physical network layer — isInternetReachable pings public
      // internet which is unreliable when the user connects to a LAN server.
      const offline = !state.isConnected;
      setIsOffline(offline);
      if (wasOffline.current && !offline) {
        useToast.getState().show('success', t.toastConnectionRestored);
        void syncMobileBootstrapState().then(({ requiresReauth }) => {
          if (requiresReauth) {
            setInitialRoute('Login');
          }
        });
      }
      wasOffline.current = offline;
    });
    return () => unsubscribe();
  }, [t]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return;

      void syncMobileBootstrapState().then(({ requiresReauth }) => {
        if (requiresReauth) {
          setInitialRoute('Login');
        }
      });
      useConnectionStore.getState().checkConnection();
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const init = async () => {
      let shouldCheckConnection = false;
      try {
        await initAppLogger();
        await loadLocale();

        const onboardingDone = await AsyncStorage.getItem(ONBOARDING_KEY);
        const hasUrl = await hasConfiguredUrl();

        if (!onboardingDone && !hasUrl) {
          if (!isCancelled) {
            setInitialRoute('OnboardingWelcome');
          }
          return;
        }

        if (!hasUrl) {
          if (!isCancelled) {
            setInitialRoute('ServerConfig');
          }
          return;
        }

        shouldCheckConnection = true;

        const baseUrl = await getApiUrl();
        const authConfig = await fetchMobileAuthConfig(baseUrl);

        if (authConfig.enableNoAuth) {
          const { requiresReauth } = await syncMobileBootstrapState();
          void migrateDeprecatedStorageKeys();
          if (!isCancelled) {
            setInitialRoute(requiresReauth ? 'Login' : 'MainTabs');
          }
          return;
        }

        const authSession = authConfig.enableOIDC ? await getValidAuthSession(baseUrl) : null;

        if (authSession) {
          const { requiresReauth } = await syncMobileBootstrapState();
          void migrateDeprecatedStorageKeys();
          if (!isCancelled) {
            setInitialRoute(requiresReauth ? 'Login' : 'MainTabs');
          }
          return;
        }

        if (!isCancelled) {
          setInitialRoute('Login');
        }
      } catch (error) {
        console.warn('[App] bootstrap init failed:', error);
        if (!isCancelled) {
          setInitialRoute('Login');
        }
      } finally {
        if (shouldCheckConnection) {
          useConnectionStore.getState().checkConnection();
        }

        if (!isCancelled) {
          setIsBootReady(true);
        }
      }
    };

    void init();

    return () => {
      isCancelled = true;
    };
  }, [loadLocale]);

  useEffect(() => {
    if (!isBootReady) return;

    ExpoSplashScreen.hideAsync().catch(() => {});
  }, [isBootReady]);

  // StatusBar style: light content on dark bg, dark content on light bg (must be before early return for hooks rules)
  const effectiveTheme = useThemeStore((s) => s.effectiveTheme);
  const statusBarStyle = effectiveTheme === 'dark' ? 'light' : 'dark';

  if (!isBootReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppErrorBoundary fallback={<AppCrashFallback />}>
            <RootNavigator initialRoute={initialRoute} />
            {isOffline && <OfflineBanner />}
            <ToastContainer />
            <StatusBar style={statusBarStyle} />
          </AppErrorBoundary>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
