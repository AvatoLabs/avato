import { useParams, useSearchParams } from 'react-router-dom';

import { getFileScope, getSourceSetScopeId } from '@/features/ContentManager/useFileScope';

/**
 * Hook to extract folder slug from URL
 * Supports Google Drive-style slug-based folder navigation
 *
 * Example URLs:
 * - /spaces/spc_123/files?scope=source-set:kb_123 -> { sourceSetId: 'kb_123', currentFolderSlug: null, isInKnowledgeBase: true }
 * - /spaces/spc_123/files/folder-slug-1?scope=source-set:kb_123 -> { sourceSetId: 'kb_123', currentFolderSlug: 'folder-slug-1', isInKnowledgeBase: true }
 * - /spaces/spc_123/files/folder-slug-1 -> { sourceSetId: null, currentFolderSlug: 'folder-slug-1', isInKnowledgeBase: false }
 * - /spaces/spc_123/files -> { sourceSetId: null, currentFolderSlug: null, isInKnowledgeBase: false }
 */
export const useFolderPath = () => {
  const [searchParams] = useSearchParams();
  const params = useParams<{ slug?: string }>();

  // Extract source-set ID from URL query params (single source of truth)
  const sourceSetId = getSourceSetScopeId(getFileScope(searchParams)) || null;

  // Determine if we're in a knowledge base context
  const isInKnowledgeBase = !!sourceSetId;

  // Extract folder slug from params (single slug, not nested paths)
  const currentFolderSlug = params.slug || null;

  return {
    currentFolderSlug,
    isInKnowledgeBase,
    sourceSetId,
  };
};
