import { useCallback, useMemo } from 'react';

import { type FolderCrumb, resourceApi, type ResourceQueryParams } from '../lib/api';
import { matchesCategory, type ResourceCategory } from '../lib/resourceFile';
import { sortFileList } from '../lib/resourceList';
import type { FileListItem } from '../types';

const ROOT_TREE_KEY = '__root__';
const RESOURCE_TREE_PAGE_SIZE = 200;

interface ResourceTreeRow {
  depth: number;
  item: FileListItem;
}

const isFolder = (item: FileListItem) => item.fileType === 'custom/folder';

interface UseResourceCollectionViewProps {
  currentFolderId: string | null;
  effectiveCategory?: ResourceCategory;
  effectiveSpaceId?: string;
  files: FileListItem[];
  folderBreadcrumb: FolderCrumb[];
  hasMore: boolean;
  hasResolvedFiles: boolean;
  loadFiles: (silent?: boolean, append?: boolean) => Promise<void>;
  loading: boolean;
  loadingMore: boolean;
  loadTreeChildren: (parentId: string | null, force?: boolean) => Promise<void>;
  locale: string;
  onMissingSourceSetFolderOpen: () => void;
  releasedGovernanceFilters: Pick<
    ResourceQueryParams,
    'assetClassification' | 'assetReviewStatus' | 'assetRightsOwner' | 'assetUsagePolicy'
  >;
  resetListOffset: () => void;
  scopeMode: 'tree' | 'files';
  searchText: string;
  setCurrentFolderId: React.Dispatch<React.SetStateAction<string | null>>;
  setCurrentFolderSlug: React.Dispatch<React.SetStateAction<string | null>>;
  setTreeChildrenByParent: React.Dispatch<React.SetStateAction<Record<string, FileListItem[]>>>;
  setTreeExpandedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  sorter: 'createdAt' | 'name' | 'size';
  sortOrder: 'asc' | 'desc';
  sourceSetId: string | null;
  treeChildrenByParent: Record<string, FileListItem[]>;
  treeExpandedIds: Set<string>;
}

