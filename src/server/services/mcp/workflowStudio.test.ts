// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildStudioWorkflowDefinition } from '@/libs/mcp/workflowStudio';

import { mcpService } from './index';
import { runWorkflowStudioPreview } from './workflowStudio';

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
        source: 'input',
        target: 'tool',
      },
      { id: 'tool->transform', source: 'tool', target: 'transform' },
      { id: 'transform->chat', source: 'transform', target: 'chat' },
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
      { id: 'input->tool', source: 'input', target: 'tool' },
      { id: 'tool->transform', source: 'tool', target: 'transform' },
      { id: 'transform->chat', source: 'transform', target: 'chat' },
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
          source: 'input-a',
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
          source: 'input-b',
          target: 'tool',
        },
        { id: 'tool->chat', source: 'tool', target: 'chat' },
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
          source: 'input-a',
          target: 'tool-a',
        },
        {
          id: 'input-b->tool-b',
          payloadBindings: [{ id: 'binding-b', source: 'humanPrompt', targetPath: 'query' }],
          source: 'input-b',
          target: 'tool-b',
        },
        { id: 'tool-a->transform', source: 'tool-a', target: 'transform' },
        { id: 'tool-b->transform', source: 'tool-b', target: 'transform' },
        { id: 'transform->chat', source: 'transform', target: 'chat' },
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
      workflow,
    });

    expect(callToolSpy).toHaveBeenCalledTimes(2);
    expect(result.toolResult?.content).toContain('Infra Tool (listInfraIssues)');
    expect(result.toolResult?.content).toContain('Design Tool (listDesignIssues)');
    expect(result.chatPreview.assistant).toContain('Combined results');
    expect(result.chatPreview.assistant).toContain('Infra issues: 3');
    expect(result.chatPreview.assistant).toContain('Design issues: 2');
  });

  it('renders imported resource and skill batteries through downstream transform batteries', async () => {
    const workflow = buildStudioWorkflowDefinition({
      edges: [
        { id: 'resource->transform', source: 'resource', target: 'transform' },
        { id: 'skill->transform', source: 'skill', target: 'transform' },
        { id: 'transform->chat', source: 'transform', target: 'chat' },
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
      workflow,
    });

    expect(result.toolResult).toBeUndefined();
    expect(result.chatPreview.assistant).toContain('Playbook Resource');
    expect(result.chatPreview.assistant).toContain('Triage Skill');
    expect(result.chatPreview.assistant).toContain('replica lag');
  });
});
