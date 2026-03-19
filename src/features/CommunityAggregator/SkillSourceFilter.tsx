'use client';

import { Block, Flexbox, Tag, Text } from '@lobehub/ui';
import { createStaticStyles, useResponsive } from 'antd-style';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useQueryRoute } from '@/hooks/useQueryRoute';
import { usePathname } from '@/libs/router/navigation';
import {
  SKILL_AGGREGATOR_ALL_SOURCE,
  SkillAggregatorSource,
  type SkillAggregatorSourceFilter,
} from '@/types/skillAggregator';

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

interface SkillSourceFilterProps {
  activeSource: SkillAggregatorSourceFilter;
  counts: Record<'all' | 'skillhub', number>;
}

const SkillSourceFilter = memo<SkillSourceFilterProps>(({ activeSource, counts }) => {
  const { t } = useTranslation('discover');
  const { mobile } = useResponsive();
  const pathname = usePathname();
  const router = useQueryRoute();

  const items = useMemo(
    () => [
      {
        count: counts.all,
        description: t('aggregator.skills.sources.all.description'),
        key: SKILL_AGGREGATOR_ALL_SOURCE,
        label: t('aggregator.skills.sources.all'),
      },
      {
        count: counts.skillhub,
        description: t('aggregator.skills.sources.skillhub.description'),
        key: SkillAggregatorSource.SkillHub,
        label: t('aggregator.skills.sources.skillhub'),
      },
    ],
    [counts.all, counts.skillhub, t],
  );

  return (
    <Flexbox gap={8} width={mobile ? '100%' : 220}>
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
                  source: item.key === SKILL_AGGREGATOR_ALL_SOURCE ? null : item.key,
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

SkillSourceFilter.displayName = 'SkillSourceFilter';

export default SkillSourceFilter;
