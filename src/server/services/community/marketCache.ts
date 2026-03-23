import { createHash } from 'node:crypto';

import { getRedisConfig } from '@/envs/redis';
import { initializeRedis, isRedisEnabled, type RedisClient } from '@/libs/redis';

const COMMUNITY_CACHE_TTL_SECONDS = 60 * 60 * 6;
const COMMUNITY_STALE_TTL_SECONDS = 60 * 60 * 24 * 7;
const COMMUNITY_CACHE_PREFIX = 'community-market-cache';
const MEMORY_CACHE_MAX_SIZE = 500;

interface CacheEnvelope<T> {
  data: T;
  fetchedAt: string;
}

interface MemoryEntry {
  expiresAt: number;
  value: string;
}

const memoryCache = new Map<string, MemoryEntry>();

const evictOldestIfNeeded = () => {
  while (memoryCache.size > MEMORY_CACHE_MAX_SIZE) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey === undefined) break;
    memoryCache.delete(oldestKey);
  }
};

const getCacheKey = (scope: string, params?: unknown) => {
  const normalizedParams = params
    ? JSON.stringify(
        Object.fromEntries(
          Object.entries(params as Record<string, unknown>)
            .filter(([, value]) => value !== undefined && value !== null && value !== '')
            .sort(([left], [right]) => left.localeCompare(right)),
        ),
      )
    : '';

  const digest = createHash('sha1').update(`${scope}:${normalizedParams}`).digest('hex');

  return `${COMMUNITY_CACHE_PREFIX}:${scope}:${digest}`;
};

const getMemoryCache = <T>(key: string): CacheEnvelope<T> | null => {
  const entry = memoryCache.get(key);
  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    memoryCache.delete(key);
    return null;
  }

  try {
    const parsed = JSON.parse(entry.value) as CacheEnvelope<T>;
    memoryCache.delete(key);
    memoryCache.set(key, entry);
    return parsed;
  } catch {
    memoryCache.delete(key);
    return null;
  }
};

const setMemoryCache = <T>(key: string, value: CacheEnvelope<T>) => {
  memoryCache.set(key, {
    expiresAt: Date.now() + COMMUNITY_STALE_TTL_SECONDS * 1000,
    value: JSON.stringify(value),
  });
  evictOldestIfNeeded();
};

const getRedis = async (): Promise<RedisClient | null> => {
  const config = getRedisConfig();
  if (!isRedisEnabled(config)) return null;

  return initializeRedis(config);
};

class CommunityMarketCacheService {
  private inflight = new Map<string, Promise<unknown>>();

  private async readCache<T>(key: string): Promise<CacheEnvelope<T> | null> {
    const memoryValue = getMemoryCache<T>(key);
    if (memoryValue) return memoryValue;

    try {
      const redis = await getRedis();
      if (!redis) return null;

      const raw = await redis.get(key);
      if (!raw) return null;

      const parsed = JSON.parse(raw) as CacheEnvelope<T>;
      setMemoryCache(key, parsed);

      return parsed;
    } catch {
      return null;
    }
  }

  private async writeCache<T>(key: string, value: CacheEnvelope<T>) {
    setMemoryCache(key, value);

    try {
      const redis = await getRedis();
      if (!redis) return;

      await redis.set(key, JSON.stringify(value), { ex: COMMUNITY_STALE_TTL_SECONDS });
    } catch {
      // Ignore cache persistence failures and keep serving fresh in-memory data.
    }
  }

  private async fetchAndCache<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const existing = this.inflight.get(key) as Promise<T> | undefined;
    if (existing) return existing;

    const next = (async () => {
      const data = await fetcher();
      await this.writeCache(key, {
        data,
        fetchedAt: new Date().toISOString(),
      });

      return data;
    })().finally(() => {
      this.inflight.delete(key);
    });

    this.inflight.set(key, next);

    return next;
  }

  async getCached<T>(
    scope: string,
    params: Record<string, unknown> | undefined,
    fetcher: () => Promise<T>,
  ) {
    const key = getCacheKey(scope, params);
    const cached = await this.readCache<T>(key);

    if (cached) {
      const age = Date.now() - new Date(cached.fetchedAt).getTime();
      if (age < COMMUNITY_CACHE_TTL_SECONDS * 1000) {
        return cached.data;
      }
    }

    try {
      return await this.fetchAndCache(key, fetcher);
    } catch (error) {
      if (cached) return cached.data;
      throw error;
    }
  }
}

export const communityMarketCacheService = new CommunityMarketCacheService();
