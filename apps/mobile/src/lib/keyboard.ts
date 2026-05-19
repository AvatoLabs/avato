import { type EmitterSubscription, Keyboard, type KeyboardEvent,Platform } from 'react-native';

import { getKeyboardOffsetFromHeight } from './keyboardMath';

export {
  ANDROID_COMPOSER_LIFT_ADJUSTMENT,
  getKeyboardOffsetFromHeight,
  resolveComposerLift,
} from './keyboardMath';


interface ComposerKeyboardSubscriptionsOptions {
  bottomInset?: number;
  onBeforeChange?: () => void;
  onKeyboardOffsetChange: (offset: number) => void;
  platform?: string;
}

export const getKeyboardOffset = (
  event?: KeyboardEvent | null,
  bottomInset = 0,
) => {
  const keyboardHeight = Number(event?.endCoordinates?.height ?? 0);
  return getKeyboardOffsetFromHeight(keyboardHeight, bottomInset);
};

export const createComposerKeyboardSubscriptions = ({
  bottomInset = 0,
  onBeforeChange,
  onKeyboardOffsetChange,
  platform = Platform.OS,
}: ComposerKeyboardSubscriptionsOptions): EmitterSubscription[] => {
  const emitOffset = (offset: number) => {
    onBeforeChange?.();
    onKeyboardOffsetChange(offset);
  };

  const handleKeyboardShow = (event: KeyboardEvent) => {
    emitOffset(getKeyboardOffset(event, bottomInset));
  };

  const handleKeyboardHide = () => {
    emitOffset(0);
  };

  if (platform === 'ios') {
    return [
      Keyboard.addListener('keyboardWillShow', handleKeyboardShow),
      Keyboard.addListener('keyboardWillHide', handleKeyboardHide),
      Keyboard.addListener('keyboardWillChangeFrame', (event) => {
        const nextOffset = getKeyboardOffset(event, bottomInset);
        if (nextOffset <= 0) {
          handleKeyboardHide();
          return;
        }

        handleKeyboardShow(event);
      }),
    ];
  }

  return [
    Keyboard.addListener('keyboardDidShow', handleKeyboardShow),
    Keyboard.addListener('keyboardDidHide', handleKeyboardHide),
  ];
};
