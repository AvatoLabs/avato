'use client';

import { Center } from '@lobehub/ui';
import { VirtuosoMasonry } from '@virtuoso.dev/masonry';
import { createStaticStyles, cssVar } from 'antd-style';
import { FileIcon } from 'lucide-react';
import { type UIEvent } from 'react';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useContentManagerStore } from '@/routes/(main)/content/features/store';
import { useFileStore } from '@/store/file';

import EmptyState from '../../EmptyState';
import { type ExplorerItem } from '../items';
import { useMasonryColumnCount } from '../useMasonryColumnCount';
import MasonryItemWrapper from './MasonryItem/MasonryItemWrapper';
import MasonryViewSkeleton from './Skeleton';

const styles = createStaticStyles(({ css, cssVar }) => ({
  loadingShell: css`
    overflow: hidden;

    display: flex;
    flex: 1;
    flex-direction: column;

    min-height: 0;

    background:
      linear-gradient(
        180deg,
        color-mix(in srgb, ${cssVar.colorBgContainer} 97%, ${cssVar.colorBgElevated}) 0%,
        color-mix(in srgb, ${cssVar.colorBgContainer} 93%, ${cssVar.colorBgLayout}) 100%
      );
  `,
  loadingHeader: css`
    display: grid;
    gap: 6px;
    padding: 16px 18px 10px;
    border-bottom: 1px solid ${cssVar.colorBorderSecondary};
    background: color-mix(in srgb, ${cssVar.colorFillQuaternary} 72%, transparent);
  `,
  loadingHeaderEyebrow: css`
    color: ${cssVar.colorTextSecondary};
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  `,
  loadingHeaderSummary: css`
    color: ${cssVar.colorTextDescription};
    font-size: 13px;
    line-height: 1.5;
  `,
  loadingHeaderTitle: css`
    font-size: 18px;
    font-weight: 600;
    line-height: 1.25;
  `,
  loadingMore: css`
    color: ${cssVar.colorTextDescription};
    font-size: 14px;
    margin-block-start: 16px;
    min-height: 40px;
  `,
  masonryScroll: css`
    flex: 1;
    height: 100%;
    min-height: 0;
    overflow-y: auto;
    transition: opacity 0.2s ease-in-out;
  `,
  masonryStage: css`
    padding-block: 12px 24px;
    padding-inline: 24px;
  `,
}));

interface MasonryViewProps {
  data: ExplorerItem[];
  hasResolvedData: boolean;
  isLoading: boolean;
}

const MasonryView = memo<MasonryViewProps>(function MasonryView({
  data,
  hasResolvedData,
  isLoading,
}) {
  // Access all state from Resource Manager store
  const [
    sourceSetId,
    spaceId,
    selectedFileIds,
    setSelectedFileIds,
    storeIsMasonryReady,
    storeIsTransitioning,
    currentFolderId,
  ] = useContentManagerStore((s) => [
    s.sourceSetId,
    s.spaceId,
    s.selectedFileIds,
    s.setSelectedFileIds,
    s.isMasonryReady,
    s.isTransitioning,
    s.currentFolderId,
  ]);

  const { t } = useTranslation('file');
  const columnCount = useMasonryColumnCount();
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const pushDockFileList = useFileStore((s) => s.pushDockFileList);
  const loadMoreResources = useFileStore((s) => s.loadMoreResources);
  const hasMore = useFileStore((s) => s.hasMore);

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
    <div className={styles.loadingShell} data-testid={'resource-masonry-loading-state'}>
      <div className={styles.loadingHeader}>
        <div className={styles.loadingHeaderEyebrow}>
          {t('loading', { defaultValue: 'Loading...' })}
        </div>
        <div className={styles.loadingHeaderTitle}>{t('emptyState.files.title')}</div>
        <div className={styles.loadingHeaderSummary}>{t('emptyState.files.description')}</div>
      </div>
      <MasonryViewSkeleton columnCount={columnCount} />
    </div>
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
      ]}
    />
  ) : (
    <div
      className={styles.masonryScroll}
      style={{ opacity: effectiveIsMasonryReady ? 1 : 0 }}
      onScroll={handleScroll}
    >
      <div className={styles.masonryStage}>
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
          <Center className={styles.loadingMore}>
            {t('loading', { defaultValue: 'Loading...' })}
          </Center>
        )}
      </div>
    </div>
  );
});

export default MasonryView;
