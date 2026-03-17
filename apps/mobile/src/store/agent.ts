import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import type { AgentTemplate } from '../types';

const AGENT_STORAGE_KEY = 'avato_mobile_agents_v1';
const CURRENT_AGENT_STORAGE_KEY = 'avato_mobile_current_agent_v1';

interface AgentState {
  agents: AgentTemplate[];
  attachSession: (agentId: string, sessionId: string) => Promise<void>;
  createAgent: (draft: Partial<AgentTemplate>) => Promise<string>;
  currentAgentId: string | null;
  deleteAgent: (agentId: string) => Promise<void>;
  detachSession: (sessionId: string) => Promise<void>;
  getCurrentAgent: () => AgentTemplate | null;
  initialized: boolean;
  loadAgents: () => Promise<void>;
  setCurrentAgent: (agentId: string | null) => Promise<void>;
  updateAgent: (agentId: string, patch: Partial<AgentTemplate>) => Promise<void>;
  upsertAgent: (agent: AgentTemplate) => Promise<void>;
}

const now = () => new Date().toISOString();

const persistAgents = async (agents: AgentTemplate[]) => {
  await AsyncStorage.setItem(AGENT_STORAGE_KEY, JSON.stringify(agents));
};

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: [],
  currentAgentId: null,
  initialized: false,

  loadAgents: async () => {
    try {
      const [raw, currentRaw] = await Promise.all([
        AsyncStorage.getItem(AGENT_STORAGE_KEY),
        AsyncStorage.getItem(CURRENT_AGENT_STORAGE_KEY),
      ]);
      const parsed = raw ? (JSON.parse(raw) as AgentTemplate[]) : [];
      const agents = Array.isArray(parsed) ? parsed : [];
      const storedCurrentId = currentRaw || null;
      const resolvedCurrentId =
        storedCurrentId && agents.some((agent) => agent.id === storedCurrentId)
          ? storedCurrentId
          : (agents[0]?.id ?? null);

      if (resolvedCurrentId !== storedCurrentId) {
        if (resolvedCurrentId) {
          await AsyncStorage.setItem(CURRENT_AGENT_STORAGE_KEY, resolvedCurrentId);
        } else {
          await AsyncStorage.removeItem(CURRENT_AGENT_STORAGE_KEY);
        }
      }

      set({ agents, currentAgentId: resolvedCurrentId, initialized: true });
    } catch {
      set({ agents: [], currentAgentId: null, initialized: true });
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
    const shouldPickAsCurrent = !get().currentAgentId;
    set({ agents: next, ...(shouldPickAsCurrent ? { currentAgentId: newAgent.id } : {}) });
    await Promise.all([
      persistAgents(next),
      shouldPickAsCurrent
        ? AsyncStorage.setItem(CURRENT_AGENT_STORAGE_KEY, newAgent.id)
        : Promise.resolve(),
    ]);
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
    const currentAgentId = get().currentAgentId;
    const nextCurrentId = currentAgentId === agentId ? (next[0]?.id ?? null) : currentAgentId;

    set({ agents: next, currentAgentId: nextCurrentId });
    await persistAgents(next);
    if (nextCurrentId) {
      await AsyncStorage.setItem(CURRENT_AGENT_STORAGE_KEY, nextCurrentId);
    } else {
      await AsyncStorage.removeItem(CURRENT_AGENT_STORAGE_KEY);
    }
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

  detachSession: async (sessionId) => {
    const next = get().agents.map((agent) => {
      if (!agent.sessionIds.includes(sessionId)) return agent;
      return {
        ...agent,
        sessionIds: agent.sessionIds.filter((id) => id !== sessionId),
        updatedAt: now(),
      };
    });
    set({ agents: next });
    await persistAgents(next);
  },

  setCurrentAgent: async (agentId) => {
    const nextId = agentId && get().agents.some((agent) => agent.id === agentId) ? agentId : null;
    set({ currentAgentId: nextId });
    if (nextId) {
      await AsyncStorage.setItem(CURRENT_AGENT_STORAGE_KEY, nextId);
    } else {
      await AsyncStorage.removeItem(CURRENT_AGENT_STORAGE_KEY);
    }
  },

  getCurrentAgent: () => {
    const { agents, currentAgentId } = get();
    if (!currentAgentId) return null;
    return agents.find((agent) => agent.id === currentAgentId) || null;
  },
}));
