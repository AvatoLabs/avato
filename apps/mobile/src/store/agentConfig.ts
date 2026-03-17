/**
 * Agent config cache — session-scoped agent configuration.
 *
 * Aligns with web architecture: agent config is cached and shared between
 * ChatSettings (agent summary) and AgentConfig (full config editor).
 * Keyed by sessionId (for session-only agents, sessionId = agent's session).
 */
import { create } from 'zustand';

import { agentApi } from '../lib/api';

export type AgentConfigCacheItem = {
  avatar?: string | null;
  description?: string | null;
  id: string;
  plugins?: string[];
  title?: string | null;
  [key: string]: any;
} | null;

interface AgentConfigState {
  /** Cache: sessionId -> agent config. null = no config / error. */
  configMap: Record<string, AgentConfigCacheItem>;
  /** Fetch config for session, populate cache, return result. */
  fetchConfig: (sessionId: string) => Promise<AgentConfigCacheItem>;
  /** Invalidate cache for session (e.g. after save). */
  invalidate: (sessionId: string) => void;
  /** Update cache after save (optimistic merge). */
  setConfig: (sessionId: string, config: AgentConfigCacheItem) => void;
}

export const useAgentConfigStore = create<AgentConfigState>((set, get) => ({
  configMap: {},

  fetchConfig: async (sessionId: string) => {
    const cached = get().configMap[sessionId];
    if (cached !== undefined) return cached;

    try {
      const config = await agentApi.getConfigBySession(sessionId);
      const value: AgentConfigCacheItem = config ?? null;
      set((s) => ({
        configMap: { ...s.configMap, [sessionId]: value },
      }));
      return value;
    } catch {
      set((s) => ({
        configMap: { ...s.configMap, [sessionId]: null },
      }));
      return null;
    }
  },

  invalidate: (sessionId: string) => {
    set((s) => {
      const next = { ...s.configMap };
      delete next[sessionId];
      return { configMap: next };
    });
  },

  setConfig: (sessionId: string, config: AgentConfigCacheItem) => {
    set((s) => ({
      configMap: { ...s.configMap, [sessionId]: config },
    }));
  },
}));
