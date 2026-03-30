import { describe, expect, it } from 'vitest';

import {
  isObsidianTheme,
  OBSIDIAN_THEME_NEUTRAL,
  OBSIDIAN_THEME_PRIMARY,
  resolveAppearanceThemeColors,
  resolvePrimaryColorValue,
  resolveSolidTextColor,
  resolveThemeAppearance,
  resolveThemeMode,
  resolveThemePrimaryAlias,
} from './themeShared';

describe('themeShared', () => {
  it('maps theme mode to antd ThemeProvider values', () => {
    expect(resolveThemeMode('light')).toBe('light');
    expect(resolveThemeMode('dark')).toBe('dark');
    expect(resolveThemeMode('system')).toBe('auto');
    expect(resolveThemeMode(undefined)).toBe('auto');
  });

  it('prioritizes explicit theme mode over lagging system appearance', () => {
    expect(resolveThemeAppearance({ isDark: true, themeMode: 'light' })).toBe('light');
    expect(resolveThemeAppearance({ isDark: false, themeMode: 'dark' })).toBe('dark');
    expect(resolveThemeAppearance({ isDark: true, themeMode: 'system' })).toBe('dark');
    expect(resolveThemeAppearance({ isDark: false, themeMode: undefined })).toBe('light');
  });

  it('falls back to the default primary color value', () => {
    expect(resolvePrimaryColorValue()).toBeTruthy();
    expect(resolvePrimaryColorValue('green')).not.toBe(resolvePrimaryColorValue('blue'));
    expect(resolvePrimaryColorValue(OBSIDIAN_THEME_PRIMARY)).toBe(OBSIDIAN_THEME_PRIMARY);
    expect(resolvePrimaryColorValue('#16A34A')).toBe(resolvePrimaryColorValue('green'));
  });

  it('maps legacy preset hex colors back to supported palette keys', () => {
    expect(resolveThemePrimaryAlias('#16A34A')).toBe('green');
    expect(resolveThemePrimaryAlias('#00B8FF')).toBe('cyan');
    expect(resolveThemePrimaryAlias('magenta')).toBe('magenta');
  });

  it('returns the right solid text color for primary surfaces', () => {
    expect(resolveSolidTextColor('yellow')).toBe('#ffffff');
    expect(resolveSolidTextColor('lime')).toBe('#ffffff');
    expect(resolveSolidTextColor('blue')).toBe('#ffffff');
    expect(resolveSolidTextColor('geekblue')).toBe('#ffffff');
    expect(resolveSolidTextColor('#ffffff')).toBe('#141414');
  });

  it('resolves obsidian preset to black/light inversions by appearance', () => {
    expect(isObsidianTheme(OBSIDIAN_THEME_PRIMARY, OBSIDIAN_THEME_NEUTRAL)).toBe(true);
    expect(
      resolveAppearanceThemeColors({
        appearance: 'dark',
        neutralColor: OBSIDIAN_THEME_NEUTRAL,
        primaryColor: OBSIDIAN_THEME_PRIMARY,
      }),
    ).toEqual({
      neutralColor: OBSIDIAN_THEME_NEUTRAL,
      primaryColor: '#ffffff',
    });
    expect(
      resolveAppearanceThemeColors({
        appearance: 'light',
        neutralColor: OBSIDIAN_THEME_NEUTRAL,
        primaryColor: OBSIDIAN_THEME_PRIMARY,
      }),
    ).toEqual({
      neutralColor: OBSIDIAN_THEME_NEUTRAL,
      primaryColor: OBSIDIAN_THEME_PRIMARY,
    });
  });
});
