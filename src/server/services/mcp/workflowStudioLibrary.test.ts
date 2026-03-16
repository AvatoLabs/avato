// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  applyWorkflowStudioSettingsState,
  extractInstalledWorkflowStudioServers,
  parseWorkflowStudioSettingsState,
  removeWorkflowStudioWorkflow,
  upsertWorkflowStudioWorkflow,
} from './workflowStudioLibrary';

describe('workflowStudioLibrary', () => {
  it('parses and sorts saved workflows from tool settings', () => {
    const state = parseWorkflowStudioSettingsState({
      workflowStudio: {
        workflows: [
          {
            createdAt: 100,
            draft: { nodes: [] },
            id: 'first',
            name: 'First',
            updatedAt: 100,
          },
          {
            createdAt: 200,
            draft: { nodes: [] },
            id: 'second',
            name: 'Second',
            updatedAt: 300,
          },
        ],
      },
    });

    expect(state.workflows.map((item) => item.id)).toEqual(['second', 'first']);
  });

  it('upserts and removes workflows inside the settings payload', () => {
    const created = upsertWorkflowStudioWorkflow({
      draft: { nodes: ['a'] },
      name: 'Daily triage',
      now: 100,
      state: { workflows: [] },
    });
    const updated = upsertWorkflowStudioWorkflow({
      draft: { nodes: ['b'] },
      id: created.entry.id,
      name: 'Daily triage v2',
      now: 200,
      state: created.state,
    });
    const persistedToolSettings = applyWorkflowStudioSettingsState(
      { humanIntervention: { mode: 'always' } },
      updated.state,
    );
    const removed = removeWorkflowStudioWorkflow({
      id: created.entry.id,
      state: updated.state,
    });

    expect(updated.entry.createdAt).toBe(100);
    expect(updated.entry.updatedAt).toBe(200);
    expect(updated.entry.name).toBe('Daily triage v2');
    expect(
      (persistedToolSettings.workflowStudio as { workflows: unknown[] }).workflows,
    ).toHaveLength(1);
    expect(removed.workflows).toHaveLength(0);
    expect((persistedToolSettings as { humanIntervention?: unknown }).humanIntervention).toEqual({
      mode: 'always',
    });
  });

  it('normalizes legacy workflow edges into channel-based drafts on save and read', () => {
    const legacyDraft = {
      edges: [
        {
          id: 'input->tool',
          source: 'input',
          sourcePortId: 'prompt',
          target: 'tool',
          targetPortId: 'primary',
        },
        {
          id: 'resource->tool',
          source: 'resource',
          sourcePortId: 'content',
          target: 'tool',
          targetPortId: 'context',
        },
      ],
      nodes: [
        { data: { humanPrompt: 'Hello' }, id: 'input', type: 'input' },
        { data: { content: 'Docs' }, id: 'resource', type: 'resource' },
        { data: { title: 'Tool' }, id: 'tool', type: 'mcp-tool' },
      ],
      previewNodeId: 'tool',
      selectedNodeId: 'tool',
      servers: [],
    };
    const created = upsertWorkflowStudioWorkflow({
      draft: legacyDraft,
      name: 'Normalized',
      now: 100,
      state: { workflows: [] },
    });
    const parsed = parseWorkflowStudioSettingsState({
      workflowStudio: {
        workflows: [created.entry],
      },
    });

    expect(created.entry.draft).toMatchObject({
      edges: [
        { channel: 'main', id: 'input->tool', source: 'input', target: 'tool' },
        { channel: 'context', id: 'resource->tool', source: 'resource', target: 'tool' },
      ],
      previewNodeId: 'tool',
      selectedNodeId: 'tool',
    });
    expect(parsed.workflows[0]?.draft).toMatchObject({
      edges: [
        { channel: 'main', id: 'input->tool', source: 'input', target: 'tool' },
        { channel: 'context', id: 'resource->tool', source: 'resource', target: 'tool' },
      ],
    });
    expect((created.entry.draft.edges as Array<Record<string, unknown>>)[0]).not.toHaveProperty(
      'sourcePortId',
    );
    expect((created.entry.draft.edges as Array<Record<string, unknown>>)[0]).not.toHaveProperty(
      'targetPortId',
    );
  });

  it('extracts installed MCP servers from user-installed plugins', () => {
    const servers = extractInstalledWorkflowStudioServers([
      {
        customParams: {
          mcp: {
            auth: { token: 'secret', type: 'bearer' },
            headers: { 'X-Workspace': 'design' },
            type: 'http',
            url: 'https://example.com/mcp',
          },
        },
        identifier: 'linear-demo',
        manifest: {
          api: [
            {
              description: 'List issues',
              name: 'listIssues',
              parameters: { type: 'object' },
            },
          ],
          meta: {
            avatar: '🧭',
            description: 'Linear issue server',
            title: 'Linear Demo',
          },
        } as any,
        type: 'plugin',
      },
      {
        customParams: {
          mcp: {
            args: ['@modelcontextprotocol/server-filesystem', '/tmp'],
            command: 'npx',
            type: 'stdio',
          },
        },
        identifier: 'filesystem-demo',
        manifest: {
          api: [],
          meta: {
            avatar: '📁',
            title: 'Filesystem Demo',
          },
        } as any,
        type: 'plugin',
      },
    ]);

    const filesystemServer = servers.find((item) => item.id === 'filesystem-demo');
    const linearServer = servers.find((item) => item.id === 'linear-demo');

    expect(servers).toHaveLength(2);
    expect(filesystemServer?.avatar).toBe('📁');
    expect(filesystemServer?.origin).toBe('installed');
    expect(filesystemServer?.connection.type).toBe('stdio');
    expect(linearServer?.avatar).toBe('🧭');
    expect(linearServer?.description).toBe('Linear issue server');
    expect(linearServer?.tools[0]?.name).toBe('listIssues');
    expect(linearServer?.connection.type).toBe('http');
  });
});
