import { create } from 'zustand';

import { userApi } from '../lib/api';
import type { UserProfile } from '../types';

interface UserState {
  avatar: string | null;
  clearProfile: () => void;
  email: string | null;
  fetchUser: () => Promise<void>;
  fullName: string | null;
  interests: string[];
  isLoaded: boolean;
  profile: UserProfile | null;

  setProfile: (profile: UserProfile) => void;
  updateField: (field: Partial<UserProfile>) => void;
  username: string | null;
}

export const useUserStore = create<UserState>((set, get) => ({
  avatar: null,
  email: null,
  fullName: null,
  interests: [],
  isLoaded: false,
  profile: null,
  username: null,

  clearProfile: () => {
    set({
      avatar: null,
      email: null,
      fullName: null,
      interests: [],
      isLoaded: false,
      profile: null,
      username: null,
    });
  },

  fetchUser: async () => {
    try {
      const user = await userApi.getUser();
      if (user) {
        set({
          avatar: user.avatar || null,
          email: user.email || null,
          fullName: user.fullName || null,
          interests: user.interests || [],
          isLoaded: true,
          profile: user,
          username: user.username || null,
        });
      }
    } catch {
      set({ isLoaded: true });
    }
  },

  setProfile: (profile) => {
    set({
      avatar: profile.avatar || null,
      email: profile.email || null,
      fullName: profile.fullName || null,
      interests: profile.interests || [],
      profile,
      username: profile.username || null,
    });
  },

  updateField: (field) => {
    const { profile } = get();
    if (!profile) return;
    const updated = { ...profile, ...field };
    set({
      ...(field.avatar !== undefined && { avatar: field.avatar || null }),
      ...(field.email !== undefined && { email: field.email || null }),
      ...(field.fullName !== undefined && { fullName: field.fullName || null }),
      ...(field.interests !== undefined && { interests: field.interests || [] }),
      ...(field.username !== undefined && { username: field.username || null }),
      profile: updated,
    });
  },
}));
