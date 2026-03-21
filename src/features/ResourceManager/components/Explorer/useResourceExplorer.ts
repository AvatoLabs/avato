import { useEffect, useMemo } from 'react';

import { useFolderPath } from '@/routes/(main)/resource/features/hooks/useFolderPath';
import {
  useResourceManagerFetchFolderBreadcrumb,
  useResourceManagerStore,
} from '@/routes/(main)/resource/features/store';
import { useVisibleResources } from '@/store/file/slices/resource/hooks';
import { type FilesTabs } from '@/types/files';

interface UseFileExplorerProps {
  category?: FilesTabs;
  libraryId?: string;
}

export const useResourceExplorer = ({
  category: categoryProp,
  libraryId,
}: UseFileExplorerProps) => {
  const [
    viewMode,
    isTransitioning,
    setCurrentFolderId,
    setIsTransitioning,
    setIsMasonryReady,
    spaceId,
    sorter,
    sortType,
  ] = useResourceManagerStore((s) => [
    s.viewMode,
    s.isTransitioning,
    s.setCurrentFolderId,
    s.setIsTransitioning,
    s.setIsMasonryReady,
    s.spaceId,
    s.sorter,
    s.sortType,
  ]);

  const categoryFromStore = useResourceManagerStore((s) => s.category);
  const category = categoryProp ?? categoryFromStore;
  const { currentFolderSlug } = useFolderPath();

  const { data: folderBreadcrumb } = useResourceManagerFetchFolderBreadcrumb(currentFolderSlug);

  const queryParams = useMemo(
    () => ({
      category: libraryId ? undefined : category,
      libraryId,
      parentId: currentFolderSlug || null,
      showFilesInKnowledgeBase: false,
      spaceId,
      sortType,
      sorter,
    }),
    [category, currentFolderSlug, libraryId, sorter, sortType, spaceId],
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
