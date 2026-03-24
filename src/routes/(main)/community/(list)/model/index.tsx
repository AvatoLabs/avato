'use client';

import { Flexbox } from '@lobehub/ui';
import { memo } from 'react';

import { useQuery } from '@/hooks/useQuery';
import { useDiscoverStore } from '@/store/discover';
import { type ModelQueryParams } from '@/types/discover';
import { DiscoverTab } from '@/types/discover';

import DiscoverRequestError from '../features/DiscoverRequestError';
import ModelEmpty from '../features/ModelEmpty';
import Pagination from '../features/Pagination';
import List from './features/List';
import Loading from './loading';

const ModelPage = memo<{ mobile?: boolean }>(() => {
  const { q, page, category, sort, order } = useQuery() as ModelQueryParams;
  const useModelList = useDiscoverStore((s) => s.useModelList);
  const { data, error, isLoading, mutate } = useModelList({
    category,
    order,
    page,
    pageSize: 21,
    q,
    sort,
  });

  if (isLoading) return <Loading />;
  if (error) return <DiscoverRequestError onRetry={() => void mutate()} />;
  if (!data) return <Loading />;

  const { items, currentPage, pageSize, totalCount } = data;
  if (items.length === 0) return <ModelEmpty search={Boolean(q || category)} />;

  return (
    <Flexbox gap={32} width={'100%'}>
      <List data={items} />
      <Pagination
        currentPage={currentPage}
        pageSize={pageSize}
        tab={DiscoverTab.Models}
        total={totalCount}
      />
    </Flexbox>
  );
});

export default ModelPage;
