import type { FileListItem } from '../types';

const RESOURCE_LIST_CACHE_MAX_ENTRIES = 80;

interface NormalizedResourceListCacheParams {
  limit: number | null;
  parentId: string | null;
  q: string | null;
  sourceSetId: string | null;
  spaceId: string | null;
}

export interface ResourceListCacheParams {
  limit?: number;
  parentId?: string | null;
  q?: string;
  sourceSetId?: string | null;
  spaceId?: string | null;
}

export interface ResourceListCacheEntry {
  cachedAt: number;
  hasMore: boolean;
  items: FileListItem[];
  params: NormalizedResourceListCacheParams;
}

const resourceListCache = new Map<string, ResourceListCacheEntry>();

const normalizeNullableString = (value?: string | null) => {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeLimit = (value?: number) => {
  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) return null;

  return value;
};

const normalizeResourceListCacheParams = (
  params: ResourceListCacheParams,
): NormalizedResourceListCacheParams => ({
  sourceSetId: normalizeNullableString(params.sourceSetId),
  limit: normalizeLimit(params.limit),
  parentId: normalizeNullableString(params.parentId),
  q: normalizeNullableString(params.q),
  spaceId: normalizeNullableString(params.spaceId),
});

export const buildResourceListCacheKey = (params: ResourceListCacheParams) =>
  JSON.stringify(normalizeResourceListCacheParams(params));

export const getResourceListCacheEntry = (params: ResourceListCacheParams) =>
  resourceListCache.get(buildResourceListCacheKey(params)) ?? null;

export const saveResourceListCacheEntry = (
  params: ResourceListCacheParams,
  value: Pick<ResourceListCacheEntry, 'cachedAt' | 'hasMore' | 'items'>,
) => {
  const normalizedParams = normalizeResourceListCacheParams(params);
  const key = JSON.stringify(normalizedParams);

  resourceListCache.delete(key);
  resourceListCache.set(key, {
    ...value,
    params: normalizedParams,
  });

  while (resourceListCache.size > RESOURCE_LIST_CACHE_MAX_ENTRIES) {
    const oldestKey = resourceListCache.keys().next().value;
    if (!oldestKey) break;
    resourceListCache.delete(oldestKey);
  }
};

export const clearResourceListCache = () => {
  resourceListCache.clear();
};
