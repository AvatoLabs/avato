'use client';

import { BRANDING_NAME } from '@lobechat/business-const';
import { type DocumentItem } from '@lobechat/database/schemas';
import { Flexbox } from '@lobehub/ui';
import { createStaticStyles, useTheme } from 'antd-style';
import { memo, useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import DragUploadZone from '@/components/DragUploadZone';
import { PageEditor } from '@/features/PageEditor';
import dynamic from '@/libs/next/dynamic';
import { useResourceManagerStore } from '@/routes/(main)/resource/features/store';
import { documentService } from '@/services/document';
import { abortableRequest } from '@/services/utils/abortableRequest';
import { useFileStore } from '@/store/file';
import { documentSelectors } from '@/store/file/slices/document/selectors';
import { DocumentSourceType, type LobeDocument } from '@/types/document';

import FileEditor from './components/Editor';
import Explorer from './components/Explorer';
import UploadDock from './components/UploadDock';

const ChunkDrawer = dynamic(() => import('./components/ChunkDrawer'), { ssr: false });

const PAGE_EDITOR_FETCH_KEY = 'resource-manager-page-editor';

const mapDocumentItemToLobeDocument = (document: DocumentItem): LobeDocument => {
  let editorData: Record<string, any> | null = document.editorData ?? null;
  if (typeof editorData === 'string') {
    try {
      editorData = JSON.parse(editorData) as Record<string, any>;
    } catch {
      editorData = null;
    }
  }

  return {
    content: document.content || null,
    createdAt: document.createdAt ? new Date(document.createdAt) : new Date(),
    editorData,
    fileType: document.fileType,
    filename: document.title || document.filename || 'Untitled',
    id: document.id,
    metadata: document.metadata || {},
    source: 'document',
    sourceType: DocumentSourceType.EDITOR,
    title: document.title || '',
    totalCharCount: document.content?.length || 0,
    totalLineCount: 0,
    updatedAt: document.updatedAt ? new Date(document.updatedAt) : new Date(),
  };
};

const styles = createStaticStyles(({ css, cssVar }) => {
  return {
    container: css`
      position: relative;
      overflow: hidden;
    `,
    editorOverlay: css`
      position: absolute;
      z-index: 1;
      inset: 0;

      width: 100%;
      height: 100%;

      background-color: var(--editor-overlay-bg, ${cssVar.colorBgContainer});
    `,
    pageEditorOverlay: css`
      position: absolute;
      z-index: 1;
      inset: 0;

      width: 100%;
      height: 100%;

      background-color: ${cssVar.colorBgLayout};
    `,
  };
});

export type ResourceManagerMode = 'editor' | 'explorer' | 'page';

/**
 * Manage resources. Can be from a certian library.
 *
 * Business component, no need be reusable.
 */
const ResourceManager = memo(() => {
  const theme = useTheme();
  const [, setSearchParams] = useSearchParams();
  const [
    mode,
    currentViewItemId,
    libraryId,
    currentFolderId,
    setMode,
    setCurrentViewItemId,
    spaceId,
  ] = useResourceManagerStore((s) => [
    s.mode,
    s.currentViewItemId,
    s.libraryId,
    s.currentFolderId,
    s.setMode,
    s.setCurrentViewItemId,
    s.spaceId,
  ]);

  const currentDocument = useFileStore(documentSelectors.getDocumentById(currentViewItemId));
  const pushDockFileList = useFileStore((s) => s.pushDockFileList);
  const updateDocumentOptimistically = useFileStore((s) => s.updateDocumentOptimistically);

  const handleUploadFiles = useCallback(
    (files: File[]) => pushDockFileList(files, libraryId, currentFolderId ?? undefined, spaceId),
    [currentFolderId, libraryId, pushDockFileList, spaceId],
  );

  const cssVariables = useMemo<Record<string, string>>(
    () => ({
      '--editor-overlay-bg': theme.colorBgContainerSecondary,
    }),
    [theme.colorBgContainerSecondary],
  );

  // Fetch specific document when switching to page mode if not already loaded
  useEffect(() => {
    if (mode !== 'page' || !currentViewItemId || currentDocument) {
      return undefined;
    }

    const requestedId = currentViewItemId;
    let cancelled = false;

    void (async () => {
      try {
        const raw = await documentService.getDocumentById(requestedId, PAGE_EDITOR_FETCH_KEY);
        if (cancelled || !raw || raw.id !== requestedId) return;

        const rm = useResourceManagerStore.getState();
        if (rm.mode !== 'page' || rm.currentViewItemId !== requestedId) return;

        const page = mapDocumentItemToLobeDocument(raw);

        useFileStore.setState((state) => {
          if (state.documents.some((d) => d.id === page.id)) return state;
          return { documents: [...state.documents, page] };
        });
      } catch {
        // Aborted (new navigation) or request failure — avoid unhandled rejection
      }
    })();

    return () => {
      cancelled = true;
      abortableRequest.cancel(PAGE_EDITOR_FETCH_KEY);
    };
  }, [mode, currentViewItemId, currentDocument]);

  const handleBack = () => {
    setMode('explorer');
    setCurrentViewItemId(undefined);
    // Remove the file query parameter from URL
    setSearchParams((prev) => {
      prev.delete('file');
      return prev;
    });
    // Reset document title to default
    document.title = BRANDING_NAME;
  };

  // Optimistic update handlers for page title and emoji
  const handleTitleChange = useCallback(
    (newTitle: string) => {
      if (currentViewItemId) {
        updateDocumentOptimistically(currentViewItemId, { title: newTitle });
      }
    },
    [currentViewItemId, updateDocumentOptimistically],
  );

  const handleEmojiChange = useCallback(
    (newEmoji: string | undefined) => {
      if (currentViewItemId) {
        updateDocumentOptimistically(currentViewItemId, {
          metadata: { ...currentDocument?.metadata, emoji: newEmoji },
        });
      }
    },
    [currentViewItemId, currentDocument?.metadata, updateDocumentOptimistically],
  );

  return (
    <>
      <DragUploadZone enabledFiles style={{ height: '100%' }} onUploadFiles={handleUploadFiles}>
        <Flexbox className={styles.container} height={'100%'} style={cssVariables}>
          {/* Explorer is always rendered to preserve its state */}
          <Explorer />

          {/* Editor overlay */}
          {mode === 'editor' && (
            <Flexbox className={styles.editorOverlay}>
              <FileEditor onBack={handleBack} />
            </Flexbox>
          )}

          {/* PageEditor overlay */}
          {mode === 'page' && (
            <Flexbox className={styles.pageEditorOverlay}>
              <PageEditor
                emoji={currentDocument?.metadata?.emoji as string | undefined}
                knowledgeBaseId={libraryId}
                pageId={currentViewItemId}
                title={currentDocument?.title}
                onBack={handleBack}
                onDelete={handleBack}
                onEmojiChange={handleEmojiChange}
                onTitleChange={handleTitleChange}
              />
            </Flexbox>
          )}
        </Flexbox>
      </DragUploadZone>
      <UploadDock />
      <ChunkDrawer />
    </>
  );
});

export default ResourceManager;
