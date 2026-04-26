import { EDITOR_DEBOUNCE_TIME, EDITOR_MAX_WAIT } from '@lobechat/const';
import debug from 'debug';
import { debounce } from 'es-toolkit/compat';
import { type StateCreator } from 'zustand';

import { documentService } from '@/services/document';
import { usePageStore } from '@/store/docs';
import { useDocumentStore } from '@/store/document';
import { useFileStore } from '@/store/file';
import { getPageDetailPath, getPageKindFromDocument } from '@/utils/docs';

import { type State } from './initialState';
import { initialState } from './initialState';

const log = debug('page:editor');

interface MetaSaveSnapshot {
  documentId?: string;
  emoji?: string;
  lastSavedEmoji?: string;
  lastSavedTitle?: string;
  title?: string;
}

export interface Action {
  flushMetaSave: () => void;
  handleCopyLink: (t: (key: string) => string, message: any) => Promise<void>;
  handleDelete: (
    t: (key: string) => string,
    message: any,
    modal: any,
    onDeleteCallback?: () => void,
  ) => Promise<void>;
  handleTitleSubmit: () => Promise<void>;
  initMeta: (title?: string, emoji?: string) => void;
  performMetaSave: (snapshot?: MetaSaveSnapshot) => Promise<void>;
  setEmoji: (emoji: string | undefined) => void;
  setTitle: (title: string) => void;
  setViewMode: (viewMode: State['viewMode']) => void;
  triggerDebouncedMetaSave: () => void;
}

export type Store = State & Action;

