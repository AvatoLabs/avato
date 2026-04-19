import { useCallback, useEffect, useState } from 'react';

import type { ToastType } from '../components/ui/Toast';
import { resourceApi, type TrashedDocumentItem } from '../lib/api';
import { haptics } from '../lib/haptics';
import { clearResourceListCache } from '../lib/resourceListCache';

interface ResourceTrashMessages {
  loadFailed: string;
  restored: string;
  restoreFailed: string;
}

interface ResourceTrashToast {
  show: (type: ToastType, message: string) => void;
}

interface UseResourceTrashProps {
  effectiveSpaceId?: string;
  loadFiles: (refresh?: boolean, append?: boolean) => Promise<void>;
  messages: ResourceTrashMessages;
  refreshTreeData: () => Promise<void>;
  sourceSetId: string | null;
  toast: ResourceTrashToast;
}

export function useResourceTrash({
  effectiveSpaceId,
  loadFiles,
  messages,
  refreshTreeData,
  sourceSetId,
  toast,
}: UseResourceTrashProps) {
  const [trashModalVisible, setTrashModalVisible] = useState(false);
  const [trashLoading, setTrashLoading] = useState(false);
  const [trashedDocuments, setTrashedDocuments] = useState<TrashedDocumentItem[]>([]);
  const [restoringTrashId, setRestoringTrashId] = useState<string | null>(null);

  const openTrash = useCallback(() => setTrashModalVisible(true), []);
  const closeTrash = useCallback(() => setTrashModalVisible(false), []);

  useEffect(() => {
    if (!trashModalVisible) return;
    let cancelled = false;

    void (async () => {
      setTrashLoading(true);

      try {
        const response = await resourceApi.queryTrashedDocuments({
          current: 0,
          pageSize: 100,
          ...(sourceSetId ? { sourceSetId } : {}),
          ...(effectiveSpaceId ? { spaceId: effectiveSpaceId } : {}),
        });

        if (!cancelled) setTrashedDocuments(response?.items ?? []);
      } catch {
        if (!cancelled) {
          setTrashedDocuments([]);
          toast.show('error', messages.loadFailed);
        }
      } finally {
        if (!cancelled) setTrashLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [effectiveSpaceId, messages.loadFailed, sourceSetId, toast, trashModalVisible]);

  const handleRestoreTrashed = useCallback(
    async (id: string) => {
      setRestoringTrashId(id);

      try {
        await resourceApi.restoreDocument(id);
        haptics.success();
        setTrashedDocuments((prev) => prev.filter((row) => row.id !== id));
        clearResourceListCache();
        await loadFiles(true);
        await refreshTreeData();
        toast.show('success', messages.restored);
      } catch {
        toast.show('error', messages.restoreFailed);
      } finally {
        setRestoringTrashId(null);
      }
    },
    [loadFiles, messages.restoreFailed, messages.restored, refreshTreeData, toast],
  );

  return {
    closeTrash,
    handleRestoreTrashed,
    openTrash,
    restoringTrashId,
    setTrashModalVisible,
    trashLoading,
    trashModalVisible,
    trashedDocuments,
  };
}
