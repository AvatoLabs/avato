import type { MarketListItem } from './api';

const COMMUNITY_DETAIL_SEGMENTS: Record<MarketListItem['_source'], string | null> = {
  agent: 'agent',
  aggregator_mcp: null,
  aggregator_skill: null,
  builtin: null,
  group_agent: 'group_agent',
  mcp: 'mcp',
  model: 'model',
  plugin: 'plugin',
  provider: 'provider',
  skill: 'skill',
};

export const getCommunityListPath = (source: MarketListItem['_source']): `/${string}` => {
  if (source === 'aggregator_mcp') return '/community/aggregator';
  if (source === 'aggregator_skill') return '/community/aggregator?kind=skills';

  const segment = source === 'group_agent' ? 'agent' : COMMUNITY_DETAIL_SEGMENTS[source];
  return segment ? `/community/${segment}` : '/community';
};

export const getCommunityDetailPath = (
  source: MarketListItem['_source'],
  identifier: string,
): `/${string}` | null => {
  const segment = COMMUNITY_DETAIL_SEGMENTS[source];
  const id = identifier.trim();

  if (!segment || !id) return null;

  return `/community/${segment}/${encodeURIComponent(id)}`;
};

export const joinWebPath = (baseUrl: string, path: `/${string}`) =>
  `${baseUrl.replace(/\/+$/, '')}${path}`;
