import { useCallback, useEffect, useRef, useState } from 'react';

import { getApiUrl, resourceApi, type ResourceQueryParams } from '../lib/api';
import { areSameFileItems } from '../lib/resourceList';
import { getResourceListCacheEntry, saveResourceListCacheEntry } from '../lib/resourceListCache';
import type { FileAssetCapabilities, FileListItem } from '../types';

const ROOT_TREE_KEY = '__root__';
const RESOURCE_LIST_PAGE_SIZE = 50;
const RESOURCE_TREE_PAGE_SIZE = 200;

const normalizeCacheParams = (
  params: ResourceQueryParams,
): ResourceQueryParams & { q?: string } => {
  const { q, ...rest } = params;

  if (typeof q === 'string' && q.trim().length > 0) {
    return { ...rest, q };
  }

  return rest;
};

interface UseResourceCollectionDataProps {
  currentFolderId: string | null;
  effectiveSpaceId?: string;
  refreshCachedResources: () => Promise<void>;
  releasedGovernanceFilters: Pick<
    ResourceQueryParams,
    'assetClassification' | 'assetReviewStatus' | 'assetRightsOwner' | 'assetUsagePolicy'
  >;
  resourceListQueryKey: string;
  resourceListQueryParams: ResourceQueryParams;
  scopeMode: 'tree' | 'files';
  setScopeMode: React.Dispatch<React.SetStateAction<'tree' | 'files'>>;
  setTreeChildrenByParent: React.Dispatch<React.SetStateAction<Record<string, FileListItem[]>>>;
  setTreeExpandedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  sorter: 'createdAt' | 'name' | 'size';
  sortOrder: 'asc' | 'desc';
  sourceSetId: string | null;
  spacesResolved: boolean;
  syncVisibleTreeChildren: (parentId: string | null, items: FileListItem[]) => void;
  treeChildrenByParent: Record<string, FileListItem[]>;
}

