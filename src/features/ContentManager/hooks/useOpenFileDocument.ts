import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { buildFilesItemPath } from '@/features/ResourceSpaces';
import { useContentManagerStore } from '@/routes/(main)/content/features/store';
import { documentService } from '@/services/document';

interface UseOpenFileDocumentOptions {
  fileId?: string | null;
  id: string;
}

export const useOpenFileDocument = ({ fileId, id }: UseOpenFileDocumentOptions) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [setCurrentViewItemId, setMode] = useContentManagerStore((s) => [
    s.setCurrentViewItemId,
    s.setMode,
  ]);

  return useCallback(async () => {
    const documentId = id.startsWith('docs_')
      ? id
      : (await documentService.ensureFileDocument(fileId || id)).id;

    const nextParams = new URLSearchParams(location.search);
    nextParams.delete('file');
    nextParams.delete('files');

    const nextPath = buildFilesItemPath(location.pathname, documentId);
    const nextSearch = nextParams.toString();
    navigate(nextSearch ? `${nextPath}?${nextSearch}` : nextPath, { replace: true });

    setCurrentViewItemId(documentId);
    setMode('doc');

    return documentId;
  }, [fileId, id, location.pathname, location.search, navigate, setCurrentViewItemId, setMode]);
};
