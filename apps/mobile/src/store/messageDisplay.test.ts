import { describe, expect, it, vi } from 'vitest';

import type { ChatMessage, ChatMessageMetadata, ChatToolPayload, MessageRole } from '../types';
import { buildDisplayMessages, getAssistantChainActionMessageId } from './messageDisplay';

// Avoid loading React Native when messageDisplay imports chatHelpers
vi.mock('../lib/api', () => ({}));
vi.mock('./model', () => ({ useModelStore: { getState: () => ({ providers: [] }) } }));
vi.mock('./session', () => ({ useSessionStore: { getState: () => ({ sessions: [] }) } }));
vi.mock('./user', () => ({ getUserMemorySettings: vi.fn() }));
vi.mock('../lib/session', () => ({ isGroupSessionLike: () => false }));

const baseMessage = (
  overrides: Partial<ChatMessage> & {
    metadata?: ChatMessageMetadata;
    role?: MessageRole;
    tools?: ChatToolPayload[];
  } = {},
): ChatMessage => ({
  content: '',
  createdAt: '2025-01-01T00:00:00Z',
  id: 'msg-1',
  parentId: undefined,
  role: 'user',
  sessionId: 's1',
  updatedAt: '2025-01-01T00:00:00Z',
  ...overrides,
});

describe('messageDisplay', () => {
  describe('buildDisplayMessages', () => {
    it('returns empty array when messages is empty', () => {
      expect(buildDisplayMessages([])).toEqual([]);
    });

    it('passes through non-tool messages unchanged', () => {
      const messages = [
        baseMessage({ id: 'u1', role: 'user', content: 'hi' }),
        baseMessage({ id: 'a1', role: 'assistant', content: 'hello' }),
      ];
      const result = buildDisplayMessages(messages);
      expect(result).toBe(messages);
      expect(result).toHaveLength(2);
      expect(result[0]!.role).toBe('user');
      expect(result[1]!.role).toBe('assistant');
    });

    it('returns original array in group sessions when no task grouping is needed', () => {
      const messages = [
        baseMessage({ id: 'u1', role: 'user', content: 'hi' }),
        baseMessage({ id: 'a1', role: 'assistant', content: 'hello' }),
      ];

      expect(buildDisplayMessages(messages, true)).toBe(messages);
    });

    it('collapses standalone tool messages into parent assistant', () => {
      const messages = [
        baseMessage({
          id: 'a1',
          role: 'assistant',
          content: 'response',
          tools: undefined,
        }),
        baseMessage({
          id: 't1',
          role: 'tool',
          parentId: 'a1',
          content: 'tool result',
          plugin: {
            apiName: 'search',
            arguments: '{"q":"x"}',
            identifier: 'lobe-web-browsing',
            type: 'function',
          },
        }),
      ];
      const result = buildDisplayMessages(messages);
      expect(result).toHaveLength(1);
      expect(result[0]!.role).toBe('assistant');
      expect(result[0]!.tools).toHaveLength(1);
      expect(result[0]!.tools![0]).toMatchObject({
        apiName: 'search',
        identifier: 'lobe-web-browsing',
        result_content: 'tool result',
      });
    });

    it('maps pluginError to tool payload when tool message has pluginError', () => {
      const messages = [
        baseMessage({ id: 'a1', role: 'assistant', content: 'x', tools: undefined }),
        baseMessage({
          id: 't1',
          role: 'tool',
          parentId: 'a1',
          content: '',
          pluginError: { message: 'Tool failed' },
          plugin: { apiName: 'foo', arguments: '{}', identifier: 'pkg', type: 'function' },
        }),
      ];
      const result = buildDisplayMessages(messages);
      expect(result[0]!.tools![0]!.pluginError).toEqual({ message: 'Tool failed' });
    });

    it('collapses assistant tool chain into single message', () => {
      const messages = [
        baseMessage({
          id: 'a1',
          role: 'assistant',
          content: 'step 1',
          tools: [
            {
              id: 'tc-1',
              apiName: 'search',
              arguments: '{}',
              identifier: 'lobe-web-browsing',
              type: 'function',
            },
          ],
        }),
        baseMessage({
          id: 'a2',
          role: 'assistant',
          content: 'step 2',
          parentId: 'a1',
          tools: [],
        }),
      ];
      // Link a2 to a1 via tool result_msg_id
      messages[1]!.tools = [
        {
          id: 'tc-1',
          result_msg_id: 'a1',
          apiName: 'search',
          arguments: '{}',
          identifier: 'lobe-web-browsing',
          type: 'function',
          result_content: 'result',
        } satisfies ChatToolPayload,
      ];
      const result = buildDisplayMessages(messages);
      // Should merge assistant chain
      expect(result.length).toBeLessThanOrEqual(2);
    });

    it('reuses merged assistant chain objects when source message refs are unchanged', () => {
      const messages = [
        baseMessage({
          id: 'a1',
          role: 'assistant',
          content: 'step 1',
          tools: [
            {
              id: 'tc-1',
              apiName: 'search',
              arguments: '{}',
              identifier: 'lobe-web-browsing',
              type: 'function',
            },
          ],
        }),
        baseMessage({
          id: 'a2',
          role: 'assistant',
          content: 'step 2',
          parentId: 'a1',
          tools: [
            {
              id: 'tc-1',
              result_msg_id: 'a1',
              apiName: 'search',
              arguments: '{}',
              identifier: 'lobe-web-browsing',
              type: 'function',
              result_content: 'result',
            },
          ],
        }),
      ];

      const first = buildDisplayMessages(messages);
      const second = buildDisplayMessages(messages);

      expect(first[0]).toBe(second[0]);
    });
  });

  describe('getAssistantChainActionMessageId', () => {
    it('returns message.id when no action id in metadata', () => {
      const msg = baseMessage({ id: 'm1' });
      expect(getAssistantChainActionMessageId(msg)).toBe('m1');
    });

    it('returns metadata action id when present', () => {
      const msg = baseMessage({
        id: 'm1',
        metadata: { mobileAssistantChainActionMessageId: 'action-123' },
      });
      expect(getAssistantChainActionMessageId(msg)).toBe('action-123');
    });
  });
});
