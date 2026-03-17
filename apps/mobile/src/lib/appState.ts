import AsyncStorage from '@react-native-async-storage/async-storage';

import { useChatStore } from '../store/chat';
import { useFileStore } from '../store/file';
import { useSessionStore } from '../store/session';
import { useUserStore } from '../store/user';

/** One-time migration: remove deprecated avato_default_model / avato_chat_settings_* keys */
export const migrateDeprecatedStorageKeys = async () => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const toRemove = keys.filter(
      (k) =>
        k === 'avato_default_model' ||
        k === 'avato_default_provider' ||
        k.startsWith('avato_chat_settings_'),
    );
    if (toRemove.length > 0) {
      await AsyncStorage.multiRemove(toRemove);
    }
  } catch {
    /* best-effort */
  }
};

export const clearTransientAppState = async () => {
  await AsyncStorage.removeItem('activeSessionId');
  useChatStore.getState().reset();
  useFileStore.getState().clearPending();
  useSessionStore.getState().reset();
  useUserStore.getState().clearProfile();
};
