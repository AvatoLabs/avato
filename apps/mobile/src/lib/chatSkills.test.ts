import { describe, expect, it } from 'vitest';

import { MOBILE_RECOMMENDED_BUILTIN_SKILLS } from '../constants/recommendedBuiltins';
import { buildBuiltinSkillItems, partitionSkillPickerItems } from './chatSkills';

describe('buildBuiltinSkillItems', () => {
  it('filters uninstalled builtins and resolves localized labels', () => {
    const items = buildBuiltinSkillItems(
      MOBILE_RECOMMENDED_BUILTIN_SKILLS.slice(0, 2),
      (key, fallback) => `${key}:${fallback}`,
      ['lobe-user-memory'],
    );

    expect(items).toEqual([
      expect.objectContaining({
        description: 'skillsBuiltinArtifactsDesc:',
        identifier: 'lobe-artifacts',
        title: 'skillsBuiltinArtifactsTitle:lobe-artifacts',
      }),
    ]);
  });
});

describe('partitionSkillPickerItems', () => {
  it('removes builtin duplicates from skills and plugins, and removes plugin duplicates from skills', () => {
    const builtinItems = [
      {
        description: '',
        icon: 'artifacts' as const,
        identifier: 'lobe-artifacts',
        title: 'Artifacts',
      },
    ];

    const { filteredPlugins, filteredSkills } = partitionSkillPickerItems({
      builtinItems,
      plugins: [
        { identifier: 'lobe-artifacts', type: 'default' as never },
        { identifier: 'skill-a', type: 'default' as never },
        { identifier: 'plugin-b', type: 'default' as never },
      ],
      skills: [
        { id: '1', identifier: 'lobe-artifacts', name: 'Builtin duplicate' },
        { id: '2', identifier: 'skill-a', name: 'Skill A' },
        { id: '3', identifier: 'skill-c', name: 'Skill C' },
      ],
    });

    expect(filteredSkills.map((item) => item.identifier)).toEqual(['skill-a', 'skill-c']);
    expect(filteredPlugins.map((item) => item.identifier)).toEqual(['plugin-b']);
  });
});
