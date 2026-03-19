'use client';

import { Block, Flexbox, Tag, Text } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useQueryRoute } from '@/hooks/useQueryRoute';
import { usePathname } from '@/libs/router/navigation';
import {
  AGGREGATOR_ALL_SOURCE,
  AggregatorSource,
  type AggregatorSourceFilter,
} from '@/types/aggregator';

const styles = createStaticStyles(({ css, cssVar }) => ({
  description: css`
    color: ${cssVar.colorTextSecondary};
  `,
  item: css`
    transition: all 0.2s ease;
  `,
  itemCount: css`
    flex: none;
    min-width: 56px;
    text-align: end;
  `,
}));

interface SourceFilterProps {
  activeSource: AggregatorSourceFilter;
  counts: Record<'all' | 'glama' | 'higress' | 'official' | 'smithery', number>;
}

const SourceFilter = memo<SourceFilterProps>(({ activeSource, counts }) => {
  const { t } = useTranslation('discover');
  const pathname = usePathname();
  const router = useQueryRoute();

  const items = useMemo(
    () => [
      {
        count: counts.all,
        description: t('aggregator.sources.all.description'),
        key: AGGREGATOR_ALL_SOURCE,
        label: t('aggregator.sources.all'),
      },
      {
        count: counts.official,
        description: t('aggregator.sources.official.description'),
        key: AggregatorSource.Official,
        label: t('aggregator.sources.official'),
      },
      {
        count: counts.higress,
        description: t('aggregator.sources.higress.description'),
        key: AggregatorSource.Higress,
        label: t('aggregator.sources.higress'),
      },
      {
        count: counts.smithery,
        description: t('aggregator.sources.smithery.description'),
        key: AggregatorSource.Smithery,
        label: t('aggregator.sources.smithery'),
      },
      {
        count: counts.glama,
        description: t('aggregator.sources.glama.description'),
        key: AggregatorSource.Glama,
        label: t('aggregator.sources.glama'),
      },
    ],
    [counts.all, counts.glama, counts.higress, counts.official, counts.smithery, t],
  );

  return (
    <Flexbox gap={8} width={'100%'}>
      {items.map((item) => {
        const active = activeSource === item.key;

        return (
          <Block
            clickable
            className={styles.item}
            key={item.key}
            padding={14}
            variant={active ? 'filled' : 'outlined'}
            width={'100%'}
            onClick={() =>
              router.push(pathname, {
                query: {
                  page: '1',
                  source: item.key === AGGREGATOR_ALL_SOURCE ? null : item.key,
                },
              })
            }
          >
            <Flexbox horizontal align={'center'} justify={'space-between'} width={'100%'}>
              <Text strong>{item.label}</Text>
              <Tag className={styles.itemCount} variant={active ? 'filled' : 'outlined'}>
                {item.count.toLocaleString()}
              </Tag>
            </Flexbox>
            <Text as={'p'} className={styles.description} style={{ fontSize: 12 }}>
              {item.description}
            </Text>
          </Block>
        );
      })}
    </Flexbox>
  );
});

SourceFilter.displayName = 'SourceFilter';

export default SourceFilter;
