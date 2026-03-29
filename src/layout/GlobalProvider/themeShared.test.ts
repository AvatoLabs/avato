import { describe, expect, it } from 'vitest';

import { resolvePrimaryColorValue, resolveSolidTextColor, resolveThemeMode } from './themeShared';

describe('themeShared', () => {
  it('maps theme mode to antd ThemeProvider values', () => {
    expect(resolveThemeMode('light')).toBe('light');
    expect(resolveThemeMode('dark')).toBe('dark');
    expect(resolveThemeMode('system')).toBe('auto');
    expect(resolveThemeMode(undefined)).toBe('auto');
  });

  it('falls back to the default primary color value', () => {
    expect(resolvePrimaryColorValue()).toBeTruthy();
    expect(resolvePrimaryColorValue('green')).not.toBe(resolvePrimaryColorValue('blue'));
  });

  it('returns a darker solid text color for bright accents', () => {
    expect(resolveSolidTextColor('yellow')).toBe('#141414');
    expect(resolveSolidTextColor('lime')).toBe('#141414');
    expect(resolveSolidTextColor('blue')).toBe('#141414');
    expect(resolveSolidTextColor('geekblue')).toBe('#ffffff');
  });
});
