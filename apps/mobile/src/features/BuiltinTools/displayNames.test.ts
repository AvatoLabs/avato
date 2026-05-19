import { describe, expect, it } from 'vitest';

import { getMobileBuiltinDisplayName } from './displayNames';

describe('getMobileBuiltinDisplayName', () => {
  it('uses the i18n resolver before legacy locale maps', () => {
    expect(
      getMobileBuiltinDisplayName('lobe-gtd', 'clearTodos', {
        locale: 'en-US',
        t: (key) => (key === 'builtinToolGtdClearTodos' ? 'Localized clear' : undefined),
      }),
    ).toBe('Localized clear');
  });

  it('falls back to legacy zh names when no resolver is provided', () => {
    expect(getMobileBuiltinDisplayName('lobe-calculator', 'calculate', 'zh-CN')).toBe('计算');
  });

  it('falls back to legacy english names for non-zh locales', () => {
    expect(getMobileBuiltinDisplayName('lobe-web-browsing', 'search', 'en-US')).toBe('Web search');
  });

  it('returns undefined for unknown builtin tool calls', () => {
    expect(getMobileBuiltinDisplayName('unknown', 'missing', 'zh-CN')).toBeUndefined();
  });
});
