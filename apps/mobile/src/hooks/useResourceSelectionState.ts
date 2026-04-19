import { useCallback, useState } from 'react';

import type { FileListItem } from '../types';

export function useResourceSelectionState() {
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [actionItem, setActionItem] = useState<FileListItem | null>(null);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  const toggleSelect = useCallback((item: FileListItem) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleEnterSelectMode = useCallback((item: FileListItem) => {
    setSelectMode(true);
    setSelectedIds(new Set([item.id]));
  }, []);

  const closeActionSheet = useCallback(() => setActionItem(null), []);
  const closeRenameModal = useCallback(() => setRenameModalVisible(false), []);

  const handleRenameStart = useCallback(() => {
    setActionItem((current) => {
      if (current) {
        setRenameValue(current.name || '');
        setRenameModalVisible(true);
      }

      return null;
    });
  }, []);

  const pruneSelectionState = useCallback((ids: string[]) => {
    if (ids.length === 0) return;

    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
    setActionItem((current) => (current && ids.includes(current.id) ? null : current));
  }, []);

  const replaceSelectionState = useCallback((nextItem: FileListItem, previousId?: string) => {
    const targetId = previousId ?? nextItem.id;

    setSelectedIds((prev) => {
      if (!prev.has(targetId) || targetId === nextItem.id) return prev;
      const next = new Set(prev);
      next.delete(targetId);
      next.add(nextItem.id);
      return next;
    });
    setActionItem((current) =>
      current && (current.id === targetId || current.id === nextItem.id) ? nextItem : current,
    );
  }, []);

  return {
    actionItem,
    clearSelection,
    closeActionSheet,
    closeRenameModal,
    handleEnterSelectMode,
    handleRenameStart,
    pruneSelectionState,
    renameModalVisible,
    renameValue,
    replaceSelectionState,
    selectMode,
    selectedIds,
    setActionItem,
    toggleSelect,
  };
}
