'use client';

import { EDITOR_DEBOUNCE_TIME, EDITOR_MAX_WAIT } from '@lobechat/const';
import { type DocumentItem } from '@lobechat/database/schemas';
import { type IEditor } from '@lobehub/editor';
import { debounce } from 'es-toolkit/compat';
import { type SWRResponse } from 'swr';

import { useClientDataSWRWithSync } from '@/libs/swr/useClientDataSWRWithSync';
import { documentService } from '@/services/document';
import { type StoreSetter } from '@/store/types';
import { setNamespace } from '@/utils/storeDebug';

import { type DocumentStore } from '../../store';
import { type DocumentSourceType } from '../editor/initialState';

const n = setNamespace('document/document');

/**
 * Parameters for initializing a document with editor
 */
export interface InitDocumentParams {
  /**
   * Whether auto-save is enabled. Defaults to true.
   * Set to false if the consumer handles saving themselves.
   */
  autoSave?: boolean;
  content?: string | null;
  documentId: string;
  editor?: IEditor;
  editorData?: unknown;
  lastUpdatedTime?: Date | string | null;
  sourceType: DocumentSourceType;
  spaceId?: string | null;
  topicId?: string;
}

/**
 * Options for useFetchDocument hook
 */
export interface UseFetchDocumentOptions {
  /**
   * Whether auto-save is enabled. Defaults to true.
   */
  autoSave?: boolean;
  /**
   * Editor instance to load content into
   */
  editor?: IEditor;
  /**
   * Whether to revalidate stale cache entries on mount. Defaults to true.
   */
  revalidateIfStale?: boolean;
  /**
   * Whether to revalidate the document when window focus changes. Defaults to true.
   */
  revalidateOnFocus?: boolean;
  /**
   * Whether to revalidate the document when the network reconnects. Defaults to true.
   */
  revalidateOnReconnect?: boolean;
  /**
   * Source type for the document. Defaults to 'page'.
   */
  sourceType?: DocumentSourceType;
  /**
   * How fetched data should be synced back into the live document store.
   * `once` is useful for editors that treat local state as the source of truth
   * after the initial hydration.
   */
  syncPolicy?: 'always' | 'once';
}

type Setter = StoreSetter<DocumentStore>;
export const createDocumentSlice = (set: Setter, get: () => DocumentStore, _api?: unknown) =>
  new DocumentActionImpl(set, get, _api);

export class DocumentActionImpl {
  readonly #get: () => DocumentStore;
  readonly #set: Setter;
  readonly #debouncedSaves = new Map<string, ReturnType<typeof debounce>>();

  constructor(set: Setter, get: () => DocumentStore, _api?: unknown) {
    void _api;
    this.#set = set;
    this.#get = get;
  }

