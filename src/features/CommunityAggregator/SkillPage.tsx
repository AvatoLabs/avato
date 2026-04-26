'use client';

import { Alert, Flexbox, Skeleton } from '@lobehub/ui';
import { createStaticStyles, useResponsive } from 'antd-style';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useQuery } from '@/hooks/useQuery';
import { useClientDataSWR } from '@/libs/swr';
import Pagination from '@/routes/(main)/community/(list)/features/Pagination';
import SearchResultCount from '@/routes/(main)/community/components/SearchResultCount';
import Statistic from '@/routes/(main)/community/components/Statistic';
import Title from '@/routes/(main)/community/components/Title';
import { aggregatorClientService } from '@/services/aggregator';
import { useToolStore } from '@/store/tool/store';
import { DiscoverTab } from '@/types/discover';
import {
  SKILL_AGGREGATOR_ALL_SOURCE,
  type SkillAggregatorQueryParams,
  SkillAggregatorSorts,
  SkillAggregatorSource,
  type SkillAggregatorSourceFilter,
} from '@/types/skillAggregator';

import SkillList from './SkillList';
import SkillSourceFilter from './SkillSourceFilter';

const styles = createStaticStyles(({ css, cssVar }) => ({
  description: css`
    color: ${cssVar.colorTextSecondary};
  `,
  listPanel: css`
    overflow: hidden;
  `,
  stats: css`
    padding-block: 8px;
    padding-inline: 12px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusLG}px;

    background: ${cssVar.colorFillQuaternary};
  `,
}));

const formatNumber = (value: number) => value.toLocaleString();

const getQueryValue = (value?: string | (string | null)[] | null) => {
  if (Array.isArray(value)) return value.find((item): item is string => typeof item === 'string');
  return typeof value === 'string' ? value : undefined;
};

const parsePage = (value?: string | (string | null)[] | null) => {
  const page = Number(getQueryValue(value));
  return Number.isFinite(page) && page > 0 ? page : 1;
};

const parseSort = (value?: string | (string | null)[] | null) => {
  const sort = getQueryValue(value);
  if (!sort) return SkillAggregatorSorts.Relevance;

  return Object.values(SkillAggregatorSorts).includes(sort as SkillAggregatorSorts)
    ? (sort as SkillAggregatorSorts)
    : SkillAggregatorSorts.Relevance;
};

const parseSource = (value?: string | (string | null)[] | null): SkillAggregatorSourceFilter => {
  const source = getQueryValue(value);
  if (!source || source === SKILL_AGGREGATOR_ALL_SOURCE) return SKILL_AGGREGATOR_ALL_SOURCE;

  return Object.values(SkillAggregatorSource).includes(source as SkillAggregatorSource)
    ? (source as SkillAggregatorSource)
    : SKILL_AGGREGATOR_ALL_SOURCE;
};

const SkillAggregatorPage = memo(() => {
  const { t } = useTranslation('discover');
  const { mobile } = useResponsive();
  const { page, q, sort, source } = useQuery();
  const useFetchAgentSkills = useToolStore((s) => s.useFetchAgentSkills);
  useFetchAgentSkills(true);

  const params = useMemo<SkillAggregatorQueryParams>(() => {
    const query = typeof q === 'string' ? q.trim() : undefined;

    return {
      page: parsePage(page),
      pageSize: 21,
      q: query || undefined,
      sort: parseSort(sort),
      source: parseSource(source),
    };
  }, [page, q, sort, source]);

  const { data, isLoading } = useClientDataSWR(['community-skill-aggregator', params], () =>
    aggregatorClientService.getSkillEntries(params),
  );

  if (isLoading || !data) {
    return (
      <Flexbox gap={24} width={'100%'}>
        <Flexbox gap={8}>
          <Skeleton.Button active style={{ height: 28, width: 220 }} />
          <Skeleton.Button active size={'small'} style={{ width: 420 }} />
        </Flexbox>
        <Flexbox
          gap={16}
          horizontal={!mobile}
          style={mobile ? undefined : { alignItems: 'flex-start' }}
          width={'100%'}
        >
          <Flexbox gap={8} width={mobile ? '100%' : 220}>
            {Array.from({ length: 2 }).map((_, index) => (
              <Skeleton.Button active key={index} style={{ height: 72, width: '100%' }} />
            ))}
          </Flexbox>
          <Flexbox flex={1} gap={16} width={'100%'}>
            <Flexbox
              horizontal
              className={styles.stats}
              gap={12}
              style={{ flexWrap: 'wrap' }}
              width={'100%'}
            >
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton.Button active key={index} style={{ height: 52, width: 92 }} />
              ))}
            </Flexbox>
            <SkillList loading />
          </Flexbox>
        </Flexbox>
      </Flexbox>
    );
  }

  const countBySource = (target: SkillAggregatorSource) =>
    data.sourceCounts.find(({ source }) => source === target)?.count || 0;

  const warningDescription = data.warnings
    .map((warning) =>
      t('aggregator.warnings.item', {
        message: warning.message,
        source: t(`aggregator.skills.sources.${warning.source}`),
      }),
    )
    .join('\n');

  return (
    <Flexbox gap={24} width={'100%'}>
      <Flexbox gap={8}>
        {params.q ? (
          <SearchResultCount count={data.totalCount} keyword={params.q} />
        ) : (
          <Title>{t('aggregator.skills.title')}</Title>
        )}
        <span className={styles.description}>{t('aggregator.skills.description')}</span>
      </Flexbox>
      <Flexbox
        gap={16}
        horizontal={!mobile}
        style={mobile ? undefined : { alignItems: 'flex-start' }}
        width={'100%'}
      >
        <SkillSourceFilter
          activeSource={params.source || SKILL_AGGREGATOR_ALL_SOURCE}
          counts={{
            all: data.allCount,
            skillhub: countBySource(SkillAggregatorSource.SkillHub),
          }}
        />
        <Flexbox className={styles.listPanel} flex={1} gap={16} width={'100%'}>
          <Flexbox
            horizontal
            className={styles.stats}
            gap={12}
            style={{ flexWrap: 'wrap' }}
            width={'100%'}
          >
            <Statistic
              title={t('aggregator.skills.stats.results')}
              value={formatNumber(data.totalCount)}
            />
            <Statistic
              title={t('aggregator.skills.stats.catalog')}
              value={formatNumber(data.allCount)}
            />
            <Statistic
              title={t('aggregator.skills.stats.curated')}
              value={formatNumber(data.stats.curatedCount)}
            />
            <Statistic
              title={t('aggregator.skills.stats.verified')}
              value={formatNumber(data.stats.verifiedCount)}
            />
          </Flexbox>
          {data.warnings.length > 0 && (
            <Alert
              showIcon
              description={<span style={{ whiteSpace: 'pre-line' }}>{warningDescription}</span>}
              message={t('aggregator.warnings.title')}
              type="warning"
            />
          )}
          <SkillList data={data.items} search={Boolean(params.q)} />
          <Pagination
            currentPage={data.currentPage}
            pageSize={data.pageSize}
            tab={DiscoverTab.Aggregator}
            total={data.totalCount}
          />
        </Flexbox>
      </Flexbox>
    </Flexbox>
  );
});

SkillAggregatorPage.displayName = 'SkillAggregatorPage';

export default SkillAggregatorPage;
