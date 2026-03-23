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

  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  const config: AgentConfigCacheItem | undefined =
    sessionId !== undefined ? configMap[sessionId] : undefined;

  const refetch = useCallback(async () => {
    if (!sessionId || !enabled) return undefined;
    setLoading(true);
    setError(null);
    try {
      return await fetchConfig(sessionId);
    } catch (error) {
      setError(error);
      return undefined;
    } finally {
      setLoading(false);
    }
  }, [enabled, fetchConfig, sessionId]);

  useEffect(() => {
    if (!sessionId || !enabled) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchConfig(sessionId)
      .catch((error) => {
        if (!cancelled) setError(error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, fetchConfig, sessionId]);

  return {
    config: config === undefined && sessionId && enabled ? undefined : config,
    error,
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

const AGENT_KEY_PREFIX = 'agent:';

/** Load agent config by agent ID (for editing without session). */
export function useAgentConfigByAgentId(agentId: string | undefined, enabled = true) {
  const fetchConfigByAgentId = useAgentConfigStore((s) => s.fetchConfigByAgentId);
  const configMap = useAgentConfigStore((s) => s.configMap);
  const setConfig = useAgentConfigStore((s) => s.setConfig);

  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  const cacheKey = agentId ? `${AGENT_KEY_PREFIX}${agentId}` : undefined;
  const config: AgentConfigCacheItem | undefined =
    cacheKey !== undefined ? configMap[cacheKey] : undefined;

  const refetch = useCallback(async () => {
    if (!agentId || !enabled) return undefined;
    setLoading(true);
    setError(null);
    try {
      return await fetchConfigByAgentId(agentId);
    } catch (err) {
      setError(err);
      return undefined;
    } finally {
      setLoading(false);
    }
  }, [agentId, enabled, fetchConfigByAgentId]);

  useEffect(() => {
    if (!agentId || !enabled) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchConfigByAgentId(agentId)
      .catch((err) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [agentId, enabled, fetchConfigByAgentId]);

  return {
    config: config === undefined && agentId && enabled ? undefined : config,
    error,
    loading,
    refetch,
    setConfig: useCallback(
      (value: AgentConfigCacheItem) => {
        if (cacheKey) setConfig(cacheKey, value);
      },
      [cacheKey, setConfig],
    ),
  };
}
