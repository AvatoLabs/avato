import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

describe('Desktop TRPC Route', () => {
  it('should have expected trpc route directories', () => {
    const routeDirs = ['async', 'lambda', 'mobile', 'tools'];

    for (const dir of routeDirs) {
      const routePath = path.join(__dirname, dir);
      expect(existsSync(routePath)).toBe(true);
    }
  });

  it('should allow longer-running tools tRPC requests', () => {
    const toolsRoutePath = path.join(__dirname, 'tools', '[trpc]', 'route.ts');
    const routeSource = readFileSync(toolsRoutePath, 'utf8');

    expect(routeSource).toContain('export const maxDuration = 180;');
  });
});
