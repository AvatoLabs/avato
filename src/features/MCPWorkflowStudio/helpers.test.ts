import { describe, expect, it } from 'vitest';

import {
  buildChatPreview,
  buildConnectorPath,
  buildConnectorPathFromPoints,
  buildDefaultToolArguments,
  buildStudioDraft,
  buildWorkflowDsl,
  canConnectNodes,
  clampNodePositions,
  createDefaultStudioDraft,
  estimateNodeSize,
  flattenStudioSkillResources,
  getNodeInputAnchor,
  getNodeInputPorts,
  getNodeOutputAnchor,
  getNodeOutputPorts,
  insertBindingToken,
  parseStudioWorkflowLibrary,
  removeStudioWorkflowFromLibrary,
  type StudioCanvasNode,
  type StudioDraft,
  type StudioLoadedServer,
  upsertStudioWorkflowLibrary,
} from './helpers';

const findNodeByType = <T extends StudioCanvasNode['type']>(
  nodes: StudioCanvasNode[],
  type: T,
): Extract<StudioCanvasNode, { type: T }> => {
  const node = nodes.find(
    (item): item is Extract<StudioCanvasNode, { type: T }> => item.type === type,
  );

  if (!node) throw new Error(`Expected node "${type}" to exist in the draft.`);

  return node;
};

const createLoadedServer = (): StudioLoadedServer => ({
  connection: {
    authType: 'bearer',
    headers: {
      'Authorization': 'Bearer top-secret',
      'X-Workspace': 'design',
    },
    identifier: 'github-demo',
    token: 'top-secret',
    type: 'http',
    url: 'https://example.com/mcp',
  },
  createdAt: 100,
  id: 'server_1',
  name: 'github-demo',
  tools: [
    {
      description: 'List issues from the configured repository.',
      name: 'listIssues',
      parameters: {
        properties: {
          repo: { type: 'string' },
        },
        type: 'object',
      },
    },
  ],
  updatedAt: 100,
});

const createGraphDraft = (): StudioDraft => {
  const draft = createDefaultStudioDraft();

  return {
    ...draft,
    nodes: draft.nodes.map((node) => {
      switch (node.type) {
        case 'input': {
          return {
            ...node,
            data: {
              ...node.data,
              humanPrompt: 'Find open issues for lobehub this week.',
            },
          };
        }
        case 'mcp-tool': {
          return {
            ...node,
            data: {
              ...node.data,
              payload: '{"repo":"lobehub","apiKey":"secret"}',
              payloadBindings: [
                {
                  id: 'binding_1',
                  source: 'humanPrompt',
                  targetPath: 'filters.query',
                },
              ],
              serverId: 'server_1',
              toolName: 'listIssues',
            },
          };
        }
        case 'transform': {
          return {
            ...node,
            data: {
              ...node.data,
              mode: 'template',
              prompt: 'Request: {{humanPrompt}}\nData: {{toolResult}}',
            },
          };
        }
        case 'resource':
        case 'skill':
        case 'chat-output': {
          return node;
        }
      }
    }),
    servers: [createLoadedServer()],
  };
};

