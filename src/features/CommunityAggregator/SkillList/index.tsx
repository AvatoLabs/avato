'use client';

import { Grid } from '@lobehub/ui';
import { memo } from 'react';

import ListLoading from '@/routes/(main)/community/components/ListLoading';
import { type SkillAggregatorItem } from '@/types/skillAggregator';

import AggregatorEmpty from '../Empty';
import Item from './Item';

interface SkillAggregatorListProps {
  data?: SkillAggregatorItem[];
  loading?: boolean;
  rows?: number;
  search?: boolean;
}

const SkillAggregatorList = memo<SkillAggregatorListProps>(
  ({ data = [], loading, rows = 3, search }) => {
    if (loading) return <ListLoading length={9} rows={rows} />;
    if (data.length === 0) {
      return (
        <AggregatorEmpty
          description="aggregator.skills.empty.description"
          search={search}
          searchDescription="aggregator.skills.empty.search"
          title="aggregator.skills.empty.title"
        />
      );
    }

    return (
      <Grid rows={rows} width={'100%'}>
        {data.map((item) => (
          <Item key={item.id} {...item} />
        ))}
      </Grid>
    );
  },
);

SkillAggregatorList.displayName = 'SkillAggregatorList';

export default SkillAggregatorList;
