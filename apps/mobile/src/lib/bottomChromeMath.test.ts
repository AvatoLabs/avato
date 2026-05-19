import { describe, expect, it } from 'vitest';

import { resolveFloatingTabKeyboardVisible } from './bottomChromeMath';

describe('resolveFloatingTabKeyboardVisible', () => {
  it('falls back to animated keyboard visibility when no event offset is provided', () => {
    expect(
      resolveFloatingTabKeyboardVisible({
        animatedKeyboardVisible: true,
      }),
    ).toBe(true);
    expect(
      resolveFloatingTabKeyboardVisible({
        animatedKeyboardVisible: false,
      }),
    ).toBe(false);
  });

  it('prefers explicit event offset when available', () => {
    expect(
      resolveFloatingTabKeyboardVisible({
        animatedKeyboardVisible: true,
        keyboardOffsetFromEvents: 0,
      }),
    ).toBe(false);
    expect(
      resolveFloatingTabKeyboardVisible({
        animatedKeyboardVisible: false,
        keyboardOffsetFromEvents: 48,
      }),
    ).toBe(true);
  });
});
