import { useGlobalStore } from '@/store/global';
import { type LobeDocument } from '@/types/document';
import { DEFAULT_PAGE_KIND, getPageKindFromDocument, type PageKind } from '@/utils/docs';

import { type PageState } from '../../initialState';

interface FilteredDocumentsSnapshot {
  count: number;
  displayed: LobeDocument[];
  hasMore: boolean;
  items: LobeDocument[];
}

/**
 * Check if documents are still loading (undefined means not yet loaded)
 */
const isDocumentsLoading = (s: PageState): boolean => s.documents === undefined;

const EMPTY_DOCUMENTS: LobeDocument[] = [];
const filteredDocumentsCache = new WeakMap<LobeDocument[], Map<string, LobeDocument[]>>();
const filteredDocumentsSnapshotCache = new WeakMap<
  LobeDocument[],
  Map<number, FilteredDocumentsSnapshot>
>();

const getFilteredDocumentsCacheKey = (
  pageKind: PageKind,
  searchKeywords: string,
  showOnlyPagesWithoutSourceSet: boolean,
) => `${pageKind}|${showOnlyPagesWithoutSourceSet ? 1 : 0}|${searchKeywords.trim().toLowerCase()}`;

const filterDocuments = (s: PageState, pageKind: PageKind = DEFAULT_PAGE_KIND): LobeDocument[] => {
  const docs = s.documents ?? EMPTY_DOCUMENTS;

  const { searchKeywords, showOnlyPagesWithoutSourceSet } = s;
  const cacheKey = getFilteredDocumentsCacheKey(
    pageKind,
    searchKeywords,
    showOnlyPagesWithoutSourceSet,
  );
  const cache = filteredDocumentsCache.get(docs);
  const cachedResult = cache?.get(cacheKey);

  if (cachedResult) return cachedResult;

  let result = docs;

  // Filter by page kind
  result = result.filter((doc: LobeDocument) => getPageKindFromDocument(doc) === pageKind);

  // Filter by source-set membership
  if (showOnlyPagesWithoutSourceSet) {
    result = result.filter((doc: LobeDocument) => {
      return !doc.sourceSetId;
    });
  }

  // Filter by search keywords
  if (searchKeywords.trim()) {
    const lowerKeywords = searchKeywords.toLowerCase();
    result = result.filter((doc: LobeDocument) => {
      const content = doc.content?.toLowerCase() || '';
      const title = doc.title?.toLowerCase() || '';
      return content.includes(lowerKeywords) || title.includes(lowerKeywords);
    });
  }

  // Sort by creation date (newest first)
  const sortedDocuments = [...result].sort((a: LobeDocument, b: LobeDocument) => {
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateB - dateA;
  });

  if (cache) {
    cache.set(cacheKey, sortedDocuments);
  } else {
    filteredDocumentsCache.set(docs, new Map([[cacheKey, sortedDocuments]]));
  }

  return sortedDocuments;
};

const getFilteredDocumentsSnapshot = (
  items: LobeDocument[],
  pageSize: number,
): FilteredDocumentsSnapshot => {
  const cache = filteredDocumentsSnapshotCache.get(items);
  const cachedResult = cache?.get(pageSize);

  if (cachedResult) return cachedResult;

  const snapshot = {
    count: items.length,
    displayed: items.slice(0, pageSize),
    hasMore: items.length > pageSize,
    items,
  };

  if (cache) {
    cache.set(pageSize, snapshot);
  } else {
    filteredDocumentsSnapshotCache.set(items, new Map([[pageSize, snapshot]]));
  }

  return snapshot;
};

const getFilteredDocumentsSnapshotByKind =
  (pageKind: PageKind) =>
  (s: PageState): FilteredDocumentsSnapshot => {
    const pageSize = useGlobalStore.getState().status.pagePageSize || 20;
    const items = filterDocuments(s, pageKind);

    return getFilteredDocumentsSnapshot(items, pageSize);
  };

const getDocumentById = (docId: string | undefined) => (s: PageState) => {
  if (!docId) return undefined;

  // Find in documents array
  return s.documents?.find((doc) => doc.id === docId);
};

const hasMoreDocuments = (s: PageState): boolean => s.hasMoreDocuments;

const isLoadingMoreDocuments = (s: PageState): boolean => s.isLoadingMoreDocuments;

const documentsTotal = (s: PageState): number => s.documentsTotal;

export const listSelectors = {
  documentsTotal,
  getDocumentById,
  getFilteredDocumentsSnapshotByKind,
  hasMoreDocuments,
  isDocumentsLoading,
  isLoadingMoreDocuments,
};
