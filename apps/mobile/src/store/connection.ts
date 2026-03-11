/**
 * Connection store — tracks server connectivity status.
 *
 * Provides real-time `isConnected` and `serverUrl` state
 * so ProfileScreen and other components reflect actual status
 * instead of hardcoded values.
 */
import { create } from 'zustand';

import { getApiUrl, testConnection } from '../lib/api';

interface ConnectionState {
  /** Ping the server and update state */
  checkConnection: () => Promise<void>;
  /** Whether a check is in flight */
  checking: boolean;
  /** Whether the last health-check succeeded */
  isConnected: boolean;
  /** Currently configured server URL */
  serverUrl: string;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  isConnected: false,
  serverUrl: '',
  checking: false,

  checkConnection: async () => {
    set({ checking: true });
    try {
      const url = await getApiUrl();
      const ok = await testConnection(url);
      set({ isConnected: ok, serverUrl: url, checking: false });
    } catch {
      set({ isConnected: false, checking: false });
    }
  },
}));
