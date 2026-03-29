import { isEqual } from 'es-toolkit';
import { useEffect } from 'react';
import { shallow } from 'zustand/shallow';

import { mutate, useClientDataSWR } from '@/libs/swr';
import { contentService } from '@/services/content';
import { type ContentItem, type ContentQueryParams } from '@/types/content';

import { useFileStore } from '../../store';

const SWR_KEY_CONTENT_ITEMS = 'SWR_CONTENT_ITEMS';

interface ResourceQueryResponse {
  hasMore: boolean;
  items: ContentItem[];
  total?: number;
}

const buildResourceMap = (items: ContentItem[]) => new Map(items.map((item) => [item.id, item]));

export const isSameResourceQueryParams = (
  left?: ContentQueryParams | null,
  right?: ContentQueryParams | null,
) => isEqual(left ?? null, right ?? null);

const syncResourceStore = (
  params: ContentQueryParams,
  data: ResourceQueryResponse,
  actionName: string,
) => {
  const { hasMore, resourceList, resourceMap, total } = useFileStore.getState();
  const newResourceMap = buildResourceMap(data.items);

  if (
    isSameResourceQueryParams(useFileStore.getState().queryParams, params) &&
    isEqual(data.items, resourceList) &&
    isEqual(newResourceMap, resourceMap) &&
    hasMore === data.hasMore &&
    total === data.total
  ) {
    return;
  }

  useFileStore.setState(
    {
      hasMore: data.hasMore,
      offset: data.items.length,
      queryParams: params,
      resourceList: data.items,
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
      revalidateOnFocus: true,
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
  const { hasMore, queryParams, resourceList, total } = useFileStore(
    (s) => ({
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
      hasMore: s.hasMore,
      queryParams: s.queryParams,
      resourceList: s.resourceList,
      resourceMap: s.resourceMap,
      total: s.total,
    }),
    shallow,
  );
};
