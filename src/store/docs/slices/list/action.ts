import { type SWRResponse } from 'swr';

import { getActiveWorkspaceSpaceId } from '@/helpers/activeWorkspaceSpace';
import { mutate } from '@/libs/swr';
import { useClientDataSWRWithSync } from '@/libs/swr/useClientDataSWRWithSync';
import { documentService } from '@/services/document';
import { type StoreSetter } from '@/store/types';
import { type LobeDocument } from '@/types/document';
import { isPageEntryFileType, PAGE_ENTRY_FILE_TYPES } from '@/utils/docsDocument';
import { setNamespace } from '@/utils/storeDebug';

import { type PageQueryFilter } from '../../initialState';
import { type PageStore } from '../../store';

const n = setNamespace('page/list');
export const PAGE_DOCUMENTS_SWR_KEY = 'pageDocuments';

const ALLOWED_PAGE_SOURCE_TYPES = new Set(['editor', 'file', 'api']);
const ALLOWED_PAGE_FILE_TYPES = PAGE_ENTRY_FILE_TYPES;

/**
 * Check if a page should be displayed in the page list
 */
const isAllowedPage = (page: { fileType: string; sourceType: string }) => {
  return ALLOWED_PAGE_SOURCE_TYPES.has(page.sourceType) && isPageEntryFileType(page.fileType);
};

interface PageDocumentQueryResult {
  documents: LobeDocument[];
  total: number;
}

const WORKSPACE_PAGE_FETCH_LIMIT = 9999;

const buildPageQueryFilter = (spaceId?: string): PageQueryFilter => {
  const activeSpaceId = spaceId ?? getActiveWorkspaceSpaceId();

  return {
    fileTypes: Array.from(ALLOWED_PAGE_FILE_TYPES),
    ...(activeSpaceId ? { spaceId: activeSpaceId } : {}),
    sourceTypes: Array.from(ALLOWED_PAGE_SOURCE_TYPES),
  };
};

const getPageDocumentsSwrKey = (spaceId?: string) => [PAGE_DOCUMENTS_SWR_KEY, spaceId ?? 'all'];

export const removePageDocumentsFromCache = async (ids: string[]) => {
  if (ids.length === 0) return;

  const idsSet = new Set(ids);

  await mutate(
    (key) => Array.isArray(key) && key[0] === PAGE_DOCUMENTS_SWR_KEY,
    async (currentData: PageDocumentQueryResult | undefined) => {
      if (!currentData) return currentData;

      const documents = currentData.documents.filter((document) => !idsSet.has(document.id));
      const removedCount = currentData.documents.length - documents.length;

      return {
        documents,
        total: Math.max(0, currentData.total - removedCount),
      };
    },
    {
      revalidate: true,
    },
  );
};

export const revalidatePageDocuments = async () => {
  await mutate((key) => Array.isArray(key) && key[0] === PAGE_DOCUMENTS_SWR_KEY);
};

type Setter = StoreSetter<PageStore>;
export const createListSlice = (set: Setter, get: () => PageStore, _api?: unknown) =>
  new ListActionImpl(set, get, _api);

export class ListActionImpl {
  readonly #get: () => PageStore;
  readonly #set: Setter;

  constructor(set: Setter, get: () => PageStore, _api?: unknown) {
    void _api;
    this.#set = set;
    this.#get = get;
  }

