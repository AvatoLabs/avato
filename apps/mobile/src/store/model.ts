import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { agentApi, aiProviderApi } from '../lib/api';
import type { ProviderWithModels, RuntimeEnabledModel } from '../types';

const CACHE_KEY = 'minkhub_model_cache';
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const SELECTED_MODEL_KEY = 'minkhub_default_model';
const SELECTED_PROVIDER_KEY = 'minkhub_default_provider';

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

    if (sessionId) {
      try {
        const raw = await AsyncStorage.getItem(`minkhub_chat_settings_${sessionId}`);
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved.model) model = saved.model;
          if (saved.provider) provider = saved.provider;
        }
      } catch {
        /* ignore */
      }
    }

    if (!model) {
      try {
        model = (await AsyncStorage.getItem(SELECTED_MODEL_KEY)) || '';
      } catch {
        /* ignore */
      }
    }
    if (!provider) {
      try {
        provider = (await AsyncStorage.getItem(SELECTED_PROVIDER_KEY)) || '';
      } catch {
        /* ignore */
      }
    }

    set({ selectedModel: model, selectedProvider: provider });
  },

  selectModel: async (modelId, providerId, sessionId) => {
    set({ selectedModel: modelId, selectedProvider: providerId });

    if (sessionId) {
      let existing: Record<string, unknown> = {};
      try {
        const raw = await AsyncStorage.getItem(`minkhub_chat_settings_${sessionId}`);
        if (raw) existing = JSON.parse(raw);
      } catch {
        /* ignore */
      }

      const { providers } = get();
      let supportsVision = false;
      for (const p of providers) {
        const found = p.children.find((m) => m.id === modelId && p.id === providerId);
        if (found) {
          supportsVision = !!found.abilities?.vision;
          break;
        }
      }

      existing.model = modelId;
      existing.provider = providerId;
      existing.vision = supportsVision;
      await AsyncStorage.setItem(`minkhub_chat_settings_${sessionId}`, JSON.stringify(existing));

      // Also update backend agent config so model/provider persists server-side
      try {
        const config = await agentApi.getConfigBySession(sessionId);
        if (config?.id) {
          await agentApi.updateConfig(config.id, { model: modelId, provider: providerId });
        }
      } catch {
        /* best-effort */
      }
    }

    await AsyncStorage.setItem(SELECTED_MODEL_KEY, modelId);
    await AsyncStorage.setItem(SELECTED_PROVIDER_KEY, providerId);
  },
}));
