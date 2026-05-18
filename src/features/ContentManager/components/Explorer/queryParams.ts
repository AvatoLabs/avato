import { type FileScope, getSourceSetScopeId } from '@/features/ContentManager/useFileScope';
import { type ContentQueryParams } from '@/types/content';
import {
  type FileAssetClassification,
  type FileAssetReviewStatus,
  type FileAssetUsagePolicy,
  type FilesTabs,
  type SortType,
} from '@/types/files';

interface BuildExplorerQueryParamsOptions {
  assetClassification?: FileAssetClassification;
  assetReviewStatus?: FileAssetReviewStatus;
  assetRightsOwner?: string;
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
  // URL scope is the source of truth and updates synchronously.
  // Store sourceSetId lags behind by one frame (set via useEffect),
  // so we prefer the URL-derived value to avoid a stale-key race that
  // would cause SWR to skip re-fetching on scope switches.
  const effectiveSourceSetId = getSourceSetScopeId(scope) ?? sourceSetId;

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
