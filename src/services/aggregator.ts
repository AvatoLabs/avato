import { lambdaClient } from '@/libs/trpc/client';
import { type AggregatorQueryParams } from '@/types/aggregator';
import { type SkillAggregatorQueryParams } from '@/types/skillAggregator';

class AggregatorClientService {
  async getRegistryEntries(params: AggregatorQueryParams) {
    return lambdaClient.aggregator.getRegistryEntries.query(params);
  }

  async getSkillEntries(params: SkillAggregatorQueryParams) {
    return lambdaClient.aggregator.getSkillEntries.query(params);
  }
}

export const aggregatorClientService = new AggregatorClientService();