export function useResourceCollectionView({
  currentFolderId,
  effectiveCategory,
  effectiveSpaceId,
  files,
  folderBreadcrumb,
  hasMore,
  hasResolvedFiles,
  loadFiles,
  loadTreeChildren,
  loading,
  loadingMore,
  locale,
  releasedGovernanceFilters,
  resetListOffset,
  searchText,
  scopeMode,
  setCurrentFolderId,
  setCurrentFolderSlug,
  setTreeChildrenByParent,
  setTreeExpandedIds,
  sortOrder,
  sorter,
  sourceSetId,
  treeChildrenByParent,
  treeExpandedIds,
  onMissingSourceSetFolderOpen,
}: UseResourceCollectionViewProps) {
  const treeMode = sourceSetId !== null && scopeMode === 'tree' && !searchText.trim();

  const treeRows = useMemo(() => {
    if (!treeMode) return [];

    const rows: ResourceTreeRow[] = [];

    const walk = (parentId: string | null, depth: number) => {
      const treeKey = parentId ?? ROOT_TREE_KEY;
      const children = sortFileList(treeChildrenByParent[treeKey] ?? [], sorter, sortOrder, locale);

      for (const child of children) {
        const includeRow =
          isFolder(child) || !effectiveCategory || matchesCategory(child, effectiveCategory);
        if (includeRow) {
          rows.push({ depth, item: child });
        }

        if (isFolder(child) && treeExpandedIds.has(child.id)) {
          walk(child.id, depth + 1);
        }
      }
    };

    walk(null, 0);
    return rows;
  }, [
    effectiveCategory,
    locale,
    sortOrder,
    sorter,
    treeChildrenByParent,
    treeExpandedIds,
    treeMode,
  ]);

  const filtered = useMemo(
    () =>
      sortFileList(
        effectiveCategory
          ? files.filter((file) => matchesCategory(file, effectiveCategory))
          : files,
        sorter,
        sortOrder,
        locale,
      ),
    [effectiveCategory, files, locale, sortOrder, sorter],
  );

  const isCurrentListEmpty = treeMode ? treeRows.length === 0 : filtered.length === 0;
  const hasResolvedTreeRoot =
    treeMode && Object.prototype.hasOwnProperty.call(treeChildrenByParent, ROOT_TREE_KEY);
  const showInitialSkeleton = loading && !hasResolvedFiles && !hasResolvedTreeRoot;

  const handleFolderPress = useCallback(
    (item: FileListItem) => {
      resetListOffset();
      setCurrentFolderId(item.id);
      setCurrentFolderSlug(item.slug ?? item.id);
    },
    [resetListOffset, setCurrentFolderId, setCurrentFolderSlug],
  );

  const handleFolderPressResolved = useCallback(
    (item: FileListItem) => {
      if (!sourceSetId) {
        onMissingSourceSetFolderOpen();
        return;
      }

      handleFolderPress(item);
    },
    [handleFolderPress, onMissingSourceSetFolderOpen, sourceSetId],
  );

  const handleBreadcrumbPress = useCallback(
    (item: FolderCrumb, index: number) => {
      if (index === folderBreadcrumb.length - 1) return;
      resetListOffset();
      setCurrentFolderId(item.id);
      setCurrentFolderSlug(item.slug);
    },
    [folderBreadcrumb.length, resetListOffset, setCurrentFolderId, setCurrentFolderSlug],
  );

  const handleBackToRoot = useCallback(() => {
    resetListOffset();
    setCurrentFolderId(null);
    setCurrentFolderSlug(null);
  }, [resetListOffset, setCurrentFolderId, setCurrentFolderSlug]);

  const handleTreeChevronPress = useCallback(
    async (item: FileListItem) => {
      if (!isFolder(item)) return;

      const isExpanded = treeExpandedIds.has(item.id);
      if (isExpanded) {
        setTreeExpandedIds((prev) => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
        return;
      }

      setTreeExpandedIds((prev) => {
        const next = new Set(prev);
        next.add(item.id);
        return next;
      });
      await loadTreeChildren(item.id);
    },
    [loadTreeChildren, setTreeExpandedIds, treeExpandedIds],
  );

  const handleExpandAllTree = useCallback(async () => {
    if (!sourceSetId) return;

    const nextChildren: Record<string, FileListItem[]> = {};
    const expandedIds = new Set<string>();
    const queue: Array<string | null> = [null];

    while (queue.length > 0) {
      const parentId = queue.shift() ?? null;
      const treeKey = parentId ?? ROOT_TREE_KEY;

      let children = treeChildrenByParent[treeKey];
      if (!children) {
        const result = await resourceApi.getKnowledgeItems({
          ...releasedGovernanceFilters,
          sortType: sortOrder,
          sorter,
          sourceSetId,
          limit: RESOURCE_TREE_PAGE_SIZE,
          offset: 0,
          parentId,
          ...(effectiveSpaceId ? { spaceId: effectiveSpaceId } : {}),
        });
        children = sortFileList(result?.items ?? [], sorter, sortOrder, locale);
      }

      nextChildren[treeKey] = children;

      for (const child of children) {
        if (!isFolder(child)) continue;
        expandedIds.add(child.id);
        queue.push(child.id);
      }
    }

    setTreeChildrenByParent((prev) => ({ ...prev, ...nextChildren }));
    setTreeExpandedIds(expandedIds);
  }, [
    effectiveSpaceId,
    locale,
    releasedGovernanceFilters,
    setTreeChildrenByParent,
    setTreeExpandedIds,
    sortOrder,
    sorter,
    sourceSetId,
    treeChildrenByParent,
  ]);

  const handleCollapseAllTree = useCallback(() => {
    setTreeExpandedIds(new Set());
    setCurrentFolderId(null);
    setCurrentFolderSlug(null);
  }, [setCurrentFolderId, setCurrentFolderSlug, setTreeExpandedIds]);

  const handleLoadMore = useCallback(() => {
    if (!hasMore || loadingMore) return;
    void loadFiles(true, true);
  }, [hasMore, loadingMore, loadFiles]);

  return {
    filtered,
    handleBackToRoot,
    handleBreadcrumbPress,
    handleCollapseAllTree,
    handleExpandAllTree,
    handleFolderPressResolved,
    handleLoadMore,
    handleTreeChevronPress,
    hasResolvedTreeRoot,
    isCurrentListEmpty,
    showInitialSkeleton,
    treeMode,
    treeRows,
  };
}
