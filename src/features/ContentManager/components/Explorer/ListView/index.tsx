'use client';

import { Center, Checkbox, Flexbox } from '@lobehub/ui';
import { createStaticStyles, cssVar, cx } from 'antd-style';
import debug from 'debug';
import { FileIcon, FilePlus } from 'lucide-react';
import { type DragEvent } from 'react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type VirtuosoHandle } from 'react-virtuoso';
import { Virtuoso } from 'react-virtuoso';

import { useDragActive } from '@/routes/(main)/content/features/DndContextWrapper';
import { useFolderPath } from '@/routes/(main)/content/features/hooks/useFolderPath';
import {
  useContentManagerFetchContentFolderBreadcrumb,
  useContentManagerStore,
} from '@/routes/(main)/content/features/store';
import { sortFileList } from '@/routes/(main)/content/features/store/selectors';
import { useFileStore } from '@/store/file';
import { useVisibleResources } from '@/store/file/slices/content/hooks';
import { useGlobalStore } from '@/store/global';
import { INITIAL_STATUS } from '@/store/global/initialState';
import { type AsyncTaskStatus } from '@/types/asyncTask';
import { type FileListItem as FileListItemType, FilesTabs } from '@/types/files';

import EmptyState from '../../EmptyState';
import { buildExplorerQueryParams } from '../queryParams';
import ColumnResizeHandle from './ColumnResizeHandle';
import FileListItem from './ListItem';
import ListViewSkeleton from './Skeleton';

const log = debug('resource-manager:list-view');

const styles = createStaticStyles(({ css }) => ({
  dropZone: css`
    position: relative;
    height: 100%;
  `,
  dropZoneActive: css`
    background: ${cssVar.colorPrimaryBg};
    outline: 1px dashed ${cssVar.colorPrimaryBorder};
    outline-offset: -4px;
  `,
  header: css`
    min-width: 800px;
    height: 40px;
    min-height: 40px;
    color: ${cssVar.colorTextDescription};
  `,
  headerItem: css`
    height: 100%;
    padding-block: 6px;
    padding-inline: 0 24px;
  `,
  scrollContainer: css`
    overflow: auto hidden;
    display: flex;
    flex: 1;
    flex-direction: column;

    min-height: 0;
  `,
}));

