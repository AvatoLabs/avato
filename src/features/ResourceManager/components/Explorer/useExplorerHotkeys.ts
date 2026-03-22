'use client';

import { App } from 'antd';
import { createElement, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { clearTreeFolderCache } from '@/features/ResourceManager/components/LibraryHierarchy';
import { useResourceManagerStore } from '@/routes/(main)/resource/features/store';
import { documentService } from '@/services/document';
import { useFileStore } from '@/store/file';

interface UseExplorerHotkeysParams {
  /** IDs of all visible items in the current view, used for Ctrl+A */
  visibleItemIds: string[];
}

/**
 * Keyboard shortcuts for the resource explorer:
 * - Delete / Backspace  → delete selected files (with confirmation)
 * - F2                  → rename single selected file or folder
 * - Ctrl/Cmd + A        → select all visible items
 * - Escape              → clear selection
 */
export const useExplorerHotkeys = ({ visibleItemIds }: UseExplorerHotkeysParams) => {
  const { message, modal } = App.useApp();
  const { t } = useTranslation('components');

  const handleKeyDown = useCallback(
    async (e: KeyboardEvent) => {
      // Skip when user is typing in an input / textarea / contenteditable
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) {
        return;
      }

      const state = useResourceManagerStore.getState();

      // Only active in explorer mode (not editor / page mode)
      if (state.mode !== 'explorer') return;

      const isMod = e.ctrlKey || e.metaKey;

      // ── Ctrl/Cmd + A: select all ──────────────────────────
      if (isMod && e.key === 'a') {
        e.preventDefault();
        if (visibleItemIds.length > 0) {
          state.setSelectedFileIds(visibleItemIds);
        }
        return;
      }

      // ── Escape: clear selection ───────────────────────────
      if (e.key === 'Escape') {
        if (state.selectedFileIds.length > 0) {
          state.setSelectedFileIds([]);
        }
        return;
      }

      // ── F2: rename single selected item ───────────────────
      if (e.key === 'F2') {
        if (state.selectedFileIds.length === 1) {
          e.preventDefault();
          state.setPendingRenameItemId(state.selectedFileIds[0]);
        }
        return;
      }

      // ── Delete / Backspace: delete selected files ─────────
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const count = state.selectedFileIds.length;
        if (count === 0) return;
        e.preventDefault();

        const ids = [...state.selectedFileIds];
        const { resourceMap } = useFileStore.getState();

        // Check if ALL selected items are documents (non-folder) → undo toast
        const allDocuments = ids.every((id) => {
          const r = resourceMap.get(id);
          return r?.sourceType === 'document' && r?.fileType !== 'custom/folder';
        });

        if (allDocuments) {
          // Immediate optimistic delete + undo toast
          await state.onActionClick('delete');
          if (state.libraryId) await clearTreeFolderCache(state.libraryId);
          await useFileStore.getState().refreshFileList();

          const undoKey = `undo-batch-${Date.now()}`;
          const handleUndo = async () => {
            message.destroy(undoKey);
            try {
              await Promise.all(ids.map((id) => documentService.restoreDocument(id)));
              await useFileStore.getState().refreshFileList();
              message.success(t('FileManager.actions.undoSuccess'));
            } catch {
              message.error(t('FileManager.actions.restoreFailed'));
            }
          };

          message.open({
            content: createElement(
              'span',
              null,
              t('FileManager.actions.deleteSuccess'),
              ' ',
              createElement(
                'a',
                {
                  onClick: handleUndo,
                  style: { cursor: 'pointer', textDecoration: 'underline' },
                },
                t('FileManager.actions.undo'),
              ),
            ),
            duration: 5,
            key: undoKey,
            type: 'success',
          });
        } else {
          // Files / folders present → confirm modal (irreversible)
          modal.confirm({
            content:
              count === 1
                ? t('FileManager.actions.confirmDelete')
                : t('FileManager.actions.confirmDeleteMultiFiles', { count }),
            okButtonProps: { danger: true },
            onOk: async () => {
              await state.onActionClick('delete');
              if (state.libraryId) await clearTreeFolderCache(state.libraryId);
              await useFileStore.getState().refreshFileList();
              message.success(t('FileManager.actions.deleteSuccess'));
            },
          });
        }
      }
    },
    [visibleItemIds, message, modal, t],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
};
