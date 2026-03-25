'use client';

import { Flexbox } from '@lobehub/ui';
import { memo } from 'react';

import { useQuery } from '@/hooks/useQuery';
import { useDiscoverStore } from '@/store/discover';
import { type McpQueryParams } from '@/types/discover';
import { DiscoverTab, McpSorts } from '@/types/discover';

import DiscoverRequestError from '../../features/DiscoverRequestError';
import McpEmpty from '../../features/McpEmpty';
import Pagination from '../features/Pagination';
import List from './features/List';
import Loading from './loading';

const McpPage = memo(() => {
  const { q, page, category, sort, order } = useQuery() as McpQueryParams;
  const useMcpList = useDiscoverStore((s) => s.useFetchMcpList);
  const { data, error, isLoading, mutate } = useMcpList({
    category,
    order,
    page,
    pageSize: 21,
    q,
    sort: sort ?? McpSorts.Recommended,
  });

  if (error) return <DiscoverRequestError onRetry={() => void mutate()} />;
  if (isLoading) return <Loading />;
  if (!data) return <DiscoverRequestError onRetry={() => void mutate()} />;

  const { items, currentPage, pageSize, totalCount } = data;
  if (items.length === 0) return <McpEmpty search={Boolean(q || category)} />;

  return (
    <Flexbox gap={32} width={'100%'}>
      <List data={items} />
      <Pagination
        currentPage={currentPage}
        pageSize={pageSize}
        tab={DiscoverTab.Mcp}
        total={totalCount}
      />
    </Flexbox>
  );
});

export default McpPage;
