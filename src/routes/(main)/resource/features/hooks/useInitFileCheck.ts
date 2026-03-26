'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

import { isMarkdownResource } from '@/features/ResourceManager/utils/isMarkdownResource';
import { documentService } from '@/services/document';
import { documentSelectors, useFileStore } from '@/store/file';

import { useResourceManagerStore } from '../store';

/**
 * Used for initial loading only, handle URL like:
 *
 * /resource?file=xxxxxx
 */
export const useInitFileCheck = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [setMode, setCurrentViewItemId] = useResourceManagerStore((s) => [
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

      const isPage =
        !isPDF &&
        (fileData?.sourceType === 'document' ||
          fileData?.fileType === 'custom/document' ||
          !!documentData);

      if (isPDF) {
        if (!cancelled) setMode('editor');
        return;
      }

      if (isPage) {
        if (!cancelled) setMode('page');
        return;
      }

      if (fileData && isMarkdownResource(fileData.name, fileData.fileType)) {
        try {
          const ensuredDocument = await documentService.ensureFileDocument(
            fileData.fileId || fileId,
          );

          if (cancelled) return;

          setCurrentViewItemId(ensuredDocument.id);
          setMode('page');
          setSearchParams(
            (prev) => {
              const next = new URLSearchParams(prev);
              next.set('file', ensuredDocument.id);
              return next;
            },
            { replace: true },
          );
          return;
        } catch (error) {
          console.error('[ResourceManager] Failed to restore markdown editor mode:', error);
        }
      }

      if (!cancelled) {
        setMode('editor');
      }
    };

    void resolveInitialView();

    return () => {
      cancelled = true;
    };
  }, [documentData, fileData, fileId, setCurrentViewItemId, setMode, setSearchParams]);
};
