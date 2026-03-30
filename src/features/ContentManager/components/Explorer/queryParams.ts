import { type ContentQueryParams } from '@/types/content';
import { type FilesTabs, type SortType } from '@/types/files';

interface BuildExplorerQueryParamsOptions {
  category?: FilesTabs;
  currentFolderSlug?: string | null;
  sorter?: 'createdAt' | 'name' | 'size';
  sortType?: SortType;
  sourceSetId?: string;
  spaceId?: string;
}

export const getExplorerCategoryFilter = (category?: FilesTabs, sourceSetId?: string) =>
  sourceSetId ? undefined : category;

export const isSpaceLevelContentFilter = (category?: FilesTabs) =>
  !!category && category !== 'all' && category !== 'home';

export const buildExplorerQueryParams = ({
  category,
  currentFolderSlug,
  sourceSetId,
  sorter,
  sortType,
  spaceId,
}: BuildExplorerQueryParamsOptions): ContentQueryParams => ({
  category: getExplorerCategoryFilter(category, sourceSetId),
  parentId:
    !sourceSetId && isSpaceLevelContentFilter(category) ? undefined : currentFolderSlug || null,
  showFilesInSourceSet: false,
  sourceSetId,
  spaceId,
  sortType,
  sorter,
});
