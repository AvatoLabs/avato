import { isEqual } from 'es-toolkit';
import { useEffect } from 'react';
import { shallow } from 'zustand/shallow';

import { mutate, useClientDataSWR } from '@/libs/swr';
import { contentService } from '@/services/content';
import { type ContentItem, type ContentQueryParams } from '@/types/content';
import { type FileAssetCapabilities } from '@/types/files';

import { useFileStore } from '../../store';

const SWR_KEY_CONTENT_ITEMS = 'SWR_CONTENT_ITEMS';

interface ResourceQueryResponse {
  governanceCapabilities?: FileAssetCapabilities;
  hasMore: boolean;
  items: ContentItem[];
  total?: number;
}

const buildResourceMap = (items: ContentItem[]) => new Map(items.map((item) => [item.id, item]));

const mergeActiveResourceList = (
  incomingItems: ContentItem[],
  existingItems: ContentItem[],
  offset: number,
) => {
  const incomingIds = new Set(incomingItems.map((item) => item.id));
  const optimisticItems = existingItems.filter(
    (item) => item._optimistic && !incomingIds.has(item.id),
  );
  const persistedItems = existingItems.filter((item) => !item._optimistic);
  const preservedTail =
    offset > incomingItems.length
      ? persistedItems.slice(incomingItems.length).filter((item) => !incomingIds.has(item.id))
      : [];

  return {
    items: [...optimisticItems, ...incomingItems, ...preservedTail],
    offset: offset > incomingItems.length ? offset : incomingItems.length,
  };
};

export const isSameResourceQueryParams = (
  left?: ContentQueryParams | null,
  right?: ContentQueryParams | null,
) => isEqual(left ?? null, right ?? null);

const syncResourceStore = (
  params: ContentQueryParams,
  data: ResourceQueryResponse,
  actionName: string,
) => {
  const { governanceCapabilities, hasMore, offset, queryParams, resourceList, resourceMap, total } =
    useFileStore.getState();
  const isActiveQuery = isSameResourceQueryParams(queryParams, params);
  const nextState = isActiveQuery
    ? mergeActiveResourceList(data.items, resourceList, offset)
    : { items: data.items, offset: data.items.length };
  const newResourceMap = buildResourceMap(nextState.items);

  if (
    isActiveQuery &&
    isEqual(nextState.items, resourceList) &&
    isEqual(newResourceMap, resourceMap) &&
    isEqual(governanceCapabilities, data.governanceCapabilities) &&
    hasMore === data.hasMore &&
    offset === nextState.offset &&
    total === data.total
  ) {
    return;
  }

  useFileStore.setState(
    {
      governanceCapabilities: data.governanceCapabilities,
      hasMore: data.hasMore,
      offset: nextState.offset,
      queryParams: params,
      resourceList: nextState.items,
      resourceMap: newResourceMap,
      total: data.total,
    },
    false,
    actionName,
  );
};

/**
 * Revalidate resources with current or specific query params
 * This can be called from outside React components (e.g., store actions)
 */
export const revalidateResources = async (params?: ContentQueryParams) => {
  const queryParams = params || useFileStore.getState().queryParams;
  if (queryParams) {
    await mutate([SWR_KEY_CONTENT_ITEMS, queryParams]);
  }
};

/**
 * Custom SWR hook for fetching resources with caching and revalidation
 */
export const useFetchResources = (params: ContentQueryParams | null, enable: any = true) => {
  return useClientDataSWR(
    enable && params ? [SWR_KEY_CONTENT_ITEMS, params] : null,
    async ([, queryParams]: [string, ContentQueryParams]) => {
      const response = await contentService.queryContentItems({
        ...queryParams,
        limit: queryParams.limit || 50,
        offset: 0,
      });
      return response;
    },
    {
      // SWR configuration for optimal UX
      dedupingInterval: 2000,
      onSuccess: (data: ResourceQueryResponse) => {
        if (!params) return;

        syncResourceStore(params, data, 'useFetchResources/success');
      },
      // Resource lists are large and already explicitly refreshed by scope/category changes.
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    },
  );
};

/**
 * Use query-scoped SWR cache for rendering, but keep the resource store in sync
 * so optimistic actions and pagination can continue to operate on the active query.
 */
export const useVisibleResources = (params: ContentQueryParams | null, enable: any = true) => {
  const swr = useFetchResources(params, enable);
  const { governanceCapabilities, hasMore, queryParams, resourceList, total } = useFileStore(
    (s) => ({
      governanceCapabilities: s.governanceCapabilities,
      hasMore: s.hasMore,
      queryParams: s.queryParams,
      resourceList: s.resourceList,
      total: s.total,
    }),
    shallow,
  );

  const isStoreActive = !!params && isSameResourceQueryParams(queryParams, params);

  useEffect(() => {
    if (!enable || !params || !swr.data || isStoreActive) return;

    syncResourceStore(params, swr.data, 'useVisibleResources/hydrateFromCache');
  }, [enable, isStoreActive, params, swr.data]);

  return {
    ...swr,
    governanceCapabilities: isStoreActive
      ? governanceCapabilities
      : swr.data?.governanceCapabilities,
    hasMore: isStoreActive ? hasMore : (swr.data?.hasMore ?? false),
    hasResolvedData: isStoreActive || swr.data !== undefined,
    isStoreActive,
    items: isStoreActive ? resourceList : (swr.data?.items ?? []),
    total: isStoreActive ? total : swr.data?.total,
  };
};

/**
 * Hook to access resource store state
 */
export const useResourceStore = () => {
  return useFileStore(
    (s) => ({
      governanceCapabilities: s.governanceCapabilities,
      hasMore: s.hasMore,
      queryParams: s.queryParams,
      resourceList: s.resourceList,
      resourceMap: s.resourceMap,
      total: s.total,
    }),
    shallow,
  );
};
