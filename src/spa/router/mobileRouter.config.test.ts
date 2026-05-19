import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const routeConfigSource = readFileSync(
  join(process.cwd(), 'src/spa/router/mobileRouter.config.tsx'),
  'utf8',
);

describe('mobileRoutes', () => {
  it('registers mobile community routes opened from the RN Store Web fallback', () => {
    expect(routeConfigSource).toContain("path: 'aggregator'");
    expect(routeConfigSource).toContain("path: 'skill'");
    expect(routeConfigSource).toContain("path: 'skill/:slug'");
    expect(routeConfigSource).toContain("path: 'group_agent/:slug'");
    expect(routeConfigSource).toContain('MobileDiscoverGroupAgentDetailPage');
    expect(routeConfigSource).toContain('MobileSkillPage');
  });

  it('registers mobile Web fallback routes for RN-only simplified surfaces', () => {
    expect(routeConfigSource).toContain("path: 'group'");
    expect(routeConfigSource).toContain("path: ':gid'");
    expect(routeConfigSource).toContain("path: 'image'");
    expect(routeConfigSource).toContain("path: 'video'");
    expect(routeConfigSource).toContain("path: 'studio'");
  });
});
