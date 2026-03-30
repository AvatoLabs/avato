'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

import { documentSelectors, useFileStore } from '@/store/file';

import { useContentManagerStore } from '../store';

/**
 * Used for initial loading only, handle URL like:
 *
 * /content?file=xxxxxx
 */
export const useInitFileCheck = () => {
  const [searchParams] = useSearchParams();
  const [setMode, setCurrentViewItemId] = useContentManagerStore((s) => [
    s.setMode,
    s.setCurrentViewItemId,
  ]);

  const fileId = searchParams.get('file');

  const useFetchKnowledgeItem = useFileStore((s) => s.useFetchKnowledgeItem);
  const { data: fileData } = useFetchKnowledgeItem(fileId || undefined);
  const documentData = useFileStore(documentSelectors.getDocumentById(fileId || undefined));

  useEffect(() => {
    if (!fileId) {
      setMode('explorer');
      setCurrentViewItemId(undefined);
      return;
    }

    let cancelled = false;

    const resolveInitialView = async () => {
      setCurrentViewItemId(fileId);

      if (!fileData && !documentData) return;

      const isPDF =
        fileData?.fileType?.toLowerCase() === 'pdf' ||
        fileData?.fileType?.toLowerCase() === 'application/pdf' ||
        fileData?.name?.toLowerCase().endsWith('.pdf') ||
        documentData?.fileType?.toLowerCase() === 'pdf' ||
        documentData?.fileType?.toLowerCase() === 'application/pdf' ||
        documentData?.filename?.toLowerCase().endsWith('.pdf') ||
        documentData?.source?.toLowerCase().endsWith('.pdf');

      const isDoc =
        !isPDF &&
        (fileData?.sourceType === 'document' ||
          fileData?.fileType === 'custom/document' ||
          !!documentData);

      if (isPDF) {
        if (!cancelled) setMode('editor');
        return;
      }

      if (isDoc) {
        if (!cancelled) setMode('doc');
        return;
      }

      // All other files (including markdown) go to editor mode
      if (!cancelled) {
        setMode('editor');
      }
    };

    void resolveInitialView();

    return () => {
      cancelled = true;
    };
  }, [documentData, fileData, fileId, setCurrentViewItemId, setMode]);
};
