export const ANDROID_COMPOSER_LIFT_ADJUSTMENT = -10;

interface ResolveComposerLiftOptions {
  animatedKeyboardHeight?: number;
  bottomInset?: number;
  keyboardOffset?: number;
  platform?: string;
}

export const getKeyboardOffsetFromHeight = (keyboardHeight = 0, bottomInset = 0) => {
  if (keyboardHeight <= 0) return 0;

  return Math.max(0, keyboardHeight - bottomInset);
};

export const resolveComposerLift = ({
  animatedKeyboardHeight = 0,
  bottomInset = 0,
  keyboardOffset = 0,
  platform,
}: ResolveComposerLiftOptions) => {
  'worklet';

  if (keyboardOffset <= 0) return 0;
  if (platform !== 'android') return keyboardOffset;

  const animatedLift = Math.max(
    0,
    Number(animatedKeyboardHeight) - bottomInset - ANDROID_COMPOSER_LIFT_ADJUSTMENT,
  );

  return Math.max(keyboardOffset, animatedLift);
};
