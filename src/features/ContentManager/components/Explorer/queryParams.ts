import { type ContentQueryParams } from '@/types/content';
import {
  type FileAssetClassification,
  type FileAssetReviewStatus,
  type FileAssetUsagePolicy,
  type FilesTabs,
  type SortType,
} from '@/types/files';
import { getSourceSetScopeId, type FileScope } from '@/features/ContentManager/useFileScope';

interface BuildExplorerQueryParamsOptions {
  assetClassification?: FileAssetClassification;
  assetRightsOwner?: string;
  assetReviewStatus?: FileAssetReviewStatus;
  assetUsagePolicy?: FileAssetUsagePolicy;
  category?: FilesTabs;
  currentFolderSlug?: string | null;
  scope?: FileScope;
  sorter?: 'createdAt' | 'name' | 'size';
  sortType?: SortType;
  sourceSetId?: string;
  spaceId?: string;
}

export const getExplorerCategoryFilter = (category?: FilesTabs, sourceSetId?: string) =>
  sourceSetId ? undefined : category;

export const isSpaceLevelContentFilter = (category?: FilesTabs) =>
  !!category && category !== 'all' && category !== 'home';

export function buildExplorerQueryParams({
  assetClassification,
  assetRightsOwner,
  assetReviewStatus,
  assetUsagePolicy,
  category,
  currentFolderSlug,
  scope = 'all',
  sourceSetId,
  sorter,
  sortType,
  spaceId,
}: BuildExplorerQueryParamsOptions): ContentQueryParams {
  const effectiveSourceSetId = sourceSetId ?? getSourceSetScopeId(scope);

  return {
    assetClassification,
    assetRightsOwner,
    assetReviewStatus,
    assetUsagePolicy,
    category: getExplorerCategoryFilter(category, effectiveSourceSetId ?? undefined),
    parentId:
      !effectiveSourceSetId && isSpaceLevelContentFilter(category)
        ? undefined
        : currentFolderSlug || null,
    showFilesInSourceSet: effectiveSourceSetId ? false : scope !== 'unassigned',
    sourceSetId: effectiveSourceSetId ?? undefined,
    spaceId,
    sortType,
    sorter,
  };
}
