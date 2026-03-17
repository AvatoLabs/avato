/**
 * Theme store — light / dark / system with persistence.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemePreference = 'light' | 'dark' | 'system';

export type EffectiveTheme = 'light' | 'dark';

const STORAGE_KEY = 'avato_theme_preference';

function resolveEffectiveTheme(preference: ThemePreference): EffectiveTheme {
  if (preference === 'system') {
    const system = Appearance.getColorScheme();
    return system === 'dark' ? 'dark' : 'light';
  }
  return preference;
}

interface ThemeState {
  effectiveTheme: EffectiveTheme;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  syncWithSystem: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      preference: 'system',
      effectiveTheme: resolveEffectiveTheme('system'),

      setPreference: (preference: ThemePreference) => {
        const effectiveTheme = resolveEffectiveTheme(preference);
        set({ preference, effectiveTheme });
      },

      syncWithSystem: () => {
        const { preference } = get();
        if (preference === 'system') {
          const effectiveTheme = resolveEffectiveTheme('system');
          set({ effectiveTheme });
        }
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ preference: s.preference }),
      merge: (persisted, current) => {
        const pref =
          (persisted as { preference?: ThemePreference })?.preference ?? current.preference;
        return {
          ...current,
          preference: pref,
          effectiveTheme: resolveEffectiveTheme(pref),
        };
      },
    },
  ),
);

// Listen to system color scheme changes
Appearance.addChangeListener(() => {
  useThemeStore.getState().syncWithSystem();
});
