'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

import { documentSelectors, useFileStore } from '@/store/file';

import { useResourceManagerStore } from '../store';

/**
 * Used for initial loading only, handle URL like:
 *
 * /resource?file=xxxxxx
 */
export const useInitFileCheck = () => {
  const [searchParams] = useSearchParams();
  const [setMode, setCurrentViewItemId] = useResourceManagerStore((s) => [
    s.setMode,
    s.setCurrentViewItemId,
  ]);

  const fileId = searchParams.get('file');

  const useFetchKnowledgeItem = useFileStore((s) => s.useFetchKnowledgeItem);
  const { data: fileData } = useFetchKnowledgeItem(fileId || undefined);

  // Memoize selector to avoid creating a new function reference on every render
  const documentSelector = useMemo(
    () => documentSelectors.getDocumentById(fileId || undefined),
    [fileId],
  );
  const documentData = useFileStore(documentSelector);

  // Track previous values to avoid redundant store updates
  const prevRef = useRef<{ currentViewItemId?: string; mode?: string }>({});

  useEffect(() => {
    if (fileId) {
      if (prevRef.current.currentViewItemId !== fileId) {
        setCurrentViewItemId(fileId);
        prevRef.current.currentViewItemId = fileId;
      }

      if (fileData || documentData) {
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

        const nextMode = isPDF ? 'editor' : isPage ? 'page' : 'editor';
        if (prevRef.current.mode !== nextMode) {
          setMode(nextMode);
          prevRef.current.mode = nextMode;
        }
      }
    } else {
      if (prevRef.current.mode !== 'explorer') {
        setMode('explorer');
        prevRef.current.mode = 'explorer';
      }
      if (prevRef.current.currentViewItemId !== undefined) {
        setCurrentViewItemId(undefined);
        prevRef.current.currentViewItemId = undefined;
      }
    }
  }, [fileId, fileData, documentData]);
};
