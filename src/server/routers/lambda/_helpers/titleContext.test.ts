import { describe, expect, it } from 'vitest';

import { pickLatestTitleContext } from './titleContext';

describe('pickLatestTitleContext', () => {
  it('should pick the latest assistant and its preceding user message', () => {
    const result = pickLatestTitleContext([
      { content: 'first question', role: 'user' },
      { content: 'first answer', role: 'assistant' },
      { content: 'follow-up question', role: 'user' },
      { content: 'final answer', role: 'assistant' },
    ]);

    expect(result).toEqual({
      lastAssistantContent: 'final answer',
      userPrompt: 'follow-up question',
    });
  });

  it('should skip empty content when resolving the latest pair', () => {
    const result = pickLatestTitleContext([
      { content: 'initial question', role: 'user' },
      { content: '', role: 'assistant' },
      { content: 'latest question', role: 'user' },
      { content: 'latest answer', role: 'assistant' },
    ]);

    expect(result).toEqual({
      lastAssistantContent: 'latest answer',
      userPrompt: 'latest question',
    });
  });
});
