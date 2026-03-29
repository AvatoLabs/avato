import { useGlobalStore } from '@/store/global';
import { type LobeDocument } from '@/types/document';
import { DEFAULT_PAGE_KIND, getPageKindFromDocument, type PageKind } from '@/utils/docs';

import { type PageState } from '../../initialState';

/**
 * Check if documents are still loading (undefined means not yet loaded)
 */
const isDocumentsLoading = (s: PageState): boolean => s.documents === undefined;

const filterDocuments = (s: PageState, pageKind: PageKind = DEFAULT_PAGE_KIND): LobeDocument[] => {
  const docs = s.documents ?? [];

  const { searchKeywords, showOnlyPagesWithoutSourceSet } = s;

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
  return [...result].sort((a: LobeDocument, b: LobeDocument) => {
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateB - dateA;
  });
};

const getFilteredDocuments = (s: PageState): LobeDocument[] => {
  return filterDocuments(s);
};

const getFilteredDocumentsByKind =
  (pageKind: PageKind) =>
  (s: PageState): LobeDocument[] => {
    return filterDocuments(s, pageKind);
  };

// Limited filtered documents for sidebar display
const getFilteredDocumentsLimited = (s: PageState): LobeDocument[] => {
  const pageSize = useGlobalStore.getState().status.pagePageSize || 20;
  const allDocs = getFilteredDocuments(s);
  return allDocs.slice(0, pageSize);
};

const getFilteredDocumentsLimitedByKind =
  (pageKind: PageKind) =>
  (s: PageState): LobeDocument[] => {
    const pageSize = useGlobalStore.getState().status.pagePageSize || 20;
    const allDocs = filterDocuments(s, pageKind);
    return allDocs.slice(0, pageSize);
  };

const getDocumentById = (docId: string | undefined) => (s: PageState) => {
  if (!docId) return undefined;

  // Find in documents array
  return s.documents?.find((doc) => doc.id === docId);
};

const hasMoreDocuments = (s: PageState): boolean => s.hasMoreDocuments;

const isLoadingMoreDocuments = (s: PageState): boolean => s.isLoadingMoreDocuments;

const documentsTotal = (s: PageState): number => s.documentsTotal;

// Check if filtered documents have more than displayed
const hasMoreFilteredDocuments = (s: PageState): boolean => {
  const pageSize = useGlobalStore.getState().status.pagePageSize || 20;
  const allDocs = getFilteredDocuments(s);
  return allDocs.length > pageSize;
};

const hasMoreFilteredDocumentsByKind =
  (pageKind: PageKind) =>
  (s: PageState): boolean => {
    const pageSize = useGlobalStore.getState().status.pagePageSize || 20;
    const allDocs = filterDocuments(s, pageKind);
    return allDocs.length > pageSize;
  };

// Get total count of filtered documents
const filteredDocumentsCount = (s: PageState): number => {
  return getFilteredDocuments(s).length;
};

const filteredDocumentsCountByKind =
  (pageKind: PageKind) =>
  (s: PageState): number => {
    return filterDocuments(s, pageKind).length;
  };

export const listSelectors = {
  documentsTotal,
  filteredDocumentsCount,
  filteredDocumentsCountByKind,
  getDocumentById,
  getFilteredDocuments,
  getFilteredDocumentsByKind,
  getFilteredDocumentsLimited,
  getFilteredDocumentsLimitedByKind,
  hasMoreDocuments,
  hasMoreFilteredDocuments,
  hasMoreFilteredDocumentsByKind,
  isDocumentsLoading,
  isLoadingMoreDocuments,
};