  #getOrCreateDebouncedSave = (documentId: string) => {
    if (!this.#debouncedSaves.has(documentId)) {
      const debouncedFn = debounce(
        async () => {
          try {
            await this.#get().performSave(documentId);
          } catch (error) {
            console.error('[DocumentStore] Failed to auto-save:', error);
          }
        },
        EDITOR_DEBOUNCE_TIME,
        { leading: false, maxWait: EDITOR_MAX_WAIT, trailing: true },
      );
      this.#debouncedSaves.set(documentId, debouncedFn);
    }
    return this.#debouncedSaves.get(documentId)!;
  };

  #cleanupDebouncedSave = (documentId: string) => {
    const fn = this.#debouncedSaves.get(documentId);
    if (fn) {
      fn.cancel();
      this.#debouncedSaves.delete(documentId);
    }
  };

  /**
   * Close a document and remove it from state
   */
  closeDocument = (documentId: string): void => {
    // Flush any pending saves before closing
    const save = this.#debouncedSaves.get(documentId);
    if (save) {
      save.flush();
      this.#cleanupDebouncedSave(documentId);
    }

    const { activeDocumentId, internal_dispatchDocument } = this.#get();

    // Delete document via reducer
    internal_dispatchDocument({ id: documentId, type: 'deleteDocument' });

    // Update activeDocumentId if needed
    if (activeDocumentId === documentId) {
      this.#set({ activeDocumentId: undefined }, false, n('closeDocument:clearActive'));
    }
  };

  /**
   * Flush any pending debounced save for a document
   */
  flushSave = (documentId?: string): void => {
    const id = documentId || this.#get().activeDocumentId;
    if (id) {
      const save = this.#debouncedSaves.get(id);
      save?.flush();
    }
  };

  /**
   * Initialize a document with editor - stores state only.
   * Content is loaded into editor via onEditorInit when Editor component is ready.
   */
  initDocumentWithEditor = (params: InitDocumentParams): void => {
    const {
      documentId,
      sourceType,
      content,
      editorData,
      topicId,
      autoSave,
      editor,
      lastUpdatedTime,
      spaceId,
    } = params;

    const { internal_dispatchDocument } = this.#get();

    // Add or update document via reducer
    internal_dispatchDocument({
      id: documentId,
      type: 'addDocument',
      value: {
        autoSave,
        content: content ?? undefined,
        editorData,
        lastUpdatedTime: lastUpdatedTime ? new Date(lastUpdatedTime) : null,
        lastSavedContent: content ?? undefined,
        lastSavedEditorData: editorData,
        spaceId,
        sourceType,
        topicId,
      },
    });

    // Update activeDocumentId and editor. `editor` may be undefined when a consumer
    // manages document content through an external editor implementation.
    this.#set(
      { activeDocumentId: documentId, editor },
      false,
      n('initDocumentWithEditor:setActive'),
    );
  };

  /**
   * Trigger a debounced save for the specified document
   */
  triggerDebouncedSave = (documentId: string): void => {
    const save = this.#getOrCreateDebouncedSave(documentId);
    save();
  };

  /**
   * SWR hook to fetch document and initialize in DocumentStore
   */
  useFetchDocument = (
    documentId: string | undefined,
    options: UseFetchDocumentOptions = {},
  ): SWRResponse<DocumentItem | null> => {
    const {
      autoSave = true,
      editor,
      revalidateIfStale = true,
      revalidateOnFocus = true,
      revalidateOnReconnect = true,
      sourceType = 'page',
      syncPolicy = 'always',
    } = options;
    const swrKey = documentId ? ['document/editor', documentId] : null;

    return useClientDataSWRWithSync<DocumentItem | null>(
      swrKey,
      async () => {
        // documentId is guaranteed to be defined when swrKey is not null
        const document = await documentService.getDocumentById(documentId!);
        if (!document) {
          console.warn(`[useFetchDocument] Document not found: ${documentId}`);
          return null;
        }

        return document;
      },
      {
        focusThrottleInterval: 20_000,
        onData: (document) => {
          if (!document || !documentId) return;

          // Check if this response is still for the current active document
          // This prevents race conditions when quickly switching between documents
          const currentActiveId = this.#get().activeDocumentId;
          const currentDocument = this.#get().documents[documentId];

          if (currentActiveId && currentActiveId !== documentId) {
            // User has already switched to another document, discard this stale response
            return;
          }

          // Never overwrite unsaved local edits with a background fetch.
          if (currentDocument?.isDirty) return;

          // For live editor sessions, only hydrate once and then keep local state
          // as the source of truth until the document changes.
          if (syncPolicy === 'once' && currentDocument) return;

          // Initialize document state. `editor` is optional here so external editors
          // can still participate in the shared autosave/export flow.
          this.#get().initDocumentWithEditor({
            autoSave,
            content: document.content,
            documentId,
            editor,
            editorData: document.editorData,
            lastUpdatedTime: document.updatedAt,
            spaceId: document.spaceId,
            sourceType,
          });
        },
        revalidateIfStale,
        revalidateOnFocus,
        revalidateOnReconnect,
      },
    );
  };
}

export type DocumentAction = Pick<DocumentActionImpl, keyof DocumentActionImpl>;
