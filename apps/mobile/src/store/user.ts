import { create } from 'zustand';

import { userApi } from '../lib/api';
import type { MobileMemoryEffort, MobileUserState, UserProfile } from '../types';

export interface MobileUserMemorySettings {
  effort: MobileMemoryEffort;
  enabled: boolean;
}

export const DEFAULT_USER_MEMORY_SETTINGS: MobileUserMemorySettings = {
  effort: 'medium',
  enabled: true,
};

const normalizeMemoryEffort = (value: unknown): MobileMemoryEffort => {
  if (value === 'low' || value === 'medium' || value === 'high') return value;

  return DEFAULT_USER_MEMORY_SETTINGS.effort;
};

export const normalizeUserMemorySettings = (
  settings?: MobileUserState['settings'],
): MobileUserMemorySettings => ({
  effort: normalizeMemoryEffort(settings?.memory?.effort),
  enabled: settings?.memory?.enabled !== false,
});

let cachedUserMemorySettings: MobileUserMemorySettings | null = null;

export const getUserMemorySettings = async (
  options?: { force?: boolean },
): Promise<MobileUserMemorySettings> => {
  if (!options?.force && cachedUserMemorySettings) return cachedUserMemorySettings;

  try {
    const userState = await userApi.getState();
    cachedUserMemorySettings = normalizeUserMemorySettings(userState?.settings);

    return cachedUserMemorySettings;
  } catch {
    return cachedUserMemorySettings ?? DEFAULT_USER_MEMORY_SETTINGS;
  }
};

export const setCachedUserMemorySettings = (settings: MobileUserMemorySettings) => {
  cachedUserMemorySettings = settings;
};

type FetchUserOptions = {
  throwOnError?: boolean;
};

type MobileUserProfile = UserProfile & Pick<MobileUserState, 'userId'>;

const normalizeUserProfile = (profile?: MobileUserProfile | null): UserProfile | null => {
  if (!profile) return null;

  return {
    avatar: typeof profile.avatar === 'string' ? profile.avatar : undefined,
    bio: profile.bio,
    email: profile.email,
    fullName: profile.fullName,
    id: profile.id || profile.userId || 'me',
    interests: profile.interests || [],
    username: profile.username,
  };
};

interface UserState {
  avatar: string | null;
  clearProfile: () => void;
  email: string | null;
  fetchUser: (options?: FetchUserOptions) => Promise<UserProfile | null>;
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

  fetchUser: async (options) => {
    try {
      const user = normalizeUserProfile((await userApi.getUser()) as MobileUserProfile | null);

      if (!user) {
        set({ isLoaded: true, profile: null });
        return null;
      }

      const avatarStr = typeof user.avatar === 'string' ? user.avatar : null;
      set({
        avatar: avatarStr,
        email: user.email || null,
        fullName: user.fullName || null,
        interests: user.interests || [],
        isLoaded: true,
        profile: user,
        username: user.username || null,
      });

      return user;
    } catch (error) {
      set({ isLoaded: true });
      if (options?.throwOnError) throw error;
      return null;
    }
  },

  setProfile: (profile) => {
    const avatarStr = typeof profile.avatar === 'string' ? profile.avatar : null;
    set({
      avatar: avatarStr,
      email: profile.email || null,
      fullName: profile.fullName || null,
      interests: profile.interests || [],
      isLoaded: true,
      profile,
      username: profile.username || null,
    });
  },

  updateField: (field) => {
    const { profile } = get();
    if (!profile) return;
    const updated = { ...profile, ...field };
    set({
      ...(field.avatar !== undefined && {
      avatar: typeof field.avatar === 'string' ? field.avatar : null,
    }),
      ...(field.email !== undefined && { email: field.email || null }),
      ...(field.fullName !== undefined && { fullName: field.fullName || null }),
      ...(field.interests !== undefined && { interests: field.interests || [] }),
      ...(field.username !== undefined && { username: field.username || null }),
      profile: updated,
    });
  },
}));
