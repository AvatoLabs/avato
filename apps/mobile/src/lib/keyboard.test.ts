import { describe, expect, it } from 'vitest';

import { getKeyboardOffsetFromHeight, resolveComposerLift } from './keyboardMath';

describe('resolveComposerLift', () => {
  it('returns 0 when keyboard height is empty', () => {
    expect(getKeyboardOffsetFromHeight(0, 20)).toBe(0);
  });

  it('subtracts bottom inset from keyboard height', () => {
    expect(getKeyboardOffsetFromHeight(320, 20)).toBe(300);
  });

  it('returns 0 when keyboard is not open on android even if animated height is stale', () => {
    expect(
      resolveComposerLift({
        animatedKeyboardHeight: 320,
        bottomInset: 20,
        keyboardOffset: 0,
        platform: 'android',
      }),
    ).toBe(0);
  });

  it('follows keyboard offset on ios', () => {
    expect(
      resolveComposerLift({
        animatedKeyboardHeight: 400,
        bottomInset: 34,
        keyboardOffset: 216,
        platform: 'ios',
      }),
    ).toBe(216);
  });

  it('uses the larger of event offset and animated height on android', () => {
    expect(
      resolveComposerLift({
        animatedKeyboardHeight: 300,
        bottomInset: 24,
        keyboardOffset: 180,
        platform: 'android',
      }),
    ).toBe(286);
  });
});
