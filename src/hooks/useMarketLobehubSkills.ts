/**
 * Hook to fetch LobeHub skill providers from market API
 *
 * This hook dynamically loads available skill providers from the market,
 * providing better alignment with the configured market.
 */

import {
  LOBEHUB_SKILL_PROVIDERS,
  type LobehubSkillProviderType,
  OFFICIAL_URL,
} from '@lobechat/const';
import { useEffect, useState } from 'react';

import { discoverService } from '@/services/discover';
import type { ProviderListResponse } from '@/types/discover';

interface UseMarketLobehubSkillsOptions {
  enabled?: boolean;
}

export const useMarketLobehubSkills = (options: UseMarketLobehubSkillsOptions = {}) => {
  const { enabled = true } = options;

  const [marketProviders, setMarketProviders] = useState<LobehubSkillProviderType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const fetchMarketProviders = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch provider list from market API
        const response: ProviderListResponse = await discoverService.getProviderList({
          pageSize: 100, // Get more providers to show comprehensive list
        });

        // Transform market response to match LOBEHUB_SKILL_PROVIDERS format
        const providers: LobehubSkillProviderType[] = response.items.map((item) => ({
          author: 'Avato',
          authorUrl: OFFICIAL_URL,
          defaultVisible: true,
          description: item.description || '',
          icon: (item as any).icon || (item as any).logo || '',
          id: item.identifier,
          label: item.name || item.id,
          readme: '', // Will be loaded on detail view
        }));

        setMarketProviders(providers);
      } catch (err) {
        console.error('Failed to fetch LobeHub skills from market:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch market skills'));

        // Fallback to hardcoded providers on error
        console.warn('Using fallback hardcoded providers');
      } finally {
        setLoading(false);
      }
    };

    fetchMarketProviders();
  }, [enabled]);

  // Merge market providers with local config
  // Priority: Local config > Market data
  const mergedProviders: LobehubSkillProviderType[] =
    marketProviders.length > 0
      ? mergeProviders(LOBEHUB_SKILL_PROVIDERS, marketProviders)
      : LOBEHUB_SKILL_PROVIDERS;

  return {
    error,
    loading,
    providers: mergedProviders,
  };
};

/**
 * Merge local provider config with market data
 * - Keep local metadata (icons, labels) for known providers
 * - Add new providers from market
 */
function mergeProviders(
  local: LobehubSkillProviderType[],
  market: LobehubSkillProviderType[],
): LobehubSkillProviderType[] {
  const localMap = new Map(local.map((p) => [p.id, p]));
  const result: LobehubSkillProviderType[] = [];

  // First add all local providers (with their custom icons and metadata)
  for (const localProvider of local) {
    result.push(localProvider);
  }

  // Then add market providers that are not in local config
  for (const marketProvider of market) {
    if (!localMap.has(marketProvider.id)) {
      result.push(marketProvider);
    }
  }

  return result;
}
