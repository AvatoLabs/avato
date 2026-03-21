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

  it('should resolve titles from compareGroup children', () => {
    const result = pickLatestTitleContext([
      { content: '帮我总结这段对话', role: 'user' },
      {
        children: [
          { content: '这是第一个成员的回答', role: 'assistant' },
          { content: '这是最终采用的回答', role: 'assistant' },
        ],
        role: 'compareGroup',
      },
    ]);

    expect(result).toEqual({
      lastAssistantContent: '这是最终采用的回答',
      userPrompt: '帮我总结这段对话',
    });
  });

  it('should resolve titles from compressedGroup history', () => {
    const result = pickLatestTitleContext([
      {
        compressedMessages: [
          { content: '旧问题', role: 'user' },
          { content: '旧答案', role: 'assistant' },
          { content: '最新问题', role: 'user' },
          { content: '最新答案', role: 'assistant' },
        ],
        role: 'compressedGroup',
      },
    ]);

    expect(result).toEqual({
      lastAssistantContent: '最新答案',
      userPrompt: '最新问题',
    });
  });

  it('should ignore loading placeholders when resolving the latest pair', () => {
    const result = pickLatestTitleContext([
      { content: '最新问题', role: 'user' },
      { content: '...', role: 'assistant' },
      { content: '最终答案', role: 'assistant' },
    ]);

    expect(result).toEqual({
      lastAssistantContent: '最终答案',
      userPrompt: '最新问题',
    });
  });
});
