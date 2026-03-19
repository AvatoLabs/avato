'use client';

import { Grid } from '@lobehub/ui';
import { memo } from 'react';

import ListLoading from '@/routes/(main)/community/components/ListLoading';
import { type AggregatorItem } from '@/types/aggregator';

import AggregatorEmpty from '../Empty';
import Item from './Item';

interface AggregatorListProps {
  data?: AggregatorItem[];
  loading?: boolean;
  rows?: number;
  search?: boolean;
}

const AggregatorList = memo<AggregatorListProps>(({ data = [], loading, rows = 3, search }) => {
  if (loading) return <ListLoading length={9} rows={rows} />;
  if (data.length === 0) return <AggregatorEmpty search={search} />;

  return (
    <Grid rows={rows} width={'100%'}>
      {data.map((item) => (
        <Item key={item.id} {...item} />
      ))}
    </Grid>
  );
});

AggregatorList.displayName = 'AggregatorList';

export default AggregatorList;
