'use client';

import { Center, Checkbox, Flexbox } from '@lobehub/ui';
import { VirtuosoMasonry } from '@virtuoso.dev/masonry';
import { cssVar } from 'antd-style';
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
import type { AsyncTaskStatus } from '@/types/asyncTask';
import type { FileListItem } from '@/types/files';

import EmptyState from '../EmptyState';
import FileListItemComponent from './ListView/ListItem';
import MasonryItemWrapper from './MasonryView/MasonryItem/MasonryItemWrapper';
import { getExplorerCategoryFilter } from './queryParams';
import { useMasonryColumnCount } from './useMasonryColumnCount';

const SWR_RESOURCE_SEARCH = 'SWR_RESOURCE_SEARCH';

const SearchResultsOverlay = memo(() => {
  const { t } = useTranslation(['components', 'file']);
  const [searchQuery, sourceSetId, category, spaceId, viewMode] = useContentManagerStore((s) => [
    s.searchQuery,
    s.sourceSetId,
    s.category,
    s.spaceId,
    s.viewMode,
  ]);

  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);

  const columnWidths = useGlobalStore(
    (s) => s.status.contentManagerColumnWidths || INITIAL_STATUS.contentManagerColumnWidths,
  );
  const columnCount = useMasonryColumnCount();

  const isActive = !!searchQuery && searchQuery.length > 0;

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

  const data: FileListItem[] | undefined = useMemo(
    () =>
      rawData?.map((item) => ({
        ...item,
        chunkCount: item.chunkCount ?? null,
        chunkingError: item.chunkingError ?? null,
        chunkingStatus: (item.chunkingStatus ?? null) as AsyncTaskStatus | null,
        embeddingError: item.embeddingError ?? null,
        embeddingStatus: (item.embeddingStatus ?? null) as AsyncTaskStatus | null,
        finishEmbedding: item.finishEmbedding ?? false,
        url: item.url ?? '',
      })),
    [rawData],
  );

  const masonryContext = useMemo(
    () => ({
      sourceSetId: sourceSetId ?? undefined,
      selectFileIds: selectedFileIds,
      setSelectedFileIds,
    }),
    [sourceSetId, selectedFileIds],
  );

  if (!isActive) return null;

  return (
    <div
      style={{
        background: cssVar.colorBgContainer as string,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        left: 0,
        minHeight: 0,
        position: 'absolute',
        right: 0,
        top: 0,
        zIndex: 10,
      }}
    >
      {isLoading ? (
        <Center height="100%">
          <NeuralNetworkLoading size={48} />
        </Center>
      ) : !data || data.length === 0 ? (
        <EmptyState
          description={t('emptyState.search.description', { ns: 'file' })}
          icon={Search}
          title={t('emptyState.search.title', { ns: 'file' })}
        />
      ) : viewMode === 'list' ? (
        <Flexbox height={'100%'} style={{ minHeight: 0 }}>
          <div
            style={{
              display: 'flex',
              flex: 1,
              flexDirection: 'column',
              minHeight: 0,
              overflow: 'auto hidden',
            }}
          >
            <Flexbox
              horizontal
              align="center"
              paddingInline={8}
              style={{
                borderBlockEnd: `1px solid ${cssVar.colorBorderSecondary}`,
                color: cssVar.colorTextDescription as string,
                fontSize: 12,
                height: 40,
                minHeight: 40,
                minWidth: 800,
              }}
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
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
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
        <div
          style={{
            flex: 1,
            height: '100%',
            minHeight: 0,
            overflowY: 'auto',
          }}
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
          </div>
        </div>
      )}
    </div>
  );
});

SearchResultsOverlay.displayName = 'SearchResultsOverlay';

export default SearchResultsOverlay;
