import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import type { ToastType } from '../components/ui/Toast';
import { resourceApi, sourceSetApi } from '../lib/api';
import { haptics } from '../lib/haptics';
import { moveFilesBetweenSourceSets } from '../lib/resourceSourceSet';
import type { FileListItem } from '../types';

interface ResourceSourceSetMessages {
  addToSourceSetExists: string;
  addToSourceSetFailed: string;
  addToSourceSetSuccess: string;
  cancel: string;
  delete: string;
  deleteFailed: string;
  errorNetwork: string;
  moveToSourceSetFailed: string;
  moveToSourceSetSuccess: string;
  removeFromSourceSetConfirm: string;
  removeFromSourceSetDesc: string;
  removeFromSourceSetFailed: string;
  removeFromSourceSetSuccess: string;
  renamed: string;
  renameFailed: string;
  sourceSetCreated: string;
  sourceSetDeleteConfirm: string;
  sourceSetDeleted: string;
  sourceSetDeleteDesc: string;
}

interface ResourceSourceSetToast {
  show: (type: ToastType, message: string) => void;
}

interface UseResourceSourceSetActionsProps {
  activateSourceSet: (nextSourceSetId: string | null, options?: { resetTree?: boolean }) => void;
  activeSpaceId: string | null;
  applyFileScope: (nextScope: 'all' | 'unassigned') => void;
  clearSelection: () => void;
  currentSourceSetName: string;
  loadSourceSets: () => Promise<void>;
  messages: ResourceSourceSetMessages;
  refreshResourceSurface: () => Promise<void>;
  removeSourceSetCache: (sourceSetId: string) => void;
  resourceItemsById: Map<string, FileListItem>;
  sourceSetId: string | null;
  toast: ResourceSourceSetToast;
}

function isSourceSetConflictError(error: unknown) {
  if (!error || typeof error !== 'object') return false;

  const maybeError = error as {
    data?: { code?: string };
    message?: string;
  };
  const message = maybeError.message ?? '';

  return (
    maybeError.data?.code === 'CONFLICT' ||
    message.includes('FILE_ALREADY_IN_SOURCE_SET') ||
    message.includes('FILE_ALREADY_IN_KNOWLEDGE_BASE')
  );
}

