import { describe, expect, it } from 'vitest';

import { communityPlugin } from './communityPlugin';

describe('communityPlugin', () => {
  it('ignores disabled assistant marketplace routes by default', () => {
    expect(communityPlugin.parseUrl('/community/agent', new URLSearchParams())).toBeNull();
  });

  it('normalizes stale assistant marketplace references back to community', () => {
    expect(
      communityPlugin.generateUrl({
        id: 'community:agent',
        lastVisited: Date.now(),
        params: { section: 'agent' },
        type: 'community',
      }),
    ).toBe('/community');
  });
});