describe('MCPWorkflowStudio helpers', () => {
  it('builds starter tool arguments from a JSON schema', () => {
    const result = buildDefaultToolArguments({
      properties: {
        includeClosed: { type: 'boolean' },
        labels: {
          items: { type: 'string' },
          type: 'array',
        },
        owner: { type: 'string' },
      },
      type: 'object',
    });

    expect(result).toBe('{\n  "includeClosed": false,\n  "labels": [],\n  "owner": ""\n}');
  });

  it('builds a sanitized local draft without persisting MCP secrets', () => {
    const sanitized = buildStudioDraft(createGraphDraft());
    const toolNode = findNodeByType(sanitized.nodes, 'mcp-tool');
    const server = sanitized.servers[0];

    expect(server.connection.type).toBe('http');
    expect(server.connection.type === 'http' ? server.connection.token : undefined).toBe('***');
    expect(
      server.connection.type === 'http' ? server.connection.headers?.Authorization : undefined,
    ).toBe('***');
    expect(
      server.connection.type === 'http' ? server.connection.headers?.['X-Workspace'] : undefined,
    ).toBe('design');
    expect(toolNode.data.payload).toContain('"apiKey": "***"');
    expect(toolNode.data.payloadBindings).toEqual([
      {
        id: 'binding_1',
        source: 'humanPrompt',
        targetPath: 'filters.query',
      },
    ]);
  });

  it('builds a DSL snapshot for the graph without leaking secrets', () => {
    const dsl = buildWorkflowDsl({ draft: createGraphDraft() });

    expect(dsl).toContain('"version": "2.0"');
    expect(dsl).toContain('"previewNodeId"');
    expect(dsl).toContain('"toolName": "listIssues"');
    expect(dsl).toContain('"source": "humanPrompt"');
    expect(dsl).toContain('"Authorization": "***"');
    expect(dsl).not.toContain('top-secret');
  });

  it('builds a chat preview for template-based output shaping', () => {
    const preview = buildChatPreview({
      connection: {
        identifier: 'github-demo',
        type: 'http',
        url: 'https://example.com/mcp',
      },
      humanPrompt: 'Show me blocked issues for this week.',
      result: 'Open issues: 12. Blocked issues: 2.',
      success: true,
      toolName: 'listIssues',
      transformMode: 'template',
      transformPrompt: 'Request: Show me blocked issues for this week.\nData: Open issues: 12.',
    });

    expect(preview.user).toContain('blocked issues');
    expect(preview.assistant).toContain('Blocked issues: 2');
    expect(preview.system).toContain('Request: Show me blocked issues');
  });

  it('sizes batteries from text length and clamps them within canvas bounds', () => {
    const shortNode: StudioCanvasNode = {
      data: { humanPrompt: 'Short', title: 'Input' },
      id: 'input_short',
      position: { x: -48, y: -24 },
      type: 'input',
    };
    const longNode: StudioCanvasNode = {
      data: {
        prompt:
          'Transform the upstream result into a concise summary that is safe to send to chat and still preserves operational detail.',
        title: 'Transform',
        mode: 'template',
      },
      id: 'transform_long',
      position: { x: 2048, y: 2048 },
      type: 'transform',
    };
    const clamped = clampNodePositions([shortNode, longNode], { height: 420, width: 760 });
    const clampedInput = findNodeByType(clamped, 'input');
    const clampedTransform = findNodeByType(clamped, 'transform');
    const shortSize = estimateNodeSize(shortNode);
    const longSize = estimateNodeSize(longNode);

    expect(longSize.height).toBeGreaterThan(shortSize.height);
    expect(longSize.width).toBeGreaterThan(shortSize.width);
    expect(clampedInput.position).toEqual({ x: 0, y: 0 });
    expect(clampedTransform.position.x).toBeLessThanOrEqual(760 - longSize.width - 24);
    expect(clampedTransform.position.y).toBeLessThanOrEqual(420 - longSize.height - 24);

    const path = buildConnectorPath({
      sourcePortId: 'prompt',
      source: clampedInput,
      targetPortId: 'primary',
      target: clampedTransform,
    });
    const directPath = buildConnectorPathFromPoints({
      end: getNodeInputAnchor(clampedTransform, 'primary'),
      start: getNodeOutputAnchor(clampedInput, 'prompt'),
    });
    expect(path.startsWith('M ')).toBe(true);
    expect(path.includes(' C ')).toBe(true);
    expect(directPath).toBe(path);
  });

  it('guards allowed connections between battery types', () => {
    expect(canConnectNodes('input', 'mcp-tool')).toBe(true);
    expect(canConnectNodes('resource', 'transform')).toBe(true);
    expect(canConnectNodes('skill', 'chat-output')).toBe(true);
    expect(canConnectNodes('mcp-tool', 'transform')).toBe(true);
    expect(canConnectNodes('transform', 'chat-output')).toBe(true);
    expect(canConnectNodes('chat-output', 'transform')).toBe(false);
    expect(canConnectNodes('mcp-tool', 'input')).toBe(false);
  });

  it('defines stable multi-slot ports for studio batteries', () => {
    const draft = createDefaultStudioDraft();
    const toolNode = findNodeByType(draft.nodes, 'mcp-tool');
    const transformNode = findNodeByType(draft.nodes, 'transform');

    expect(draft.edges[0]).toMatchObject({
      sourcePortId: 'prompt',
      targetPortId: 'primary',
    });
    expect(getNodeInputPorts(toolNode).map((port) => port.id)).toEqual([
      'primary',
      'context',
      'config',
    ]);
    expect(getNodeOutputPorts(toolNode).map((port) => port.id)).toEqual(['result']);
    expect(getNodeInputAnchor(transformNode, 'context').y).toBeGreaterThan(
      getNodeInputAnchor(transformNode, 'primary').y,
    );
  });

  it('flattens a skill resource tree into selectable file options', () => {
    const options = flattenStudioSkillResources([
      {
        children: [
          { name: 'guide.md', path: 'docs/guide.md', type: 'file' },
          { name: 'diagram.png', path: 'docs/diagram.png', type: 'file' },
        ],
        name: 'docs',
        path: 'docs',
        type: 'directory',
      },
    ]);

    expect(options).toEqual([
      { label: 'docs/diagram.png', value: 'docs/diagram.png' },
      { label: 'docs/guide.md', value: 'docs/guide.md' },
    ]);
  });

  it('inserts a binding token at the current cursor selection', () => {
    const result = insertBindingToken({
      selectionEnd: 14,
      selectionStart: 10,
      token: '{{humanPrompt}}',
      value: '{"query":"repo"}',
    });

    expect(result.nextValue).toBe('{"query":"{{humanPrompt}}"}');
    expect(result.nextSelection).toBe(25);
  });

  it('upserts, parses, sorts, and removes saved workflows in the local library', () => {
    const draft = createGraphDraft();
    const first = upsertStudioWorkflowLibrary({
      draft,
      library: [],
      name: 'Team triage',
      now: 100,
    });
    const second = upsertStudioWorkflowLibrary({
      draft: {
        ...draft,
        nodes: draft.nodes.map((node) =>
          node.type === 'input'
            ? {
                ...node,
                data: {
                  ...node.data,
                  humanPrompt: 'Summarize production incidents for this week.',
                },
              }
            : node,
        ),
      },
      library: first.library,
      name: 'Incident wrap-up',
      now: 200,
    });

    const parsed = parseStudioWorkflowLibrary(JSON.stringify(second.library));
    const firstToolNode = findNodeByType(first.entry.draft.nodes, 'mcp-tool');

    expect(first.entry.draft.servers[0]?.connection.type).toBe('http');
    expect(
      first.entry.draft.servers[0]?.connection.type === 'http'
        ? first.entry.draft.servers[0].connection.token
        : undefined,
    ).toBe('***');
    expect(firstToolNode.data.payload).toContain('"apiKey": "***"');
    expect(parsed.map((item) => item.name)).toEqual(['Incident wrap-up', 'Team triage']);

    const removed = removeStudioWorkflowFromLibrary({
      id: second.entry.id,
      library: parsed,
    });
    expect(removed.map((item) => item.name)).toEqual(['Team triage']);
  });
});
