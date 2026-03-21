import { describe, expect, it } from 'vitest';

import { parseChatCompletionTextResponse, readChatCompletionResult } from './responseParser';

describe('responseParser', () => {
  it('should parse JSON chat completion responses directly', async () => {
    const response = new Response(
      JSON.stringify({
        choices: [{ finish_reason: 'stop', message: { content: 'hello', role: 'assistant' } }],
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );

    await expect(readChatCompletionResult(response)).resolves.toEqual({
      choices: [{ finish_reason: 'stop', message: { content: 'hello', role: 'assistant' } }],
    });
  });

  it('should parse SSE text responses into chat completion shape', () => {
    const result = parseChatCompletionTextResponse(
      [
        'id: chatcmpl-1',
        'event: message',
        'data: {"choices":[{"delta":{"content":"Hello"}}]}',
        '',
        'data: {"choices":[{"delta":{"content":" world"},"finish_reason":"stop"}]}',
        '',
        'data: [DONE]',
        '',
      ].join('\n'),
    );

    expect(result).toEqual({
      choices: [
        {
          finish_reason: 'stop',
          message: {
            content: 'Hello world',
            role: 'assistant',
          },
        },
      ],
    });
  });

  it('should reconstruct tool calls from SSE deltas', () => {
    const result = parseChatCompletionTextResponse(
      [
        'id: chatcmpl-2',
        'event: message',
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"lobe-skills____runSkill____builtin","arguments":"{\\"identifier\\":\\"demo"}}]}}]}',
        '',
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"-skill\\"}"}}],"reasoning_content":"thinking"},"finish_reason":"tool_calls"}]}',
        '',
      ].join('\n'),
    );

    expect(result).toEqual({
      choices: [
        {
          finish_reason: 'tool_calls',
          message: {
            content: '',
            reasoning_content: 'thinking',
            role: 'assistant',
            tool_calls: [
              {
                function: {
                  arguments: '{"identifier":"demo-skill"}',
                  name: 'lobe-skills____runSkill____builtin',
                },
                id: 'call_1',
                type: 'function',
              },
            ],
          },
        },
      ],
    });
  });

  it('should parse custom SSE events with reasoning and tool calls', () => {
    const result = parseChatCompletionTextResponse(
      [
        'id: chatcmpl-3',
        'event: reasoning',
        'data: "用户想研究 BTC 最近行情。"',
        '',
        'event: tool_calls',
        'data: [{"index":0,"id":"call_1","type":"function","function":{"name":"deep-research____deep-research____mcp","arguments":"{\\"query\\":\\"BTC比特币2026年3月最新市场行情\\"}"}}]',
        '',
        'event: stop',
        'data: "tool_calls"',
        '',
        'data: [DONE]',
        '',
      ].join('\n'),
    );

    expect(result).toEqual({
      choices: [
        {
          finish_reason: 'tool_calls',
          message: {
            content: '',
            reasoning_content: '用户想研究 BTC 最近行情。',
            role: 'assistant',
            tool_calls: [
              {
                function: {
                  arguments: '{"query":"BTC比特币2026年3月最新市场行情"}',
                  name: 'deep-research____deep-research____mcp',
                },
                id: 'call_1',
                type: 'function',
              },
            ],
          },
        },
      ],
    });
  });
});
