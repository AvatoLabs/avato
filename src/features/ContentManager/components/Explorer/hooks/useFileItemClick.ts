import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { isCanonicalDocumentEntry } from '@/features/ContentManager/utils/isCanonicalDocumentEntry';
import { buildFilesFolderPath, buildFilesItemPath } from '@/features/ResourceSpaces';
import { useContentManagerStore } from '@/routes/(main)/content/features/store';

export interface UseFileItemClickOptions {
  fileId?: string | null;
  id: string;
  isFolder: boolean;
  isPage: boolean;
  onOpen?: (id: string) => void;
  slug?: string | null;
  sourceSetId?: string | null;
  sourceType?: string | null;
}

/**
 * Shared hook for handling file item click across different view modes (list/masonry)
 */
export const useFileItemClick = ({
  fileId,
  id,
  slug,
  isFolder,
  isPage,
  onOpen,
  sourceType,
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

      const queryString = newParams.toString();
      const basePath = buildFilesFolderPath(spaceId, folderSlug);
      navigate(queryString ? `${basePath}?${queryString}` : basePath);
      return;
    }

    const hasCanonicalDocumentIdentity = isCanonicalDocumentEntry({ id, sourceType });

    if (hasCanonicalDocumentIdentity || isPage) {
      // Switch to doc mode for existing documents
      setCurrentViewItemId(id);
      setMode('doc');
      const nextParams = new URLSearchParams(location.search);
      nextParams.delete('file');

      const nextPath = buildFilesItemPath(location.pathname, id);
      const nextSearch = nextParams.toString();
      navigate(nextSearch ? `${nextPath}?${nextSearch}` : nextPath, { replace: true });
    } else {
      // Set mode to editor for regular files
      const previewTargetId = fileId || id;
      setCurrentViewItemId(previewTargetId);
      setMode('editor');
      const nextParams = new URLSearchParams(location.search);
      nextParams.delete('file');

      const nextPath = buildFilesItemPath(location.pathname, previewTargetId);
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
    location.pathname,
    location.search,
    navigate,
    onOpen,
    setCurrentViewItemId,
    setMode,
    slug,
    sourceType,
    spaceId,
  ]);

  return handleClick;
};
