/**
 * SessionGroup store — manages session groups (folders).
 */
import { create } from 'zustand';

import { useToast } from '../components/ui/Toast';
import { sessionGroupApi } from '../lib/api';
import { classifyError } from '../lib/errorHandler';
import { useI18n } from '../lib/i18n';
import type { SessionGroup } from '../types';

interface SessionGroupState {
  createGroup: (name: string) => Promise<SessionGroup | null>;
  fetchGroups: () => Promise<void>;

  groups: SessionGroup[];
  loading: boolean;
  removeAll: () => Promise<void>;
  removeGroup: (id: string) => Promise<void>;
  renameGroup: (id: string, name: string) => Promise<void>;
  reorderGroup: (id: string, direction: 'up' | 'down') => Promise<void>;
}

export const useSessionGroupStore = create<SessionGroupState>((set, get) => ({
  groups: [],
  loading: false,

  fetchGroups: async () => {
    set({ loading: true });
    try {
      const groups = await sessionGroupApi.list();
      set({ groups: groups ?? [], loading: false });
    } catch (err) {
      const { messageKey } = classifyError(err);
      const t = useI18n.getState().t;
      useToast.getState().show('error', t[messageKey]);
      set({ loading: false });
    }
  },

  createGroup: async (name: string) => {
    try {
      // createSessionGroup now returns the group ID string directly
      const newId = await sessionGroupApi.create(name);
      if (newId) {
        const newGroup: SessionGroup = {
          id: newId,
          name,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((s) => ({ groups: [...s.groups, newGroup] }));
        return newGroup;
      }
      return null;
    } catch (err) {
      console.warn('[SessionGroupStore] createGroup error:', err);
      return null;
    }
  },

  removeGroup: async (id: string) => {
    set((s) => ({ groups: s.groups.filter((g) => g.id !== id) }));
    try {
      await sessionGroupApi.remove(id);
    } catch (err) {
      console.warn('[SessionGroupStore] removeGroup error:', err);
      get().fetchGroups();
    }
  },

  renameGroup: async (id: string, name: string) => {
    set((s) => ({
      groups: s.groups.map((g) => (g.id === id ? { ...g, name } : g)),
    }));
    try {
      await sessionGroupApi.rename(id, name);
    } catch (err) {
      console.warn('[SessionGroupStore] renameGroup error:', err);
      get().fetchGroups();
    }
  },

  removeAll: async () => {
    const prev = get().groups;
    set({ groups: [] });
    try {
      await sessionGroupApi.removeAll();
    } catch (err) {
      console.warn('[SessionGroupStore] removeAll error:', err);
      set({ groups: prev });
    }
  },

  reorderGroup: async (id: string, direction: 'up' | 'down') => {
    const groups = [...get().groups];
    const idx = groups.findIndex((g) => g.id === id);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= groups.length) return;
    // Swap
    [groups[idx], groups[swapIdx]] = [groups[swapIdx], groups[idx]];
    // Assign sort values
    const sorted = groups.map((g, i) => ({ ...g, sort: i }));
    set({ groups: sorted });
    try {
      await sessionGroupApi.updateOrder(sorted.map((g, i) => ({ id: g.id, sort: i })));
    } catch (err) {
      console.warn('[SessionGroupStore] reorderGroup error:', err);
      get().fetchGroups();
    }
  },
}));
