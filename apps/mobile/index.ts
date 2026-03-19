import { registerRootComponent } from 'expo';
import { LogBox } from 'react-native';

import App from './App';

const isKeepAwakeActivityError = (value: unknown) => {
  const text =
    typeof value === 'string'
      ? value
      : value instanceof Error
        ? value.message
        : typeof value === 'object' && value && 'message' in value
          ? String((value as { message?: unknown }).message ?? '')
          : String(value ?? '');

  const message = text.toLowerCase();

  return (
    (message.includes('expokeepawake') || message.includes('keepawake')) &&
    message.includes('activate') &&
    message.includes('activity is no longer available')
  );
};

// Guard very early unhandled rejections before app logger initialization.
{
  const globalScope = globalThis as typeof globalThis & {
    onunhandledrejection?: ((event: any) => void) | null;
  };
  const previous = globalScope.onunhandledrejection;
  globalScope.onunhandledrejection = (event: any) => {
    const reason = event?.reason ?? event;
    if (isKeepAwakeActivityError(reason)) {
      event?.preventDefault?.();
      return;
    }
    previous?.(event);
  };
}

// Suppress ExpoKeepAwake activity errors (harmless when Activity is destroyed during navigation)
LogBox.ignoreLogs([
  'ExpoKeepAwake',
  'activity is no longer available',
  "Call to function 'ExpoKeepAwake.activate' has been rejected",
]);

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
