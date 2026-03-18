/**
 * Theme store — light / dark / system + color scheme with persistence.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { ColorSchemeId } from '../theme/palettes';

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
  colorScheme: ColorSchemeId;
  effectiveTheme: EffectiveTheme;
  preference: ThemePreference;
  setColorScheme: (scheme: ColorSchemeId) => void;
  setPreference: (preference: ThemePreference) => void;
  syncWithSystem: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      preference: 'system',
      effectiveTheme: resolveEffectiveTheme('system'),
      colorScheme: 'blue',

      setPreference: (preference: ThemePreference) => {
        const effectiveTheme = resolveEffectiveTheme(preference);
        set({ preference, effectiveTheme });
      },

      setColorScheme: (colorScheme: ColorSchemeId) => {
        set({ colorScheme });
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
      partialize: (s) => ({ preference: s.preference, colorScheme: s.colorScheme }),
      merge: (persisted, current) => {
        const p = persisted as { preference?: ThemePreference; colorScheme?: ColorSchemeId };
        const pref = p?.preference ?? current.preference;
        const scheme = p?.colorScheme ?? current.colorScheme;
        return {
          ...current,
          preference: pref,
          effectiveTheme: resolveEffectiveTheme(pref),
          colorScheme: scheme,
        };
      },
    },
  ),
);

// Listen to system color scheme changes
Appearance.addChangeListener(() => {
  useThemeStore.getState().syncWithSystem();
});
