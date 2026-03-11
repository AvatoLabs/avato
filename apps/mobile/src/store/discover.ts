/**
 * Discover store — manages agent/model/provider browsing from the marketplace.
 */
import { create } from 'zustand';

import { useToast } from '../components/ui/Toast';
import { aiProviderApi, marketApi } from '../lib/api';
import { classifyError } from '../lib/errorHandler';
import { useI18n } from '../lib/i18n';
import type { AiProviderListItem, DiscoverModel, MarketAgent } from '../types';

interface DiscoverState {
  agentDetail: MarketAgent | null;
  agents: MarketAgent[];
  fetchAgentDetail: (identifier: string) => Promise<void>;
  fetchAgents: (locale?: string) => Promise<void>;
  fetchModels: () => Promise<void>;
  fetchProviders: () => Promise<void>;

  loading: boolean;
  models: DiscoverModel[];
  providers: AiProviderListItem[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

export const useDiscoverStore = create<DiscoverState>((set) => ({
  agents: [],
  models: [],
  providers: [],
  agentDetail: null,
  loading: false,
  searchQuery: '',

  fetchAgents: async (locale = 'en-US') => {
    set({ loading: true });
    try {
      const result = await marketApi.getAgentList(locale);
      set({ agents: result?.agents ?? [], loading: false });
    } catch (err) {
      const { messageKey } = classifyError(err);
      const t = useI18n.getState().t;
      useToast.getState().show('error', t[messageKey]);
      set({ loading: false });
    }
  },

  fetchModels: async () => {
    try {
      // aiModel.getAiModelList doesn't exist on server;
      // use aiProvider runtime state to get enabled models instead.
      const state = await aiProviderApi.getRuntimeState();
      const models = (state?.enabledAiModels ?? []).map((m: any) => ({
        id: m.id,
        displayName: m.displayName || m.id,
        providerId: m.providerId,
        type: m.type,
      }));
      set({ models: models as any });
    } catch (err) {
      const { messageKey } = classifyError(err);
      const t = useI18n.getState().t;
      useToast.getState().show('error', t[messageKey]);
    }
  },

  fetchProviders: async () => {
    try {
      const providers = await aiProviderApi.list();
      set({ providers: providers ?? [] });
    } catch (err) {
      const { messageKey } = classifyError(err);
      const t = useI18n.getState().t;
      useToast.getState().show('error', t[messageKey]);
    }
  },

  fetchAgentDetail: async (identifier: string) => {
    set({ agentDetail: null });
    try {
      const detail = await marketApi.getAgentDetail(identifier);
      set({ agentDetail: detail });
    } catch (err) {
      const { messageKey } = classifyError(err);
      const t = useI18n.getState().t;
      useToast.getState().show('error', t[messageKey]);
    }
  },

  setSearchQuery: (q: string) => set({ searchQuery: q }),
}));
