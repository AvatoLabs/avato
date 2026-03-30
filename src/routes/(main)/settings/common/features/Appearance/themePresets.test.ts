import { neutralColors, primaryColors } from '@lobehub/ui';
import { describe, expect, it } from 'vitest';

import { getThemePresetPreview, resolveThemePreset } from './themePresets';

describe('themePresets', () => {
  it('resolves matching preset colors to the preset id', () => {
    expect(resolveThemePreset(undefined, undefined)).toBe('obsidian');
    expect(resolveThemePreset('green', 'slate')).toBe('forest');
    expect(resolveThemePreset('blue', 'slate')).toBe('surge');
    expect(resolveThemePreset('volcano', 'slate')).toBe('ember');
    expect(resolveThemePreset('magenta', 'slate')).toBe('velvet');
    expect(resolveThemePreset('geekblue', 'slate')).toBe('midnight');
    expect(resolveThemePreset('#000000', 'slate')).toBe('obsidian');
  });

  it('keeps legacy hex presets mapped to the renamed options', () => {
    expect(resolveThemePreset('#16A34A', 'slate')).toBe('forest');
    expect(resolveThemePreset('#00B8FF', 'slate')).toBe('surge');
    expect(resolveThemePreset('cyan', 'slate')).toBe('surge');
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

  it('keeps saturated presets colorful and only inverts obsidian by appearance', () => {
    expect(getThemePresetPreview('forest', undefined, 'light')).toEqual({
      accent: primaryColors.green,
      neutral: neutralColors.slate,
    });
    expect(getThemePresetPreview('forest', undefined, 'dark')).toEqual({
      accent: primaryColors.green,
      neutral: neutralColors.slate,
    });
    expect(getThemePresetPreview('surge', undefined, 'light')).toEqual({
      accent: primaryColors.blue,
      neutral: neutralColors.slate,
    });
    expect(getThemePresetPreview('surge', undefined, 'dark')).toEqual({
      accent: primaryColors.blue,
      neutral: neutralColors.slate,
    });
    expect(getThemePresetPreview('obsidian', undefined, 'light')).toEqual({
      accent: '#000000',
      neutral: neutralColors.slate,
    });
    expect(getThemePresetPreview('obsidian', undefined, 'dark')).toEqual({
      accent: '#ffffff',
      neutral: neutralColors.slate,
    });
  });
});
