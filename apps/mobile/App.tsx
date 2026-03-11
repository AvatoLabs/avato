import './global.css';

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import SplashScreen from './src/components/splash/SplashScreen';
import { ToastContainer, useToast } from './src/components/ui/Toast';
import { hasConfiguredUrl } from './src/lib/api';
import { useI18n } from './src/lib/i18n';
import RootNavigator from './src/navigation';
import { useConnectionStore } from './src/store/connection';
import { useSessionStore } from './src/store/session';
import { MinkLightTheme } from './src/theme';

const ONBOARDING_KEY = 'minkhub_onboarding_complete';

function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const t = useI18n((s) => s.t);
  return (
    <View style={{ position: 'absolute', top: insets.top, left: 0, right: 0, zIndex: 999 }}>
      <View style={{ backgroundColor: '#ff3b30', paddingVertical: 6, alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{t.errorOffline}</Text>
      </View>
    </View>
  );
}

export default function App() {
  const [isAppReady, setIsAppReady] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const wasOffline = useRef(false);
  const [initialRoute, setInitialRoute] = useState<
    'OnboardingWelcome' | 'ServerConfig' | 'MainTabs'
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
      }
      wasOffline.current = offline;
    });
    return () => unsubscribe();
  }, [t]);

  useEffect(() => {
    const init = async () => {
      // Load persisted locale
      await loadLocale();

      // Check onboarding
      const onboardingDone = await AsyncStorage.getItem(ONBOARDING_KEY);
      const hasUrl = await hasConfiguredUrl();

      if (!onboardingDone && !hasUrl) {
        setInitialRoute('OnboardingWelcome');
        setIsAppReady(true);
        return;
      }

      if (!hasUrl) {
        setInitialRoute('ServerConfig');
        setIsAppReady(true);
        return;
      }

      try {
        await useSessionStore.getState().fetchSessions();
      } catch {
        // Offline
      }

      // Check server connectivity (non-blocking)
      useConnectionStore.getState().checkConnection();

      const timer = setTimeout(() => setIsAppReady(true), 2000);
      return () => clearTimeout(timer);
    };
    init();
  }, []);

  if (!isAppReady) {
    return <SplashScreen />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer theme={MinkLightTheme}>
          <RootNavigator initialRoute={initialRoute} />
          {isOffline && <OfflineBanner />}
          <ToastContainer />
          <StatusBar style="dark" />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
