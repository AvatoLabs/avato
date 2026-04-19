import { useCallback, useEffect, useMemo, useState } from 'react';

import { getProviderIconUrl } from '../constants/cdn';
import { sessionApi } from '../lib/api';
import { resolveChatDetailComposerConfig } from '../lib/chatDetailComposer';
import { haptics } from '../lib/haptics';
import { getUserMemorySettings } from '../store/user';
import type { MobileMemoryEffort, ProviderWithModels } from '../types';

interface UseChatDetailComposerControlsProps {
  effectiveTheme: 'light' | 'dark';
  isGroupSession: boolean;
  modelProviders: ProviderWithModels[];
  sessionId?: string;
  sessionMemoryEffort?: MobileMemoryEffort | null;
  sessionMemoryEnabled?: boolean | null;
  sessionProvider?: string;
  sessionSearchMode?: string | null;
}

export function useChatDetailComposerControls({
  effectiveTheme,
  isGroupSession,
  modelProviders,
  sessionId,
  sessionMemoryEffort,
  sessionMemoryEnabled,
  sessionProvider,
  sessionSearchMode,
}: UseChatDetailComposerControlsProps) {
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [memoryEffort, setMemoryEffort] = useState<MobileMemoryEffort>('medium');
  const [globalMemoryEnabled, setGlobalMemoryEnabled] = useState(true);
  const [globalMemoryEffort, setGlobalMemoryEffort] = useState<MobileMemoryEffort>('medium');
  const [memorySheetVisible, setMemorySheetVisible] = useState(false);
  const [modelDrawerVisible, setModelDrawerVisible] = useState(false);
  const [providerLogoError, setProviderLogoError] = useState(false);

  useEffect(() => {
    let disposed = false;

    getUserMemorySettings().then((settings) => {
      if (disposed) return;

      setGlobalMemoryEnabled(settings.enabled);
      setGlobalMemoryEffort(settings.effort);
    });

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    const next = resolveChatDetailComposerConfig({
      globalMemoryEffort,
      globalMemoryEnabled,
      sessionMemoryEffort,
      sessionMemoryEnabled,
      sessionSearchMode,
    });

    setSearchEnabled(next.searchEnabled);
    setMemoryEnabled(next.memoryEnabled);
    setMemoryEffort(next.memoryEffort);
  }, [
    globalMemoryEffort,
    globalMemoryEnabled,
    sessionMemoryEffort,
    sessionMemoryEnabled,
    sessionSearchMode,
  ]);

  const selectedProviderLogo = useMemo(
    () => modelProviders.find((provider) => provider.id === sessionProvider)?.logo,
    [modelProviders, sessionProvider],
  );

  const toolbarProviderLogo = useMemo(
    () =>
      selectedProviderLogo ||
      (sessionProvider ? getProviderIconUrl(sessionProvider, effectiveTheme) : undefined),
    [effectiveTheme, selectedProviderLogo, sessionProvider],
  );

  useEffect(() => {
    setProviderLogoError(false);
  }, [sessionProvider, toolbarProviderLogo]);

  const openModelDrawer = useCallback(() => {
    if (isGroupSession) return;
    haptics.light();
    setModelDrawerVisible(true);
  }, [isGroupSession]);

  const closeModelDrawer = useCallback(() => {
    setModelDrawerVisible(false);
  }, []);

  const openMemorySheet = useCallback(() => {
    haptics.light();
    setMemorySheetVisible(true);
  }, []);

  const closeMemorySheet = useCallback(() => {
    setMemorySheetVisible(false);
  }, []);

  const handleToggleSearch = useCallback(async () => {
    if (!sessionId || isGroupSession) return;
    haptics.light();

    const next = !searchEnabled;
    setSearchEnabled(next);

    try {
      await sessionApi.updateChatConfig(sessionId, { searchMode: next ? 'on' : 'off' });
    } catch {
      /* best-effort */
    }
  }, [isGroupSession, searchEnabled, sessionId]);

  const updateMemoryConfig = useCallback(
    async (nextEnabled: boolean, nextEffort: MobileMemoryEffort) => {
      if (!sessionId || isGroupSession) return;

      setMemoryEnabled(nextEnabled);
      setMemoryEffort(nextEffort);

      try {
        await sessionApi.updateChatConfig(sessionId, {
          memory: {
            effort: nextEffort,
            enabled: nextEnabled,
          },
        });
      } catch {
        /* best-effort */
      }
    },
    [isGroupSession, sessionId],
  );

  return {
    clearProviderLogoError: () => setProviderLogoError(false),
    closeMemorySheet,
    closeModelDrawer,
    handleToggleSearch,
    markProviderLogoError: () => setProviderLogoError(true),
    memoryEffort,
    memoryEnabled,
    memorySheetVisible,
    modelDrawerVisible,
    openMemorySheet,
    openModelDrawer,
    providerLogoError,
    searchEnabled,
    toolbarProviderLogo,
    updateMemoryConfig,
  };
}
