import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import {
  buildContentFolderPath,
  buildContentItemPath,
  buildSourceSetFolderPath,
} from '@/features/ResourceSpaces';
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
  const location = useLocation();
  const navigate = useNavigate();
  const [setMode, setCurrentViewItemId, spaceId] = useContentManagerStore((s) => [
    s.setMode,
    s.setCurrentViewItemId,
    s.spaceId,
  ]);

  const handleClick = useCallback(async () => {
    if (isFolder) {
      // Navigate to folder using slug-based routing (Google Drive style)
      const folderSlug = slug || id;

      // Preserve existing query parameters (view and sort preferences)
      const newParams = new URLSearchParams(location.search);
      newParams.delete('file');
      newParams.delete('files');

      const queryString = newParams.toString();
      const isSourceSetRoute = location.pathname.includes('/source-sets/');
      const basePath =
        isSourceSetRoute && sourceSetId
          ? buildSourceSetFolderPath(spaceId, sourceSetId, folderSlug)
          : buildContentFolderPath(spaceId, folderSlug);
      navigate(queryString ? `${basePath}?${queryString}` : basePath);
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
      const nextParams = new URLSearchParams(location.search);
      nextParams.delete('file');
      nextParams.delete('files');

      const nextPath = buildContentItemPath(location.pathname, previewTargetId);
      const nextSearch = nextParams.toString();
      navigate(nextSearch ? `${nextPath}?${nextSearch}` : nextPath, { replace: true });
      onOpen?.(previewTargetId);
    } else if (isPage) {
      // Switch to doc mode for existing documents
      setCurrentViewItemId(id);
      setMode('doc');
      const nextParams = new URLSearchParams(location.search);
      nextParams.delete('file');
      nextParams.delete('files');

      const nextPath = buildContentItemPath(location.pathname, id);
      const nextSearch = nextParams.toString();
      navigate(nextSearch ? `${nextPath}?${nextSearch}` : nextPath, { replace: true });
    } else {
      // Set mode to editor for regular files
      setCurrentViewItemId(previewTargetId);
      setMode('editor');
      const nextParams = new URLSearchParams(location.search);
      nextParams.delete('file');
      nextParams.delete('files');

      const nextPath = buildContentItemPath(location.pathname, previewTargetId);
      const nextSearch = nextParams.toString();
      navigate(nextSearch ? `${nextPath}?${nextSearch}` : nextPath, { replace: true });
      // Call onOpen if provided for backwards compatibility
      onOpen?.(previewTargetId);
    }
  }, [
    fileId,
    id,
    isFolder,
    isPage,
    sourceSetId,
    location.pathname,
    location.search,
    navigate,
    onOpen,
    setCurrentViewItemId,
    setMode,
    slug,
    spaceId,
  ]);

  return handleClick;
};
