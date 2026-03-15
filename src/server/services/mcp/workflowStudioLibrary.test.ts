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
            title: 'Filesystem Demo',
          },
        } as any,
        type: 'plugin',
      },
    ]);

    const filesystemServer = servers.find((item) => item.id === 'filesystem-demo');
    const linearServer = servers.find((item) => item.id === 'linear-demo');

    expect(servers).toHaveLength(2);
    expect(filesystemServer?.origin).toBe('installed');
    expect(filesystemServer?.connection.type).toBe('stdio');
    expect(linearServer?.tools[0]?.name).toBe('listIssues');
    expect(linearServer?.connection.type).toBe('http');
  });
});
