'use client';

import type { IEditor } from '@lobehub/editor/es/types';
import type { EditorState as LobehubEditorState } from '@lobehub/editor/react';
import isEqual from 'fast-deep-equal';

import { normalizeMarkdownBreakTags } from '@/libs/markdown/remarkEncodedBreakTag';
import { documentService } from '@/services/document';
import type { StoreSetter } from '@/store/types';
import { setNamespace } from '@/utils/storeDebug';

import type { DocumentStore } from '../../store';
import type { DocumentDispatch } from './reducer';
import { documentReducer } from './reducer';

const n = setNamespace('document/editor');

/**
 * Metadata passed in at save time (not stored in editor state)
 */
export interface SaveMetadata {
  metadata?: Record<string, any>;
  title?: string;
}

const TRANSIENT_EDITOR_READ_ERROR = 'Expected node root to have a parent.';
const SAVE_READ_RETRY_LIMIT = 30;

type Setter = StoreSetter<DocumentStore>;
export const createEditorSlice = (set: Setter, get: () => DocumentStore, _api?: unknown) =>
  new EditorActionImpl(set, get, _api);

export class EditorActionImpl {
  readonly #get: () => DocumentStore;
  readonly #set: Setter;
  readonly #saveQueue = new Map<string, Promise<void>>();

  constructor(set: Setter, get: () => DocumentStore, _api?: unknown) {
    void _api;
    this.#set = set;
    this.#get = get;
  }

  #enqueueSave = (documentId: string, task: () => Promise<void>) => {
    const previous = this.#saveQueue.get(documentId) || Promise.resolve();

    const queued = previous
      .catch(() => undefined)
      .then(task)
      .finally(() => {
        if (this.#saveQueue.get(documentId) === queued) {
          this.#saveQueue.delete(documentId);
        }
      });

    this.#saveQueue.set(documentId, queued);

