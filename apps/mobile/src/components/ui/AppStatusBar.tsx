import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, StatusBar as NativeStatusBar } from 'react-native';

export interface AppStatusBarProps {
  animated?: boolean;
  barStyle: 'dark-content' | 'light-content';
  restoreBarStyle?: 'dark-content' | 'light-content';
}

const toExpoStyle = (barStyle: AppStatusBarProps['barStyle']) =>
  barStyle === 'light-content' ? 'light' : 'dark';

export default function AppStatusBar({
  animated = true,
  barStyle,
  restoreBarStyle,
}: AppStatusBarProps) {
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    NativeStatusBar.setBarStyle(barStyle, animated);

    return () => {
      if (restoreBarStyle) {
        NativeStatusBar.setBarStyle(restoreBarStyle, animated);
      }
    };
  }, [animated, barStyle, restoreBarStyle]);

  if (Platform.OS === 'android') return null;

  return <ExpoStatusBar animated={animated} style={toExpoStyle(barStyle)} />;
}
