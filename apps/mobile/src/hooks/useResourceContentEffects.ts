import type { RefObject } from 'react';
import { useEffect } from 'react';
import type { TextInput } from 'react-native';

interface ResourceContentNavigationListener {
  addListener: (event: 'blur' | 'focus', listener: () => void) => () => void;
}

interface UseResourceContentEffectsProps {
  activeSpaceId: string | null;
  clearOrigins: () => void;
  loadSourceSets: () => Promise<void>;
  navigation: ResourceContentNavigationListener;
  refreshCachedResources: () => Promise<void>;
  refreshCurrentSpaceMemorySummary: () => Promise<void>;
  searchInputRef: RefObject<TextInput | null>;
  searchVisible: boolean;
  spacesResolved: boolean;
  triggerConnectionCheck: () => void;
}

export function useResourceContentEffects({
  activeSpaceId,
  clearOrigins,
  loadSourceSets,
  navigation,
  refreshCachedResources,
  refreshCurrentSpaceMemorySummary,
  searchInputRef,
  searchVisible,
  spacesResolved,
  triggerConnectionCheck,
}: UseResourceContentEffectsProps) {
  useEffect(() => {
    if (!searchVisible) return;
    const timer = setTimeout(() => searchInputRef.current?.focus(), 120);
    return () => clearTimeout(timer);
  }, [searchInputRef, searchVisible]);

  useEffect(
    () =>
      navigation.addListener('blur', () => {
        clearOrigins();
      }),
    [clearOrigins, navigation],
  );

  useEffect(() => {
    triggerConnectionCheck();
  }, [triggerConnectionCheck]);

  useEffect(() => {
    if (!spacesResolved) return;
    void loadSourceSets();
  }, [loadSourceSets, spacesResolved]);

  useEffect(() => {
    if (!spacesResolved) return;
    void refreshCachedResources();
  }, [activeSpaceId, refreshCachedResources, spacesResolved]);

  useEffect(
    () =>
      navigation.addListener('focus', () => {
        void refreshCurrentSpaceMemorySummary();
      }),
    [navigation, refreshCurrentSpaceMemorySummary],
  );
}
