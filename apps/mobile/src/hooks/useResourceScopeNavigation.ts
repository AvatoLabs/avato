import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { FolderCrumb } from '../lib/api';
import { clearResourceListCache } from '../lib/resourceListCache';
import {
  shouldFallbackSourceSetScope,
  type SourceSetDirectoryStatus,
} from '../lib/resourceSourceSet';
import type { FileListItem, SourceSetItem } from '../types';

type FileScopeMode = 'all' | 'unassigned';
type ScopeMode = 'tree' | 'files';
type ScopeLauncherTab = 'spaces' | 'sources';

interface SourceSetTreeCacheEntry {
  currentFolderId: string | null;
  currentFolderSlug: string | null;
  treeChildrenByParent: Record<string, FileListItem[]>;
  treeExpandedIds: string[];
}

interface UseResourceScopeNavigationProps {
  allSourceSets: SourceSetItem[];
  setTreeChildrenByParent: React.Dispatch<React.SetStateAction<Record<string, FileListItem[]>>>;
  setTreeExpandedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  sourceSetDirectoryStatus: SourceSetDirectoryStatus;
  treeChildrenByParent: Record<string, FileListItem[]>;
  treeExpandedIds: Set<string>;
}

export function useResourceScopeNavigation({
  allSourceSets,
  sourceSetDirectoryStatus,
  treeChildrenByParent,
  treeExpandedIds,
  setTreeChildrenByParent,
  setTreeExpandedIds,
}: UseResourceScopeNavigationProps) {
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);
  const [sourceSetId, setSourceSetId] = useState<string | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [currentFolderSlug, setCurrentFolderSlug] = useState<string | null>(null);
  const [folderBreadcrumb, setFolderBreadcrumb] = useState<FolderCrumb[]>([]);
  const [scopeLauncherVisible, setScopeLauncherVisible] = useState(false);
  const [scopeLauncherTab, setScopeLauncherTab] = useState<ScopeLauncherTab>('spaces');
  const [fileScope, setFileScope] = useState<FileScopeMode>('all');
  const [scopeMode, setScopeMode] = useState<ScopeMode>('files');
  const [pendingSourceSetSelectionId, setPendingSourceSetSelectionId] = useState<string | null>(
    null,
  );
  const sourceSetTreeCacheRef = useRef<Record<string, SourceSetTreeCacheEntry>>({});
  const sourceSets = useMemo(
    () =>
      allSourceSets.filter((item) =>
        activeSpaceId ? (item.spaceId ?? null) === activeSpaceId : true,
      ),
    [activeSpaceId, allSourceSets],
  );

  const isSourceSetScope = sourceSetId !== null;
  const isUnassignedScope = !isSourceSetScope && fileScope === 'unassigned';
  const isAllFilesScope = !isSourceSetScope && fileScope === 'all';

  const closeScopeLauncher = useCallback(() => setScopeLauncherVisible(false), []);

  const openScopeLauncher = useCallback(
    (nextTab?: ScopeLauncherTab) => {
      setScopeLauncherTab(nextTab ?? (sourceSetId || isUnassignedScope ? 'sources' : 'spaces'));
      setScopeLauncherVisible(true);
    },
    [isUnassignedScope, sourceSetId],
  );

  const resetSourceSetNavigation = useCallback(() => {
    setCurrentFolderId(null);
    setCurrentFolderSlug(null);
    setTreeChildrenByParent({});
    setTreeExpandedIds(new Set());
    setFolderBreadcrumb([]);
    clearResourceListCache();
  }, [setTreeChildrenByParent, setTreeExpandedIds]);

  const applyFileScope = useCallback(
    (nextScope: FileScopeMode) => {
      setFileScope(nextScope);
      setScopeMode('files');
      setSourceSetId(null);
      resetSourceSetNavigation();
    },
    [resetSourceSetNavigation],
  );

  useEffect(() => {
    if (
      !shouldFallbackSourceSetScope({
        pendingSourceSetSelectionId,
        sourceSetDirectoryStatus,
        sourceSetId,
        sourceSets,
      })
    ) {
      return;
    }

    applyFileScope('all');
  }, [
    applyFileScope,
    pendingSourceSetSelectionId,
    sourceSetDirectoryStatus,
    sourceSetId,
    sourceSets,
  ]);

  const activateSourceSet = useCallback(
    (nextSourceSetId: string | null, options?: { resetTree?: boolean }) => {
      if (sourceSetId) {
        sourceSetTreeCacheRef.current[sourceSetId] = {
          currentFolderId,
          currentFolderSlug,
          treeChildrenByParent,
          treeExpandedIds: [...treeExpandedIds],
        };
      }

      if (!nextSourceSetId) {
        applyFileScope('all');
        return;
      }

      setFileScope('all');
      setSourceSetId(nextSourceSetId);
      setScopeMode('tree');

      if (options?.resetTree) {
        delete sourceSetTreeCacheRef.current[nextSourceSetId];
        resetSourceSetNavigation();
        return;
      }

      const cached = sourceSetTreeCacheRef.current[nextSourceSetId];
      if (!cached) {
        resetSourceSetNavigation();
        return;
      }

      setCurrentFolderId(cached.currentFolderId);
      setCurrentFolderSlug(cached.currentFolderSlug);
      setTreeChildrenByParent(cached.treeChildrenByParent);
      setTreeExpandedIds(new Set(cached.treeExpandedIds));
      if (!cached.currentFolderSlug) setFolderBreadcrumb([]);
      clearResourceListCache();
    },
    [
      applyFileScope,
      currentFolderId,
      currentFolderSlug,
      resetSourceSetNavigation,
      setTreeChildrenByParent,
      setTreeExpandedIds,
      sourceSetId,
      treeChildrenByParent,
      treeExpandedIds,
    ],
  );

  const switchToSourceSet = useCallback(
    (target: SourceSetItem) => {
      if (target.spaceId && target.spaceId !== activeSpaceId) {
        setPendingSourceSetSelectionId(target.id);
        setFileScope('all');
        setSourceSetId(null);
        resetSourceSetNavigation();
        setActiveSpaceId(target.spaceId);
        return;
      }

      activateSourceSet(target.id);
      closeScopeLauncher();
    },
    [activeSpaceId, activateSourceSet, closeScopeLauncher, resetSourceSetNavigation],
  );

  useEffect(() => {
    if (!pendingSourceSetSelectionId) return;
    if (!sourceSets.some((item) => item.id === pendingSourceSetSelectionId)) return;

    activateSourceSet(pendingSourceSetSelectionId);
    setPendingSourceSetSelectionId(null);
    closeScopeLauncher();
  }, [activateSourceSet, closeScopeLauncher, pendingSourceSetSelectionId, sourceSets]);

  const applySpaceSelection = useCallback(
    (spaceId: string) => {
      setActiveSpaceId(spaceId);
      applyFileScope('all');
      setScopeLauncherVisible(false);
    },
    [applyFileScope],
  );

  const removeSourceSetCache = useCallback((nextSourceSetId: string) => {
    delete sourceSetTreeCacheRef.current[nextSourceSetId];
  }, []);

  return {
    activateSourceSet,
    activeSpaceId,
    applyFileScope,
    applySpaceSelection,
    closeScopeLauncher,
    currentFolderId,
    currentFolderSlug,
    fileScope,
    folderBreadcrumb,
    isAllFilesScope,
    isSourceSetScope,
    isUnassignedScope,
    openScopeLauncher,
    pendingSourceSetSelectionId,
    removeSourceSetCache,
    resetSourceSetNavigation,
    scopeLauncherTab,
    scopeLauncherVisible,
    scopeMode,
    setActiveSpaceId,
    setCurrentFolderId,
    setCurrentFolderSlug,
    setFileScope,
    setFolderBreadcrumb,
    setPendingSourceSetSelectionId,
    setScopeLauncherTab,
    setScopeLauncherVisible,
    setScopeMode,
    setSourceSetId,
    sourceSetId,
    switchToSourceSet,
  };
}
