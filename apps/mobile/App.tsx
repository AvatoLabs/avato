import './global.css';

import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { useEffect, useState } from 'react';

import SplashLoading from './src/components/SplashLoading';
import RootNavigator from './src/navigation';
import { MinkDarkTheme, MinkLightTheme } from './src/theme';

export default function App() {
  const { colorScheme } = useColorScheme();
  const [isAppReady, setIsAppReady] = useState(false);

  useEffect(() => {
    // Simulate initial loading sequence
    const timer = setTimeout(() => {
      setIsAppReady(true);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  if (!isAppReady) {
    return <SplashLoading />;
  }

  return (
    <NavigationContainer theme={colorScheme === 'dark' ? MinkDarkTheme : MinkLightTheme}>
      <RootNavigator />
      <StatusBar style="auto" />
    </NavigationContainer>
  );
}
