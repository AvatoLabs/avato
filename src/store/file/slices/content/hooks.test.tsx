import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useFileStore } from '@/store/file/store';
import { type ContentItem, type ContentQueryParams } from '@/types/content';
import { FilesTabs, SortType } from '@/types/files';

import { useFetchResources } from './hooks';

const swrCalls = vi.hoisted(
  () =>
    [] as Array<{ fetcher: unknown; key: unknown; options: { onSuccess?: (data: any) => void } }>,
);

vi.mock('@/libs/swr', () => ({
  mutate: vi.fn(),
  useClientDataSWR: vi.fn((key, fetcher, options) => {
    swrCalls.push({ fetcher, key, options });
    return {
      data: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    };
  }),
}));

const buildParams = (spaceId: string): ContentQueryParams => ({
  category: FilesTabs.Home,
  limit: 50,
  parentId: null,
  sorter: 'createdAt',
  sortType: SortType.Desc,
  spaceId,
});

const buildItem = (id: string): ContentItem => ({
  createdAt: new Date('2026-04-27T00:00:00.000Z'),
  fileType: 'text/plain',
  id,
  name: id,
  size: 1,
  sourceType: 'file',
  updatedAt: new Date('2026-04-27T00:00:00.000Z'),
});

describe('useFetchResources', () => {
  beforeEach(() => {
    swrCalls.length = 0;
    useFileStore.setState(
      {
        governanceCapabilities: undefined,
        hasMore: false,
        isLoadingMore: false,
        offset: 0,
        queryParams: undefined,
        requestedQueryParams: undefined,
        resourceList: [],
        resourceMap: new Map(),
        total: 0,
      },
      false,
    );
  });

  it('ignores stale resource responses after the active query changes', async () => {
    const paramsA = buildParams('space-a');
    const paramsB = buildParams('space-b');

    const { rerender } = renderHook(({ params }) => useFetchResources(params), {
      initialProps: { params: paramsA },
    });

    await act(async () => {});
    const firstOnSuccess = swrCalls.at(-1)?.options.onSuccess;
    expect(useFileStore.getState().requestedQueryParams).toEqual(paramsA);

    rerender({ params: paramsB });
    await act(async () => {});
    const secondOnSuccess = swrCalls.at(-1)?.options.onSuccess;
    expect(useFileStore.getState().requestedQueryParams).toEqual(paramsB);

    act(() => {
      firstOnSuccess?.({ hasMore: false, items: [buildItem('stale-a')], total: 1 });
    });

    expect(useFileStore.getState().queryParams).toBeUndefined();
    expect(useFileStore.getState().resourceList).toEqual([]);

    act(() => {
      secondOnSuccess?.({ hasMore: false, items: [buildItem('current-b')], total: 1 });
    });

    expect(useFileStore.getState().queryParams).toEqual(paramsB);
    expect(useFileStore.getState().resourceList.map((item) => item.id)).toEqual(['current-b']);
  });
});
