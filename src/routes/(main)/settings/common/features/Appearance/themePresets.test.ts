import { neutralColors, primaryColors } from '@lobehub/ui';
import { describe, expect, it } from 'vitest';

import { getThemePresetPreview, resolveThemePreset } from './themePresets';

describe('themePresets', () => {
  it('resolves matching preset colors to the preset id', () => {
    expect(resolveThemePreset(undefined, undefined)).toBe('classic');
    expect(resolveThemePreset('cyan', 'slate')).toBe('tide');
  });

  it('falls back to custom when colors do not match a preset', () => {
    expect(resolveThemePreset('blue', 'sage')).toBe('custom');
  });

  it('uses the current colors for the custom preset preview', () => {
    expect(
      getThemePresetPreview('custom', {
        neutralColor: 'sand',
        primaryColor: 'volcano',
      }),
    ).toEqual({
      accent: primaryColors.volcano,
      neutral: neutralColors.sand,
    });
  });
});
