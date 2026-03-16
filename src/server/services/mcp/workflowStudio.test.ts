// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentModel } from '@/database/models/agent';
import { UserPersonaModel } from '@/database/models/userMemory/persona';
import { buildStudioWorkflowDefinition } from '@/libs/mcp/workflowStudio';
import * as modelRuntimeModule from '@/server/modules/ModelRuntime';

import { mcpService } from './index';
import { runWorkflowStudioPreview } from './workflowStudio';

vi.mock('@/database/models/agent', () => ({
  AgentModel: vi.fn(),
}));

vi.mock('@/database/models/userMemory/persona', () => ({
  UserPersonaModel: vi.fn(),
}));

const mockServerDB = {} as any;
const mockUserId = 'user_1';

const createHttpWorkflow = () =>
  buildStudioWorkflowDefinition({
    edges: [
      {
        id: 'input->tool',
        payloadBindings: [
          {
            id: 'binding-1',
            source: 'humanPrompt',
            targetPath: 'query',
          },
        ],
        sourcePortId: 'prompt',
        source: 'input',
        targetPortId: 'primary',
        target: 'tool',
      },
      {
        id: 'tool->transform',
        source: 'tool',
        sourcePortId: 'result',
        target: 'transform',
        targetPortId: 'primary',
      },
      {
        id: 'transform->chat',
        source: 'transform',
        sourcePortId: 'result',
        target: 'chat',
        targetPortId: 'message',
      },
    ],
    nodes: [
      {
        data: {
          humanPrompt: "Show this week's blocked infra issues.",
          title: 'Input',
        },
        id: 'input',
        type: 'input',
      },
      {
        data: {
          connection: {
            authType: 'bearer',
            headers: { 'X-Workspace': 'design' },
            identifier: 'linear-demo',
            token: 'secret-token',
            type: 'http',
            url: 'https://example.com/mcp',
          },
          payload: { team: 'infra' },
          payloadBindings: [],
          title: 'Tool',
          toolName: 'listIssues',
        },
        id: 'tool',
        type: 'mcp-tool',
      },
      {
        data: {
          mode: 'template',
          prompt: 'Request: {{humanPrompt}}\nData: {{toolResult}}',
          title: 'Transform',
        },
        id: 'transform',
        type: 'transform',
      },
      {
        data: {
          target: 'chat',
          title: 'Chat',
        },
        id: 'chat',
        type: 'chat-output',
      },
    ],
    previewNodeId: 'chat',
  });

const createStdioWorkflow = () =>
  buildStudioWorkflowDefinition({
    edges: [
      {
        id: 'input->tool',
        source: 'input',
        sourcePortId: 'prompt',
        target: 'tool',
        targetPortId: 'primary',
      },
      {
        id: 'tool->transform',
        source: 'tool',
        sourcePortId: 'result',
        target: 'transform',
        targetPortId: 'primary',
      },
      {
        id: 'transform->chat',
        source: 'transform',
        sourcePortId: 'result',
        target: 'chat',
        targetPortId: 'message',
      },
    ],
    nodes: [
      {
        data: {
          humanPrompt: 'List the temp directory contents.',
          title: 'Input',
        },
        id: 'input',
        type: 'input',
      },
      {
        data: {
          connection: {
            args: ['@modelcontextprotocol/server-filesystem', '/tmp'],
            command: 'npx',
            env: { HOME: '/tmp/demo' },
            identifier: 'filesystem-demo',
            type: 'stdio',
          },
          payload: { path: '/tmp' },
          payloadBindings: [],
          title: 'Tool',
          toolName: 'list_directory',
        },
        id: 'tool',
        type: 'mcp-tool',
      },
      {
        data: {
          mode: 'instruction',
          prompt: 'Summarize the output for chat.',
          title: 'Transform',
        },
        id: 'transform',
        type: 'transform',
      },
      {
        data: {
          target: 'chat',
          title: 'Chat',
        },
        id: 'chat',
        type: 'chat-output',
      },
    ],
    previewNodeId: 'chat',
  });

