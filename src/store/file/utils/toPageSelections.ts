import { type ChatContextContent, type PageSelection } from '@lobechat/types';

export const toPageSelections = (contexts: ChatContextContent[]): PageSelection[] =>
  contexts.map((context) => ({
    content: context.preview || context.content,
    id: context.id,
    pageId: context.pageId || '',
    xml: context.content,
  }));
