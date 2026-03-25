'use client';

import { Flexbox } from '@lobehub/ui';
import { memo } from 'react';

import { useQuery } from '@/hooks/useQuery';
import { useDiscoverStore } from '@/store/discover';
import { type SkillQueryParams } from '@/types/discover';
import { DiscoverTab, SkillSorts } from '@/types/discover';

import DiscoverRequestError from '../../features/DiscoverRequestError';
import SkillEmpty from '../../features/SkillEmpty';
import Pagination from '../features/Pagination';
import List from './features/List';
import Loading from './loading';

const SkillPage = memo(() => {
  const { q, page, category, sort, order } = useQuery() as SkillQueryParams;
  const useSkillList = useDiscoverStore((s) => s.useFetchSkillList);
  const { data, error, isLoading, mutate } = useSkillList({
    category,
    order,
    page,
    pageSize: 21,
    q,
    sort: sort ?? SkillSorts.InstallCount,
  });

  if (isLoading) return <Loading />;
  if (error) return <DiscoverRequestError onRetry={() => void mutate()} />;
  if (!data) return <Loading />;

  const { items, currentPage, pageSize, totalCount } = data;
  if (items.length === 0) return <SkillEmpty search={Boolean(q || category)} />;

  return (
    <Flexbox gap={32} width={'100%'}>
      <List data={items} />
      <Pagination
        currentPage={currentPage}
        pageSize={pageSize}
        tab={DiscoverTab.Skills}
        total={totalCount}
      />
    </Flexbox>
  );
});

export default SkillPage;
