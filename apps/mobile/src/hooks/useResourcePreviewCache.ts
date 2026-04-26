import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ViewToken } from 'react-native';

import {
  clearResourceCacheEntry,
  listResourceCacheEntries,
  type ResourceCacheEntry,
} from '../lib/resourceCache';
import { canWarmPreviewCache, ensurePreviewCacheEntry } from '../lib/resourcePreview';
import type { FileListItem } from '../types';

interface ResourceTreeListRow {
  depth: number;
  item: FileListItem;
}

type ResourceListRow = FileListItem | ResourceTreeListRow;

const isResourceTreeRow = (value: ResourceListRow): value is ResourceTreeListRow =>
  'depth' in value && 'item' in value;

const areStringSetsEqual = (left: Set<string>, right: Set<string>) => {
  if (left === right) return true;
  if (left.size !== right.size) return false;

  for (const value of left) {
    if (!right.has(value)) return false;
  }

  return true;
};

export function useResourcePreviewCache() {
  const [visibleIds, setVisibleIds] = useState<Set<string>>(() => new Set());
  const [cachedResourceIds, setCachedResourceIds] = useState<Set<string>>(() => new Set());
  const [cachedResourceMap, setCachedResourceMap] = useState<Record<string, ResourceCacheEntry>>(
    {},
  );
  const viewabilityConfig = useMemo(
    () => ({ itemVisiblePercentThreshold: 10, minimumViewTime: 100 }),
    [],
  );

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: Array<ViewToken<ResourceListRow>> }) => {
      const nextVisibleIds = new Set<string>();

      for (const token of viewableItems) {
        if (!token.item || isResourceTreeRow(token.item)) continue;
        nextVisibleIds.add(token.item.id);
      }

      setVisibleIds((prev) => (areStringSetsEqual(prev, nextVisibleIds) ? prev : nextVisibleIds));
    },
    [],
  );

  const refreshCachedResources = useCallback(async () => {
    try {
      const entries = await listResourceCacheEntries();
      setCachedResourceIds(new Set(entries.map((entry) => entry.fileId)));
      setCachedResourceMap(Object.fromEntries(entries.map((entry) => [entry.fileId, entry])));
    } catch {
      setCachedResourceIds(new Set());
      setCachedResourceMap({});
    }
  }, []);

  const applyCachedResourceEntry = useCallback((entry: ResourceCacheEntry) => {
    setCachedResourceIds((prev) => {
      if (prev.has(entry.fileId)) return prev;
      const next = new Set(prev);
      next.add(entry.fileId);
      return next;
    });
    setCachedResourceMap((prev) => {
      const current = prev[entry.fileId];
      if (
        current &&
        current.localUri === entry.localUri &&
        current.updatedAt === entry.updatedAt &&
        current.cachedAt === entry.cachedAt
      ) {
        return prev;
      }

      return {
        ...prev,
        [entry.fileId]: entry,
      };
    });
  }, []);

  const invalidateCachedResource = useCallback((fileId: string) => {
    setCachedResourceIds((prev) => {
      if (!prev.has(fileId)) return prev;
      const next = new Set(prev);
      next.delete(fileId);
      return next;
    });
    setCachedResourceMap((prev) => {
      if (!prev[fileId]) return prev;
      const next = { ...prev };
      delete next[fileId];
      return next;
    });
    void clearResourceCacheEntry(fileId);
  }, []);

  const prunePreviewCacheState = useCallback((ids: string[]) => {
    if (ids.length === 0) return;

    setVisibleIds((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
    setCachedResourceIds((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
    setCachedResourceMap((prev) => {
      const next = { ...prev };
      for (const id of ids) delete next[id];
      return next;
    });
  }, []);

  const replaceVisibleResourceId = useCallback((previousId: string, nextId: string) => {
    if (previousId === nextId) return;

    setVisibleIds((prev) => {
      if (!prev.has(previousId)) return prev;
      const next = new Set(prev);
      next.delete(previousId);
      next.add(nextId);
      return next;
    });
  }, []);

  return {
    applyCachedResourceEntry,
    cachedResourceIds,
    cachedResourceMap,
    invalidateCachedResource,
    onViewableItemsChanged,
    prunePreviewCacheState,
    refreshCachedResources,
    replaceVisibleResourceId,
    viewabilityConfig,
    visibleIds,
  };
}

interface UseWarmResourcePreviewCacheProps {
  applyCachedResourceEntry: (entry: ResourceCacheEntry) => void;
  cachedResourceIds: Set<string>;
  filteredItems: FileListItem[];
  treeMode: boolean;
  treeRows: ResourceTreeListRow[];
  visibleIds: Set<string>;
}

export function useWarmResourcePreviewCache({
  applyCachedResourceEntry,
  cachedResourceIds,
  filteredItems,
  treeMode,
  treeRows,
  visibleIds,
}: UseWarmResourcePreviewCacheProps) {
  const previewWarmupIdsRef = useRef<Set<string>>(new Set());

  const warmablePreviewItems = useMemo(() => {
    const sourceItems = treeMode ? treeRows.map((row) => row.item) : filteredItems;
    const scopedItems =
      !treeMode && visibleIds.size > 0
        ? sourceItems.filter((item) => visibleIds.has(item.id))
        : sourceItems;

    return scopedItems
      .filter((item) => canWarmPreviewCache(item) && !cachedResourceIds.has(item.id))
      .slice(0, treeMode ? 4 : 6);
  }, [cachedResourceIds, filteredItems, treeMode, treeRows, visibleIds]);

  useEffect(() => {
    let cancelled = false;

    const pendingItems = warmablePreviewItems.filter(
      (item) => !previewWarmupIdsRef.current.has(item.id),
    );
    if (pendingItems.length === 0) return;

    const runWarmup = async () => {
      await Promise.all(
        pendingItems.slice(0, treeMode ? 2 : 3).map(async (item) => {
          previewWarmupIdsRef.current.add(item.id);

          try {
            const entry = await ensurePreviewCacheEntry(item);
            if (!cancelled && entry) {
              applyCachedResourceEntry(entry);
            }
          } finally {
            previewWarmupIdsRef.current.delete(item.id);
          }
        }),
      );
    };

    void runWarmup();

    return () => {
      cancelled = true;
    };
  }, [applyCachedResourceEntry, treeMode, warmablePreviewItems]);
}