const ListView = memo(function ListView() {
  const [
    sourceSetId,
    category,
    spaceId,
    selectFileIds,
    setSelectedFileIds,
    pendingRenameItemId,
    sorter,
    sortType,
    storeIsTransitioning,
  ] = useContentManagerStore((s) => [
    s.sourceSetId,
    s.category,
    s.spaceId,
    s.selectedFileIds,
    s.setSelectedFileIds,
    s.pendingRenameItemId,
    s.sorter,
    s.sortType,
    s.isTransitioning,
  ]);

  const pushDockFileList = useFileStore((s) => s.pushDockFileList);

  // Access column widths from Global store
  const columnWidths = useGlobalStore(
    (s) => s.status.contentManagerColumnWidths || INITIAL_STATUS.contentManagerColumnWidths,
  );
  const updateColumnWidth = useGlobalStore((s) => s.updateContentManagerColumnWidth);

  const { t } = useTranslation(['components', 'file']);

  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const isDragActive = useDragActive();
  const [isDropZoneActive, setIsDropZoneActive] = useState(false);
  const [isAnyRowHovered, setIsAnyRowHovered] = useState(false);
  const [viewportSize, setViewportSize] = useState({ height: 0, width: 0 });
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoScrollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastSelectedIndexRef = useRef<number | null>(null);

  const { currentFolderSlug } = useFolderPath();
  const { data: folderBreadcrumb } = useContentManagerFetchContentFolderBreadcrumb(
    currentFolderSlug,
    spaceId,
  );

  // Get current folder ID - either from breadcrumb or null for root
  const currentFolderId = folderBreadcrumb?.at(-1)?.id || null;

  // Handler for file upload in empty state
  const handleUploadFiles = useCallback(
    async (files: File[]) => {
      await pushDockFileList(files, sourceSetId, currentFolderId ?? undefined, spaceId);
    },
    [pushDockFileList, sourceSetId, currentFolderId, spaceId],
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

  const { hasResolvedData, isLoading, items: resourceList } = useVisibleResources(queryParams);
  const { hasMore, loadMoreResources } = useFileStore();

  // Map ContentItem[] to FileListItem[] for compatibility
  const rawData = useMemo(
    () =>
      resourceList?.map<FileListItemType>((item) => ({
        ...item,
        chunkCount: item.chunkCount ?? null,
        chunkingError: item.chunkingError ?? null,
        chunkingStatus: (item.chunkingStatus ?? null) as AsyncTaskStatus | null,
        embeddingError: item.embeddingError ?? null,
        embeddingStatus: (item.embeddingStatus ?? null) as AsyncTaskStatus | null,
        finishEmbedding: item.finishEmbedding ?? false,
        url: item.url ?? '',
      })) ?? [],
    [resourceList],
  );

  // Sort data using current sort settings
  const data = useMemo(
    () => sortFileList(rawData, sorter, sortType) || [],
    [rawData, sorter, sortType],
  );

  const dataLength = data.length;
  const effectiveIsLoading = isLoading ?? false;
  const effectiveIsTransitioning = storeIsTransitioning ?? false;

  const showSkeleton =
    (((!hasResolvedData && dataLength === 0) || effectiveIsLoading) && dataLength === 0) ||
    effectiveIsTransitioning;

  const dataRef = useRef<FileListItemType[]>(data);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) return;

    const updateViewportSize = () => {
      const { height, width } = container.getBoundingClientRect();

      setViewportSize((current) => {
        if (current.height === height && current.width === width) return current;

        return { height, width };
      });
    };

    updateViewportSize();

    const observer = new ResizeObserver(updateViewportSize);
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  // Handle selection change with shift-click support for range selection
  const handleSelectionChange = useCallback(
    (id: string, checked: boolean, shiftKey: boolean, clickedIndex: number) => {
      // Always get the latest state from the store to avoid stale closure issues
      const currentSelected = useContentManagerStore.getState().selectedFileIds;
      const lastIndex = lastSelectedIndexRef.current;
      const list = dataRef.current;

      if (shiftKey && lastIndex !== null && list.length > 0) {
        // Shift-click: select range from lastIndex to current index
        const start = Math.min(lastIndex, clickedIndex);
        const end = Math.max(lastIndex, clickedIndex);
        const rangeIds = list
          .slice(start, end + 1)
          .filter(Boolean)
          .map((item) => item.id);

        // Merge with existing selection
        const prevSet = new Set(currentSelected);
        rangeIds.forEach((rangeId) => prevSet.add(rangeId));
        setSelectedFileIds(Array.from(prevSet));
      } else {
        // Regular click: toggle single item
        if (checked) {
          setSelectedFileIds([...currentSelected, id]);
        } else {
          setSelectedFileIds(currentSelected.filter((item) => item !== id));
        }
      }
      lastSelectedIndexRef.current = clickedIndex;
    },
    [setSelectedFileIds],
  );

  // Clean up invalid selections when data changes
  useEffect(() => {
    if (selectFileIds.length > 0) {
      const validFileIds = new Set(data.map((item) => item?.id).filter(Boolean));
      const filteredSelection = selectFileIds.filter((id) => validFileIds.has(id));
      if (filteredSelection.length !== selectFileIds.length) {
        setSelectedFileIds(filteredSelection);
      }
    }
  }, [data, selectFileIds, setSelectedFileIds]);

  // Reset last selected index when all selections are cleared
  useEffect(() => {
    if (selectFileIds.length === 0) {
      lastSelectedIndexRef.current = null;
    }
  }, [selectFileIds.length]);

  // Calculate select all checkbox state
  const { allSelected, indeterminate } = useMemo(() => {
    const fileCount = data.length;
    const selectedCount = selectFileIds.length;
    return {
      allSelected: fileCount > 0 && selectedCount === fileCount,
      indeterminate: selectedCount > 0 && selectedCount < fileCount,
    };
  }, [data, selectFileIds]);

  // Handle select all checkbox change
  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedFileIds([]);
    } else {
      setSelectedFileIds(data.map((item) => item.id));
    }
  };

  // Handle automatic load more when reaching the end
  const handleEndReached = useCallback(async () => {
    log('handleEndReached', hasMore, isLoadingMore);

    if (!hasMore || isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      await loadMoreResources();
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, loadMoreResources, isLoadingMore]);

  // Clear auto-scroll timers
  const clearScrollTimers = useCallback(() => {
    if (scrollTimerRef.current) {
      clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = null;
    }
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current);
      autoScrollIntervalRef.current = null;
    }
  }, []);

  // Drop zone handlers for dragging to blank space
  const handleDropZoneDragOver = useCallback(
    (e: DragEvent) => {
      if (!isDragActive) return;
      e.preventDefault();
      e.stopPropagation();
      setIsDropZoneActive(true);
    },
    [isDragActive],
  );

  const handleDropZoneDragLeave = useCallback(() => {
    setIsDropZoneActive(false);
    clearScrollTimers();
  }, [clearScrollTimers]);

  const handleDropZoneDrop = useCallback(() => {
    setIsDropZoneActive(false);
    clearScrollTimers();
  }, [clearScrollTimers]);

  // Handle auto-scroll during drag
  const handleDragMove = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (!isDragActive || !containerRef.current) return;

      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const mouseY = e.clientY;
      const bottomThreshold = 200; // pixels from bottom edge
      const distanceFromBottom = rect.bottom - mouseY;

      // Check if mouse is near the bottom edge
      if (distanceFromBottom > 0 && distanceFromBottom <= bottomThreshold) {
        // If not already started, start the 2-second timer
        if (!scrollTimerRef.current && !autoScrollIntervalRef.current) {
          scrollTimerRef.current = setTimeout(() => {
            // After 2 seconds, start auto-scrolling
            autoScrollIntervalRef.current = setInterval(() => {
              virtuosoRef.current?.scrollBy({ top: 50 });
            }, 100); // Scroll every 100ms for smooth scrolling
            scrollTimerRef.current = null;
          }, 2000);
        }
      } else {
        // Mouse moved away from bottom edge, clear timers
        clearScrollTimers();
      }
    },
    [isDragActive, clearScrollTimers],
  );

  // Clean up timers when drag ends or component unmounts
  useEffect(() => {
    if (!isDragActive) {
      clearScrollTimers();
    }
  }, [isDragActive, clearScrollTimers]);

  useEffect(() => {
    return () => {
      clearScrollTimers();
    };
  }, [clearScrollTimers]);

  // Memoize footer component to show skeleton loaders when loading more
  // eslint-disable-next-line @eslint-react/no-nested-component-definitions
  const Footer = useCallback(() => {
    if (isLoadingMore && hasMore) return <ListViewSkeleton columnWidths={columnWidths} />;

    // Leave some padding at the end when there are no more pages,
    // so users can clearly feel they've reached the end of the list.
    if (hasMore === false && dataLength > 0) return <div aria-hidden style={{ height: 96 }} />;

    return null;
  }, [columnWidths, dataLength, hasMore, isLoadingMore]);

  if (showSkeleton) return <ListViewSkeleton columnWidths={columnWidths} />;

  // Show empty state when data is loaded but empty (and not in a folder)
  const showEmptyState = hasResolvedData && !effectiveIsLoading && dataLength === 0;

  const isViewportReady = viewportSize.height > 0 && viewportSize.width > 0;

  return (
    <Flexbox height={'100%'} style={{ minHeight: 0 }}>
      <div className={styles.scrollContainer}>
        <Flexbox
          horizontal
          align={'center'}
          className={styles.header}
          paddingInline={8}
          style={{
            borderBlockEnd: `1px solid ${cssVar.colorBorderSecondary}`,
            fontSize: 12,
          }}
        >
          <Center height={40} style={{ paddingInline: 4 }}>
            <Checkbox
              checked={allSelected}
              indeterminate={indeterminate}
              onChange={handleSelectAll}
            />
          </Center>
          <Flexbox
            className={styles.headerItem}
            justify={'center'}
            style={{
              flexShrink: 0,
              maxWidth: columnWidths.name,
              minWidth: columnWidths.name,
              paddingInline: 20,
              paddingInlineEnd: 16,
              position: 'relative',
              width: columnWidths.name,
            }}
          >
            {selectFileIds.length > 0
              ? t('FileManager.total.selectedCount', {
                  count: selectFileIds.length,
                  ns: 'components',
                })
              : category === FilesTabs.Documents
                ? t('shared.kind.document', { defaultValue: 'Document', ns: 'file' })
                : t('FileManager.title.title')}
            <ColumnResizeHandle
              column="name"
              currentWidth={columnWidths.name}
              maxWidth={1200}
              minWidth={200}
              onResize={(width) => updateColumnWidth('name', width)}
            />
          </Flexbox>
          <Flexbox
            className={styles.headerItem}
            justify={'center'}
            style={{ flexShrink: 0, paddingInlineEnd: 16, position: 'relative' }}
            width={columnWidths.date}
          >
            {t('FileManager.title.createdAt')}
            <ColumnResizeHandle
              column="date"
              currentWidth={columnWidths.date}
              maxWidth={300}
              minWidth={120}
              onResize={(width) => updateColumnWidth('date', width)}
            />
          </Flexbox>
          <Flexbox
            className={styles.headerItem}
            justify={'center'}
            style={{ flexShrink: 0, paddingInlineEnd: 16, position: 'relative' }}
            width={columnWidths.size}
          >
            {t('FileManager.title.size')}
            <ColumnResizeHandle
              column="size"
              currentWidth={columnWidths.size}
              maxWidth={200}
              minWidth={80}
              onResize={(width) => updateColumnWidth('size', width)}
            />
          </Flexbox>
        </Flexbox>
        <div
          data-drop-target-id={currentFolderId || undefined}
          data-is-folder="true"
          ref={containerRef}
          className={cx(
            styles.dropZone,
            isDropZoneActive && styles.dropZoneActive,
            isAnyRowHovered && 'any-row-hovered',
          )}
          style={{
            display: 'flex',
            flex: 1,
            flexDirection: 'column',
            minHeight: 0,
            overflow: 'hidden',
            position: 'relative',
          }}
          onDragLeave={handleDropZoneDragLeave}
          onDrop={handleDropZoneDrop}
          onDragOver={(e) => {
            handleDropZoneDragOver(e);
            handleDragMove(e);
          }}
        >
          {showEmptyState ? (
            <EmptyState
              description={t('emptyState.files.description', { ns: 'file' })}
              icon={FileIcon}
              title={t('emptyState.files.title', { ns: 'file' })}
              actions={[
                {
                  label: t('emptyState.files.uploadAction', { ns: 'file' }),
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
                  label: t('emptyState.files.createPageAction', { ns: 'file' }),
                  type: 'dashed',
                },
              ]}
            />
          ) : (
            isViewportReady && (
              <Virtuoso
                components={{ Footer }}
                data={data}
                defaultItemHeight={48}
                endReached={handleEndReached}
                fixedItemHeight={48}
                increaseViewportBy={{ bottom: 800, top: 1200 }}
                initialItemCount={30}
                overscan={48 * 5}
                ref={virtuosoRef}
                style={{ height: '100%', width: '100%' }}
                itemContent={(index, item) => {
                  if (!item) return null;
                  return (
                    <FileListItem
                      columnWidths={columnWidths}
                      index={index}
                      isAnyRowHovered={isAnyRowHovered}
                      key={item.id}
                      pendingRenameItemId={pendingRenameItemId}
                      selected={selectFileIds.includes(item.id)}
                      onHoverChange={setIsAnyRowHovered}
                      onSelectedChange={handleSelectionChange}
                      {...item}
                    />
                  );
                }}
              />
            )
          )}
        </div>
      </div>
    </Flexbox>
  );
});

export default ListView;
