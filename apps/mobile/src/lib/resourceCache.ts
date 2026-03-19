import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

const RESOURCE_CACHE_STORAGE_KEY = 'resource-preview-cache-v1';

export interface ResourceCacheEntry {
  cachedAt: number;
  fileId: string;
  localUri: string;
  name?: string;
  updatedAt?: string;
}

type ResourceCacheMap = Record<string, ResourceCacheEntry>;

const readCacheMap = async (): Promise<ResourceCacheMap> => {
  try {
    const raw = await AsyncStorage.getItem(RESOURCE_CACHE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ResourceCacheMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const writeCacheMap = async (cache: ResourceCacheMap) => {
  await AsyncStorage.setItem(RESOURCE_CACHE_STORAGE_KEY, JSON.stringify(cache));
};

export const getResourceCacheEntry = async (fileId: string) => {
  const cache = await readCacheMap();
  const entry = cache[fileId];
  if (!entry?.localUri) return null;

  try {
    const info = await FileSystem.getInfoAsync(entry.localUri);
    if (info.exists) return entry;
  } catch {
    /* ignore */
  }

  delete cache[fileId];
  await writeCacheMap(cache);
  return null;
};

export const listResourceCacheEntries = async () => {
  const cache = await readCacheMap();
  const entries = await Promise.all(
    Object.values(cache).map(async (entry) => {
      const resolved = await getResourceCacheEntry(entry.fileId);
      return resolved;
    }),
  );

  return entries.filter((entry): entry is ResourceCacheEntry => Boolean(entry));
};

export const saveResourceCacheEntry = async (entry: ResourceCacheEntry) => {
  const cache = await readCacheMap();
  cache[entry.fileId] = entry;
  await writeCacheMap(cache);
};

export const clearResourceCacheEntry = async (fileId: string) => {
  const cache = await readCacheMap();
  delete cache[fileId];
  await writeCacheMap(cache);
};
