import { describe, expect, it } from 'vitest';

import { SkillsApiName } from './types';

describe('SkillsManifest', () => {
  it('exposes exportFile in both web and desktop manifests', async () => {
    const [{ SkillsManifest: webManifest }, { SkillsManifest: desktopManifest }] =
      await Promise.all([import('./manifest'), import('./manifest.desktop')]);

    expect(webManifest.api.map((api) => api.name)).toContain(SkillsApiName.exportFile);
    expect(desktopManifest.api.map((api) => api.name)).toContain(SkillsApiName.exportFile);
  });
});
