'use client';

import { memo, useEffect, useRef } from 'react';
import { createStoreUpdater } from 'zustand-utils';

import { useAgentStore } from '@/store/agent/store';
import { useChatStore } from '@/store/chat';
import { docsAgentRuntime } from '@/store/tool/slices/builtin/executors/lobe-docs-agent';

import { type PublicState } from './store';
import { usePageEditorStore, useStoreApi } from './store';

export interface StoreUpdaterProps extends Partial<PublicState> {
  pageId?: string;
}

/**
 * StoreUpdater syncs PageEditorStore props and connects to the Docs Agent runtime.
 *
 * Note: Document content loading is handled by EditorCanvas via DocumentStore.
 * Title/emoji are consumed from PageEditorStore (set via setCurrentTitle/setCurrentEmoji).
 */
const StoreUpdater = memo<StoreUpdaterProps>(
  ({
    pageId,
    pageKind,
    sourceSetId,
    onDocumentIdChange,
    onEmojiChange,
    onSave,
    onTitleChange,
    onDelete,
    onBack,
    parentId,
    title,
    emoji,
  }) => {
    const storeApi = useStoreApi();
    const useStoreUpdater = createStoreUpdater(storeApi);
    const previousPageIdRef = useRef<string | undefined>(undefined);
    const previousChatSelectionRef = useRef<{
      activeAgentId?: string;
      activeThreadId?: string | null;
      activeTopicId?: string | null;
    } | null>(null);

    const editor = usePageEditorStore((s) => s.editor);
    const initMeta = usePageEditorStore((s) => s.initMeta);

    // Update store with props
    useStoreUpdater('documentId', pageId);
    useStoreUpdater('sourceSetId', sourceSetId);
    useStoreUpdater('onDocumentIdChange', onDocumentIdChange);
    useStoreUpdater('onEmojiChange', onEmojiChange);
    useStoreUpdater('onSave', onSave);
    useStoreUpdater('onTitleChange', onTitleChange);
    useStoreUpdater('pageKind', pageKind);
    useStoreUpdater('onDelete', onDelete);
    useStoreUpdater('onBack', onBack);
    useStoreUpdater('parentId', parentId);

    useEffect(() => {
      if (!previousChatSelectionRef.current) {
        const chatState = useChatStore.getState();

        previousChatSelectionRef.current = {
          activeAgentId: chatState.activeAgentId,
          activeThreadId: chatState.activeThreadId,
          activeTopicId: chatState.activeTopicId ?? null,
        };
      }

      return () => {
        const previousChatSelection = previousChatSelectionRef.current;
        if (!previousChatSelection) return;

        useChatStore.setState(
          {
            activeAgentId: previousChatSelection.activeAgentId,
            activeThreadId: previousChatSelection.activeThreadId ?? undefined,
            activeTopicId: previousChatSelection.activeTopicId ?? (null as any),
          },
          false,
          'PageEditor/restoreChatSelection',
        );
        useAgentStore.getState().setActiveAgentId(previousChatSelection.activeAgentId);
      };
    }, []);

    // Initialize meta (title/emoji) with dirty tracking
    useEffect(() => {
      const state = storeApi.getState();
      const previousPageId = previousPageIdRef.current;
      const isPageChanged = previousPageId !== pageId;
      previousPageIdRef.current = pageId;

      if (isPageChanged) {
        initMeta(title, emoji);

        if (previousPageId !== undefined && previousPageId !== pageId) {
          void useChatStore.getState().switchTopic(null, {
            scope: 'doc',
            skipRefreshMessage: true,
          });
        }

        return;
      }

      if (state.isMetaDirty) return;

      const shouldHydrateLateTitle = state.lastSavedTitle === undefined && title !== undefined;
      const shouldHydrateLateEmoji = state.lastSavedEmoji === undefined && emoji !== undefined;

      if (shouldHydrateLateTitle || shouldHydrateLateEmoji) {
        initMeta(title, emoji);
      }
    }, [emoji, initMeta, pageId, storeApi, title]);

    // Connect editor to the Docs Agent runtime.
    useEffect(() => {
      if (editor) {
        docsAgentRuntime.setEditor(editor);
      }
      return () => {
        docsAgentRuntime.setEditor(null);
      };
    }, [editor]);

    // Connect title handlers and document ID to the Docs Agent runtime.
    useEffect(() => {
      const titleGetter = () => {
        return storeApi.getState().title || '';
      };

      docsAgentRuntime.setCurrentDocId(pageId);
      docsAgentRuntime.setTitleHandlers(storeApi.getState().setTitle, titleGetter);

      return () => {
        docsAgentRuntime.setCurrentDocId(undefined);
        docsAgentRuntime.setTitleHandlers(null, null);
      };
    }, [pageId, storeApi]);

    return null;
  },
);

export default StoreUpdater;
