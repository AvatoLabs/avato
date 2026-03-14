import AsyncStorage from '@react-native-async-storage/async-storage';

import { useChatStore } from '../store/chat';
import { useFileStore } from '../store/file';
import { useSessionStore } from '../store/session';
import { useUserStore } from '../store/user';

export const clearTransientAppState = async () => {
  await AsyncStorage.removeItem('activeSessionId');
  useChatStore.getState().reset();
  useFileStore.getState().clearPending();
  useSessionStore.getState().reset();
  useUserStore.getState().clearProfile();
};
