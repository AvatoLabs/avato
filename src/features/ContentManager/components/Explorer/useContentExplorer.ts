import { useEffect } from 'react';

import { useFolderPath } from '@/routes/(main)/content/features/hooks/useFolderPath';
import {
  useContentManagerFetchContentFolderBreadcrumb,
  useContentManagerStore,
} from '@/routes/(main)/content/features/store';

interface UseContentExplorerProps {
  hasResolvedData: boolean;
  isLoading: boolean;
}

export const useContentExplorer = ({
  hasResolvedData,
  isLoading,
}: UseContentExplorerProps) => {
  const [viewMode, isTransitioning, setCurrentFolderId, setIsTransitioning, setIsMasonryReady, spaceId] =
    useContentManagerStore((s) => [
      s.viewMode,
      s.isTransitioning,
      s.setCurrentFolderId,
      s.setIsTransitioning,
      s.setIsMasonryReady,
      s.spaceId,
    ]);
  const { currentFolderSlug } = useFolderPath();

  const { data: folderBreadcrumb } = useContentManagerFetchContentFolderBreadcrumb(
    currentFolderSlug,
    spaceId,
  );

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
