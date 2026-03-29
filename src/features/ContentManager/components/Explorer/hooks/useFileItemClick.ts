import { useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { buildContentFolderPath, buildSourceSetFolderPath } from '@/features/ResourceSpaces';
import { useContentManagerStore } from '@/routes/(main)/content/features/store';
import { documentService } from '@/services/document';

export interface UseFileItemClickOptions {
  fileId?: string | null;
  id: string;
  isFolder: boolean;
  isPage: boolean;
  onOpen?: (id: string) => void;
  slug?: string | null;
  sourceSetId?: string | null;
}

/**
 * Shared hook for handling file item click across different view modes (list/masonry)
 */
export const useFileItemClick = ({
  fileId,
  id,
  slug,
  sourceSetId,
  isFolder,
  isPage,
  onOpen,
}: UseFileItemClickOptions) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [setMode, setCurrentViewItemId, spaceId] = useContentManagerStore((s) => [
    s.setMode,
    s.setCurrentViewItemId,
    s.spaceId,
  ]);

  const handleClick = useCallback(async () => {
    if (isFolder) {
      // Navigate to folder using slug-based routing (Google Drive style)
      const folderSlug = slug || id;

      if (sourceSetId) {
        // Preserve existing query parameters (view and sort preferences)
        const newParams = new URLSearchParams(searchParams);
        // Remove 'file' parameter when navigating to folder
        newParams.delete('file');

        const queryString = newParams.toString();
        const basePath = sourceSetId
          ? buildSourceSetFolderPath(spaceId, sourceSetId, folderSlug)
          : buildContentFolderPath(spaceId, folderSlug);
        navigate(queryString ? `${basePath}?${queryString}` : basePath);
      }
      return;
    }

    let previewTargetId = fileId || id;

    if (!fileId && id.startsWith('docs_')) {
      try {
        const document = await documentService.getDocumentById(id);
        if (document?.sourceType === 'file' && document.fileId) {
          previewTargetId = document.fileId;
        }
      } catch {
        // Fall back to the original id when the derived document lookup fails.
      }
    }

    const isFileBackedEntry = previewTargetId !== id;

    if (isFileBackedEntry) {
      setCurrentViewItemId(previewTargetId);
      setMode('editor');
      setSearchParams(
        (prev) => {
          const newParams = new URLSearchParams(prev);
          newParams.set('file', previewTargetId);
          return newParams;
        },
        { replace: true },
      );
      onOpen?.(previewTargetId);
    } else if (isPage) {
      // Switch to doc mode for existing documents
      setCurrentViewItemId(id);
      setMode('doc');
      // Update URL query parameter for shareable links
      setSearchParams(
        (prev) => {
          const newParams = new URLSearchParams(prev);
          newParams.set('file', id);
          return newParams;
        },
        { replace: true },
      );
    } else {
      // Set mode to editor for regular files
      setCurrentViewItemId(previewTargetId);
      setMode('editor');
      // Update URL query parameter for shareable links
      setSearchParams(
        (prev) => {
          const newParams = new URLSearchParams(prev);
          newParams.set('file', previewTargetId);
          return newParams;
        },
        { replace: true },
      );
      // Call onOpen if provided for backwards compatibility
      onOpen?.(previewTargetId);
    }
  }, [
    fileId,
    id,
    isFolder,
    isPage,
    sourceSetId,
    navigate,
    onOpen,
    searchParams,
    setCurrentViewItemId,
    setMode,
    setSearchParams,
    slug,
    spaceId,
  ]);

  return handleClick;
};
