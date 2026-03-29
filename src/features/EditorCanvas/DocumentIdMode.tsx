'use client';

import { type IEditor } from '@lobehub/editor';
import { Alert, Skeleton } from '@lobehub/ui';
import { memo, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { createStoreUpdater } from 'zustand-utils';

import { useSaveDocumentHotkey } from '@/hooks/useHotkeys';
import { useDocumentStore } from '@/store/document';
import { editorSelectors } from '@/store/document/slices/editor';

import { type EditorCanvasProps } from './EditorCanvas';
import InternalEditor from './InternalEditor';
import UnsavedChangesGuard from './UnsavedChangesGuard';

/**
 * Loading skeleton for the editor
 */
const EditorSkeleton = memo(() => (
  <div style={{ paddingBlock: 24 }}>
    <Skeleton active paragraph={{ rows: 8 }} />
  </div>
));

/**
 * Error display for fetch failures
 */
const EditorError = memo<{ error: Error }>(({ error }) => {
  const { t } = useTranslation('file');

  return (
    <Alert
      showIcon
      description={error.message || t('docEditor.loadError', 'Failed to load document')}
      style={{ margin: 16 }}
      title={t('docEditor.error', 'Error')}
      type="error"
    />
  );
});

export interface DocumentIdModeProps extends EditorCanvasProps {
  documentId: string;
  editor: IEditor | undefined;
}

/**
 * EditorCanvas with documentId mode - handles data fetching internally
 */
const DocumentIdMode = memo<DocumentIdModeProps>(
  ({
    editor,
    documentId,
    autoSave = true,
    sourceType = 'page',
    onContentChange,
    unsavedChangesGuard,
    style,
    ...editorProps
  }) => {
    const { t } = useTranslation(['file', 'ui']);
    const shouldGuardUnsavedChanges = unsavedChangesGuard?.enabled ?? false;

    const storeUpdater = createStoreUpdater(useDocumentStore);
    storeUpdater('activeDocumentId', documentId);
    storeUpdater('editor', editor);

    // Get document store actions
    const [onEditorInit, handleContentChangeStore, useFetchDocument, performSave, flushSave] =
      useDocumentStore((s) => [
        s.onEditorInit,
        s.handleContentChange,
        s.useFetchDocument,
        s.performSave,
        s.flushSave,
      ]);

    useSaveDocumentHotkey(flushSave);

    // Use SWR hook for document fetching (auto-initializes via onSuccess in DocumentStore)
    const { error } = useFetchDocument(documentId, {
      autoSave,
      editor,
      sourceType,
      syncPolicy: 'once',
    });

    // Check loading state via selector (document not yet in store)
    const isLoading = useDocumentStore(editorSelectors.isDocumentLoading(documentId));
    const isDirty = useDocumentStore((s) =>
      shouldGuardUnsavedChanges ? editorSelectors.isDirty(documentId)(s) : false,
    );

    const handleAutoSaveBeforeLeave = useCallback(async () => {
      if (!shouldGuardUnsavedChanges) return true;

      await unsavedChangesGuard?.beforeAutoSave?.();
      await performSave(documentId);

      const latestDocument = useDocumentStore.getState().documents[documentId];

      if (!latestDocument || !latestDocument.isDirty) return true;

      throw new Error(latestDocument.lastSaveError || t('docEditor.saveFailed'));
    }, [documentId, performSave, shouldGuardUnsavedChanges, t, unsavedChangesGuard]);

    const unsavedGuardNode = (
      <UnsavedChangesGuard
        isDirty={shouldGuardUnsavedChanges && isDirty}
        message={unsavedChangesGuard?.message || t('form.unsavedWarning', { ns: 'ui' })}
        title={unsavedChangesGuard?.title || t('form.unsavedChanges', { ns: 'ui' })}
        onAutoSave={handleAutoSaveBeforeLeave}
      />
    );

    // Handle content change
    const handleChange = useCallback(() => {
      handleContentChangeStore();
      onContentChange?.();
    }, [handleContentChangeStore, onContentChange]);

    const isEditorInitialized = !!editor?.getLexicalEditor();
    const contentChangeLockRef = useRef(false);
    const initRunIdRef = useRef(0);
    const initializedDocIdRef = useRef<string | null>(null);
    const releaseContentChangeLock = useCallback((runId: number) => {
      queueMicrotask(() => {
        if (initRunIdRef.current === runId) {
          contentChangeLockRef.current = false;
        }
      });
    }, []);

    const runEditorInit = useCallback(
      (targetEditor: IEditor) => {
        if (initializedDocIdRef.current === documentId) return;

        const runId = ++initRunIdRef.current;
        const scheduledDocumentId = documentId;

        initializedDocIdRef.current = scheduledDocumentId;
        contentChangeLockRef.current = true;

        queueMicrotask(() => {
          if (initializedDocIdRef.current !== scheduledDocumentId) {
            releaseContentChangeLock(runId);
            return;
          }

          void onEditorInit(targetEditor).finally(() => {
            releaseContentChangeLock(runId);
          });
        });
      },
      [documentId, onEditorInit, releaseContentChangeLock],
    );

    const handleEditorInit = useCallback(
      (targetEditor: IEditor) => {
        runEditorInit(targetEditor);
      },
      [runEditorInit],
    );

    // If the shared editor instance is already ready for a new document,
    // re-hydrate content without waiting for a fresh onInit callback.
    useEffect(() => {
      if (!editor || !isEditorInitialized || isLoading) return;

      queueMicrotask(() => {
        if (initializedDocIdRef.current === documentId) return;
        runEditorInit(editor);
      });
    }, [documentId, editor, isEditorInitialized, isLoading, runEditorInit]);

    if (error) {
      return (
        <>
          {unsavedGuardNode}
          <EditorError error={error as Error} />
        </>
      );
    }

    if (!editor) return unsavedGuardNode;

    // Show loading state
    if (isLoading) {
      return (
        <>
          {unsavedGuardNode}
          <EditorSkeleton />
        </>
      );
    }

    return (
      <>
        {unsavedGuardNode}
        <InternalEditor
          contentChangeLockRef={contentChangeLockRef}
          editor={editor}
          placeholder={editorProps.placeholder || t('docEditor.editorPlaceholder')}
          style={style}
          onContentChange={handleChange}
          onInit={handleEditorInit}
          {...editorProps}
        />
      </>
    );
  },
);

DocumentIdMode.displayName = 'DocumentIdMode';

export default DocumentIdMode;
