import { type Store } from './action';

export const selectors = {
  documentId: (s: Store) => s.documentId,
  editor: (s: Store) => s.editor,
  emoji: (s: Store) => s.emoji,
  title: (s: Store) => s.title,
  viewMode: (s: Store) => s.viewMode,
};
