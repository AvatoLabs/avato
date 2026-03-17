/**
 * Hook to load and cache agent config by session ID.
 *
 * Aligns with web: single source of truth for agent config, shared by
 * ChatSettings (summary) and AgentConfig (full editor).
 */
import { useCallback, useEffect, useState } from 'react';

import { type AgentConfigCacheItem, useAgentConfigStore } from '../store/agentConfig';

export function useAgentConfig(sessionId: string | undefined, enabled = true) {
  const fetchConfig = useAgentConfigStore((s) => s.fetchConfig);
  const configMap = useAgentConfigStore((s) => s.configMap);
  const invalidate = useAgentConfigStore((s) => s.invalidate);
  const setConfig = useAgentConfigStore((s) => s.setConfig);

  const [loading, setLoading] = useState(false);

  const config: AgentConfigCacheItem | undefined =
    sessionId !== undefined ? configMap[sessionId] : undefined;

  const refetch = useCallback(async () => {
    if (!sessionId || !enabled) return undefined;
    setLoading(true);
    try {
      return await fetchConfig(sessionId);
    } finally {
      setLoading(false);
    }
  }, [enabled, fetchConfig, sessionId]);

  useEffect(() => {
    if (!sessionId || !enabled) return;
    let cancelled = false;
    setLoading(true);
    fetchConfig(sessionId).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, fetchConfig, sessionId]);

  return {
    config: config === undefined && sessionId && enabled ? undefined : config,
    invalidate: useCallback(() => {
      if (sessionId) invalidate(sessionId);
    }, [invalidate, sessionId]),
    loading,
    refetch,
    setConfig: useCallback(
      (value: AgentConfigCacheItem) => {
        if (sessionId) setConfig(sessionId, value);
      },
      [sessionId, setConfig],
    ),
  };
}
