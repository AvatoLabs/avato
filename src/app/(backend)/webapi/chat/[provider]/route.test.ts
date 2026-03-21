// @vitest-environment node
import { type LobeRuntimeAI } from '@lobechat/model-runtime';
import { ModelRuntime } from '@lobechat/model-runtime';
import { ChatErrorType } from '@lobechat/types';
import { getXorPayload } from '@lobechat/utils/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as EnvsAuthModule from '@/envs/auth';
import { LOBE_CHAT_AUTH_HEADER, OAUTH_AUTHORIZED } from '@/envs/auth';
import { initModelRuntimeFromDB } from '@/server/modules/ModelRuntime';

import { POST } from './route';

const { findSkillByIdentifierMock, mcpListToolsMock, pluginQueryMock } = vi.hoisted(() => ({
  findSkillByIdentifierMock: vi.fn(),
  mcpListToolsMock: vi.fn(),
  pluginQueryMock: vi.fn(),
}));

vi.mock('@/app/(backend)/middleware/auth/utils', () => ({
  checkAuthMethod: vi.fn(),
}));

vi.mock('@lobechat/utils/server', () => ({
  getXorPayload: vi.fn(),
}));

vi.mock('@/server/modules/ModelRuntime', () => ({
  initModelRuntimeFromDB: vi.fn(),
  createTraceOptions: vi.fn().mockReturnValue({}),
}));

vi.mock('@/server/services/file', () => ({
  FileService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@/server/services/mcp', () => ({
  mcpService: {
    listTools: mcpListToolsMock,
  },
}));

vi.mock('@/database/models/agentSkill', () => ({
  AgentSkillModel: vi.fn().mockImplementation(() => ({
    findByIdentifier: findSkillByIdentifierMock,
  })),
}));

vi.mock('@/database/models/plugin', () => ({
  PluginModel: vi.fn().mockImplementation(() => ({
    query: pluginQueryMock,
  })),
}));

vi.mock('@/envs/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof EnvsAuthModule>();
  return {
    ...actual,
  };
});

vi.mock('@/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn().mockResolvedValue(null),
    },
  },
}));

// 模拟请求和响应
let request: Request;
beforeEach(() => {
  request = new Request(new URL('https://test.com'), {
    headers: {
      [LOBE_CHAT_AUTH_HEADER]: 'Bearer some-valid-token',
      [OAUTH_AUTHORIZED]: 'true',
    },
    method: 'POST',
    body: JSON.stringify({ model: 'test-model' }),
  });
});

afterEach(() => {
  // 清除模拟调用历史
  vi.clearAllMocks();
  findSkillByIdentifierMock.mockReset();
  mcpListToolsMock.mockReset();
  pluginQueryMock.mockReset();
});

