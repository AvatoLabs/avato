import './global.css';

import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import React, { useEffect, useState } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import SplashLoading from './src/components/SplashLoading';
import { hasConfiguredUrl } from './src/lib/api';
import { useI18n } from './src/lib/i18n';
import RootNavigator from './src/navigation';
import { useSessionStore } from './src/store/session';
import { MinkDarkTheme, MinkLightTheme } from './src/theme';

export default function App() {
  const { colorScheme } = useColorScheme();
  const systemScheme = useSystemColorScheme();
  const [isAppReady, setIsAppReady] = useState(false);
  const [initialRoute, setInitialRoute] = useState<'ServerConfig' | 'MainTabs'>('MainTabs');
  const loadLocale = useI18n((s) => s.loadLocale);

  // Determine effective color scheme (NativeWind handles className, we need this for nav theme + status bar)
  const effectiveScheme = colorScheme || systemScheme || 'light';
  const isDark = effectiveScheme === 'dark';

  useEffect(() => {
    const init = async () => {
      // Load persisted locale
      await loadLocale();

      const hasUrl = await hasConfiguredUrl();
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

      const timer = setTimeout(() => setIsAppReady(true), 2000);
      return () => clearTimeout(timer);
    };
    init();
  }, []);

  if (!isAppReady) {
    return <SplashLoading />;
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer
        theme={isDark ? MinkDarkTheme : MinkLightTheme}
      >
        <RootNavigator initialRoute={initialRoute} />
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
