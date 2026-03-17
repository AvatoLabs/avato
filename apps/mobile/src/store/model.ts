import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { DEFAULT_AGENT_CONFIG } from '../constants/defaultModel';
import { agentApi, agentGroupApi, aiProviderApi, configApi, sessionApi, userApi } from '../lib/api';
import { isGroupSessionLike } from '../lib/session';
import type { ProviderWithModels, RuntimeEnabledModel } from '../types';
import { useSessionStore } from './session';

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
    const session = sessionId
      ? useSessionStore.getState().sessions.find((item) => item.id === sessionId)
      : undefined;
    const isGroupSession = isGroupSessionLike(sessionId, session?.type);

    // 1. Backend agent config (session-specific)
    if (sessionId && !isGroupSession) {
      try {
        const config = await agentApi.getConfigBySession(sessionId);
        if (config?.model) model = config.model;
        if (config?.provider) provider = config.provider;
      } catch {
        /* ignore */
      }
    }

    if (sessionId && isGroupSession) {
      try {
        const groupDetail = await agentGroupApi.getGroupDetail(sessionId);
        const supervisor = groupDetail?.agents?.find(
          (agent) => agent.id === groupDetail?.supervisorAgentId,
        );

        if (!model && typeof supervisor?.model === 'string') model = supervisor.model;
        if (!provider && typeof supervisor?.provider === 'string') provider = supervisor.provider;
      } catch {
        /* ignore */
      }
    }

    if (session) {
      if (!model && session.model) model = session.model;
      if (!provider && session.provider) provider = session.provider;
    }

    // 2. Default agent config (align with Web: DEFAULT -> server -> user)
    if (!model || !provider) {
      try {
        const [serverDefault, userState] = await Promise.all([
          configApi
            .getDefaultAgentConfig()
            .catch((): { model?: string; provider?: string } => ({})),
          userApi.getState(),
        ]);
        const userConfig = userState?.settings?.defaultAgent?.config || {};
        const serverCfg = serverDefault as { model?: string; provider?: string };

        const merged = {
          model: model || userConfig.model || serverCfg.model || DEFAULT_AGENT_CONFIG.model,
          provider:
            provider || userConfig.provider || serverCfg.provider || DEFAULT_AGENT_CONFIG.provider,
        };
        if (!model) model = merged.model;
        if (!provider) provider = merged.provider;
      } catch {
        if (!model) model = DEFAULT_AGENT_CONFIG.model;
        if (!provider) provider = DEFAULT_AGENT_CONFIG.provider;
      }
    }

    // 3. Runtime fallback: validate model is enabled, resolve provider if missing
    if (!get().isLoaded || get().providers.length === 0) {
      await get().fetchModels();
    }

    const providers = get().providers;

    const isModelEnabled = (m: string, p: string) =>
      providers.some((pr) => pr.id === p && pr.children.some((ch) => ch.id === m));

    if (model && !provider) {
      const found = providers.find((pr) => pr.children.some((ch) => ch.id === model));
      if (found) provider = found.id;
    }

    if (model && provider && !isModelEnabled(model, provider)) {
      model = '';
      provider = '';
    }

    if (!model || !provider) {
      const currentSelectedModel = get().selectedModel;
      const currentSelectedProvider = get().selectedProvider;
      const selectedProviderEntry = currentSelectedProvider
        ? providers.find((item) => item.id === currentSelectedProvider)
        : undefined;
      const selectedModelStillEnabled =
        !!selectedProviderEntry &&
        !!currentSelectedModel &&
        selectedProviderEntry.children.some((child) => child.id === currentSelectedModel);

      const fallbackProvider = selectedProviderEntry || providers[0];
      const fallbackModel = selectedModelStillEnabled
        ? selectedProviderEntry?.children.find((child) => child.id === currentSelectedModel)
        : fallbackProvider?.children[0];

      if (!provider && fallbackProvider) provider = fallbackProvider.id;
      if (!model && fallbackModel) model = fallbackModel.id;
    }

    set({ selectedModel: model, selectedProvider: provider });
  },

  selectModel: async (modelId, providerId, sessionId) => {
    set({ selectedModel: modelId, selectedProvider: providerId });

    if (sessionId) {
      const session = useSessionStore.getState().sessions.find((item) => item.id === sessionId);
      if (isGroupSessionLike(sessionId, session?.type)) return;

      // Update backend agent config (single source of truth)
      try {
        const config = await agentApi.getConfigBySession(sessionId);
        if (config?.id) {
          await agentApi.updateConfig(config.id, { model: modelId, provider: providerId });
        } else {
          await sessionApi.updateSessionConfig(sessionId, {
            model: modelId,
            provider: providerId,
          });
        }
      } catch {
        /* best-effort */
      }
    }

    // Global selection: align with web by writing into user.settings.defaultAgent.config
    try {
      const userState = await userApi.getState();
      const defaultAgent = (userState?.settings?.defaultAgent || {}) as Record<string, any>;
      const defaultAgentConfig = (defaultAgent.config || {}) as Record<string, any>;

      await userApi.updateSettings({
        defaultAgent: {
          ...defaultAgent,
          config: {
            ...defaultAgentConfig,
            model: modelId,
            provider: providerId,
          },
        },
      });
    } catch (error) {
      console.warn('[ModelStore] failed to persist global default model', error);
    }
  },
}));
