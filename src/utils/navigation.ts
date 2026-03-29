import type { NavigateFunction, To } from 'react-router-dom';

import { isDesktop } from '@/const/version';

/**
 * Check if user is performing a modifier click (Cmd+Click on Mac, Ctrl+Click on other OS)
 * to open link in new tab. Always returns false on desktop (Electron) since
 * there's no browser tab concept.
 */
export const isModifierClick = (e: { ctrlKey: boolean; metaKey: boolean }): boolean => {
  if (isDesktop) return false;
  return e.metaKey || e.ctrlKey;
};

export const getHistoryIndex = (): number => {
  if (typeof window === 'undefined') return 0;

  return typeof window.history.state?.idx === 'number' ? window.history.state.idx : 0;
};

export const canNavigateBack = (): boolean => getHistoryIndex() > 0;

export const navigateBackOrTo = (navigate: NavigateFunction, to: To = '/') => {
  if (canNavigateBack()) {
    navigate(-1);
    return;
  }

  navigate(to);
};
