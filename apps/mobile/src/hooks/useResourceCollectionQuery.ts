import { useMemo } from 'react';

import { type ResourceQueryParams } from '../lib/api';

interface UseResourceCollectionQueryProps {
  currentFolderId: string | null;
  currentFolderSlug: string | null;
  effectiveCategory?: ResourceQueryParams['category'];
  effectiveSpaceId?: string;
  fileScope: 'all' | 'unassigned';
  isUnassignedScope: boolean;
  releasedGovernanceFilters: Pick<
    ResourceQueryParams,
    'assetClassification' | 'assetReviewStatus' | 'assetRightsOwner' | 'assetUsagePolicy'
  >;
  searchText: string;
  sorter: 'createdAt' | 'name' | 'size';
  sortOrder: 'asc' | 'desc';
  sourceSetId: string | null;
}

export function useResourceCollectionQuery({
  currentFolderId,
  currentFolderSlug,
  effectiveCategory,
  effectiveSpaceId,
  fileScope,
  isUnassignedScope,
  releasedGovernanceFilters,
  searchText,
  sortOrder,
  sorter,
  sourceSetId,
}: UseResourceCollectionQueryProps) {
  const resourceListQueryParams = useMemo(
    () => ({
      ...(effectiveCategory ? { category: effectiveCategory } : {}),
      ...releasedGovernanceFilters,
      sortType: sortOrder,
      sorter,
      showFilesInSourceSet: sourceSetId ? false : !isUnassignedScope,
      sourceSetId: sourceSetId ?? undefined,
      limit: 50,
      parentId: sourceSetId ? (currentFolderId ?? currentFolderSlug ?? null) : null,
      q: searchText.trim() || undefined,
      ...(effectiveSpaceId ? { spaceId: effectiveSpaceId } : {}),
    }),
    [
      currentFolderId,
      currentFolderSlug,
      effectiveCategory,
      effectiveSpaceId,
      isUnassignedScope,
      releasedGovernanceFilters,
      searchText,
      sortOrder,
      sorter,
      sourceSetId,
    ],
  );

  const resourceListQueryKey = useMemo(
    () =>
      JSON.stringify({
        category: effectiveCategory ?? null,
        fileScope,
        governance: releasedGovernanceFilters,
        parent: sourceSetId ? (currentFolderId ?? currentFolderSlug ?? null) : null,
        q: searchText.trim() || null,
        sortOrder,
        sorter,
        sourceSet: sourceSetId ?? null,
        space: effectiveSpaceId ?? null,
      }),
    [
      currentFolderId,
      currentFolderSlug,
      effectiveCategory,
      effectiveSpaceId,
      fileScope,
      releasedGovernanceFilters,
      searchText,
      sortOrder,
      sorter,
      sourceSetId,
    ],
  );

  return {
    resourceListQueryKey,
    resourceListQueryParams,
  };
}
