import { useParams } from 'react-router-dom';

/**
 * Hook to extract folder slug from URL
 * Supports Google Drive-style slug-based folder navigation
 *
 * Example URLs:
 * - /content/source-sets/kb_123 -> { sourceSetId: 'kb_123', currentFolderSlug: null, isInKnowledgeBase: true }
 * - /content/source-sets/kb_123/folder-slug-1 -> { sourceSetId: 'kb_123', currentFolderSlug: 'folder-slug-1', isInKnowledgeBase: true }
 * - /content/spaces/spc_123/folder-slug-1 -> { sourceSetId: null, currentFolderSlug: 'folder-slug-1', isInKnowledgeBase: false }
 * - /content -> { sourceSetId: null, currentFolderSlug: null, isInKnowledgeBase: false }
 */
export const useFolderPath = () => {
  const params = useParams<{ id?: string; slug?: string }>();

  // Extract knowledge base ID from params
  const sourceSetId = params.id || null;

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
