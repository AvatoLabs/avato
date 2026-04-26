import type { RefObject } from 'react';
import { useCallback } from 'react';
import type { TextInput } from 'react-native';

import type { FolderCrumb, ResourceQueryParams } from '../lib/api';
import type { TranslationKeys } from '../lib/i18n';
import { areSameFileItems } from '../lib/resourceList';
import type { SourceSetDirectoryStatus } from '../lib/resourceSourceSet';
import { useConnectionStore } from '../store/connection';
import type { FileListItem, SourceSetItem } from '../types';
import { useResourceCollectionData } from './useResourceCollectionData';
import { useResourceCollectionQuery } from './useResourceCollectionQuery';
import { useResourceCollectionView } from './useResourceCollectionView';
import { useResourceContentEffects } from './useResourceContentEffects';
import type { UseResourceContentScreenProps } from './useResourceContentScreen';
import { useResourceContentSurfaceData } from './useResourceContentSurfaceData';

type FileCategory = 'all' | 'images' | 'documents' | 'others';
const ROOT_TREE_KEY = '__root__';

interface UseResourceContentDataFlowProps {
  clearOrigins: () => void;
  currentFolderId: string | null;
  currentFolderSlug: string | null;
  effectiveCategory?: FileCategory;
  effectiveSpaceId?: string;
  fileScope: 'all' | 'unassigned';
  folderBreadcrumb: FolderCrumb[];
  governanceFilterSummaryLabels: string[];
  handleMissingSourceSetFolderOpen: () => void;
  locale: string;
  navigation: UseResourceContentScreenProps['navigation'];
  previewItem: FileListItem | null;
  refreshCachedResources: () => Promise<void>;
  refreshCurrentSpaceMemorySummary: () => Promise<void>;
  releasedGovernanceFilters: Pick<
    ResourceQueryParams,
    'assetClassification' | 'assetReviewStatus' | 'assetRightsOwner' | 'assetUsagePolicy'
  >;
  route: UseResourceContentScreenProps['route'];
  scopeMode: 'tree' | 'files';
  searchInputRef: RefObject<TextInput | null>;
  searchText: string;
  searchVisible: boolean;
  setAllSourceSets: React.Dispatch<React.SetStateAction<SourceSetItem[]>>;
  setCurrentFolderId: React.Dispatch<React.SetStateAction<string | null>>;
  setCurrentFolderSlug: React.Dispatch<React.SetStateAction<string | null>>;
  setScopeMode: React.Dispatch<React.SetStateAction<'tree' | 'files'>>;
  setSourceSetDirectoryStatus: React.Dispatch<React.SetStateAction<SourceSetDirectoryStatus>>;
  setTreeChildrenByParent: React.Dispatch<React.SetStateAction<Record<string, FileListItem[]>>>;
  setTreeExpandedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  showSourceSetLoadError: () => void;
  sorter: 'createdAt' | 'name' | 'size';
  sortOrder: 'asc' | 'desc';
  sourceSetId: string | null;
  spacesResolved: boolean;
  t: TranslationKeys;
  treeChildrenByParent: Record<string, FileListItem[]>;
  treeExpandedIds: Set<string>;
}

export function useResourceContentDataFlow({
  clearOrigins,
  currentFolderId,
  currentFolderSlug,
  effectiveCategory,
  effectiveSpaceId,
  fileScope,
  folderBreadcrumb,
  governanceFilterSummaryLabels,
  handleMissingSourceSetFolderOpen,
  locale,
  navigation,
  previewItem,
  refreshCachedResources,
  refreshCurrentSpaceMemorySummary,
  releasedGovernanceFilters,
  route,
  searchInputRef,
  searchText,
  searchVisible,
  setAllSourceSets,
  setSourceSetDirectoryStatus,
  setCurrentFolderId,
  setCurrentFolderSlug,
  setScopeMode,
  setTreeChildrenByParent,
  setTreeExpandedIds,
  showSourceSetLoadError,
  sortOrder,
  sorter,
  sourceSetId,
  spacesResolved,
  scopeMode,
  t,
  treeChildrenByParent,
  treeExpandedIds,
}: UseResourceContentDataFlowProps) {
  const { resourceListQueryKey, resourceListQueryParams } = useResourceCollectionQuery({
    currentFolderId,
    currentFolderSlug,
    effectiveCategory: sourceSetId ? undefined : effectiveCategory,
    effectiveSpaceId,
    fileScope,
    isUnassignedScope: !sourceSetId && fileScope === 'unassigned',
    releasedGovernanceFilters,
    searchText,
    sortOrder,
    sorter,
    sourceSetId,
  });

  const syncVisibleTreeChildren = useCallback(
    (parentId: string | null, items: FileListItem[]) => {
      if (!sourceSetId || searchText.trim()) return;

      const treeKey = parentId ?? ROOT_TREE_KEY;

      setTreeChildrenByParent((prev) => {
        if (areSameFileItems(prev[treeKey], items)) return prev;

        return {
          ...prev,
          [treeKey]: items,
        };
      });
    },
    [searchText, setTreeChildrenByParent, sourceSetId],
  );

  const collectionData = useResourceCollectionData({
    currentFolderId,
    effectiveSpaceId,
    refreshCachedResources,
    releasedGovernanceFilters,
    resourceListQueryKey,
    resourceListQueryParams,
    scopeMode,
    setScopeMode,
    setTreeChildrenByParent,
    setTreeExpandedIds,
    sourceSetId,
    sorter,
    sortOrder,
    spacesResolved,
    syncVisibleTreeChildren,
    treeChildrenByParent,
  });

  const surfaceData = useResourceContentSurfaceData({
    apiBase: collectionData.apiBase,
    files: collectionData.files,
    governanceCapabilities: collectionData.governanceCapabilities,
    governanceFilterSummaryLabels,
    previewItem,
    setAllSourceSets,
    setSourceSetDirectoryStatus,
    showSourceSetLoadError,
    t,
    treeChildrenByParent,
  });

  useResourceContentEffects({
    activeSpaceId: effectiveSpaceId ?? null,
    clearOrigins,
    loadSourceSets: surfaceData.loadSourceSets,
    navigation,
    refreshCachedResources,
    refreshCurrentSpaceMemorySummary,
    searchInputRef,
    searchVisible,
    spacesResolved,
    triggerConnectionCheck: () => useConnectionStore.getState().checkConnection(),
  });

  const collectionView = useResourceCollectionView({
    currentFolderId,
    effectiveCategory,
    effectiveSpaceId,
    files: collectionData.files,
    folderBreadcrumb,
    hasMore: collectionData.hasMore,
    hasResolvedFiles: collectionData.hasResolvedFiles,
    loadFiles: collectionData.loadFiles,
    loadTreeChildren: collectionData.loadTreeChildren,
    loading: collectionData.loading,
    loadingMore: collectionData.loadingMore,
    locale,
    onMissingSourceSetFolderOpen: handleMissingSourceSetFolderOpen,
    releasedGovernanceFilters,
    resetListOffset: collectionData.resetListOffset,
    scopeMode,
    searchText,
    setCurrentFolderId,
    setCurrentFolderSlug,
    setTreeChildrenByParent,
    setTreeExpandedIds,
    sortOrder,
    sorter,
    sourceSetId,
    treeChildrenByParent,
    treeExpandedIds,
  });

  return {
    collectionData,
    collectionView,
    surfaceData,
  };
}

export type ResourceContentDataFlowResult = ReturnType<typeof useResourceContentDataFlow>;
