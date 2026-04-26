'use client';

import { Flexbox } from '@lobehub/ui';
import { createStaticStyles, cx } from 'antd-style';
import { memo, useEffect, useMemo } from 'react';

import { useContentManagerUrlSync } from '@/routes/(main)/content/features/hooks/useContentManagerUrlSync';
import { useFolderPath } from '@/routes/(main)/content/features/hooks/useFolderPath';
import { useContentManagerStore } from '@/routes/(main)/content/features/store';
import { useServerConfigStore } from '@/store/serverConfig';

import { useFileScope } from '../../useFileScope';
import SourceSetListSection from '../SourceSetListSection';
import EmptyPlaceholder from './EmptyPlaceholder';
import Header from './Header';
import ListView from './ListView';
import MasonryView from './MasonryView';
import { buildExplorerQueryParams } from './queryParams';
import SearchResultsOverlay from './SearchResultsOverlay';
import { useCheckTaskStatus } from './useCheckTaskStatus';
import { useContentExplorer } from './useContentExplorer';
import { useExplorerItems } from './useExplorerItems';

const styles = createStaticStyles(({ css, cssVar }) => ({
  page: css`
    position: relative;

    min-height: 0;
    height: 100%;
    padding: clamp(12px, 1.8vw, 18px);

    background:
      radial-gradient(circle at top left, rgb(82 149 255 / 7%), transparent 26%),
      linear-gradient(180deg, ${cssVar.colorBgLayout} 0%, ${cssVar.colorBgContainer} 100%);
  `,
  pageMobile: css`
    padding: 8px;
  `,
  shell: css`
    width: min(100%, 1520px);
    min-height: 0;
    height: 100%;
    margin-inline: auto;
  `,
  stage: css`
    overflow: hidden;

    display: flex;
    flex-direction: column;

    min-height: 0;
    height: 100%;
    border: 1px solid color-mix(in srgb, ${cssVar.colorBorderSecondary} 90%, transparent);
    border-radius: 24px;

    background:
      linear-gradient(
        180deg,
        color-mix(in srgb, ${cssVar.colorBgContainer} 97%, ${cssVar.colorBgElevated}) 0%,
        color-mix(in srgb, ${cssVar.colorBgContainer} 92%, ${cssVar.colorBgLayout}) 100%
      );
    box-shadow:
      0 28px 72px -48px color-mix(in srgb, ${cssVar.colorText} 24%, transparent),
      inset 0 1px 0 color-mix(in srgb, white 55%, transparent);
    backdrop-filter: blur(16px);

    @media (max-width: 768px) {
      border-radius: 18px;
    }
  `,
  sourceSetSection: css`
    padding-inline: clamp(12px, 2vw, 18px);
    padding-block-end: 8px;
    border-bottom: 1px solid ${cssVar.colorBorderSecondary};
  `,
  viewport: css`
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;

    background:
      linear-gradient(
        180deg,
        color-mix(in srgb, ${cssVar.colorFillQuaternary} 54%, transparent) 0%,
        transparent 88px
      );
  `,
}));

/**
 * Explore content items inside a source set or space view.
 *
 * Works with FileTree
 *
 * It's a un-reusable component for business logic only.
 * So we depend on context, not props.
 */
const ResourceExplorer = memo(() => {
  // Get state from Resource Manager store
  const [
    sourceSetId,
    assetClassification,
    assetRightsOwner,
    assetReviewStatus,
    assetUsagePolicy,
    category,
    mode,
    viewMode,
    searchQuery,
    setSelectedFileIds,
    sorter,
    sortType,
    spaceId,
  ] = useContentManagerStore((s) => [
    s.sourceSetId,
    s.assetClassification,
    s.assetRightsOwner,
    s.assetReviewStatus,
    s.assetUsagePolicy,
    s.category,
    s.mode,
    s.viewMode,
    s.searchQuery,
    s.setSelectedFileIds,
    s.sorter,
    s.sortType,
    s.spaceId,
  ]);
  const { scope } = useFileScope(spaceId);

  const isExplorerMode = mode === 'explorer';

  // Sync store state with URL query parameters
  useContentManagerUrlSync(isExplorerMode);

  // searchQuery is still subscribed above for selection-clearing effect below

  // Get folder path for empty state check
  const { currentFolderSlug } = useFolderPath();

  const queryParams = useMemo(
    () =>
      buildExplorerQueryParams({
        assetClassification,
        assetRightsOwner,
        assetReviewStatus,
        assetUsagePolicy,
        category,
        currentFolderSlug,
        scope,
        sourceSetId,
        sorter,
        sortType,
        spaceId,
      }),
    [
      assetClassification,
      assetRightsOwner,
      assetReviewStatus,
      assetUsagePolicy,
      category,
      currentFolderSlug,
      scope,
      sourceSetId,
      sorter,
      sortType,
      spaceId,
    ],
  );

  const { data, governanceCapabilities, hasResolvedData, isLoading, isValidating } =
    useExplorerItems({
      enabled: isExplorerMode,
      params: queryParams,
      sorter,
      sortType,
    });

  // Check task status
  useCheckTaskStatus(data, isExplorerMode);

  // Initialize folder/file navigation effects (still need hook for complex effects)
  useContentExplorer({ hasResolvedData, isLoading });

  // Clear selections when category/source-set/search changes.
  useEffect(() => {
    setSelectedFileIds([]);
  }, [
    assetClassification,
    assetRightsOwner,
    assetReviewStatus,
    assetUsagePolicy,
    category,
    sourceSetId,
    searchQuery,
    setSelectedFileIds,
  ]);

  const showEmptyStatus =
    hasResolvedData && !isLoading && !isValidating && data.length === 0 && !currentFolderSlug;
  const isMobile = useServerConfigStore((s) => s.isMobile);
  const showSourceSetListSection = isMobile && !sourceSetId;

  return (
    <div
      className={cx(styles.page, isMobile && styles.pageMobile)}
      data-testid={'resource-explorer-shell'}
    >
      <Flexbox className={styles.shell}>
        <div className={styles.stage} data-testid={'resource-explorer-stage'}>
          <Header governanceCapabilities={governanceCapabilities} />
          {showSourceSetListSection && (
            <div className={styles.sourceSetSection}>
              <SourceSetListSection />
            </div>
          )}
          <div className={styles.viewport} data-testid={'resource-explorer-viewport'}>
            {showEmptyStatus ? (
              <EmptyPlaceholder />
            ) : viewMode === 'list' ? (
              <ListView data={data} hasResolvedData={hasResolvedData} isLoading={isLoading} />
            ) : (
              <MasonryView data={data} hasResolvedData={hasResolvedData} isLoading={isLoading} />
            )}
            <SearchResultsOverlay />
          </div>
        </div>
      </Flexbox>
    </div>
  );
});

ResourceExplorer.displayName = 'ResourceExplorer';

export default ResourceExplorer;