  fetchDocuments = async (spaceId?: string): Promise<void> => {
    try {
      const queryFilters = buildPageQueryFilter(spaceId);

      const result = await documentService.queryDocuments({
        current: 0,
        pageSize: WORKSPACE_PAGE_FETCH_LIMIT,
        ...queryFilters,
      });

      const documents = result.items.filter(isAllowedPage).map((doc) => ({
        ...doc,
        filename: doc.filename ?? doc.title ?? 'Untitled',
      })) as LobeDocument[];

      const hasMore = result.total > documents.length;

      // Use internal dispatch to set documents
      this.#get().internal_dispatchDocuments({ documents, type: 'setDocuments' });

      this.#set(
        {
          currentPage: 0,
          documentsTotal: result.total,
          hasMoreDocuments: hasMore,
          queryFilter: queryFilters,
        },
        false,
        n('fetchDocuments/success'),
      );
    } catch (error) {
      console.error('Failed to fetch documents:', error);
      throw error;
    }
  };

  loadMoreDocuments = async (): Promise<void> => {
    const { currentPage, isLoadingMoreDocuments, hasMoreDocuments, queryFilter, documents } =
      this.#get();

    if (isLoadingMoreDocuments || !hasMoreDocuments || !documents) return;

    const nextPage = currentPage + 1;

    this.#set({ isLoadingMoreDocuments: true }, false, n('loadMoreDocuments/start'));

    try {
      const pageSize = WORKSPACE_PAGE_FETCH_LIMIT;
      const queryParams = queryFilter
        ? { current: nextPage, pageSize, ...queryFilter }
        : { current: nextPage, pageSize };

      const result = await documentService.queryDocuments(queryParams);

      const newDocuments = result.items.filter(isAllowedPage).map((doc) => ({
        ...doc,
        filename: doc.filename ?? doc.title ?? 'Untitled',
      })) as LobeDocument[];

      const hasMore = result.items.length >= pageSize;

      // Use internal dispatch to append documents
      this.#get().internal_dispatchDocuments({ documents: newDocuments, type: 'appendDocuments' });

      this.#set(
        {
          currentPage: nextPage,
          documentsTotal: result.total,
          hasMoreDocuments: hasMore,
          isLoadingMoreDocuments: false,
        },
        false,
        n('loadMoreDocuments/success'),
      );
    } catch (error) {
      console.error('Failed to load more documents:', error);
      this.#set({ isLoadingMoreDocuments: false }, false, n('loadMoreDocuments/error'));
    }
  };

  refreshDocuments = async (): Promise<void> => {
    await this.#get().fetchDocuments(this.#get().queryFilter?.spaceId);
  };

  setSearchKeywords = (keywords: string): void => {
    this.#set({ searchKeywords: keywords }, false, n('setSearchKeywords'));
  };

  setShowOnlyPagesWithoutSourceSet = (show: boolean): void => {
    this.#set(
      { showOnlyPagesWithoutSourceSet: show },
      false,
      n('setShowOnlyPagesWithoutSourceSet'),
    );
  };

  setCurrentSourceSetScopeId = (sourceSetId: string | null): void => {
    this.#set({ currentSourceSetScopeId: sourceSetId }, false, n('setCurrentSourceSetScopeId'));
  };

  useFetchDocuments = (spaceId?: string): SWRResponse<PageDocumentQueryResult> => {
    const activeSpaceId = spaceId ?? getActiveWorkspaceSpaceId();

    return useClientDataSWRWithSync<PageDocumentQueryResult>(
      getPageDocumentsSwrKey(activeSpaceId),
      async () => {
        const queryFilters = buildPageQueryFilter(activeSpaceId);

        const result = await documentService.queryDocuments({
          current: 0,
          pageSize: WORKSPACE_PAGE_FETCH_LIMIT,
          ...queryFilters,
        });

        const documents = result.items.filter(isAllowedPage).map((doc) => ({
          ...doc,
          filename: doc.filename ?? doc.title ?? 'Untitled',
        })) as LobeDocument[];

        return { documents, total: result.total };
      },
      {
        onData: (data) => {
          if (!data) return;

          const hasMore = data.total > data.documents.length;

          // Use internal dispatch to set documents
          this.#get().internal_dispatchDocuments({
            documents: data.documents,
            type: 'setDocuments',
          });

          this.#set(
            {
              currentPage: 0,
              documentsTotal: data.total,
              hasMoreDocuments: hasMore,
              queryFilter: buildPageQueryFilter(activeSpaceId),
            },
            false,
            n('useFetchDocuments/onData'),
          );
        },
        revalidateOnFocus: true,
      },
    );
  };
}

export type ListAction = Pick<ListActionImpl, keyof ListActionImpl>;
