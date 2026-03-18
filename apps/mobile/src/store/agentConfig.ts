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
  params?: Record<string, unknown>;
  plugins?: string[];
  provider?: string;
  systemRole?: string;
  title?: string | null;
  model?: string;
  [key: string]: any;
} | null;

interface AgentConfigState {
  /** Cache: sessionId -> agent config. null = no config / error. */
  configMap: Record<string, AgentConfigCacheItem>;
  /** Fetch config for session, populate cache, return result. */
  fetchConfig: (sessionId: string) => Promise<AgentConfigCacheItem>;
  /** Fetch config by agent ID (for editing without session). Key: `agent:${agentId}` */
  fetchConfigByAgentId: (agentId: string) => Promise<AgentConfigCacheItem>;
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
    } catch (error) {
      console.warn('[AgentConfigStore] fetchConfig error:', error);
      throw error;
    }
  },

  fetchConfigByAgentId: async (agentId: string) => {
    const key = `agent:${agentId}`;
    const cached = get().configMap[key];
    if (cached !== undefined) return cached;

    try {
      const config = await agentApi.getConfigByAgentId(agentId);
      const value: AgentConfigCacheItem = config ?? null;
      set((s) => ({
        configMap: { ...s.configMap, [key]: value },
      }));
      return value;
    } catch (error) {
      console.warn('[AgentConfigStore] fetchConfigByAgentId error:', error);
      throw error;
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
