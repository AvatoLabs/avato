interface ResolveFloatingTabKeyboardVisibleOptions {
  animatedKeyboardVisible: boolean;
  keyboardOffsetFromEvents?: number;
}

export const resolveFloatingTabKeyboardVisible = ({
  animatedKeyboardVisible,
  keyboardOffsetFromEvents,
}: ResolveFloatingTabKeyboardVisibleOptions) => {
  if (keyboardOffsetFromEvents !== undefined) {
    return keyboardOffsetFromEvents > 0;
  }

  return animatedKeyboardVisible;
};
