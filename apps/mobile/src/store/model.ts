import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { agentApi, aiProviderApi } from '../lib/api';
import type { ProviderWithModels, RuntimeEnabledModel } from '../types';
import { useAgentStore } from './agent';

const CACHE_KEY = 'avato_model_cache';
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

interface CachedData {
  providers: ProviderWithModels[];
  timestamp: number;
}

function buildProviderModelTree(
  providers: { id: string; name?: string; logo?: string }[],
  models: RuntimeEnabledModel[],
): ProviderWithModels[] {
  const seen = new Set<string>();
  const uniqueProviders = providers.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  return uniqueProviders
    .map((p) => {
      const childSeen = new Set<string>();
      const children = models.filter((m) => {
        if (m.providerId !== p.id || m.type !== 'chat') return false;
        if (childSeen.has(m.id)) return false;
        childSeen.add(m.id);
        return true;
      });
      return { id: p.id, name: p.name || p.id, logo: p.logo, children };
    })
    .filter((p) => p.children.length > 0);
}

interface ModelState {
  fetchModels: (force?: boolean) => Promise<void>;
  isLoaded: boolean;
  loading: boolean;
  loadSelection: (sessionId?: string) => Promise<void>;
  providers: ProviderWithModels[];

  selectedModel: string;
  selectedProvider: string;
  selectModel: (modelId: string, providerId: string, sessionId?: string) => Promise<void>;
}

export const useModelStore = create<ModelState>((set, get) => ({
  isLoaded: false,
  loading: false,
  providers: [],
  selectedModel: '',
  selectedProvider: '',

  fetchModels: async (force = false) => {
    if (get().loading) return;

    if (!force) {
      try {
        const raw = await AsyncStorage.getItem(CACHE_KEY);
        if (raw) {
          const cached: CachedData = JSON.parse(raw);
          if (Date.now() - cached.timestamp < CACHE_TTL && cached.providers.length > 0) {
            set({ providers: cached.providers, isLoaded: true });
            return;
          }
        }
      } catch {
        /* ignore */
      }
    }

    set({ loading: true });
    try {
      const state = await aiProviderApi.getRuntimeState();
      if (state?.enabledChatAiProviders && state?.enabledAiModels) {
        const tree = buildProviderModelTree(state.enabledChatAiProviders, state.enabledAiModels);
        set({ providers: tree, isLoaded: true });

        await AsyncStorage.setItem(
          CACHE_KEY,
          JSON.stringify({
            providers: tree,
            timestamp: Date.now(),
          } satisfies CachedData),
        );
      }
    } catch {
      // Load from stale cache if available
      try {
        const raw = await AsyncStorage.getItem(CACHE_KEY);
        if (raw) {
          const cached: CachedData = JSON.parse(raw);
          if (cached.providers.length > 0) {
            set({ providers: cached.providers, isLoaded: true });
          }
        }
      } catch {
        /* ignore */
      }
    } finally {
      set({ loading: false, isLoaded: true });
    }
  },

  loadSelection: async (sessionId?: string) => {
    let model = '';
    let provider = '';

    // 1. Backend agent config (session-specific)
    if (sessionId) {
      try {
        const config = await agentApi.getConfigBySession(sessionId);
        if (config?.model) model = config.model;
        if (config?.provider) provider = config.provider;
      } catch {
        /* ignore */
      }
    }

    // 2. Local Agent fallback (session's agent or default agent)
    if (!model || !provider) {
      const agentStore = useAgentStore.getState();
      if (!agentStore.initialized) await agentStore.loadAgents();
      const agent = sessionId
        ? agentStore.agents.find((a) => a.sessionIds.includes(sessionId)) || agentStore.getCurrentAgent()
        : agentStore.getCurrentAgent();
      if (agent) {
        if (!model && agent.model) model = agent.model;
        if (!provider && agent.provider) provider = agent.provider;
      }
    }

    set({ selectedModel: model, selectedProvider: provider });
  },

  selectModel: async (modelId, providerId, sessionId) => {
    set({ selectedModel: modelId, selectedProvider: providerId });

    if (sessionId) {
      // Update backend agent config (single source of truth)
      try {
        const config = await agentApi.getConfigBySession(sessionId);
        if (config?.id) {
          await agentApi.updateConfig(config.id, { model: modelId, provider: providerId });
        }
      } catch {
        /* best-effort */
      }
    } else {
      // Global default: update current agent in local store (create if none)
      const agentStore = useAgentStore.getState();
      if (!agentStore.initialized) await agentStore.loadAgents();
      let current = agentStore.getCurrentAgent();
      if (!current && agentStore.agents.length === 0) {
        await agentStore.createAgent({
          model: modelId,
          provider: providerId,
          title: 'Default',
        });
        current = agentStore.getCurrentAgent();
      }
      if (current) {
        await agentStore.updateAgent(current.id, { model: modelId, provider: providerId });
      }
    }
  },
}));
