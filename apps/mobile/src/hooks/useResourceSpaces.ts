import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { type FolderCrumb, resourceApi, spaceApi, spaceMemoryApi } from '../lib/api';
import {
  canReviewMobileSpaceMemorySummary,
  getMobilePendingGovernanceCountFromSummary,
  getMobilePendingGovernanceTargetFromSummary,
} from '../lib/spaceMemorySummary';
import type { MobileSpaceItem, MobileSpaceMemorySummary } from '../types';

const RESOURCE_ACTIVE_SPACE_STORAGE_KEY = 'resource_active_space_id';

interface UseResourceSpacesProps {
  activeSpaceId: string | null;
  currentFolderSlug: string | null;
  effectiveSpaceId?: string;
  setActiveSpaceId: React.Dispatch<React.SetStateAction<string | null>>;
  setFolderBreadcrumb: React.Dispatch<React.SetStateAction<FolderCrumb[]>>;
  showToast: (type: 'error' | 'info' | 'success', message: string) => void;
  workspaceLoadFailedMessage: string;
}

export function useResourceSpaces({
  activeSpaceId,
  currentFolderSlug,
  effectiveSpaceId,
  setActiveSpaceId,
  setFolderBreadcrumb,
  showToast,
  workspaceLoadFailedMessage,
}: UseResourceSpacesProps) {
  const [spaces, setSpaces] = useState<MobileSpaceItem[]>([]);
  const [spacesResolved, setSpacesResolved] = useState(false);
  const [currentSpaceMemorySummary, setCurrentSpaceMemorySummary] =
    useState<MobileSpaceMemorySummary | null>(null);
  const currentSpaceMemoryRequestRef = useRef(0);

  const currentSpace = useMemo(
    () => spaces.find((space) => space.id === activeSpaceId) ?? null,
    [activeSpaceId, spaces],
  );
  const currentSpacePendingGovernanceCount = useMemo(
    () => getMobilePendingGovernanceCountFromSummary(currentSpaceMemorySummary),
    [currentSpaceMemorySummary],
  );
  const currentSpacePendingGovernanceTarget = useMemo(
    () => getMobilePendingGovernanceTargetFromSummary(currentSpaceMemorySummary),
    [currentSpaceMemorySummary],
  );
  const currentSpaceCanReviewMemory = useMemo(
    () => canReviewMobileSpaceMemorySummary(currentSpaceMemorySummary),
    [currentSpaceMemorySummary],
  );
  const showCurrentSpaceMemoryShortcut =
    currentSpace?.kind === 'team' &&
    (currentSpacePendingGovernanceCount > 0 ||
      (!!currentSpaceMemorySummary && !currentSpaceCanReviewMemory));

  const loadSpaces = useCallback(async () => {
    try {
      const list = await spaceApi.list();
      const nextSpaces = list ?? [];
      const persistedSpaceId = await AsyncStorage.getItem(RESOURCE_ACTIVE_SPACE_STORAGE_KEY).catch(
        () => null,
      );
      setSpaces(nextSpaces);
      setActiveSpaceId((current) => {
        if (current && nextSpaces.some((space) => space.id === current)) return current;
        if (persistedSpaceId && nextSpaces.some((space) => space.id === persistedSpaceId)) {
          return persistedSpaceId;
        }

        return (
          nextSpaces.find((space) => space.kind === 'personal')?.id ?? nextSpaces[0]?.id ?? null
        );
      });
    } catch {
      setSpaces([]);
      setActiveSpaceId(null);
      showToast('error', workspaceLoadFailedMessage);
    } finally {
      setSpacesResolved(true);
    }
  }, [setActiveSpaceId, showToast, workspaceLoadFailedMessage]);

  const loadFolderBreadcrumb = useCallback(
    async (slug: string, spaceId?: string) => {
      try {
        const chain = await resourceApi.getFolderBreadcrumb(slug, spaceId);
        setFolderBreadcrumb(chain ?? []);
      } catch {
        setFolderBreadcrumb([]);
      }
    },
    [setFolderBreadcrumb],
  );

  const refreshCurrentSpaceMemorySummary = useCallback(async () => {
    const requestId = currentSpaceMemoryRequestRef.current + 1;
    currentSpaceMemoryRequestRef.current = requestId;

    if (currentSpace?.kind !== 'team') {
      setCurrentSpaceMemorySummary(null);
      return;
    }

    const summary = await spaceMemoryApi.getSummary(currentSpace.id).catch(() => null);
    if (currentSpaceMemoryRequestRef.current !== requestId) return;
    setCurrentSpaceMemorySummary(summary);
  }, [currentSpace?.id, currentSpace?.kind]);

  useEffect(() => {
    void loadSpaces();
  }, [loadSpaces]);

  useEffect(() => {
    void refreshCurrentSpaceMemorySummary();
  }, [refreshCurrentSpaceMemorySummary]);

  useEffect(() => {
    if (!spacesResolved) return;

    if (!activeSpaceId) {
      void AsyncStorage.removeItem(RESOURCE_ACTIVE_SPACE_STORAGE_KEY).catch(() => {});
      return;
    }

    void AsyncStorage.setItem(RESOURCE_ACTIVE_SPACE_STORAGE_KEY, activeSpaceId).catch(() => {});
  }, [activeSpaceId, spacesResolved]);

  useEffect(() => {
    if (currentFolderSlug) {
      void loadFolderBreadcrumb(currentFolderSlug, effectiveSpaceId);
      return;
    }

    setFolderBreadcrumb([]);
  }, [currentFolderSlug, effectiveSpaceId, loadFolderBreadcrumb, setFolderBreadcrumb]);

  return {
    currentSpace,
    currentSpaceCanReviewMemory,
    currentSpaceMemorySummary,
    currentSpacePendingGovernanceCount,
    currentSpacePendingGovernanceTarget,
    loadFolderBreadcrumb,
    loadSpaces,
    refreshCurrentSpaceMemorySummary,
    showCurrentSpaceMemoryShortcut,
    spaces,
    spacesResolved,
  };
}
