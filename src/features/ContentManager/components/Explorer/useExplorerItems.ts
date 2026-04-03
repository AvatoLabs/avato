import { useMemo } from 'react';

import { sortFileList } from '@/routes/(main)/content/features/store/selectors';
import { fileManagerSelectors, useFileStore } from '@/store/file';
import { useVisibleResources } from '@/store/file/slices/content/hooks';
import { type ContentQueryParams } from '@/types/content';
import { type SortType } from '@/types/files';

import {
  buildPendingUploadExplorerItems,
  type ExplorerItem,
  mapContentItemsToExplorerItems,
} from './items';

interface UseExplorerItemsOptions {
  enabled?: boolean;
  params: ContentQueryParams | null;
  sorter: 'createdAt' | 'name' | 'size';
  sortType: SortType;
}

export const useExplorerItems = ({
  enabled = true,
  params,
  sorter,
  sortType,
}: UseExplorerItemsOptions) => {
  const resources = useVisibleResources(params, enabled);
  const dockUploadFileList = useFileStore(fileManagerSelectors.dockFileList);

  const data = useMemo<ExplorerItem[]>(() => {
    const visibleItems =
      resources.items?.filter(
        (item) => !(item.sourceType === 'document' && item.fileType === 'custom/document'),
      ) ?? [];
    const pendingItems = buildPendingUploadExplorerItems(dockUploadFileList, params, visibleItems);
    const mergedItems = [...pendingItems, ...mapContentItemsToExplorerItems(visibleItems)];

    return sortFileList(mergedItems, sorter, sortType) || [];
  }, [dockUploadFileList, params, resources.items, sortType, sorter]);

  return {
    ...resources,
    data,
  };
};