export const store: (initState?: Partial<State>) => StateCreator<Store> =
  (initState) => (set, get) => {
    // Debounced save function for meta (title/emoji)
    let debouncedMetaSave: ReturnType<typeof debounce> | null = null;

    const getOrCreateDebouncedMetaSave = () => {
      if (!debouncedMetaSave) {
        debouncedMetaSave = debounce(
          async (snapshot: MetaSaveSnapshot) => {
            try {
              await get().performMetaSave(snapshot);
            } catch (error) {
              console.error('[PageEditor] Failed to auto-save meta:', error);
            }
          },
          EDITOR_DEBOUNCE_TIME,
          { leading: false, maxWait: EDITOR_MAX_WAIT, trailing: true },
        );
      }
      return debouncedMetaSave;
    };

    return {
      ...initialState,
      ...initState,

      flushMetaSave: () => {
        debouncedMetaSave?.flush();
      },

      handleCopyLink: async (t, message) => {
        const { documentId } = get();
        if (!documentId) return;

        const debugProxyBase = '/_dangerous_local_dev_proxy';
        const spaBase =
          window.__DEBUG_PROXY__ || window.location.pathname.startsWith(debugProxyBase)
            ? debugProxyBase
            : '';

        const document = usePageStore.getState().documents?.find((doc) => doc.id === documentId);
        const pagePath = getPageDetailPath(
          documentId,
          getPageKindFromDocument(document),
          document?.spaceId,
        );
        const url = `${window.location.origin}${spaBase}${pagePath}`;

        try {
          await navigator.clipboard.writeText(url);
          message.success(t('docEditor.linkCopied'));
        } catch (error) {
          console.error('[PageEditor] Failed to copy link:', error);
          message.error(t('docEditor.linkCopyError'));
        }
      },

      handleDelete: async (t, message, modal, onDeleteCallback) => {
        const { documentId } = get();
        if (!documentId) return;

        return new Promise((resolve, reject) => {
          modal.confirm({
            cancelText: t('cancel'),
            content: t('docEditor.deleteConfirm.content'),
            okButtonProps: { danger: true },
            okText: t('delete'),
            onOk: async () => {
              try {
                const { removeDocument } = useFileStore.getState();
                await removeDocument(documentId);
                message.success(t('docEditor.deleteSuccess'));
                onDeleteCallback?.();
                resolve();
              } catch (error) {
                log('Failed to delete page:', error);
                message.error(t('docEditor.deleteError'));
                reject(error);
              }
            },
            title: t('docEditor.deleteConfirm.title'),
          });
        });
      },

      handleTitleSubmit: async () => {
        const { editor, flushMetaSave } = get();

        // Flush pending save and focus editor
        flushMetaSave();
        editor?.focus();
      },

      initMeta: (title, emoji) => {
        set({
          emoji,
          isMetaDirty: false,
          lastSavedEmoji: emoji,
          lastSavedTitle: title,
          metaSaveStatus: 'idle',
          title,
        });
      },

      performMetaSave: async (snapshot?: MetaSaveSnapshot) => {
        const state = get();
        const documentId = snapshot?.documentId ?? state.documentId;
        const title = snapshot?.title ?? state.title;
        const emoji = snapshot ? snapshot.emoji : state.emoji;
        const lastSavedTitle = snapshot?.lastSavedTitle ?? state.lastSavedTitle;
        const lastSavedEmoji = snapshot?.lastSavedEmoji ?? state.lastSavedEmoji;
        const { isMetaDirty, onTitleChange, onEmojiChange } = state;
        const isCurrentDocument = state.documentId === documentId;

        if (!documentId || (!snapshot && !isMetaDirty)) return;

        if (isCurrentDocument) {
          set({ metaSaveStatus: 'saving' });
        }

        try {
          const currentDocument = usePageStore
            .getState()
            .documents?.find((document) => document.id === documentId);
          const needsEmojiSync = emoji !== lastSavedEmoji;
          let baseMetadata = currentDocument?.metadata as Record<string, any> | undefined;

          if (!baseMetadata && needsEmojiSync) {
            const remoteDocument = await documentService.getDocumentById(documentId);
            baseMetadata = remoteDocument?.metadata as Record<string, any> | undefined;
          }

          let nextMetadata: Record<string, any> | undefined = undefined;

          if (baseMetadata || needsEmojiSync) {
            nextMetadata = { ...baseMetadata };

            if (emoji === undefined) {
              delete nextMetadata.emoji;
            } else {
              nextMetadata.emoji = emoji;
            }
          }

          const documentStore = useDocumentStore.getState();
          const hasDocumentState = !!documentStore.documents[documentId];

          // Trigger save via DocumentStore with metadata
          if (hasDocumentState) {
            await documentStore.performSave(documentId, {
              metadata: nextMetadata,
              title,
            });
          } else {
            await documentService.updateDocument({
              id: documentId,
              ...(nextMetadata !== undefined ? { metadata: nextMetadata } : {}),
              title,
            });
          }

          // Notify parent after successful save
          if (title !== lastSavedTitle) {
            onTitleChange?.(title || '');
          }
          if (emoji !== lastSavedEmoji) {
            onEmojiChange?.(emoji);
          }

          if (get().documentId === documentId) {
            set({
              isMetaDirty: false,
              lastSavedEmoji: emoji,
              lastSavedTitle: title,
              metaSaveStatus: 'saved',
            });
          }
        } catch (error) {
          console.error('[PageEditor] Failed to save meta:', error);
          if (get().documentId === documentId) {
            set({ metaSaveStatus: 'idle' });
          }
          throw error;
        }
      },

      setEmoji: (emoji: string | undefined) => {
        const { lastSavedEmoji, triggerDebouncedMetaSave } = get();

        const isDirty = emoji !== lastSavedEmoji;
        set({ emoji, isMetaDirty: isDirty });

        if (isDirty) {
          triggerDebouncedMetaSave();
        }
      },

      setTitle: (title: string) => {
        const { lastSavedTitle, triggerDebouncedMetaSave } = get();

        const isDirty = title !== lastSavedTitle;
        set({ isMetaDirty: isDirty, title });

        if (isDirty) {
          triggerDebouncedMetaSave();
        }
      },

      setViewMode: (viewMode) => {
        set({ viewMode });
      },

      triggerDebouncedMetaSave: () => {
        const save = getOrCreateDebouncedMetaSave();
        const { documentId, emoji, lastSavedEmoji, lastSavedTitle, title } = get();

        save({
          documentId,
          emoji,
          lastSavedEmoji,
          lastSavedTitle,
          title,
        });
      },
    };
  };
