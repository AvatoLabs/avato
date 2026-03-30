import { useEffect, useMemo } from 'react';

import { useFolderPath } from '@/routes/(main)/content/features/hooks/useFolderPath';
import {
  useContentManagerFetchContentFolderBreadcrumb,
  useContentManagerStore,
} from '@/routes/(main)/content/features/store';
import { useVisibleResources } from '@/store/file/slices/content/hooks';
import { type FilesTabs } from '@/types/files';

import { buildExplorerQueryParams } from './queryParams';

interface UseContentExplorerProps {
  category?: FilesTabs;
  sourceSetId?: string;
}

export const useContentExplorer = ({
  category: categoryProp,
  sourceSetId,
}: UseContentExplorerProps) => {
  const [
    viewMode,
    isTransitioning,
    setCurrentFolderId,
    setIsTransitioning,
    setIsMasonryReady,
    spaceId,
    sorter,
    sortType,
  ] = useContentManagerStore((s) => [
    s.viewMode,
    s.isTransitioning,
    s.setCurrentFolderId,
    s.setIsTransitioning,
    s.setIsMasonryReady,
    s.spaceId,
    s.sorter,
    s.sortType,
  ]);

  const categoryFromStore = useContentManagerStore((s) => s.category);
  const category = categoryProp ?? categoryFromStore;
  const { currentFolderSlug } = useFolderPath();

  const { data: folderBreadcrumb } = useContentManagerFetchContentFolderBreadcrumb(
    currentFolderSlug,
    spaceId,
  );

  const queryParams = useMemo(
    () =>
      buildExplorerQueryParams({
        category,
        currentFolderSlug,
        sourceSetId,
        sorter,
        sortType,
        spaceId,
      }),
    [category, currentFolderSlug, sourceSetId, sorter, sortType, spaceId],
  );

  const { hasResolvedData, isLoading } = useVisibleResources(queryParams);

  useEffect(() => {
    if (!currentFolderSlug) {
      setCurrentFolderId(null);
    } else if (folderBreadcrumb && folderBreadcrumb.length > 0) {
      const currentFolder = folderBreadcrumb.at(-1);
      setCurrentFolderId(currentFolder?.id ?? null);
    }
  }, [currentFolderSlug, folderBreadcrumb, setCurrentFolderId]);

  useEffect(() => {
    if (viewMode === 'masonry') {
      setIsTransitioning(true);
      setIsMasonryReady(false);
    }
  }, [viewMode, setIsTransitioning, setIsMasonryReady]);

  useEffect(() => {
    if (!isTransitioning || !hasResolvedData) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const frameId = requestAnimationFrame(() => {
      timer = setTimeout(() => {
        setIsTransitioning(false);
      }, 100);
    });

    return () => {
      cancelAnimationFrame(frameId);
      if (timer) clearTimeout(timer);
    };
  }, [hasResolvedData, isTransitioning, setIsTransitioning]);

  useEffect(() => {
    if (viewMode === 'masonry' && hasResolvedData && !isLoading && !isTransitioning) {
      const timer = setTimeout(() => {
        setIsMasonryReady(true);
      }, 300);
      return () => clearTimeout(timer);
    }

    if (viewMode === 'list') {
      setIsMasonryReady(false);
    }
  }, [viewMode, hasResolvedData, isLoading, isTransitioning, setIsMasonryReady]);
};
