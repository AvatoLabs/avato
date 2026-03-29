import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useContentManagerStore } from '@/routes/(main)/content/features/store';
import { documentService } from '@/services/document';

interface UseOpenFileDocumentOptions {
  fileId?: string | null;
  id: string;
}

export const useOpenFileDocument = ({ fileId, id }: UseOpenFileDocumentOptions) => {
  const [, setSearchParams] = useSearchParams();
  const [setCurrentViewItemId, setMode] = useContentManagerStore((s) => [
    s.setCurrentViewItemId,
    s.setMode,
  ]);

  return useCallback(async () => {
    const documentId = id.startsWith('docs_')
      ? id
      : (await documentService.ensureFileDocument(fileId || id)).id;

    setSearchParams(
      (prev) => {
        const newParams = new URLSearchParams(prev);
        newParams.set('file', documentId);
        return newParams;
      },
      { replace: true },
    );

    setCurrentViewItemId(documentId);
    setMode('doc');

    return documentId;
  }, [fileId, id, setCurrentViewItemId, setMode, setSearchParams]);
};