describe('runWorkflowStudioPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('executes an HTTP tool battery and returns a chat preview', async () => {
    const callToolSpy = vi.spyOn(mcpService, 'callTool').mockResolvedValue({
      content: 'Open issues: 12',
      state: {
        content: [{ text: 'Open issues: 12', type: 'text' }],
      },
      success: true,
    });

    const result = await runWorkflowStudioPreview({
      processContentBlocks: vi.fn(async (blocks) => blocks),
      serverDB: mockServerDB,
      userId: mockUserId,
      workflow: createHttpWorkflow(),
    });

    expect(callToolSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(callToolSpy.mock.calls[0]![0].argsStr)).toEqual({
      query: "Show this week's blocked infra issues.",
      team: 'infra',
    });
    expect(callToolSpy.mock.calls[0]![0].clientParams).toEqual({
      auth: {
        token: 'secret-token',
        type: 'bearer',
      },
      headers: { 'X-Workspace': 'design' },
      name: 'linear-demo',
      type: 'http',
      url: 'https://example.com/mcp',
    });
    expect(result.toolResult?.content).toBe('Open issues: 12');
    expect(result.chatPreview.user).toContain('blocked infra issues');
    expect(result.chatPreview.assistant).toContain('Open issues: 12');
    expect(result.chatPreview.system).toContain('Request: Show this week');
  });

  it('passes stdio connection params through the runtime and keeps the output chat-ready', async () => {
    const callToolSpy = vi.spyOn(mcpService, 'callTool').mockResolvedValue({
      content: 'ok',
      state: {
        content: [{ text: 'ok', type: 'text' }],
      },
      success: true,
    });

    const result = await runWorkflowStudioPreview({
      processContentBlocks: vi.fn(async (blocks) => blocks),
      serverDB: mockServerDB,
      userId: mockUserId,
      workflow: createStdioWorkflow(),
    });

    expect(callToolSpy).toHaveBeenCalledTimes(1);
    expect(callToolSpy.mock.calls[0]![0].clientParams).toEqual({
      args: ['@modelcontextprotocol/server-filesystem', '/tmp'],
      command: 'npx',
      env: { HOME: '/tmp/demo' },
      name: 'filesystem-demo',
      type: 'stdio',
    });
    expect(result.toolResult?.content).toBe('ok');
    expect(result.chatPreview.assistant).toBe('ok');
    expect(result.chatPreview.system).toBe('Summarize the output for chat.');
    expect(result.chatPreview.user).toContain('filesystem-demo');
  });

  it('accepts pure channel-based DSL without legacy port ids', async () => {
    const callToolSpy = vi.spyOn(mcpService, 'callTool').mockResolvedValue({
      content: 'Channel result',
      state: {
        content: [{ text: 'Channel result', type: 'text' }],
      },
      success: true,
    });

    const result = await runWorkflowStudioPreview({
      processContentBlocks: vi.fn(async (blocks) => blocks),
      serverDB: mockServerDB,
      userId: mockUserId,
      workflow: {
        edges: [
          {
            channel: 'main',
            id: 'input->tool',
            payloadBindings: [
              {
                id: 'binding-1',
                source: 'humanPrompt',
                targetPath: 'query',
              },
            ],
            source: 'input',
            target: 'tool',
          },
          {
            channel: 'main',
            id: 'tool->chat',
            source: 'tool',
            target: 'chat',
          },
        ],
        nodes: [
          {
            data: {
              humanPrompt: 'Use pure channel DSL.',
              title: 'Input',
            },
            id: 'input',
            type: 'input',
          },
          {
            data: {
              connection: {
                identifier: 'channel-demo',
                type: 'http',
                url: 'https://example.com/mcp',
              },
              payload: { repo: 'lobehub' },
              payloadBindings: [],
              title: 'Tool',
              toolName: 'listIssues',
            },
            id: 'tool',
            type: 'mcp-tool',
          },
          {
            data: {
              target: 'chat',
              title: 'Chat',
            },
            id: 'chat',
            type: 'chat-output',
          },
        ],
        policy: {
          retries: { tool: 1 },
          timeouts: { toolMs: 60_000 },
        },
        previewNodeId: 'chat',
        trigger: {
          type: 'manual',
        },
        version: '2.0',
      },
    });

    expect(callToolSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(callToolSpy.mock.calls[0]![0].argsStr)).toEqual({
      query: 'Use pure channel DSL.',
      repo: 'lobehub',
    });
    expect(result.chatPreview.assistant).toBe('Channel result');
  });

  it('merges multiple inputs into a single MCP battery through edge bindings', async () => {
    const workflow = buildStudioWorkflowDefinition({
      edges: [
        {
          id: 'input-a->tool',
          payloadBindings: [
            {
              id: 'binding-a',
              source: 'humanPrompt',
              targetPath: 'filters.primary',
            },
          ],
          sourcePortId: 'prompt',
          source: 'input-a',
          targetPortId: 'primary',
          target: 'tool',
        },
        {
          id: 'input-b->tool',
          payloadBindings: [
            {
              id: 'binding-b',
              source: 'humanPrompt',
              targetPath: 'filters.secondary',
            },
          ],
          sourcePortId: 'prompt',
          source: 'input-b',
          targetPortId: 'context',
          target: 'tool',
        },
        {
          id: 'tool->chat',
          source: 'tool',
          sourcePortId: 'result',
          target: 'chat',
          targetPortId: 'message',
        },
      ],
      nodes: [
        {
          data: { humanPrompt: 'First input', title: 'Input A' },
          id: 'input-a',
          type: 'input',
        },
        {
          data: { humanPrompt: 'Second input', title: 'Input B' },
          id: 'input-b',
          type: 'input',
        },
        {
          data: {
            connection: {
              identifier: 'linear-demo',
              type: 'http',
              url: 'https://example.com/mcp',
            },
            payload: { repo: 'lobehub' },
            payloadBindings: [],
            title: 'Tool',
            toolName: 'listIssues',
          },
          id: 'tool',
          type: 'mcp-tool',
        },
        {
          data: { target: 'chat', title: 'Chat' },
          id: 'chat',
          type: 'chat-output',
        },
      ],
      previewNodeId: 'chat',
    });
    const callToolSpy = vi.spyOn(mcpService, 'callTool').mockResolvedValue({
      content: 'Merged result',
      state: {
        content: [{ text: 'Merged result', type: 'text' }],
      },
      success: true,
    });

    const result = await runWorkflowStudioPreview({
      processContentBlocks: vi.fn(async (blocks) => blocks),
      serverDB: mockServerDB,
      userId: mockUserId,
      workflow,
    });

    expect(callToolSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(callToolSpy.mock.calls[0]![0].argsStr)).toEqual({
      filters: {
        primary: 'First input',
        secondary: 'Second input',
      },
      repo: 'lobehub',
    });
    expect(result.chatPreview.user).toContain('First input');
    expect(result.chatPreview.user).toContain('Second input');
    expect(result.toolResult?.content).toBe('Merged result');
  });

  it('runs multiple MCP batteries and merges their outputs for downstream transform batteries', async () => {
    const workflow = buildStudioWorkflowDefinition({
      edges: [
        {
          id: 'input-a->tool-a',
          payloadBindings: [{ id: 'binding-a', source: 'humanPrompt', targetPath: 'query' }],
          sourcePortId: 'prompt',
          source: 'input-a',
          targetPortId: 'primary',
          target: 'tool-a',
        },
        {
          id: 'input-b->tool-b',
          payloadBindings: [{ id: 'binding-b', source: 'humanPrompt', targetPath: 'query' }],
          sourcePortId: 'prompt',
          source: 'input-b',
          targetPortId: 'primary',
          target: 'tool-b',
        },
        {
          id: 'tool-a->transform',
          source: 'tool-a',
          sourcePortId: 'result',
          target: 'transform',
          targetPortId: 'primary',
        },
        {
          id: 'tool-b->transform',
          source: 'tool-b',
          sourcePortId: 'result',
          target: 'transform',
          targetPortId: 'context',
        },
        {
          id: 'transform->chat',
          source: 'transform',
          sourcePortId: 'result',
          target: 'chat',
          targetPortId: 'message',
        },
      ],
      nodes: [
        {
          data: { humanPrompt: 'Infra blockers', title: 'Infra Input' },
          id: 'input-a',
          type: 'input',
        },
        {
          data: { humanPrompt: 'Design blockers', title: 'Design Input' },
          id: 'input-b',
          type: 'input',
        },
        {
          data: {
            connection: {
              identifier: 'infra-demo',
              type: 'http',
              url: 'https://example.com/infra',
            },
            payload: { team: 'infra' },
            payloadBindings: [],
            title: 'Infra Tool',
            toolName: 'listInfraIssues',
          },
          id: 'tool-a',
          type: 'mcp-tool',
        },
        {
          data: {
            connection: {
              identifier: 'design-demo',
              type: 'http',
              url: 'https://example.com/design',
            },
            payload: { team: 'design' },
            payloadBindings: [],
            title: 'Design Tool',
            toolName: 'listDesignIssues',
          },
          id: 'tool-b',
          type: 'mcp-tool',
        },
        {
          data: {
            mode: 'template',
            prompt: 'Combined results:\n{{toolResult}}',
            title: 'Transform',
          },
          id: 'transform',
          type: 'transform',
        },
        {
          data: { target: 'chat', title: 'Chat' },
          id: 'chat',
          type: 'chat-output',
        },
      ],
      previewNodeId: 'chat',
    });
    const callToolSpy = vi
      .spyOn(mcpService, 'callTool')
      .mockImplementation(async ({ toolName }) => ({
        content: toolName === 'listInfraIssues' ? 'Infra issues: 3' : 'Design issues: 2',
        state: {
          content: [
            {
              text: toolName === 'listInfraIssues' ? 'Infra issues: 3' : 'Design issues: 2',
              type: 'text',
            },
          ],
        },
        success: true,
      }));

    const result = await runWorkflowStudioPreview({
      processContentBlocks: vi.fn(async (blocks) => blocks),
      serverDB: mockServerDB,
      userId: mockUserId,
      workflow,
    });

    expect(callToolSpy).toHaveBeenCalledTimes(2);
    expect(result.toolResult?.content).toContain('Infra Tool (listInfraIssues)');
    expect(result.toolResult?.content).toContain('Design Tool (listDesignIssues)');
    expect(result.chatPreview.assistant).toContain('Combined results');
    expect(result.chatPreview.assistant).toContain('Infra issues: 3');
    expect(result.chatPreview.assistant).toContain('Design issues: 2');
  });

  it('executes agent batteries and routes agent output into chat preview', async () => {
    const chatSpy = vi.fn().mockResolvedValue({
      json: async () => ({
        choices: [{ message: { content: 'Agent handoff ready.' } }],
      }),
    });
    vi.mocked(AgentModel).mockImplementation(
      () =>
        ({
          getAgentConfigById: vi.fn().mockResolvedValue({
            model: 'gpt-4o-mini',
            provider: 'openai',
            systemRole: 'You triage issues.',
            title: 'Triage Agent',
          }),
        }) as any,
    );
    vi.spyOn(modelRuntimeModule, 'initModelRuntimeFromDB').mockResolvedValue({
      chat: chatSpy,
    } as any);

    const workflow = buildStudioWorkflowDefinition({
      edges: [
        {
          id: 'input->agent',
          source: 'input',
          sourcePortId: 'prompt',
          target: 'agent',
          targetPortId: 'primary',
        },
        {
          id: 'agent->chat',
          source: 'agent',
          sourcePortId: 'result',
          target: 'chat',
          targetPortId: 'message',
        },
      ],
      nodes: [
        {
          data: { humanPrompt: 'Review the blocker list.', title: 'Input' },
          id: 'input',
          type: 'input',
        },
        {
          data: {
            agentId: 'agent-1',
            agentName: 'Triage Agent',
            prompt: 'Prompt: {{humanPrompt}}\nContext: {{upstreamResult}}',
            title: 'Agent',
          },
          id: 'agent',
          type: 'agent',
        },
        {
          data: { target: 'chat', title: 'Chat' },
          id: 'chat',
          type: 'chat-output',
        },
      ],
      previewNodeId: 'chat',
    });

    const result = await runWorkflowStudioPreview({
      processContentBlocks: vi.fn(async (blocks) => blocks),
      serverDB: mockServerDB,
      userId: mockUserId,
      workflow,
    });

    expect(chatSpy).toHaveBeenCalledTimes(1);
    expect(chatSpy.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining('You triage issues.'),
            role: 'system',
          }),
          {
            content: 'Prompt: Review the blocker list.\nContext: Review the blocker list.',
            role: 'user',
          },
        ]),
        model: 'gpt-4o-mini',
        stream: false,
      }),
    );
    expect(result.toolResult).toBeUndefined();
    expect(result.chatPreview.assistant).toContain('Agent handoff ready.');
    expect(result.chatPreview.user).toContain('Triage Agent');
  });

  it('passes agent runtime params and persona memory into studio agent execution', async () => {
    const chatSpy = vi.fn().mockResolvedValue({
      json: async () => ({
        choices: [{ message: { content: 'Memory-aware answer.' } }],
      }),
    });
    vi.mocked(AgentModel).mockImplementation(
      () =>
        ({
          getAgentConfigById: vi.fn().mockResolvedValue({
            chatConfig: {
              inputTemplate: 'User request:\n{{text}}',
              memory: { enabled: true },
            },
            model: 'gpt-4.1-mini',
            params: { temperature: 0.35 },
            provider: 'openai',
            systemRole: 'You remember user preferences.',
            title: 'Memory Agent',
          }),
        }) as any,
    );
    vi.mocked(UserPersonaModel).mockImplementation(
      () =>
        ({
          getLatestPersonaDocument: vi.fn().mockResolvedValue({
            persona: 'Prefers terse release notes.',
            tagline: 'Terse',
            version: 2,
          }),
        }) as any,
    );
    vi.spyOn(modelRuntimeModule, 'initModelRuntimeFromDB').mockResolvedValue({
      chat: chatSpy,
    } as any);

    const workflow = buildStudioWorkflowDefinition({
      edges: [
        {
          channel: 'main',
          id: 'input->agent',
          source: 'input',
          target: 'agent',
        },
        {
          channel: 'main',
          id: 'agent->chat',
          source: 'agent',
          target: 'chat',
        },
      ],
      nodes: [
        {
          data: { humanPrompt: 'Draft a concise summary.', title: 'Input' },
          id: 'input',
          type: 'input',
        },
        {
          data: {
            agentId: 'agent-memory',
            agentName: 'Memory Agent',
            memoryEnabled: true,
            params: { temperature: 0.2, top_p: 0.8 },
            prompt: 'Need: {{humanPrompt}}',
            title: 'Agent',
          },
          id: 'agent',
          type: 'agent',
        },
        {
          data: { target: 'chat', title: 'Chat' },
          id: 'chat',
          type: 'chat-output',
        },
      ],
      previewNodeId: 'chat',
    });

    const result = await runWorkflowStudioPreview({
      processContentBlocks: vi.fn(async (blocks) => blocks),
      serverDB: mockServerDB,
      userId: mockUserId,
      workflow,
    });

    expect(chatSpy).toHaveBeenCalledTimes(1);
    expect(chatSpy.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        model: 'gpt-4.1-mini',
        stream: false,
        temperature: 0.2,
        top_p: 0.8,
      }),
    );
    expect(chatSpy.mock.calls[0]?.[0].messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          content: expect.stringContaining('You remember user preferences.'),
          role: 'system',
        }),
        expect.objectContaining({
          content: expect.stringContaining('User request:\nNeed: Draft a concise summary.'),
          role: 'user',
        }),
        expect.objectContaining({
          content: expect.stringContaining('Prefers terse release notes.'),
          role: 'user',
        }),
      ]),
    );
    expect(result.chatPreview.assistant).toBe('Memory-aware answer.');
  });

  it('falls back to agent snapshot config when the source agent record is missing', async () => {
    const chatSpy = vi.fn().mockResolvedValue({
      json: async () => ({
        choices: [{ message: { content: 'Snapshot answer.' } }],
      }),
    });
    vi.mocked(AgentModel).mockImplementation(
      () =>
        ({
          getAgentConfigById: vi.fn().mockResolvedValue(undefined),
        }) as any,
    );
    vi.spyOn(modelRuntimeModule, 'initModelRuntimeFromDB').mockResolvedValue({
      chat: chatSpy,
    } as any);

    const workflow = buildStudioWorkflowDefinition({
      edges: [
        { channel: 'main', id: 'input->agent', source: 'input', target: 'agent' },
        { channel: 'main', id: 'agent->chat', source: 'agent', target: 'chat' },
      ],
      nodes: [
        {
          data: { humanPrompt: 'Use the local snapshot.', title: 'Input' },
          id: 'input',
          type: 'input',
        },
        {
          data: {
            agentId: 'ghost-agent',
            agentName: 'Ghost Agent',
            model: 'gpt-4o-mini',
            params: { temperature: 0.1 },
            prompt: 'Snapshot prompt: {{humanPrompt}}',
            provider: 'openai',
            systemRole: 'Fallback role',
            title: 'Agent',
          },
          id: 'agent',
          type: 'agent',
        },
        {
          data: { target: 'chat', title: 'Chat' },
          id: 'chat',
          type: 'chat-output',
        },
      ],
      previewNodeId: 'chat',
    });

    const result = await runWorkflowStudioPreview({
      processContentBlocks: vi.fn(async (blocks) => blocks),
      serverDB: mockServerDB,
      userId: mockUserId,
      workflow,
    });

    expect(chatSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4o-mini',
        temperature: 0.1,
      }),
    );
    expect(result.chatPreview.assistant).toBe('Snapshot answer.');
  });

  it('supports chained agent batteries through explicit handoff ports', async () => {
    const chatSpy = vi.fn().mockImplementation(async ({ messages }) => ({
      json: async () => ({
        choices: [
          {
            message: {
              content: String(messages[0]?.content).includes('Lead agent')
                ? 'Lead handoff ready.'
                : 'Reviewer final answer.',
            },
          },
        ],
      }),
    }));
    vi.mocked(AgentModel).mockImplementation(
      () =>
        ({
          getAgentConfigById: vi.fn(async (agentId: string) =>
            agentId === 'agent-a'
              ? {
                  model: 'gpt-4o-mini',
                  provider: 'openai',
                  systemRole: 'Lead agent',
                  title: 'Lead Agent',
                }
              : {
                  model: 'gpt-4o-mini',
                  provider: 'openai',
                  systemRole: 'Reviewer agent',
                  title: 'Reviewer Agent',
                },
          ),
        }) as any,
    );
    vi.spyOn(modelRuntimeModule, 'initModelRuntimeFromDB').mockResolvedValue({
      chat: chatSpy,
    } as any);

    const workflow = buildStudioWorkflowDefinition({
      edges: [
        {
          id: 'input->agent-a',
          source: 'input',
          sourcePortId: 'prompt',
          target: 'agent-a',
          targetPortId: 'primary',
        },
        {
          id: 'agent-a->agent-b',
          source: 'agent-a',
          sourcePortId: 'handoff',
          target: 'agent-b',
          targetPortId: 'primary',
        },
        {
          id: 'agent-b->chat',
          source: 'agent-b',
          sourcePortId: 'result',
          target: 'chat',
          targetPortId: 'message',
        },
      ],
      nodes: [
        {
          data: { humanPrompt: 'Draft the release note.', title: 'Input' },
          id: 'input',
          type: 'input',
        },
        {
          data: {
            agentId: 'agent-a',
            agentName: 'Lead Agent',
            prompt: 'Lead request: {{humanPrompt}}',
            title: 'Lead',
          },
          id: 'agent-a',
          type: 'agent',
        },
        {
          data: {
            agentId: 'agent-b',
            agentName: 'Reviewer Agent',
            prompt: 'Review this handoff: {{upstreamResult}}',
            title: 'Reviewer',
          },
          id: 'agent-b',
          type: 'agent',
        },
        {
          data: { target: 'chat', title: 'Chat' },
          id: 'chat',
          type: 'chat-output',
        },
      ],
      previewNodeId: 'chat',
    });

    const result = await runWorkflowStudioPreview({
      processContentBlocks: vi.fn(async (blocks) => blocks),
      serverDB: mockServerDB,
      userId: mockUserId,
      workflow,
    });

    expect(chatSpy).toHaveBeenCalledTimes(2);
    expect(chatSpy.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining('Reviewer agent'),
            role: 'system',
          }),
          { content: 'Review this handoff: Lead handoff ready.', role: 'user' },
        ]),
      }),
    );
    expect(result.chatPreview.assistant).toBe('Reviewer final answer.');
    expect(result.chatPreview.user).toContain('Reviewer Agent');
  });

  it('pauses the graph when a breakpoint battery is reached', async () => {
    const workflow = buildStudioWorkflowDefinition({
      edges: [
        {
          id: 'input->transform',
          source: 'input',
          sourcePortId: 'prompt',
          target: 'transform',
          targetPortId: 'primary',
        },
        {
          id: 'transform->chat',
          source: 'transform',
          sourcePortId: 'result',
          target: 'chat',
          targetPortId: 'message',
        },
      ],
      nodes: [
        {
          data: { humanPrompt: 'Pause after formatting.', title: 'Input' },
          id: 'input',
          type: 'input',
        },
        {
          data: {
            breakpoint: true,
            mode: 'template',
            prompt: 'Paused output: {{upstreamResult}}',
            title: 'Transform',
          },
          id: 'transform',
          type: 'transform',
        },
        {
          data: { target: 'chat', title: 'Chat' },
          id: 'chat',
          type: 'chat-output',
        },
      ],
      previewNodeId: 'chat',
    });

    const result = await runWorkflowStudioPreview({
      processContentBlocks: vi.fn(async (blocks) => blocks),
      serverDB: mockServerDB,
      userId: mockUserId,
      workflow,
    });

    expect(result.breakpoint).toEqual({
      nodeId: 'transform',
      nodeTitle: 'Transform',
      nodeType: 'transform',
    });
    expect(result.chatPreview.assistant).toBe('Paused output: Pause after formatting.');
  });

  it('rejects multiple wires into a single-capacity input port', async () => {
    const workflow = buildStudioWorkflowDefinition({
      edges: [
        {
          id: 'input-a->chat',
          source: 'input-a',
          sourcePortId: 'prompt',
          target: 'chat',
          targetPortId: 'message',
        },
        {
          id: 'input-b->chat',
          source: 'input-b',
          sourcePortId: 'prompt',
          target: 'chat',
          targetPortId: 'message',
        },
      ],
      nodes: [
        {
          data: { humanPrompt: 'First input', title: 'Input A' },
          id: 'input-a',
          type: 'input',
        },
        {
          data: { humanPrompt: 'Second input', title: 'Input B' },
          id: 'input-b',
          type: 'input',
        },
        {
          data: { target: 'chat', title: 'Chat' },
          id: 'chat',
          type: 'chat-output',
        },
      ],
      previewNodeId: 'chat',
    });

    await expect(
      runWorkflowStudioPreview({
        processContentBlocks: vi.fn(async (blocks) => blocks),
        serverDB: mockServerDB,
        userId: mockUserId,
        workflow,
      }),
    ).rejects.toThrow(/does not accept more connections/);
  });

  it('rejects handoff wires unless they target another agent battery', async () => {
    const workflow = buildStudioWorkflowDefinition({
      edges: [
        {
          id: 'input->agent',
          source: 'input',
          sourcePortId: 'prompt',
          target: 'agent',
          targetPortId: 'primary',
        },
        {
          id: 'agent->chat',
          source: 'agent',
          sourcePortId: 'handoff',
          target: 'chat',
          targetPortId: 'message',
        },
      ],
      nodes: [
        {
          data: { humanPrompt: 'Draft the answer.', title: 'Input' },
          id: 'input',
          type: 'input',
        },
        {
          data: {
            agentId: 'agent-1',
            agentName: 'Triage Agent',
            prompt: 'Draft: {{humanPrompt}}',
            title: 'Agent',
          },
          id: 'agent',
          type: 'agent',
        },
        {
          data: { target: 'chat', title: 'Chat' },
          id: 'chat',
          type: 'chat-output',
        },
      ],
      previewNodeId: 'chat',
    });

    await expect(
      runWorkflowStudioPreview({
        processContentBlocks: vi.fn(async (blocks) => blocks),
        serverDB: mockServerDB,
        userId: mockUserId,
        workflow,
      }),
    ).rejects.toThrow(/invalid connection route/);
  });

  it('rejects context-only sources when they try to feed chat output directly', async () => {
    const workflow = buildStudioWorkflowDefinition({
      edges: [
        {
          id: 'resource->chat',
          source: 'resource',
          sourcePortId: 'content',
          target: 'chat',
          targetPortId: 'message',
        },
      ],
      nodes: [
        {
          data: {
            content: '# Notes\nIncident follow-up guidance.',
            title: 'Resource',
          },
          id: 'resource',
          type: 'resource',
        },
        {
          data: { target: 'chat', title: 'Chat' },
          id: 'chat',
          type: 'chat-output',
        },
      ],
      previewNodeId: 'chat',
    });

    await expect(
      runWorkflowStudioPreview({
        processContentBlocks: vi.fn(async (blocks) => blocks),
        serverDB: mockServerDB,
        userId: mockUserId,
        workflow,
      }),
    ).rejects.toThrow(/invalid connection route/);
  });

  it('renders imported resource and skill batteries through downstream transform batteries', async () => {
    const workflow = buildStudioWorkflowDefinition({
      edges: [
        {
          id: 'resource->transform',
          source: 'resource',
          sourcePortId: 'content',
          target: 'transform',
          targetPortId: 'primary',
        },
        {
          id: 'skill->transform',
          source: 'skill',
          sourcePortId: 'content',
          target: 'transform',
          targetPortId: 'context',
        },
        {
          id: 'transform->chat',
          source: 'transform',
          sourcePortId: 'result',
          target: 'chat',
          targetPortId: 'message',
        },
      ],
      nodes: [
        {
          data: {
            content: '# Ops Playbook\nEscalate infra incidents to the platform team.',
            resourcePath: 'playbooks/ops.md',
            skillId: 'skill-a',
            skillName: 'Ops Kit',
            title: 'Playbook Resource',
          },
          id: 'resource',
          type: 'resource',
        },
        {
          data: {
            content:
              '# Skill\nWhen incidents mention database latency, suggest checking replica lag.',
            skillId: 'skill-b',
            skillName: 'Incident Triage',
            title: 'Triage Skill',
          },
          id: 'skill',
          type: 'skill',
        },
        {
          data: {
            mode: 'template',
            prompt: 'Context bundle:\n{{upstreamResult}}',
            title: 'Transform',
          },
          id: 'transform',
          type: 'transform',
        },
        {
          data: { target: 'chat', title: 'Chat' },
          id: 'chat',
          type: 'chat-output',
        },
      ],
      previewNodeId: 'chat',
    });

    const result = await runWorkflowStudioPreview({
      processContentBlocks: vi.fn(async (blocks) => blocks),
      serverDB: mockServerDB,
      userId: mockUserId,
      workflow,
    });

    expect(result.toolResult).toBeUndefined();
    expect(result.chatPreview.assistant).toContain('Playbook Resource');
    expect(result.chatPreview.assistant).toContain('Triage Skill');
    expect(result.chatPreview.assistant).toContain('replica lag');
  });
});
