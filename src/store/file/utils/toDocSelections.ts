import { type ChatContextContent, type DocSelection } from '@lobechat/types';

export const toDocSelections = (contexts: ChatContextContent[]): DocSelection[] =>
  contexts.map((context) => ({
    content: context.preview || context.content,
    docId: context.docId || '',
    id: context.id,
    xml: context.content,
  }));