    return queued;
  };

  #isTransientEditorReadError = (error: unknown) =>
    error instanceof Error && error.message.includes(TRANSIENT_EDITOR_READ_ERROR);

  #waitForEditorStability = () =>
    new Promise<void>((resolve) => {
      setTimeout(resolve, 100);
    });

  #readEditorDocumentWithRetry = async (editor: IEditor, type: 'json' | 'markdown') => {
    let lastError: unknown;

    for (let attempt = 0; attempt <= SAVE_READ_RETRY_LIMIT; attempt += 1) {
      try {
        const value = editor.getDocument(type);

        if (type === 'markdown') return (value as unknown as string) || '';

        return value;
      } catch (error) {
        lastError = error;

        if (attempt === SAVE_READ_RETRY_LIMIT || !this.#isTransientEditorReadError(error)) {
          throw error;
        }

        await this.#waitForEditorStability();
      }
    }

    throw lastError;
  };

  getEditorContent = (): { editorData: any; markdown: string } | null => {
    const { activeDocumentId, documents, editor } = this.#get();

    if (!editor) {
      if (!activeDocumentId) return null;

      const doc = documents[activeDocumentId];
      if (!doc) return null;

      return {
        editorData: doc.editorData,
        markdown: doc.content || '',
      };
    }

    try {
      const markdown = (editor.getDocument('markdown') as unknown as string) || '';
      const editorData = editor.getDocument('json');
      return { editorData, markdown };
    } catch (error) {
      console.error('[DocumentStore] Failed to get editor content:', error);
      return null;
    }
  };

  handleContentChange = (): void => {
    const { editor, activeDocumentId, documents, internal_dispatchDocument } = this.#get();

    if (!editor || !activeDocumentId) return;

    const doc = documents[activeDocumentId];
    if (!doc) return;

    try {
      const markdown = (editor.getDocument('markdown') as unknown as string) || '';
      const editorData = editor.getDocument('json');

      const markdownChanged = markdown !== doc.lastSavedContent;
      const editorDataChanged = !isEqual(editorData, doc.lastSavedEditorData);
      const contentChanged = markdownChanged || editorDataChanged;

      internal_dispatchDocument(
        {
          id: activeDocumentId,
          type: 'updateDocument',
          value: { content: markdown, editorData, isDirty: contentChanged },
        },
        'handleContentChange',
      );

      // Only trigger auto-save if content actually changed AND autoSave is enabled
      if (contentChanged && doc.autoSave !== false) {
        this.#get().triggerDebouncedSave(activeDocumentId);
      }
    } catch (error) {
      console.error('[DocumentStore] Failed to update content:', error);
    }
  };

  syncExternalDocumentContent = (
    documentId: string,
    value: { content?: string; editorData?: any },
  ): void => {
    const { documents, internal_dispatchDocument } = this.#get();
    const doc = documents[documentId];

    if (!doc) return;

    const nextContent = value.content ?? doc.content ?? '';
    const nextEditorData = value.editorData ?? doc.editorData;
    const markdownChanged = nextContent !== doc.lastSavedContent;
    const editorDataChanged = !isEqual(nextEditorData, doc.lastSavedEditorData);
    const contentChanged = markdownChanged || editorDataChanged;

    internal_dispatchDocument(
      {
        id: documentId,
        type: 'updateDocument',
        value: {
          content: nextContent,
          editorData: nextEditorData,
          isDirty: contentChanged,
        },
      },
      'syncExternalDocumentContent',
    );

    if (contentChanged && doc.autoSave !== false) {
      this.#get().triggerDebouncedSave(documentId);
    }
  };

  internal_dispatchDocument = (payload: DocumentDispatch, action?: string): void => {
    const { documents } = this.#get();
    const nextDocuments = documentReducer(documents, payload);

    if (isEqual(documents, nextDocuments)) return;

    this.#set(
      { documents: nextDocuments },
      false,
      action ?? n(`dispatchDocument/${payload.type}`, { id: payload.id }),
    );
  };

  markDirty = (documentId: string): void => {
    const { documents, internal_dispatchDocument } = this.#get();
    if (!documents[documentId]) return;

    internal_dispatchDocument({ id: documentId, type: 'updateDocument', value: { isDirty: true } });
  };

  onEditorInit = async (editor: IEditor): Promise<void> => {
    const { activeDocumentId, documents } = this.#get();
    if (!editor || !activeDocumentId) return;

    const doc = documents[activeDocumentId];

    if (!doc) return;

    // Check if editorData is valid and non-empty
    const hasValidEditorData =
      doc.editorData &&
      typeof doc.editorData === 'object' &&
      Object.keys(doc.editorData).length > 0;

    // Set content from document state
    if (hasValidEditorData) {
      try {
        editor.setDocument('json', JSON.stringify(doc.editorData));
        return;
      } catch {
        // Fallback to markdown if JSON fails
        console.warn('[DocumentStore] Failed to load editorData, falling back to markdown');
      }
    }

    // Load markdown content if available
    // Skip setDocument for empty content - let editor use its default empty state
    if (doc.content?.trim()) {
      try {
        editor.setDocument('markdown', normalizeMarkdownBreakTags(doc.content));
      } catch (err) {
        console.error('[DocumentStore] Failed to load markdown content:', err);
      }
    }

    this.#set({ editor });
  };

  performSave = async (documentId?: string, metadata?: SaveMetadata): Promise<void> => {
    const id = documentId || this.#get().activeDocumentId;

    if (!id) return;

    await this.#enqueueSave(id, async () => {
      const { activeDocumentId, editor, documents, internal_dispatchDocument } = this.#get();
      const doc = documents[id];
      if (!doc) return;

      const hasExtraSavePayload = metadata?.metadata !== undefined || metadata?.title !== undefined;

      // Skip save if no changes
      if (!doc.isDirty && !hasExtraSavePayload) return;

      // Update save status
      internal_dispatchDocument({
        id,
        type: 'updateDocument',
        value: { lastSaveError: undefined, saveStatus: 'saving' },
      });

      try {
        const shouldReadFromEditor = !!editor && activeDocumentId === id && doc.isDirty;
        const currentContent = shouldReadFromEditor
          ? ((await this.#readEditorDocumentWithRetry(editor, 'markdown')) as string)
          : (doc.content ?? '');
        let currentEditorData = doc.editorData;

        if (shouldReadFromEditor) {
          try {
            currentEditorData = await this.#readEditorDocumentWithRetry(editor, 'json');
          } catch (error) {
            if (!this.#isTransientEditorReadError(error)) throw error;

            currentEditorData = null;
          }
        }

        // Save document
        await documentService.updateDocument({
          content: currentContent,
          editorData: JSON.stringify(currentEditorData),
          id,
          metadata: metadata?.metadata,
          title: metadata?.title,
        });

        // Mark as clean and update save status
        internal_dispatchDocument({
          id,
          type: 'updateDocument',
          value: {
            content: currentContent,
            editorData: structuredClone(currentEditorData),
            isDirty: false,
            lastSavedContent: currentContent,
            lastSavedEditorData: structuredClone(currentEditorData),
            lastSaveError: undefined,
            lastUpdatedTime: new Date(),
            saveStatus: 'saved',
          },
        });
      } catch (error) {
        console.error('[DocumentStore] Failed to save:', error);
        internal_dispatchDocument({
          id,
          type: 'updateDocument',
          value: {
            lastSaveError: error instanceof Error ? error.message : undefined,
            saveStatus: 'idle',
          },
        });
      }
    });
  };

  setEditorState = (editorState: LobehubEditorState | undefined): void => {
    this.#set({ editorState }, false, n('setEditorState'));
  };
}

export type EditorAction = Pick<EditorActionImpl, keyof EditorActionImpl>;
