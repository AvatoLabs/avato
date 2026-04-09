'use client';

import { Center, Checkbox, Flexbox } from '@lobehub/ui';
import { VirtuosoMasonry } from '@virtuoso.dev/masonry';
import { createStaticStyles, cssVar } from 'antd-style';
import { Search } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Virtuoso } from 'react-virtuoso';

import NeuralNetworkLoading from '@/components/NeuralNetworkLoading';
import { useClientDataSWR } from '@/libs/swr';
import { useContentManagerStore } from '@/routes/(main)/content/features/store';
import { contentService } from '@/services/content';
import { useGlobalStore } from '@/store/global';
import { INITIAL_STATUS } from '@/store/global/initialState';

import EmptyState from '../EmptyState';
import { mapContentItemsToExplorerItems } from './items';
import FileListItemComponent from './ListView/ListItem';
import MasonryItemWrapper from './MasonryView/MasonryItem/MasonryItemWrapper';
import { getExplorerCategoryFilter } from './queryParams';
import { useMasonryColumnCount } from './useMasonryColumnCount';

const SWR_RESOURCE_SEARCH = 'SWR_RESOURCE_SEARCH';

const styles = createStaticStyles(({ css, cssVar }) => ({
  body: css`
    flex: 1;
    min-height: 0;
    overflow: hidden;
  `,
  count: css`
    flex-shrink: 0;

    padding: 5px 10px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 999px;

    color: ${cssVar.colorTextSecondary};
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;

    background: color-mix(in srgb, ${cssVar.colorFillQuaternary} 78%, transparent);
  `,
  header: css`
    gap: 10px;
    padding: 16px 18px;
    border-bottom: 1px solid ${cssVar.colorBorderSecondary};

    background:
      linear-gradient(
        180deg,
        color-mix(in srgb, ${cssVar.colorFillQuaternary} 76%, transparent) 0%,
        color-mix(in srgb, ${cssVar.colorBgContainer} 88%, transparent) 100%
      );
  `,
  headerEyebrow: css`
    display: flex;
    gap: 8px;
    align-items: center;

    color: ${cssVar.colorTextSecondary};
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  `,
  headerSummary: css`
    color: ${cssVar.colorTextSecondary};
    font-size: 13px;
    line-height: 1.5;
  `,
  headerTitle: css`
    overflow: hidden;

    font-size: 18px;
    font-weight: 600;
    line-height: 1.25;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  headerTop: css`
    display: flex;
    gap: 12px;
    align-items: flex-start;
    justify-content: space-between;
    flex-wrap: wrap;
  `,
  listBody: css`
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    overflow: auto hidden;
  `,
  listHeader: css`
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
    color: ${cssVar.colorTextDescription};
    font-size: 12px;
    min-width: 800px;
  `,
  masonryScroll: css`
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  `,
  masonryStage: css`
    padding-inline: clamp(16px, 2.2vw, 24px);
    padding-block: 14px 24px;
  `,
  overlay: css`
    position: absolute;
    z-index: 10;
    inset: 0;

    display: flex;
    flex-direction: column;

    min-height: 0;
    overflow: hidden;

    background:
      linear-gradient(
        180deg,
        color-mix(in srgb, ${cssVar.colorBgContainer} 97%, ${cssVar.colorBgElevated}) 0%,
        color-mix(in srgb, ${cssVar.colorBgContainer} 93%, ${cssVar.colorBgLayout}) 100%
      );
    backdrop-filter: blur(14px);
  `,
  listViewport: css`
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  `,
}));

const SearchResultsOverlay = memo(() => {
  const { t } = useTranslation(['components', 'file']);
  const [searchQuery, sourceSetId, category, spaceId, viewMode, mode] = useContentManagerStore(
    (s) => [s.searchQuery, s.sourceSetId, s.category, s.spaceId, s.viewMode, s.mode],
  );

  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);

  const columnWidths = useGlobalStore(
    (s) => s.status.contentManagerColumnWidths || INITIAL_STATUS.contentManagerColumnWidths,
  );
  const columnCount = useMasonryColumnCount();

  const isActive = mode === 'explorer' && !!searchQuery && searchQuery.length > 0;

  const { data: rawData, isLoading } = useClientDataSWR(
    isActive
      ? [
          SWR_RESOURCE_SEARCH,
          {
            category: getExplorerCategoryFilter(category, sourceSetId),
            sourceSetId,
            q: searchQuery,
            spaceId,
          },
        ]
      : null,
    async ([, params]: [
      string,
      { category?: string; sourceSetId?: string; q: string; spaceId?: string },
    ]) => {
      const response = await contentService.queryContentItems({
        ...params,
        limit: 50,
        offset: 0,
        showFilesInSourceSet: false,
      } as any);
      return response.items;
    },
  );

  const data = useMemo(() => (rawData ? mapContentItemsToExplorerItems(rawData) : undefined), [rawData]);

  const masonryContext = useMemo(
    () => ({
      sourceSetId: sourceSetId ?? undefined,
      selectFileIds: selectedFileIds,
      setSelectedFileIds,
    }),
    [sourceSetId, selectedFileIds],
  );

  if (!isActive) return null;

  const resultCount = data?.length ?? 0;

  return (
    <div className={styles.overlay} data-testid={'resource-search-overlay'}>
      <Flexbox className={styles.header}>
        <div className={styles.headerEyebrow}>
          <Search size={14} />
          {t('emptyState.search.title', { ns: 'file' })}
        </div>
        <div className={styles.headerTop}>
          <div style={{ minWidth: 0 }}>
            <div className={styles.headerTitle}>{searchQuery}</div>
            <div className={styles.headerSummary}>
              {isLoading
                ? t('discover.searching', { ns: 'components', defaultValue: 'Searching…' })
                : `${resultCount}`}
            </div>
          </div>
          {!isLoading && <div className={styles.count}>{resultCount}</div>}
        </div>
      </Flexbox>
      {isLoading ? (
        <Center className={styles.body} height="100%">
          <NeuralNetworkLoading size={48} />
        </Center>
      ) : !data || data.length === 0 ? (
        <div className={styles.body}>
          <EmptyState
            description={t('emptyState.search.description', { ns: 'file' })}
            icon={Search}
            title={t('emptyState.search.title', { ns: 'file' })}
          />
        </div>
      ) : viewMode === 'list' ? (
        <Flexbox height={'100%'} style={{ minHeight: 0 }}>
          <div className={styles.listBody}>
            <Flexbox
              className={styles.listHeader}
              horizontal
              align="center"
              paddingInline={8}
              style={{ height: 40, minHeight: 40 }}
            >
              <Center height={40} style={{ paddingInline: 4 }}>
                <Checkbox disabled checked={false} />
              </Center>
              <Flexbox
                justify="center"
                style={{
                  flexShrink: 0,
                  height: '100%',
                  maxWidth: columnWidths.name,
                  minWidth: columnWidths.name,
                  paddingBlock: 6,
                  paddingInline: '20px 16px',
                  width: columnWidths.name,
                }}
              >
                {t('FileManager.title.title', { ns: 'components' })}
              </Flexbox>
              <Flexbox
                justify="center"
                style={{
                  flexShrink: 0,
                  height: '100%',
                  paddingBlock: 6,
                  paddingInlineEnd: 16,
                  width: columnWidths.date,
                }}
              >
                {t('FileManager.title.createdAt', { ns: 'components' })}
              </Flexbox>
              <Flexbox
                justify="center"
                style={{
                  flexShrink: 0,
                  height: '100%',
                  paddingBlock: 6,
                  paddingInlineEnd: 16,
                  width: columnWidths.size,
                }}
                >
                  {t('FileManager.title.size', { ns: 'components' })}
                </Flexbox>
            </Flexbox>
            <div className={styles.listViewport}>
              <Virtuoso
                data={data}
                defaultItemHeight={48}
                fixedItemHeight={48}
                style={{ height: '100%' }}
                itemContent={(index, item) => {
                  if (!item) return null;
                  return (
                    <FileListItemComponent
                      columnWidths={columnWidths}
                      index={index}
                      isAnyRowHovered={false}
                      key={item.id}
                      selected={selectedFileIds.includes(item.id)}
                      onHoverChange={() => {}}
                      onSelectedChange={(id, checked) => {
                        if (checked) {
                          setSelectedFileIds((prev) => [...prev, id]);
                        } else {
                          setSelectedFileIds((prev) => prev.filter((fid) => fid !== id));
                        }
                      }}
                      {...item}
                    />
                  );
                }}
              />
            </div>
          </div>
        </Flexbox>
      ) : (
        <div className={styles.masonryScroll}>
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
          </div>
        </div>
      )}
    </div>
  );
});

SearchResultsOverlay.displayName = 'SearchResultsOverlay';

export default SearchResultsOverlay;
