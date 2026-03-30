import { type SWRResponse } from 'swr';

import { mutate, useClientDataSWR } from '@/libs/swr';
import { sourceSetService } from '@/services/sourceSet';
import { type SourceSetStore } from '@/store/sourceSet/store';
import { type StoreSetter } from '@/store/types';
import { type CreateSourceSetParams, type SourceSetItem } from '@/types/sourceSet';

const FETCH_SOURCE_SET_LIST_KEY = 'FETCH_SOURCE_SET_LIST';
const FETCH_SOURCE_SET_ITEM_KEY = 'FETCH_SOURCE_SET_ITEM';

type Setter = StoreSetter<SourceSetStore>;
export const createCrudSlice = (set: Setter, get: () => SourceSetStore, _api?: unknown) =>
  new SourceSetCrudActionImpl(set, get, _api);

export class SourceSetCrudActionImpl {
  readonly #get: () => SourceSetStore;
  readonly #set: Setter;

  constructor(set: Setter, get: () => SourceSetStore, _api?: unknown) {
    void _api;
    this.#set = set;
    this.#get = get;
  }

  createSourceSet = async (params: CreateSourceSetParams): Promise<string> => {
    const id = await sourceSetService.createSourceSet(params);

    await this.#get().refreshSourceSetList(params.spaceId);

    return id;
  };

  internal_setSourceSetLoading = (id: string, loading: boolean): void => {
    this.#set(
      (state) => {
        if (loading) return { sourceSetLoadingIds: [...state.sourceSetLoadingIds, id] };

        return { sourceSetLoadingIds: state.sourceSetLoadingIds.filter((itemId) => itemId !== id) };
      },
      false,
      'setSourceSetLoading',
    );
  };

  refreshSourceSetList = async (spaceId?: string): Promise<void> => {
    if (spaceId) {
      await mutate([FETCH_SOURCE_SET_LIST_KEY, spaceId]);
      return;
    }

    await mutate((key) => Array.isArray(key) && key[0] === FETCH_SOURCE_SET_LIST_KEY);
  };

  removeSourceSet = async (id: string): Promise<void> => {
    await sourceSetService.deleteSourceSet(id);
    await this.#get().refreshSourceSetList();
  };

  updateSourceSet = async (id: string, value: CreateSourceSetParams): Promise<void> => {
    this.#get().internal_setSourceSetLoading(id, true);
    await sourceSetService.updateSourceSet(id, value);
    await this.#get().refreshSourceSetList();

    this.#get().internal_setSourceSetLoading(id, false);
  };

  useFetchSourceSetItem = (id: string): SWRResponse<SourceSetItem | undefined> => {
    return useClientDataSWR<SourceSetItem | undefined>(
      [FETCH_SOURCE_SET_ITEM_KEY, id],
      () => sourceSetService.getSourceSetById(id),
      {
        onSuccess: (item) => {
          if (!item) return;

          this.#set({
            activeSourceSetId: id,
            activeSourceSetItems: {
              ...this.#get().activeSourceSetItems,
              [id]: item,
            },
          });
        },
      },
    );
  };

  useFetchSourceSetList = (
    spaceId?: string,
    params: { suspense?: boolean } = {},
  ): SWRResponse<SourceSetItem[]> => {
    return useClientDataSWR<SourceSetItem[]>(
      [FETCH_SOURCE_SET_LIST_KEY, spaceId || 'all'],
      () => sourceSetService.getSourceSets(spaceId),
      {
        fallbackData: [],
        onSuccess: (items) => {
          const sourceSetMap = Object.fromEntries(items.map((item) => [item.id, item]));

          this.#set(
            {
              activeSourceSetItems: {
                ...this.#get().activeSourceSetItems,
                ...sourceSetMap,
              },
              ...(this.#get().initSourceSetList ? {} : { initSourceSetList: true }),
            },
            false,
            'useFetchSourceSetList/onSuccess',
          );
        },
        suspense: params.suspense,
      },
    );
  };
}

export type SourceSetCrudAction = Pick<SourceSetCrudActionImpl, keyof SourceSetCrudActionImpl>;
