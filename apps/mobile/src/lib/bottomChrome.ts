/**
 * Main-tab bar metrics + padding helpers.
 * Keep in sync with tabBarStyle in navigation/index.tsx (single source for layout math).
 */
import { useCallback, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { runOnJS, useAnimatedKeyboard, useAnimatedReaction } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { resolveFloatingTabKeyboardVisible } from './bottomChromeMath';

/** Fixed bottom tab bar: no floating gap or horizontal inset */
export const TAB_BAR_FLOAT_GAP = 0;
export const TAB_BAR_HORIZONTAL_INSET = 0;
export const TAB_BAR_HEIGHT = Platform.OS === 'android' ? 52 : 54;

/** Vertical extent of the tab bar above the home indicator (safe area excluded) */
export const FLOATING_TAB_BAR_STACK_EXTENT = TAB_BAR_FLOAT_GAP + TAB_BAR_HEIGHT;

/** Space between composer bottom and top of tab bar */
export const COMPOSER_ABOVE_TAB_GAP = 8;

const HOME_SCROLL_EXTRA_IDLE = 56;
const HOME_SCROLL_EXTRA_KEYBOARD = 28;

/** Matches Reanimated keyboard height noise; Android often relies on this path */
const KEYBOARD_VISIBLE_THRESHOLD = 2;

/**
 * Tab bar hides with keyboard (`tabBarHideOnKeyboard`). Combine OS keyboard events
 * (`keyboardOffset` from RN Keyboard) with `useAnimatedKeyboard` so Android stays correct
 * when composer lift uses animated height instead of JS events.
 */
function useFloatingTabKeyboardChromeVisible(keyboardOffsetFromEvents?: number) {
  const keyboard = useAnimatedKeyboard();
  const [animDrivenVisible, setAnimDrivenVisible] = useState(false);

  const setVisible = useCallback((next: boolean) => {
    setAnimDrivenVisible(next);
  }, []);

  useAnimatedReaction(
    () => keyboard.height.value,
    (height, prev) => {
      const visible = height > KEYBOARD_VISIBLE_THRESHOLD;
      const prevHeight = prev ?? 0;
      const wasVisible = prevHeight > KEYBOARD_VISIBLE_THRESHOLD;
      if (visible !== wasVisible) {
        runOnJS(setVisible)(visible);
      }
    },
  );

  return resolveFloatingTabKeyboardVisible({
    animatedKeyboardVisible: animDrivenVisible,
    keyboardOffsetFromEvents,
  });
}

/** Stack screens (e.g. ChatDetail) — no floating tab */
export function stackScreenComposerPaddingBottom(safeBottom: number): number {
  return Math.max(safeBottom, 8);
}

/** Main tabs: composer sits above the fixed tab bar */
export function mainTabComposerPaddingBottom(safeBottom: number): number {
  return safeBottom + FLOATING_TAB_BAR_STACK_EXTENT + COMPOSER_ABOVE_TAB_GAP;
}

/**
 * When the keyboard is open, React Navigation hides the tab bar (`tabBarHideOnKeyboard`),
 * so composer padding should match stack screens.
 */
export function mainTabComposerPaddingBottomWhenKeyboard(
  safeBottom: number,
  keyboardVisible: boolean,
): number {
  if (keyboardVisible) {
    return stackScreenComposerPaddingBottom(safeBottom);
  }
  return mainTabComposerPaddingBottom(safeBottom);
}

/** Home hero ScrollView — air above composer; keyboard adds safe-area breathing */
export function mainTabHomeScrollPaddingBottom(safeBottom: number, keyboardVisible: boolean): number {
  if (keyboardVisible) {
    return Math.max(safeBottom, 8) + HOME_SCROLL_EXTRA_KEYBOARD;
  }
  return HOME_SCROLL_EXTRA_IDLE;
}

/**
 * Full-height panels (directory, side drawer) where the tab bar may still show beside the panel.
 */
export function mainTabOverlayListPaddingBottom(safeBottom: number, keyboardVisible: boolean): number {
  if (keyboardVisible) {
    return Math.max(safeBottom, 8) + 16;
  }
  return safeBottom + FLOATING_TAB_BAR_STACK_EXTENT + 16;
}

/**
 * @param keyboardOffset - Pass raw `keyboardOffset` state from `Keyboard` listeners when the
 *   screen uses them for composer lift (iOS); combined with animated keyboard height for Android.
 */
export function useMainTabBottomInsets(keyboardOffsetFromEvents?: number) {
  const insets = useSafeAreaInsets();
  const keyboardVisible = useFloatingTabKeyboardChromeVisible(keyboardOffsetFromEvents);

  return useMemo(
    () => ({
      composerPaddingBottom: mainTabComposerPaddingBottomWhenKeyboard(insets.bottom, keyboardVisible),
      homeScrollPaddingBottom: mainTabHomeScrollPaddingBottom(insets.bottom, keyboardVisible),
      overlayListPaddingBottom: mainTabOverlayListPaddingBottom(insets.bottom, keyboardVisible),
    }),
    [insets.bottom, keyboardVisible],
  );
}

/** Main-tab pages with scroll content but no bottom composer (Store, Resource lists, Profile) */
export function mainTabScrollableContentPaddingBottom(safeBottom: number): number {
  return safeBottom + FLOATING_TAB_BAR_STACK_EXTENT + 24;
}

export function mainTabScrollableContentPaddingBottomWhenKeyboard(
  safeBottom: number,
  keyboardVisible: boolean,
): number {
  if (keyboardVisible) {
    return Math.max(safeBottom, 8) + 24;
  }
  return mainTabScrollableContentPaddingBottom(safeBottom);
}

export function useMainTabScrollableContentPaddingBottom(keyboardOffsetFromEvents?: number) {
  const insets = useSafeAreaInsets();
  const keyboardVisible = useFloatingTabKeyboardChromeVisible(keyboardOffsetFromEvents);

  return useMemo(
    () => mainTabScrollableContentPaddingBottomWhenKeyboard(insets.bottom, keyboardVisible),
    [insets.bottom, keyboardVisible],
  );
}