export function useResourceCollectionData({
  currentFolderId,
  effectiveSpaceId,
  refreshCachedResources,
  releasedGovernanceFilters,
  resourceListQueryKey,
  resourceListQueryParams,
  scopeMode,
  setScopeMode,
  setTreeChildrenByParent,
  setTreeExpandedIds,
  sourceSetId,
  sorter,
  sortOrder,
  spacesResolved,
  syncVisibleTreeChildren,
  treeChildrenByParent,
}: UseResourceCollectionDataProps) {
  const [files, setFiles] = useState<FileListItem[]>([]);
  const [hasResolvedFiles, setHasResolvedFiles] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [apiBase, setApiBase] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [governanceCapabilities, setGovernanceCapabilities] = useState<FileAssetCapabilities>();
  const [treeLoadingIds, setTreeLoadingIds] = useState<Set<string>>(() => new Set());
  const treeChildrenByParentRef = useRef<Record<string, FileListItem[]>>({});
  const nextOffsetRef = useRef(0);
  const loadRequestRef = useRef(0);

  useEffect(() => {
    treeChildrenByParentRef.current = treeChildrenByParent;
  }, [treeChildrenByParent]);

  const resetListOffset = useCallback(() => {
    nextOffsetRef.current = 0;
  }, []);

  const loadFiles = useCallback(
    async (silent = false, append = false) => {
      const ticket = ++loadRequestRef.current;
      const loadOffset = append ? nextOffsetRef.current : 0;
      const cachedEntry = append
        ? null
        : getResourceListCacheEntry(normalizeCacheParams(resourceListQueryParams));
      const hasCachedEntry = Boolean(cachedEntry);

      if (!append) {
        if (cachedEntry) {
          nextOffsetRef.current = cachedEntry.items.length;
          setFiles(cachedEntry.items);
          setHasMore(cachedEntry.hasMore);
          setHasResolvedFiles(true);
          syncVisibleTreeChildren(resourceListQueryParams.parentId ?? null, cachedEntry.items);
        } else if (!silent) {
          nextOffsetRef.current = 0;
          setFiles([]);
          setHasMore(false);
          setHasResolvedFiles(false);
        }
      }

      setLoading(!silent && !append && !hasCachedEntry);
      if (append) setLoadingMore(true);

      try {
        const base = await getApiUrl();
        setApiBase((prev) => (prev === base ? prev : base));
        const result = await resourceApi.getKnowledgeItems({
          ...resourceListQueryParams,
          limit: RESOURCE_LIST_PAGE_SIZE,
          offset: loadOffset,
        });
        if (ticket !== loadRequestRef.current) return;
        const items = result?.items ?? [];
        const nextHasMore = result?.hasMore ?? false;
        setGovernanceCapabilities(result?.governanceCapabilities);
        setHasMore(nextHasMore);
        nextOffsetRef.current = loadOffset + items.length;

        if (append) {
          setFiles((prev) => [...prev, ...items]);
          setHasResolvedFiles(true);
        } else {
          saveResourceListCacheEntry(normalizeCacheParams(resourceListQueryParams), {
            cachedAt: Date.now(),
            hasMore: nextHasMore,
            items,
          });
          setFiles(items);
          setHasResolvedFiles(true);
          syncVisibleTreeChildren(resourceListQueryParams.parentId ?? null, items);
        }
      } catch {
        if (ticket !== loadRequestRef.current) return;
        setGovernanceCapabilities(undefined);
        if (!append && !hasCachedEntry && !silent) {
          nextOffsetRef.current = 0;
          setFiles([]);
          setHasMore(false);
          setHasResolvedFiles(true);
        }
      } finally {
        if (ticket === loadRequestRef.current) {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [resourceListQueryParams, syncVisibleTreeChildren],
  );

  const loadTreeChildren = useCallback(
    async (parentId: string | null, force = false) => {
      if (!sourceSetId) return;

      const treeKey = parentId ?? ROOT_TREE_KEY;
      const cacheParams = {
        ...releasedGovernanceFilters,
        sortType: sortOrder,
        sorter,
        sourceSetId,
        limit: RESOURCE_TREE_PAGE_SIZE,
        parentId,
        ...(effectiveSpaceId ? { spaceId: effectiveSpaceId } : {}),
      } satisfies ResourceQueryParams;

      if (!force) {
        const cachedEntry = getResourceListCacheEntry(normalizeCacheParams(cacheParams));

        if (cachedEntry) {
          setTreeChildrenByParent((prev) => {
            if (areSameFileItems(prev[treeKey], cachedEntry.items)) return prev;

            return {
              ...prev,
              [treeKey]: cachedEntry.items,
            };
          });
        } else if (treeChildrenByParentRef.current[treeKey]) {
          return;
        }
      }

      setTreeLoadingIds((prev) => {
        const next = new Set(prev);
        next.add(treeKey);
        return next;
      });

      try {
        const result = await resourceApi.getKnowledgeItems({
          ...releasedGovernanceFilters,
          sortType: sortOrder,
          sorter,
          sourceSetId,
          limit: RESOURCE_TREE_PAGE_SIZE,
          offset: 0,
          parentId,
          ...(effectiveSpaceId ? { spaceId: effectiveSpaceId } : {}),
        });

        const items = result?.items ?? [];
        saveResourceListCacheEntry(normalizeCacheParams(cacheParams), {
          cachedAt: Date.now(),
          hasMore: result?.hasMore ?? false,
          items,
        });

        setTreeChildrenByParent((prev) => ({
          ...prev,
          [treeKey]: items,
        }));
      } catch {
        setTreeChildrenByParent((prev) => ({
          ...prev,
          [treeKey]: [],
        }));
      } finally {
        setTreeLoadingIds((prev) => {
          const next = new Set(prev);
          next.delete(treeKey);
          return next;
        });
      }
    },
    [
      effectiveSpaceId,
      releasedGovernanceFilters,
      setTreeChildrenByParent,
      sortOrder,
      sorter,
      sourceSetId,
    ],
  );

  const refreshTreeData = useCallback(async () => {
    if (!sourceSetId) {
      setTreeChildrenByParent({});
      setTreeExpandedIds(new Set());
      return;
    }

    await loadTreeChildren(null, true);

    if (currentFolderId) {
      await loadTreeChildren(currentFolderId, true);
    }
  }, [currentFolderId, loadTreeChildren, setTreeChildrenByParent, setTreeExpandedIds, sourceSetId]);

  const refreshResources = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshCachedResources();
      await loadFiles(true);
    } finally {
      setRefreshing(false);
    }
  }, [loadFiles, refreshCachedResources]);

  useEffect(() => {
    if (!spacesResolved) return;
    nextOffsetRef.current = 0;
    void (async () => {
      await refreshCachedResources();
      await loadFiles();
    })();
  }, [loadFiles, refreshCachedResources, resourceListQueryKey, spacesResolved]);

  useEffect(() => {
    if (!sourceSetId) return;
    void loadTreeChildren(null);
  }, [loadTreeChildren, sourceSetId]);

  useEffect(() => {
    if (sourceSetId || scopeMode !== 'tree') return;
    setScopeMode('files');
  }, [scopeMode, setScopeMode, sourceSetId]);

  return {
    apiBase,
    files,
    governanceCapabilities,
    hasMore,
    hasResolvedFiles,
    loadFiles,
    loadTreeChildren,
    loading,
    loadingMore,
    refreshResources,
    refreshTreeData,
    refreshing,
    resetListOffset,
    setFiles,
    treeLoadingIds,
  };
}
