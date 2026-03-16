import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import type { AgentTemplate } from '../types';

const AGENT_STORAGE_KEY = 'avato_mobile_agents_v1';

interface AgentState {
  agents: AgentTemplate[];
  attachSession: (agentId: string, sessionId: string) => Promise<void>;
  createAgent: (draft: Partial<AgentTemplate>) => Promise<string>;
  deleteAgent: (agentId: string) => Promise<void>;
  initialized: boolean;
  loadAgents: () => Promise<void>;
  updateAgent: (agentId: string, patch: Partial<AgentTemplate>) => Promise<void>;
  upsertAgent: (agent: AgentTemplate) => Promise<void>;
}

const now = () => new Date().toISOString();

const persistAgents = async (agents: AgentTemplate[]) => {
  await AsyncStorage.setItem(AGENT_STORAGE_KEY, JSON.stringify(agents));
};

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: [],
  initialized: false,

  loadAgents: async () => {
    try {
      const raw = await AsyncStorage.getItem(AGENT_STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as AgentTemplate[]) : [];
      set({ agents: Array.isArray(parsed) ? parsed : [], initialized: true });
    } catch {
      set({ agents: [], initialized: true });
    }
  },

  createAgent: async (draft) => {
    const createdAt = now();
    const newAgent: AgentTemplate = {
      avatar: draft.avatar,
      createdAt,
      id: draft.id || `agent-${Date.now()}`,
      model: draft.model,
      params: draft.params,
      plugins: draft.plugins || [],
      provider: draft.provider,
      sessionIds: draft.sessionIds || [],
      systemRole: draft.systemRole,
      title: draft.title || 'New Agent',
      updatedAt: createdAt,
    };
    const next = [newAgent, ...get().agents.filter((item) => item.id !== newAgent.id)];
    set({ agents: next });
    await persistAgents(next);
    return newAgent.id;
  },

  updateAgent: async (agentId, patch) => {
    const next = get().agents.map((agent) =>
      agent.id === agentId ? { ...agent, ...patch, updatedAt: now() } : agent,
    );
    set({ agents: next });
    await persistAgents(next);
  },

  upsertAgent: async (agent) => {
    const next = [
      { ...agent, updatedAt: now() },
      ...get().agents.filter((item) => item.id !== agent.id),
    ];
    set({ agents: next });
    await persistAgents(next);
  },

  deleteAgent: async (agentId) => {
    const next = get().agents.filter((agent) => agent.id !== agentId);
    set({ agents: next });
    await persistAgents(next);
  },

  attachSession: async (agentId, sessionId) => {
    const next = get().agents.map((agent) => {
      if (agent.id !== agentId) return agent;
      return {
        ...agent,
        sessionIds: Array.from(new Set([...agent.sessionIds, sessionId])),
        updatedAt: now(),
      };
    });
    set({ agents: next });
    await persistAgents(next);
  },
}));