describe('POST handler', () => {
  describe('init chat model', () => {
    it('should initialize ModelRuntime correctly with valid authorization', async () => {
      const mockParams = Promise.resolve({ provider: 'test-provider' });

      // 设置 getJWTPayload 的模拟返回值
      vi.mocked(getXorPayload).mockReturnValueOnce({
        apiKey: 'test-api-key',
        azureApiVersion: 'v1',
      });

      // chat mock 需要返回一个 Response 对象，否则中间件访问 res.headers 会报错
      const mockChatResponse = new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
      const mockRuntime: LobeRuntimeAI = {
        baseURL: 'abc',
        chat: vi.fn().mockResolvedValue(mockChatResponse),
      };

      // Mock initModelRuntimeFromDB
      vi.mocked(initModelRuntimeFromDB).mockResolvedValue(new ModelRuntime(mockRuntime));

      // 调用 POST 函数
      await POST(request as unknown as Request, { params: mockParams });

      // 验证是否正确调用了模拟函数
      expect(getXorPayload).toHaveBeenCalledWith('Bearer some-valid-token');
      expect(initModelRuntimeFromDB).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(String),
        'test-provider',
      );
    });

    it('should return Unauthorized error when LOBE_CHAT_AUTH_HEADER is missing', async () => {
      const mockParams = Promise.resolve({ provider: 'test-provider' });
      const requestWithoutAuthHeader = new Request(new URL('https://test.com'), {
        method: 'POST',
        body: JSON.stringify({ model: 'test-model' }),
      });

      const response = await POST(requestWithoutAuthHeader, { params: mockParams });

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        body: {
          error: { errorType: 401 },
          provider: 'test-provider',
        },
        errorType: 401,
      });
    });

    it('should return InternalServerError error when throw a unknown error', async () => {
      const mockParams = Promise.resolve({ provider: 'test-provider' });
      vi.mocked(getXorPayload).mockImplementationOnce(() => {
        throw new Error('unknown error');
      });

      const response = await POST(request, { params: mockParams });

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        body: {
          error: {},
          provider: 'test-provider',
        },
        errorType: 500,
      });
    });
  });

  describe('chat', () => {
    it('should correctly handle chat completion with valid payload', async () => {
      vi.mocked(getXorPayload).mockReturnValueOnce({
        apiKey: 'test-api-key',
        azureApiVersion: 'v1',
        userId: 'abc',
      });

      const mockParams = Promise.resolve({ provider: 'test-provider' });
      const mockChatPayload = { message: 'Hello, world!' };
      request = new Request(new URL('https://test.com'), {
        headers: { [LOBE_CHAT_AUTH_HEADER]: 'Bearer some-valid-token' },
        method: 'POST',
        body: JSON.stringify(mockChatPayload),
      });

      const mockChatResponse: any = { success: true, message: 'Reply from agent' };
      const mockRuntime: LobeRuntimeAI = {
        baseURL: 'abc',
        chat: vi.fn().mockResolvedValue(mockChatResponse),
      };

      vi.mocked(initModelRuntimeFromDB).mockResolvedValue(new ModelRuntime(mockRuntime));

      const response = await POST(request as unknown as Request, { params: mockParams });

      expect(response).toEqual(mockChatResponse);
      expect(mockRuntime.chat).toHaveBeenCalledWith(
        expect.objectContaining(mockChatPayload),
        expect.objectContaining({
          signal: expect.anything(),
          user: expect.any(String),
        }),
      );
    });

    it('should return an error response when chat completion fails', async () => {
      vi.mocked(getXorPayload).mockReturnValueOnce({
        apiKey: 'test-api-key',
        azureApiVersion: 'v1',
      });

      const mockParams = Promise.resolve({ provider: 'test-provider' });
      const mockChatPayload = { message: 'Hello, world!' };
      request = new Request(new URL('https://test.com'), {
        headers: { [LOBE_CHAT_AUTH_HEADER]: 'Bearer some-valid-token' },
        method: 'POST',
        body: JSON.stringify(mockChatPayload),
      });

      const mockErrorResponse = {
        errorType: ChatErrorType.InternalServerError,
        error: { errorMessage: 'Something went wrong', errorType: 500 },
        errorMessage: 'Something went wrong',
      };

      const mockRuntime: LobeRuntimeAI = {
        baseURL: 'abc',
        chat: vi.fn().mockRejectedValue(mockErrorResponse),
      };

      vi.mocked(initModelRuntimeFromDB).mockResolvedValue(new ModelRuntime(mockRuntime));

      const response = await POST(request, { params: mockParams });

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        body: {
          errorMessage: 'Something went wrong',
          error: {
            errorMessage: 'Something went wrong',
            errorType: 500,
          },
          provider: 'test-provider',
        },
        errorType: 500,
      });
    });

    it('should inject skill context and expose lobe-skills builtin tool for mobile requests', async () => {
      vi.mocked(getXorPayload).mockReturnValueOnce({
        apiKey: 'test-api-key',
        azureApiVersion: 'v1',
        userId: 'abc',
      });

      findSkillByIdentifierMock.mockImplementation(async (identifier: string) => {
        if (identifier !== 'demo-skill') return undefined;

        return {
          createdAt: new Date(),
          description: 'Use this skill to handle demo tasks',
          id: 'skill-1',
          identifier: 'demo-skill',
          manifest: {
            description: 'Use this skill to handle demo tasks',
            name: 'Demo Skill',
            repository: 'https://example.com/demo-skill',
          },
          name: 'Demo Skill',
          source: 'user',
          updatedAt: new Date(),
        };
      });
      pluginQueryMock.mockResolvedValue([]);

      const mockParams = Promise.resolve({ provider: 'test-provider' });
      request = new Request(new URL('https://test.com'), {
        headers: { [LOBE_CHAT_AUTH_HEADER]: 'Bearer some-valid-token' },
        method: 'POST',
        body: JSON.stringify({
          messages: [{ content: 'Please use the demo skill', role: 'user' }],
          model: 'test-model',
          plugins: ['demo-skill'],
          stream: true,
        }),
      });

      const toolLoopResponse = new Response(
        JSON.stringify({
          choices: [{ finish_reason: 'stop', message: { content: 'Done', role: 'assistant' } }],
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );
      const mockRuntime: LobeRuntimeAI = {
        baseURL: 'abc',
        chat: vi
          .fn()
          .mockResolvedValueOnce(toolLoopResponse)
          .mockImplementationOnce(async (_payload, options: any) => {
            await options?.callback?.onText?.('Done');
            await options?.callback?.onCompletion?.({
              speed: { tps: 20, ttft: 100 },
              text: 'Done',
              usage: { totalInputTokens: 10, totalOutputTokens: 5, totalTokens: 15 },
            });

            return new Response('data: [DONE]\n\n', {
              headers: { 'Content-Type': 'text/event-stream' },
            });
          }),
      };

      vi.mocked(initModelRuntimeFromDB).mockResolvedValue(new ModelRuntime(mockRuntime));

      const response = await POST(request as unknown as Request, { params: mockParams });
      const mockedChat = mockRuntime.chat as ReturnType<typeof vi.fn>;

      expect(response.headers.get('Content-Type')).toContain('text/event-stream');
      expect(mockedChat).toHaveBeenCalledTimes(2);

      const firstCall = mockedChat.mock.calls[0];
      expect(firstCall).toBeDefined();

      const firstCallPayload = firstCall![0] as any;
      const systemMessage = firstCallPayload.messages.find(
        (message: any) => message.role === 'system',
      );

      expect(firstCallPayload.tools).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            function: expect.objectContaining({
              name: 'lobe-skills____runSkill____builtin',
            }),
          }),
        ]),
      );
      expect(systemMessage?.content).toContain('<available_skills>');
      expect(systemMessage?.content).toContain('name="Demo Skill"');
      expect(systemMessage?.content).toContain('Use the runSkill tool to activate a skill');
      expect(systemMessage?.content).toContain('Read reference files attached to a skill');
    });

    it('should execute tools via streaming fallback when the non-stream tool loop finds no structured tool calls', async () => {
      vi.mocked(getXorPayload).mockReturnValueOnce({
        apiKey: 'test-api-key',
        azureApiVersion: 'v1',
        userId: 'abc',
      });

      pluginQueryMock.mockResolvedValue([]);

      const mockParams = Promise.resolve({ provider: 'test-provider' });
      request = new Request(new URL('https://test.com'), {
        headers: { [LOBE_CHAT_AUTH_HEADER]: 'Bearer some-valid-token' },
        method: 'POST',
        body: JSON.stringify({
          messages: [{ content: 'use the calculator tool', role: 'user' }],
          model: 'test-model',
          plugins: ['lobe-calculator'],
          stream: true,
        }),
      });

      const toolLoopResponse = new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: "I'll use the calculator tool for you.",
                role: 'assistant',
              },
            },
          ],
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );
      const mockRuntime: LobeRuntimeAI = {
        baseURL: 'abc',
        chat: vi
          .fn()
          .mockResolvedValueOnce(toolLoopResponse)
          .mockImplementationOnce(async (_payload, options: any) => {
            await options?.callback?.onToolsCalling?.({
              chunk: [
                {
                  function: {
                    arguments: '{"expression":"x^2","variable":"x"}',
                    name: 'lobe-calculator____differentiate____builtin',
                  },
                  id: 'call_1',
                  type: 'function',
                },
              ],
              toolsCalling: [
                {
                  function: {
                    arguments: '{"expression":"x^2","variable":"x"}',
                    name: 'lobe-calculator____differentiate____builtin',
                  },
                  id: 'call_1',
                  type: 'function',
                },
              ],
            });

            return new Response('data: [DONE]\n\n', {
              headers: { 'Content-Type': 'text/event-stream' },
            });
          })
          .mockImplementationOnce(async (_payload, options: any) => {
            await options?.callback?.onText?.('The derivative is $2x$.');
            await options?.callback?.onCompletion?.({
              speed: { tps: 20, ttft: 100 },
              text: 'The derivative is $2x$.',
              usage: { totalInputTokens: 10, totalOutputTokens: 5, totalTokens: 15 },
            });

            return new Response('data: [DONE]\n\n', {
              headers: { 'Content-Type': 'text/event-stream' },
            });
          }),
      };

      vi.mocked(initModelRuntimeFromDB).mockResolvedValue(new ModelRuntime(mockRuntime));

      const response = await POST(request as unknown as Request, { params: mockParams });
      const mockedChat = mockRuntime.chat as ReturnType<typeof vi.fn>;
      const responseBody = await response.text();

      expect(response.headers.get('Content-Type')).toContain('text/event-stream');
      expect(mockedChat).toHaveBeenCalledTimes(3);

      const firstCallPayload = mockedChat.mock.calls[0]![0] as any;
      const secondCallPayload = mockedChat.mock.calls[1]![0] as any;
      const thirdCallPayload = mockedChat.mock.calls[2]![0] as any;

      expect(firstCallPayload.stream).toBe(false);
      expect(firstCallPayload.responseMode).toBe('json');
      expect(secondCallPayload.stream).toBe(true);
      expect(secondCallPayload.responseMode).toBeUndefined();
      expect(firstCallPayload.tools).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            function: expect.objectContaining({
              name: expect.stringContaining('lobe-calculator____'),
            }),
          }),
        ]),
      );
      expect(secondCallPayload.tools).toEqual(firstCallPayload.tools);
      expect(thirdCallPayload.tools).toEqual(firstCallPayload.tools);
      expect(responseBody).toContain('event: tool_calls');
      expect(responseBody).toContain('event: tool_executions');
      expect(responseBody).toContain('"state":{"expression":"x^2","result":"2*x","variable":"x"}');
      expect(responseBody).toContain('The derivative is $2x$.');
    });

    it('should return the final assistant response from the tool loop without an extra streaming model call', async () => {
      vi.mocked(getXorPayload).mockReturnValueOnce({
        apiKey: 'test-api-key',
        azureApiVersion: 'v1',
        userId: 'abc',
      });

      pluginQueryMock.mockResolvedValue([]);

      const mockParams = Promise.resolve({ provider: 'test-provider' });
      request = new Request(new URL('https://test.com'), {
        headers: { [LOBE_CHAT_AUTH_HEADER]: 'Bearer some-valid-token' },
        method: 'POST',
        body: JSON.stringify({
          messages: [{ content: 'differentiate x^2', role: 'user' }],
          model: 'test-model',
          plugins: ['lobe-calculator'],
          stream: true,
        }),
      });

      const toolCalls = [
        {
          function: {
            arguments: '{"expression":"x^2","variable":"x"}',
            name: 'lobe-calculator____differentiate____builtin',
          },
          id: 'call_1',
          type: 'function',
        },
      ];

      const mockRuntime: LobeRuntimeAI = {
        baseURL: 'abc',
        chat: vi
          .fn()
          .mockResolvedValueOnce(
            new Response(
              JSON.stringify({
                choices: [
                  {
                    finish_reason: 'tool_calls',
                    message: {
                      content: '',
                      reasoning_content: 'I should call the calculator first.',
                      role: 'assistant',
                      tool_calls: toolCalls,
                    },
                  },
                ],
              }),
              {
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
          .mockResolvedValueOnce(
            new Response(
              JSON.stringify({
                choices: [
                  {
                    finish_reason: 'stop',
                    message: {
                      content: 'The derivative is $2x$.',
                      reasoning_content: 'I used the calculator result to answer directly.',
                      role: 'assistant',
                    },
                  },
                ],
                usage: { totalInputTokens: 10, totalOutputTokens: 5, totalTokens: 15 },
              }),
              {
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          ),
      };

      vi.mocked(initModelRuntimeFromDB).mockResolvedValue(new ModelRuntime(mockRuntime));

      const response = await POST(request as unknown as Request, { params: mockParams });
      const mockedChat = mockRuntime.chat as ReturnType<typeof vi.fn>;
      const responseBody = await response.text();

      expect(response.headers.get('Content-Type')).toContain('text/event-stream');
      expect(mockedChat).toHaveBeenCalledTimes(2);

      const firstCallPayload = mockedChat.mock.calls[0]![0] as any;
      const secondCallPayload = mockedChat.mock.calls[1]![0] as any;

      expect(firstCallPayload.stream).toBe(false);
      expect(secondCallPayload.stream).toBe(false);
      expect(secondCallPayload.messages).toHaveLength(4);
      expect(responseBody).toContain('event: tool_executions');
      expect(responseBody).toContain('event: reasoning');
      expect(responseBody).toContain('The derivative is $2x$.');
      expect(responseBody).toContain('"state":{"expression":"x^2","result":"2*x","variable":"x"}');
    });

    it('should remove orphan assistant tool_calls from history before calling the provider', async () => {
      vi.mocked(getXorPayload).mockReturnValueOnce({
        apiKey: 'test-api-key',
        azureApiVersion: 'v1',
        userId: 'abc',
      });

      pluginQueryMock.mockResolvedValue([]);

      const mockParams = Promise.resolve({ provider: 'test-provider' });
      request = new Request(new URL('https://test.com'), {
        headers: { [LOBE_CHAT_AUTH_HEADER]: 'Bearer some-valid-token' },
        method: 'POST',
        body: JSON.stringify({
          messages: [
            { content: 'use the calculator tool', role: 'user' },
            {
              content: '',
              role: 'assistant',
              tool_calls: [
                {
                  function: {
                    arguments: '{"expression":"x^2","variable":"x"}',
                    name: 'lobe-calculator____differentiate____builtin',
                  },
                  id: 'call_orphan',
                  type: 'function',
                },
              ],
            },
            { content: 'That previous tool attempt failed.', role: 'assistant' },
            { content: 'try again', role: 'user' },
          ],
          model: 'test-model',
          plugins: ['lobe-calculator'],
          stream: true,
        }),
      });

      const mockRuntime: LobeRuntimeAI = {
        baseURL: 'abc',
        chat: vi
          .fn()
          .mockResolvedValueOnce(
            new Response(
              JSON.stringify({
                choices: [
                  { finish_reason: 'stop', message: { content: 'Retrying.', role: 'assistant' } },
                ],
              }),
              {
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
          .mockImplementationOnce(async (_payload, options: any) => {
            await options?.callback?.onText?.('Retry completed.');
            await options?.callback?.onCompletion?.({
              speed: { tps: 20, ttft: 100 },
              text: 'Retry completed.',
              usage: { totalInputTokens: 10, totalOutputTokens: 5, totalTokens: 15 },
            });

            return new Response('data: [DONE]\n\n', {
              headers: { 'Content-Type': 'text/event-stream' },
            });
          }),
      };

      vi.mocked(initModelRuntimeFromDB).mockResolvedValue(new ModelRuntime(mockRuntime));

      const response = await POST(request as unknown as Request, { params: mockParams });
      const mockedChat = mockRuntime.chat as ReturnType<typeof vi.fn>;
      const firstCallPayload = mockedChat.mock.calls[0]![0] as any;

      expect(response.headers.get('Content-Type')).toContain('text/event-stream');
      expect(mockedChat).toHaveBeenCalledTimes(2);
      expect(
        firstCallPayload.messages.filter(
          (message: any) => message.role === 'assistant' && Array.isArray(message.tool_calls),
        ),
      ).toEqual([]);
      expect(firstCallPayload.messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            content: 'That previous tool attempt failed.',
            role: 'assistant',
          }),
          expect.objectContaining({ content: 'try again', role: 'user' }),
        ]),
      );
    });

    it('should recover MCP tools when an installed plugin manifest has no api array', async () => {
      vi.mocked(getXorPayload).mockReturnValueOnce({
        apiKey: 'test-api-key',
        azureApiVersion: 'v1',
        userId: 'abc',
      });

      pluginQueryMock.mockResolvedValue([
        {
          customParams: {
            mcp: {
              type: 'http',
              url: 'https://example.com/mcp',
            },
          },
          identifier: 'openclaw-mcp',
          manifest: {
            identifier: 'openclaw-mcp',
            meta: { title: 'OpenClaw MCP' },
            type: 'mcp',
          },
          runtimeType: 'mcp',
          type: 'plugin',
        },
      ]);
      mcpListToolsMock.mockResolvedValue([
        {
          description: 'Search the OpenClaw service',
          name: 'search',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
            },
            required: ['query'],
          },
        },
      ]);

      const mockParams = Promise.resolve({ provider: 'test-provider' });
      request = new Request(new URL('https://test.com'), {
        headers: { [LOBE_CHAT_AUTH_HEADER]: 'Bearer some-valid-token' },
        method: 'POST',
        body: JSON.stringify({
          messages: [{ content: 'search with openclaw', role: 'user' }],
          model: 'test-model',
          plugins: ['openclaw-mcp'],
          stream: true,
        }),
      });

      const mockRuntime: LobeRuntimeAI = {
        baseURL: 'abc',
        chat: vi
          .fn()
          .mockResolvedValueOnce(
            new Response(
              JSON.stringify({
                choices: [
                  { finish_reason: 'stop', message: { content: 'Checking.', role: 'assistant' } },
                ],
              }),
              {
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
          .mockImplementationOnce(async (_payload, options: any) => {
            await options?.callback?.onText?.('Recovered MCP tools.');
            await options?.callback?.onCompletion?.({
              speed: { tps: 20, ttft: 100 },
              text: 'Recovered MCP tools.',
              usage: { totalInputTokens: 10, totalOutputTokens: 5, totalTokens: 15 },
            });

            return new Response('data: [DONE]\n\n', {
              headers: { 'Content-Type': 'text/event-stream' },
            });
          }),
      };

      vi.mocked(initModelRuntimeFromDB).mockResolvedValue(new ModelRuntime(mockRuntime));

      const response = await POST(request as unknown as Request, { params: mockParams });
      const mockedChat = mockRuntime.chat as ReturnType<typeof vi.fn>;
      const responseBody = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('text/event-stream');
      expect(mcpListToolsMock).toHaveBeenCalledWith({
        name: 'openclaw-mcp',
        type: 'http',
        url: 'https://example.com/mcp',
      });
      expect(mockedChat).toHaveBeenCalledTimes(2);

      const firstCallPayload = mockedChat.mock.calls[0]![0] as any;
      const secondCallPayload = mockedChat.mock.calls[1]![0] as any;

      expect(firstCallPayload.tools).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            function: expect.objectContaining({
              name: 'openclaw-mcp____search____mcp',
            }),
          }),
        ]),
      );
      expect(secondCallPayload.tools).toEqual(firstCallPayload.tools);
      expect(responseBody).toContain('Recovered MCP tools.');
    });
  });
});
