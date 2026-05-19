import { describe, expect, it } from 'vitest';

import { getCommunityDetailPath, getCommunityListPath, joinWebPath } from './communityLinks';

describe('communityLinks', () => {
  it.each([
    ['agent', '/community/agent/my-agent'],
    ['group_agent', '/community/group_agent/team'],
    ['model', '/community/model/gpt-5.4'],
    ['provider', '/community/provider/openai'],
    ['mcp', '/community/mcp/fetch'],
    ['plugin', '/community/plugin/search'],
    ['skill', '/community/skill/writer'],
  ] as const)('builds detail path for %s', (source, path) => {
    expect(getCommunityDetailPath(source, path.split('/').at(-1)!)).toBe(path);
  });

  it('keeps group agents under the agent list path', () => {
    expect(getCommunityListPath('group_agent')).toBe('/community/agent');
  });

  it('builds aggregator list paths for Web fallback', () => {
    expect(getCommunityListPath('aggregator_mcp')).toBe('/community/aggregator');
    expect(getCommunityListPath('aggregator_skill')).toBe('/community/aggregator?kind=skills');
  });

  it('does not build a detail path for builtin pseudo source', () => {
    expect(getCommunityDetailPath('builtin', 'lobe-artifacts')).toBeNull();
  });

  it('does not build a detail path for aggregator pseudo sources', () => {
    expect(getCommunityDetailPath('aggregator_mcp', 'fetch')).toBeNull();
    expect(getCommunityDetailPath('aggregator_skill', 'writer')).toBeNull();
  });

  it('joins base url and web path without duplicate slashes', () => {
    expect(joinWebPath('https://example.com/', '/community/agent')).toBe(
      'https://example.com/community/agent',
    );
  });
});
