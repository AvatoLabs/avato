import { useGlobalStore } from '@/store/global';

export const revealChatContextPanel = () => {
  useGlobalStore.getState().toggleRightPanel(true);

  if (typeof document === 'undefined') return;

  setTimeout(() => {
    const allEditors = [...document.querySelectorAll('[data-lexical-editor="true"]')];
    const chatInputEditor = allEditors.at(-1) as HTMLElement | undefined;

    chatInputEditor?.focus();
  }, 300);
};
