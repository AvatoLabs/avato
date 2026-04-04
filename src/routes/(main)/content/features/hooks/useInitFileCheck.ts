'use client';

import { useEffect } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { buildFilesItemPath } from '@/features/ResourceSpaces';
import { documentSelectors, useFileStore } from '@/store/file';

import { useContentManagerStore } from '../store';

/**
 * Used for initial loading only, handle URL like:
 *
 * /content/item/:fileId
 * /content?file=xxxxxx (legacy, auto-migrated)
 */
export const useInitFileCheck = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { fileId: routeFileId } = useParams<{ fileId?: string }>();
  const [searchParams] = useSearchParams();
  const [setMode, setCurrentViewItemId] = useContentManagerStore((s) => [
    s.setMode,
    s.setCurrentViewItemId,
  ]);

  const legacyFileId = searchParams.get('file') ?? searchParams.get('files');
  const fileId = routeFileId ?? legacyFileId;

  const useFetchKnowledgeItem = useFileStore((s) => s.useFetchKnowledgeItem);
  const { data: fileData } = useFetchKnowledgeItem(fileId || undefined);
  const documentData = useFileStore(documentSelectors.getDocumentById(fileId || undefined));

  useEffect(() => {
    if (routeFileId || !legacyFileId) return;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('file');
    nextParams.delete('files');

    const nextPath = buildFilesItemPath(location.pathname, legacyFileId);
    const nextSearch = nextParams.toString();

    navigate(nextSearch ? `${nextPath}?${nextSearch}` : nextPath, { replace: true });
  }, [legacyFileId, location.pathname, navigate, routeFileId, searchParams]);

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
