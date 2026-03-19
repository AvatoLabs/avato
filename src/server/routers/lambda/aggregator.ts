import { z } from 'zod';

import { publicProcedure, router } from '@/libs/trpc/lambda';
import { aggregatorService } from '@/server/services/aggregator';
import { communityMarketCacheService } from '@/server/services/community/marketCache';
import { skillAggregatorService } from '@/server/services/skillAggregator';
import { AGGREGATOR_ALL_SOURCE, AggregatorSorts, AggregatorSource } from '@/types/aggregator';
import {
  SKILL_AGGREGATOR_ALL_SOURCE,
  SkillAggregatorSorts,
  SkillAggregatorSource,
} from '@/types/skillAggregator';

const aggregatorQuerySchema = z.object({
  installable: z.boolean().optional(),
  page: z.number().optional(),
  pageSize: z.number().optional(),
  q: z.string().optional(),
  sort: z.nativeEnum(AggregatorSorts).optional(),
  source: z.union([z.literal(AGGREGATOR_ALL_SOURCE), z.nativeEnum(AggregatorSource)]).optional(),
});

const skillAggregatorQuerySchema = z.object({
  page: z.number().optional(),
  pageSize: z.number().optional(),
  q: z.string().optional(),
  sort: z.nativeEnum(SkillAggregatorSorts).optional(),
  source: z
    .union([z.literal(SKILL_AGGREGATOR_ALL_SOURCE), z.nativeEnum(SkillAggregatorSource)])
    .optional(),
});

export const aggregatorRouter = router({
  getRegistryEntries: publicProcedure
    .input(aggregatorQuerySchema.optional())
    .query(async ({ input }) => {
      const collection = await communityMarketCacheService.getCached(
        'aggregator-entries-v4',
        {},
        () => aggregatorService.collectEntries(),
      );

      return communityMarketCacheService.getCached('aggregator-query-v2', input || {}, () =>
        aggregatorService.buildListResponse(collection, input || {}),
      );
    }),
  getSkillEntries: publicProcedure
    .input(skillAggregatorQuerySchema.optional())
    .query(async ({ input }) => {
      const meta = await communityMarketCacheService.getCached('aggregator-skill-meta-v2', {}, () =>
        skillAggregatorService.fetchMeta(),
      );

      return communityMarketCacheService.getCached('aggregator-skill-entries-v2', input || {}, () =>
        skillAggregatorService.fetchEntries(input || {}, meta),
      );
    }),
});

export type AggregatorRouter = typeof aggregatorRouter;
