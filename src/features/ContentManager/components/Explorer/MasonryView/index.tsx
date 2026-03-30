'use client';

import { Center } from '@lobehub/ui';
import { VirtuosoMasonry } from '@virtuoso.dev/masonry';
import { cssVar } from 'antd-style';
import { FileIcon, FilePlus } from 'lucide-react';
import { type UIEvent } from 'react';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useFolderPath } from '@/routes/(main)/content/features/hooks/useFolderPath';
import { useContentManagerStore } from '@/routes/(main)/content/features/store';
import { sortFileList } from '@/routes/(main)/content/features/store/selectors';
import { useFileStore } from '@/store/file';
import { useVisibleResources } from '@/store/file/slices/content/hooks';
import { type FileListItem } from '@/types/files';

import EmptyState from '../../EmptyState';
import { buildExplorerQueryParams } from '../queryParams';
import { useMasonryColumnCount } from '../useMasonryColumnCount';
import MasonryItemWrapper from './MasonryItem/MasonryItemWrapper';
import MasonryViewSkeleton from './Skeleton';

const MasonryView = memo(function MasonryView() {
  // Access all state from Resource Manager store
  const [
    sourceSetId,
    category,
    mode,
    spaceId,
    selectedFileIds,
    setSelectedFileIds,
    storeIsMasonryReady,
    sorter,
    sortType,
    storeIsTransitioning,
    currentFolderId,
  ] = useContentManagerStore((s) => [
    s.sourceSetId,
    s.category,
    s.mode,
    s.spaceId,
    s.selectedFileIds,
    s.setSelectedFileIds,
    s.isMasonryReady,
    s.sorter,
    s.sortType,
    s.isTransitioning,
    s.currentFolderId,
  ]);

  const isExplorerMode = mode === 'explorer';

  const { t } = useTranslation('file');
  const columnCount = useMasonryColumnCount();
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const { currentFolderSlug } = useFolderPath();

  const pushDockFileList = useFileStore((s) => s.pushDockFileList);

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

  const {
    hasMore,
    hasResolvedData,
    isLoading,
    items: resourceList,
  } = useVisibleResources(queryParams, isExplorerMode);
  const loadMoreResources = useFileStore((s) => s.loadMoreResources);

  // Map ContentItem[] to FileListItem[] for compatibility
  const rawData = resourceList?.map(
    (item): FileListItem => ({
      chunkCount: item.chunkCount ?? null,
      chunkingError: item.chunkingError ?? null,
      chunkingStatus: (item.chunkingStatus as any) ?? null,
      content: item.content,
      createdAt: item.createdAt,
      editorData: item.editorData,
      embeddingError: item.embeddingError ?? null,
      embeddingStatus: (item.embeddingStatus as any) ?? null,
      fileId: item.fileId ?? null,
      fileType: item.fileType,
      finishEmbedding: item.finishEmbedding ?? false,
      id: item.id,
      metadata: item.metadata,
      name: item.name,
      parentId: item.parentId,
      size: item.size,
      slug: item.slug,
      sourceType: item.sourceType,
      updatedAt: item.updatedAt,
      url: item.url ?? '',
    }),
  );

  // Sort data using current sort settings
  const data = sortFileList(rawData, sorter, sortType) || [];

  const dataLength = data.length;
  const effectiveIsLoading = isLoading ?? false;
  const effectiveIsTransitioning = storeIsTransitioning ?? false;
  const effectiveIsMasonryReady = storeIsMasonryReady;

  const showSkeleton =
    (((!hasResolvedData && dataLength === 0) || effectiveIsLoading) && dataLength === 0) ||
    effectiveIsTransitioning ||
    !effectiveIsMasonryReady;

  // Show empty state when data is loaded but empty
  const showEmptyState =
    hasResolvedData && !effectiveIsLoading && dataLength === 0 && !showSkeleton;

  // Handler for file upload in empty state
  const handleUploadFiles = useCallback(
    async (files: File[]) => {
      await pushDockFileList(files, sourceSetId, currentFolderId ?? undefined, spaceId);
    },
    [pushDockFileList, sourceSetId, currentFolderId, spaceId],
  );

  const masonryContext = useMemo(
    () => ({
      sourceSetId,
      selectFileIds: selectedFileIds,
      setSelectedFileIds,
    }),
    [sourceSetId, selectedFileIds, setSelectedFileIds],
  );

  // Handle automatic load more when scrolling to bottom
  const handleLoadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      await loadMoreResources();
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, loadMoreResources, isLoadingMore]);

  // Handle scroll event to detect when near bottom
  const handleScroll = useCallback(
    (e: UIEvent<HTMLDivElement>) => {
      const target = e.currentTarget;
      const scrollTop = target.scrollTop;
      const scrollHeight = target.scrollHeight;
      const clientHeight = target.clientHeight;

      // Trigger load when within 300px of bottom
      if (scrollHeight - scrollTop - clientHeight < 300) {
        handleLoadMore();
      }
    },
    [handleLoadMore],
  );

  return showSkeleton ? (
    <MasonryViewSkeleton columnCount={columnCount} />
  ) : showEmptyState ? (
    <EmptyState
      description={t('emptyState.files.description')}
      icon={FileIcon}
      title={t('emptyState.files.title')}
      actions={[
        {
          label: t('emptyState.files.uploadAction'),
          type: 'primary',
          onClick: () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.multiple = true;
            input.onchange = async (e) => {
              const files = Array.from((e.target as HTMLInputElement).files || []);
              if (files.length > 0) {
                await handleUploadFiles(files);
              }
            };
            input.click();
          },
        },
        {
          icon: FilePlus,
          label: t('emptyState.files.createPageAction'),
          type: 'dashed',
        },
      ]}
    />
  ) : (
    <div
      style={{
        flex: 1,
        height: '100%',
        opacity: effectiveIsMasonryReady ? 1 : 0,
        overflowY: 'auto',
        transition: 'opacity 0.2s ease-in-out',
      }}
      onScroll={handleScroll}
    >
      <div style={{ paddingBlockEnd: 24, paddingBlockStart: 12, paddingInline: 24 }}>
        <VirtuosoMasonry
          ItemContent={MasonryItemWrapper}
          columnCount={columnCount}
          context={masonryContext}
          data={data}
          style={{
            gap: '16px',
            overflow: 'hidden',
          }}
        />
        {isLoadingMore && (
          <Center
            style={{
              color: cssVar.colorTextDescription,
              fontSize: 14,
              marginBlockStart: 16,
              minHeight: 40,
            }}
          >
            {t('loading', { defaultValue: 'Loading...' })}
          </Center>
        )}
      </div>
    </div>
  );
});

export default MasonryView;