export function useResourceSourceSetActions({
  activateSourceSet,
  activeSpaceId,
  applyFileScope,
  clearSelection,
  currentSourceSetName,
  loadSourceSets,
  messages,
  refreshResourceSurface,
  removeSourceSetCache,
  resourceItemsById,
  sourceSetId,
  toast,
}: UseResourceSourceSetActionsProps) {
  const [sourceSetNameDraft, setSourceSetNameDraft] = useState('');
  const [sourceSetNameMode, setSourceSetNameMode] = useState<'create' | 'rename'>('create');
  const [sourceSetNameModalVisible, setSourceSetNameModalVisible] = useState(false);
  const [sourceSetActionVisible, setSourceSetActionVisible] = useState(false);
  const [sourceSetActionMode, setSourceSetActionMode] = useState<'add' | 'move'>('add');
  const [sourceSetActionIds, setSourceSetActionIds] = useState<string[]>([]);
  const [sourceSetActionSubmitting, setSourceSetActionSubmitting] = useState(false);
  const [sourceSetSharingMenuVisible, setSourceSetSharingMenuVisible] = useState(false);

  const openSourceSetManagement = useCallback(() => {
    if (!sourceSetId) return;
    setSourceSetSharingMenuVisible(true);
  }, [sourceSetId]);

  const closeSourceSetSharingMenu = useCallback(() => setSourceSetSharingMenuVisible(false), []);

  const openCreateSourceSetModal = useCallback(() => {
    setSourceSetNameMode('create');
    setSourceSetNameDraft('');
    setSourceSetNameModalVisible(true);
  }, []);

  const openRenameSourceSetModal = useCallback(() => {
    if (!sourceSetId) return;

    setSourceSetNameMode('rename');
    setSourceSetNameDraft(currentSourceSetName);
    setSourceSetSharingMenuVisible(false);
    setSourceSetNameModalVisible(true);
  }, [currentSourceSetName, sourceSetId]);

  const closeSourceSetNameModal = useCallback(() => setSourceSetNameModalVisible(false), []);

  const handleSubmitSourceSetName = useCallback(
    async (value: string) => {
      const name = value.trim();
      if (!name) return;

      setSourceSetNameModalVisible(false);

      try {
        if (sourceSetNameMode === 'create') {
          const createdId = await sourceSetApi.create({
            name,
            ...(activeSpaceId ? { spaceId: activeSpaceId } : {}),
          });

          if (!createdId) {
            toast.show('error', messages.errorNetwork);
            return;
          }

          await loadSourceSets();
          activateSourceSet(createdId, { resetTree: true });
          haptics.success();
          toast.show('success', messages.sourceSetCreated);
          return;
        }

        if (!sourceSetId) return;

        await sourceSetApi.update(sourceSetId, { name });
        await loadSourceSets();
        haptics.success();
        toast.show('success', messages.renamed);
      } catch {
        toast.show(
          'error',
          sourceSetNameMode === 'create' ? messages.errorNetwork : messages.renameFailed,
        );
      }
    },
    [
      activeSpaceId,
      activateSourceSet,
      loadSourceSets,
      messages.errorNetwork,
      messages.renameFailed,
      messages.renamed,
      messages.sourceSetCreated,
      sourceSetId,
      sourceSetNameMode,
      toast,
    ],
  );

  const handleDeleteSourceSet = useCallback(() => {
    if (!sourceSetId) return;

    Alert.alert(messages.sourceSetDeleteConfirm, messages.sourceSetDeleteDesc, [
      { text: messages.cancel, style: 'cancel' },
      {
        text: messages.delete,
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await sourceSetApi.remove(sourceSetId, false);
              await loadSourceSets();
              removeSourceSetCache(sourceSetId);
              applyFileScope('all');
              haptics.success();
              toast.show('success', messages.sourceSetDeleted);
            } catch {
              toast.show('error', messages.deleteFailed);
            }
          })();
        },
      },
    ]);
  }, [
    applyFileScope,
    loadSourceSets,
    messages.cancel,
    messages.delete,
    messages.deleteFailed,
    messages.sourceSetDeleteConfirm,
    messages.sourceSetDeleteDesc,
    messages.sourceSetDeleted,
    removeSourceSetCache,
    sourceSetId,
    toast,
  ]);

  const openSourceSetAction = useCallback((ids: string[], mode: 'add' | 'move') => {
    if (ids.length === 0) return;
    setSourceSetActionIds(ids);
    setSourceSetActionMode(mode);
    setSourceSetActionVisible(true);
  }, []);

  const closeSourceSetAction = useCallback(() => {
    if (sourceSetActionSubmitting) return;
    setSourceSetActionVisible(false);
    setSourceSetActionIds([]);
  }, [sourceSetActionSubmitting]);

  const handleRemoveFromSourceSet = useCallback(
    (ids: string[]) => {
      if (!sourceSetId || ids.length === 0) return;

      Alert.alert(
        messages.removeFromSourceSetConfirm,
        messages.removeFromSourceSetDesc.replace('{count}', String(ids.length)),
        [
          { text: messages.cancel, style: 'cancel' },
          {
            text: messages.delete,
            style: 'destructive',
            onPress: () => {
              void (async () => {
                try {
                  await sourceSetApi.removeFiles(sourceSetId, ids);
                  clearSelection();
                  await refreshResourceSurface();
                  haptics.success();
                  toast.show('success', messages.removeFromSourceSetSuccess);
                } catch {
                  toast.show('error', messages.removeFromSourceSetFailed);
                }
              })();
            },
          },
        ],
      );
    },
    [
      clearSelection,
      messages.cancel,
      messages.delete,
      messages.removeFromSourceSetConfirm,
      messages.removeFromSourceSetDesc,
      messages.removeFromSourceSetFailed,
      messages.removeFromSourceSetSuccess,
      refreshResourceSurface,
      sourceSetId,
      toast,
    ],
  );

  const handleSelectSourceSetTarget = useCallback(
    async (targetSourceSetId: string) => {
      if (sourceSetActionSubmitting || sourceSetActionIds.length === 0) return;

      setSourceSetActionSubmitting(true);

      try {
        if (sourceSetActionMode === 'move' && sourceSetId) {
          await moveFilesBetweenSourceSets(
            {
              currentSourceSetId: sourceSetId,
              ids: sourceSetActionIds,
              resourceItemsById,
              targetSourceSetId,
            },
            {
              addFiles: sourceSetApi.addFiles,
              moveResourceToRoot: (id, kind) => resourceApi.moveResource(id, null, kind),
              removeFiles: sourceSetApi.removeFiles,
            },
          );
        } else {
          await sourceSetApi.addFiles(targetSourceSetId, sourceSetActionIds);
        }
        setSourceSetActionVisible(false);
        setSourceSetActionIds([]);
        clearSelection();
        await refreshResourceSurface();
        haptics.success();
        toast.show(
          'success',
          sourceSetActionMode === 'move'
            ? messages.moveToSourceSetSuccess
            : messages.addToSourceSetSuccess,
        );
      } catch (error) {
        const hasConflict = isSourceSetConflictError(error);

        toast.show(
          hasConflict ? 'info' : 'error',
          hasConflict
            ? messages.addToSourceSetExists
            : sourceSetActionMode === 'move'
              ? messages.moveToSourceSetFailed
              : messages.addToSourceSetFailed,
        );
      } finally {
        setSourceSetActionSubmitting(false);
      }
    },
    [
      clearSelection,
      messages.addToSourceSetExists,
      messages.addToSourceSetFailed,
      messages.addToSourceSetSuccess,
      messages.moveToSourceSetFailed,
      messages.moveToSourceSetSuccess,
      refreshResourceSurface,
      resourceItemsById,
      sourceSetActionIds,
      sourceSetActionMode,
      sourceSetActionSubmitting,
      sourceSetId,
      toast,
    ],
  );

  return {
    closeSourceSetAction,
    closeSourceSetNameModal,
    closeSourceSetSharingMenu,
    handleDeleteSourceSet,
    handleRemoveFromSourceSet,
    handleSelectSourceSetTarget,
    handleSubmitSourceSetName,
    openCreateSourceSetModal,
    openRenameSourceSetModal,
    openSourceSetAction,
    openSourceSetManagement,
    sourceSetActionMode,
    sourceSetActionSubmitting,
    sourceSetActionVisible,
    sourceSetNameDraft,
    sourceSetNameModalVisible,
    sourceSetNameMode,
    sourceSetSharingMenuVisible,
  };
}
