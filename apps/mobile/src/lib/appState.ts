import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAgentStore } from '../store/agent';
import { useChatStore } from '../store/chat';
import { useFileStore } from '../store/file';
import { useSessionStore } from '../store/session';
import { useUserStore } from '../store/user';
import { clearStoredAuthSession } from './auth';

export const ONBOARDING_KEY = 'avato_onboarding_complete';

const isAuthInvalidReason = (reason: unknown) => {
  const message = reason instanceof Error ? reason.message : String(reason ?? '');
  return /\b401\b|user not found|unauthorized|forbidden|invalid token/i.test(message);
};

export const syncMobileBootstrapState = async () => {
  const [sessionsResult, userResult, agentsResult] = await Promise.allSettled([
    useSessionStore.getState().fetchSessions({ throwOnError: true }),
    useUserStore.getState().fetchUser({ throwOnError: true }),
    useAgentStore.getState().loadAgents(),
  ]);

  let requiresReauth = false;

  if (sessionsResult.status === 'rejected') {
    console.warn('[appState] bootstrap sessions sync failed:', sessionsResult.reason);
  }
  if (userResult.status === 'rejected') {
    console.warn('[appState] bootstrap user sync failed:', userResult.reason);
    if (isAuthInvalidReason(userResult.reason)) {
      requiresReauth = true;
      await clearStoredAuthSession().catch(() => {});
      await clearTransientAppState().catch(() => {});
    }
  }
  if (agentsResult.status === 'rejected') {
    console.warn('[appState] bootstrap agents sync failed:', agentsResult.reason);
  }

  return { requiresReauth };
};

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

export const clearTransientAppState = async (
  options?: { preserveUserProfile?: boolean },
) => {
  await AsyncStorage.removeItem('activeSessionId');
  useChatStore.getState().reset();
  useFileStore.getState().clearPending();
  useSessionStore.getState().reset();

  if (options?.preserveUserProfile) {
    useUserStore.setState({ isLoaded: false });
    return;
  }

  useUserStore.getState().clearProfile();
};
