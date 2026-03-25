'use client';

import { Flexbox } from '@lobehub/ui';
import { memo } from 'react';

import { useQuery } from '@/hooks/useQuery';
import { useDiscoverStore } from '@/store/discover';
import { type AssistantQueryParams } from '@/types/discover';
import { AssistantSorts, DiscoverTab } from '@/types/discover';

import AssistantEmpty from '../../features/AssistantEmpty';
import DiscoverRequestError from '../../features/DiscoverRequestError';
import Pagination from '../features/Pagination';
import List from './features/List';
import Loading from './loading';

const AssistantPage = memo(() => {
  const { q, page, category, sort, order } = useQuery() as AssistantQueryParams;
  const useAssistantList = useDiscoverStore((s) => s.useAssistantList);
  const { data, error, isLoading, mutate } = useAssistantList({
    category,
    includeAgentGroup: true,
    order,
    page,
    pageSize: 21,
    q,
    sort: sort ?? AssistantSorts.Recommended,
  });

  if (error) return <DiscoverRequestError onRetry={() => void mutate()} />;
  if (isLoading) return <Loading />;
  if (!data) return <DiscoverRequestError onRetry={() => void mutate()} />;

  const { items, currentPage, pageSize, totalCount } = data;
  if (items.length === 0) return <AssistantEmpty search={Boolean(q || category)} />;

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

export default AssistantPage;
