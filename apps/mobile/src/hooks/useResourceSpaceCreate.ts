import { useCallback, useState } from 'react';

import { spaceApi } from '../lib/api';
import { haptics } from '../lib/haptics';

interface ResourceSpaceCreateMessages {
  workspaceCreateCreated: string;
  workspaceCreateFailed: string;
}

interface UseResourceSpaceCreateProps {
  applyFileScope: (nextScope: 'all' | 'unassigned') => void;
  closeScopeLauncher: () => void;
  loadSpaces: () => Promise<void>;
  messages: ResourceSpaceCreateMessages;
  setActiveSpaceId: React.Dispatch<React.SetStateAction<string | null>>;
  showToast: (type: 'error' | 'info' | 'success', message: string) => void;
}

export function useResourceSpaceCreate({
  applyFileScope,
  closeScopeLauncher,
  loadSpaces,
  messages,
  setActiveSpaceId,
  showToast,
}: UseResourceSpaceCreateProps) {
  const [spaceCreateVisible, setSpaceCreateVisible] = useState(false);
  const [spaceCreateNameDraft, setSpaceCreateNameDraft] = useState('');
  const [spaceCreateDescriptionDraft, setSpaceCreateDescriptionDraft] = useState('');
  const [spaceCreateSubmitting, setSpaceCreateSubmitting] = useState(false);

  const openCreateSpaceModal = useCallback(() => {
    closeScopeLauncher();
    setSpaceCreateNameDraft('');
    setSpaceCreateDescriptionDraft('');
    setSpaceCreateVisible(true);
  }, [closeScopeLauncher]);

  const closeCreateSpaceModal = useCallback(() => {
    if (spaceCreateSubmitting) return;
    setSpaceCreateVisible(false);
  }, [spaceCreateSubmitting]);

  const handleCreateSpace = useCallback(async () => {
    const name = spaceCreateNameDraft.trim();
    const description = spaceCreateDescriptionDraft.trim();
    if (!name || spaceCreateSubmitting) return;

    setSpaceCreateSubmitting(true);

    try {
      const created = await spaceApi.create({
        ...(description ? { description } : {}),
        name,
      });
      await loadSpaces();
      setActiveSpaceId(created.id);
      applyFileScope('all');
      setSpaceCreateVisible(false);
      setSpaceCreateNameDraft('');
      setSpaceCreateDescriptionDraft('');
      haptics.success();
      showToast('success', messages.workspaceCreateCreated);
    } catch {
      showToast('error', messages.workspaceCreateFailed);
    } finally {
      setSpaceCreateSubmitting(false);
    }
  }, [
    applyFileScope,
    loadSpaces,
    messages.workspaceCreateCreated,
    messages.workspaceCreateFailed,
    setActiveSpaceId,
    showToast,
    spaceCreateDescriptionDraft,
    spaceCreateNameDraft,
    spaceCreateSubmitting,
  ]);

  return {
    closeCreateSpaceModal,
    handleCreateSpace,
    openCreateSpaceModal,
    setSpaceCreateDescriptionDraft,
    setSpaceCreateNameDraft,
    spaceCreateDescriptionDraft,
    spaceCreateNameDraft,
    spaceCreateSubmitting,
    spaceCreateVisible,
  };
}
