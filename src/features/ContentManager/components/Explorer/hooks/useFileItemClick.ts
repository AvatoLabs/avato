import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { message } from '@/components/AntdStaticMethods';
import { buildContentFolderPath, buildSourceSetFolderPath } from '@/features/ResourceSpaces';
import { useContentManagerStore } from '@/routes/(main)/content/features/store';
import { documentService } from '@/services/document';

export interface UseFileItemClickOptions {
  fileId?: string | null;
  id: string;
  isFolder: boolean;
  isPage: boolean;
  onOpen?: (id: string) => void;
  preferPageEditor?: boolean;
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
  preferPageEditor,
}: UseFileItemClickOptions) => {
  const { t } = useTranslation('common');
  const { t: tFile } = useTranslation('file');
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
          console.error('[ContentManager] Failed to open markdown file as doc:', error);
          message.error({
            content:
              error instanceof Error
                ? error.message
                : tFile('docEditor.loadError', { defaultValue: 'Failed to load document' }),
            key: messageKey,
          });
          return;
        }
      }

      // Switch to doc mode
      setCurrentViewItemId(targetId);
      setMode('doc');
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
    sourceSetId,
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
