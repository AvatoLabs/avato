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
import { useContentManagerStore } from '@/routes/(main)/content/features/store';
import { documentService } from '@/services/document';
import { abortableRequest } from '@/services/utils/abortableRequest';
import { useFileStore } from '@/store/file';
import { documentSelectors } from '@/store/file/slices/document/selectors';
import { DocumentSourceType, type LobeDocument } from '@/types/document';
import { getPageKindFromDocument } from '@/utils/docs';

import FileEditor from './components/Editor';
import Explorer from './components/Explorer';
import UploadDock from './components/UploadDock';

const ChunkDrawer = dynamic(() => import('./components/ChunkDrawer'), { ssr: false });

const DOC_EDITOR_FETCH_KEY = 'content-manager-doc-editor';

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
    docEditorOverlay: css`
      position: absolute;
      z-index: 1;
      inset: 0;

      width: 100%;
      height: 100%;

      background-color: ${cssVar.colorBgLayout};
    `,
  };
});

export type ContentManagerMode = 'doc' | 'editor' | 'explorer';

/**
 * Manage content within the current workspace or source set.
 *
 * Business component, no need be reusable.
 */
const ContentManager = memo(() => {
  const theme = useTheme();
  const [, setSearchParams] = useSearchParams();
  const [
    mode,
    currentViewItemId,
    sourceSetId,
    currentFolderId,
    setMode,
    setCurrentViewItemId,
    spaceId,
  ] = useContentManagerStore((s) => [
    s.mode,
    s.currentViewItemId,
    s.sourceSetId,
    s.currentFolderId,
    s.setMode,
    s.setCurrentViewItemId,
    s.spaceId,
  ]);

  const currentDocument = useFileStore(documentSelectors.getDocumentById(currentViewItemId));
  const pushDockFileList = useFileStore((s) => s.pushDockFileList);
  const updateDocumentOptimistically = useFileStore((s) => s.updateDocumentOptimistically);

  const handleUploadFiles = useCallback(
    (files: File[]) => pushDockFileList(files, sourceSetId, currentFolderId ?? undefined, spaceId),
    [currentFolderId, sourceSetId, pushDockFileList, spaceId],
  );

  const cssVariables = useMemo<Record<string, string>>(
    () => ({
      '--editor-overlay-bg': theme.colorBgContainerSecondary,
    }),
    [theme.colorBgContainerSecondary],
  );

  // Fetch the current doc when switching to doc mode if it is not already loaded.
  useEffect(() => {
    if (mode !== 'doc' || !currentViewItemId || currentDocument) {
      return undefined;
    }

    const requestedId = currentViewItemId;
    let cancelled = false;

    void (async () => {
      try {
        const raw = await documentService.getDocumentById(requestedId, DOC_EDITOR_FETCH_KEY);
        if (cancelled || !raw || raw.id !== requestedId) return;

        const contentManager = useContentManagerStore.getState();
        if (contentManager.mode !== 'doc' || contentManager.currentViewItemId !== requestedId) {
          return;
        }

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
      abortableRequest.cancel(DOC_EDITOR_FETCH_KEY);
    };
  }, [mode, currentViewItemId, currentDocument]);

  const handleBack = () => {
    setMode('explorer');
    setCurrentViewItemId(undefined);
    // Remove the file query parameter from URL
    setSearchParams(
      (prev) => {
        prev.delete('file');
        return prev;
      },
      { replace: true },
    );
    // Reset document title to default
    document.title = BRANDING_NAME;
  };

  // Optimistic update handlers for doc title and emoji
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

          {/* Doc editor overlay */}
          {mode === 'doc' && (
            <Flexbox className={styles.docEditorOverlay}>
              <PageEditor
                emoji={currentDocument?.metadata?.emoji as string | undefined}
                pageId={currentViewItemId}
                pageKind={getPageKindFromDocument(currentDocument)}
                sourceSetId={sourceSetId}
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

export default ContentManager;
