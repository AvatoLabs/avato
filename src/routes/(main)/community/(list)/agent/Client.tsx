'use client';

import { Flexbox } from '@lobehub/ui';
import { memo } from 'react';

import { withSuspense } from '@/components/withSuspense';
import { useQuery } from '@/hooks/useQuery';
import { useDiscoverStore } from '@/store/discover';
import { type AssistantQueryParams } from '@/types/discover';
import { DiscoverTab } from '@/types/discover';

import AssistantEmpty from '../../features/AssistantEmpty';
import DiscoverRequestError from '../../features/DiscoverRequestError';
import Pagination from '../features/Pagination';
import List from './features/List';
import Loading from './loading';

const Client = memo<{ mobile?: boolean }>(() => {
  const { q, page, category, sort, order, ownerId } = useQuery() as AssistantQueryParams;
  const useAssistantList = useDiscoverStore((s) => s.useAssistantList);
  const { data, error, isLoading, mutate } = useAssistantList({
    category,
    order,
    ownerId,
    page,
    pageSize: 21,
    q,
    sort,
  });

  if (isLoading) return <Loading />;
  if (error) return <DiscoverRequestError onRetry={() => void mutate()} />;
  if (!data) return <Loading />;

  const { items, currentPage, pageSize, totalCount } = data;
  if (items.length === 0) return <AssistantEmpty search={Boolean(q || category || ownerId)} />;

  return (
    <Flexbox gap={32} width={'100%'}>
      <List data={items} />
      <Pagination
        currentPage={currentPage}
        pageSize={pageSize}
        tab={DiscoverTab.Assistants}
        total={totalCount}
      />
    </Flexbox>
  );
});

export default withSuspense(Client);
