'use client';

import { Flexbox } from '@lobehub/ui';
import { memo } from 'react';

import { useQuery } from '@/hooks/useQuery';
import { useDiscoverStore } from '@/store/discover';
import { type ProviderQueryParams } from '@/types/discover';
import { DiscoverTab } from '@/types/discover';

import DiscoverRequestError from '../../features/DiscoverRequestError';
import ProviderEmpty from '../../features/ProviderEmpty';
import Pagination from '../features/Pagination';
import List from './features/List';
import Loading from './loading';

const ProviderPage = memo(() => {
  const { q, page, sort, order } = useQuery() as ProviderQueryParams;
  const useProviderList = useDiscoverStore((s) => s.useProviderList);
  const { data, error, isLoading, mutate } = useProviderList({
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
  if (items.length === 0) return <ProviderEmpty search={Boolean(q)} />;

  return (
    <Flexbox gap={32} width={'100%'}>
      <List data={items} />
      <Pagination
        currentPage={currentPage}
        pageSize={pageSize}
        tab={DiscoverTab.Providers}
        total={totalCount}
      />
    </Flexbox>
  );
});

export default ProviderPage;
