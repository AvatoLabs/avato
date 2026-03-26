import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { message } from '@/components/AntdStaticMethods';
import { buildResourceFolderPath } from '@/features/ResourceSpaces';
import { useResourceManagerStore } from '@/routes/(main)/resource/features/store';
import { documentService } from '@/services/document';

export interface UseFileItemClickOptions {
  fileId?: string | null;
  id: string;
  isFolder: boolean;
  isPage: boolean;
  libraryId?: string | null;
  onOpen?: (id: string) => void;
  preferPageEditor?: boolean;
  slug?: string | null;
}

/**
 * Shared hook for handling file item click across different view modes (list/masonry)
 */
export const useFileItemClick = ({
  fileId,
  id,
  slug,
  libraryId,
  isFolder,
  isPage,
  onOpen,
  preferPageEditor,
}: UseFileItemClickOptions) => {
  const { t } = useTranslation('common');
  const { t: tFile } = useTranslation('file');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [setMode, setCurrentViewItemId, spaceId] = useResourceManagerStore((s) => [
    s.setMode,
    s.setCurrentViewItemId,
    s.spaceId,
  ]);

  const handleClick = useCallback(async () => {
    if (isFolder) {
      // Navigate to folder using slug-based routing (Google Drive style)
      const folderSlug = slug || id;

      if (libraryId) {
        // Preserve existing query parameters (view and sort preferences)
        const newParams = new URLSearchParams(searchParams);
        // Remove 'file' parameter when navigating to folder
        newParams.delete('file');

        const queryString = newParams.toString();
        const basePath = buildResourceFolderPath(spaceId, libraryId, folderSlug);
        navigate(queryString ? `${basePath}?${queryString}` : basePath);
      }
    } else if (isPage || preferPageEditor) {
      let targetId = id;

      if (preferPageEditor && !id.startsWith('docs_')) {
        const messageKey = `resource-open-page-${fileId || id}`;
        message.loading({ content: t('loading', { ns: 'common' }), duration: 0, key: messageKey });

        try {
          const ensuredDocument = await documentService.ensureFileDocument(fileId || id);
          targetId = ensuredDocument.id;
          message.destroy(messageKey);
        } catch (error) {
          console.error('[ResourceManager] Failed to open markdown file as page:', error);
          message.error({
            content:
              error instanceof Error
                ? error.message
                : tFile('pageEditor.loadError', { defaultValue: 'Failed to load document' }),
            key: messageKey,
          });
          return;
        }
      }

      // Switch to page view mode
      setCurrentViewItemId(targetId);
      setMode('page');
      // Update URL query parameter for shareable links
      setSearchParams(
        (prev) => {
          const newParams = new URLSearchParams(prev);
          newParams.set('file', targetId);
          return newParams;
        },
        { replace: true },
      );
    } else {
      // Set mode to editor for regular files
      setCurrentViewItemId(id);
      setMode('editor');
      // Update URL query parameter for shareable links
      setSearchParams(
        (prev) => {
          const newParams = new URLSearchParams(prev);
          newParams.set('file', id);
          return newParams;
        },
        { replace: true },
      );
      // Call onOpen if provided for backwards compatibility
      onOpen?.(id);
    }
  }, [
    fileId,
    id,
    isFolder,
    isPage,
    libraryId,
    navigate,
    onOpen,
    preferPageEditor,
    searchParams,
    setCurrentViewItemId,
    setMode,
    setSearchParams,
    slug,
    spaceId,
    t,
  ]);

  return handleClick;
};
