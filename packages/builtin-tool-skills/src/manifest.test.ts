import { describe, expect, it } from 'vitest';

import { SkillsApiName } from './types';

describe('SkillsManifest', () => {
  it('exposes exportFile in both web and desktop manifests', async () => {
    const [{ SkillsManifest: webManifest }, { SkillsManifest: desktopManifest }] =
      await Promise.all([import('./manifest'), import('./manifest.desktop')]);

    expect(webManifest.api.map((api) => api.name)).toContain(SkillsApiName.exportFile);
    expect(desktopManifest.api.map((api) => api.name)).toContain(SkillsApiName.exportFile);
  });

  it('exposes execScript timeout in both web and desktop manifests', async () => {
    const [{ SkillsManifest: webManifest }, { SkillsManifest: desktopManifest }] =
      await Promise.all([import('./manifest'), import('./manifest.desktop')]);

    for (const manifest of [webManifest, desktopManifest]) {
      const execScript = manifest.api.find((api) => api.name === SkillsApiName.execScript);
      expect(execScript?.parameters.properties).toMatchObject({
        timeout: {
          type: 'number',
        },
      });
    }
  });
});
