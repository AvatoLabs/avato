import { describe, expect, it } from 'vitest';

import {
  autoLayoutStudioNodes,
  buildChatPreview,
  buildConnectorPath,
  buildConnectorPathFromPoints,
  buildDefaultToolArguments,
  buildStudioDraft,
  buildWorkflowDsl,
  canConnectNodes,
  clampNodePositions,
  createDefaultStudioDraft,
  createStudioNode,
  estimateNodeSize,
  findStudioConnectionTarget,
  flattenStudioSkillResources,
  getNodeInputAnchor,
  getNodeInputPorts,
  getNodeOutputAnchor,
  getNodeOutputPorts,
  getStudioAutoNodeTitle,
  getStudioConnectionState,
  getSuggestedStudioNodePosition,
  insertBindingToken,
  parseStudioWorkflowLibrary,
  removeStudioWorkflowFromLibrary,
  shouldStudioReplaceTargetPortEdges,
  shouldStudioSyncNodeTitle,
  type StudioCanvasAgentNode,
  type StudioCanvasNode,
  type StudioCanvasResourceNode,
  type StudioCanvasSkillNode,
  type StudioCanvasToolNode,
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
        default: {
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
    expect(dsl).toContain('"channel": "main"');
    expect(dsl).not.toContain('"sourcePortId"');
    expect(dsl).not.toContain('"targetPortId"');
    expect(dsl).toContain('"Authorization": "***"');
    expect(dsl).not.toContain('top-secret');
  });

  it('serializes agent runtime snapshot fields into the workflow DSL', () => {
    const draft = createDefaultStudioDraft();
    const input = findNodeByType(draft.nodes, 'input');
    const chat = findNodeByType(draft.nodes, 'chat-output');
    const agent = createStudioNode('agent', { x: 420, y: 180 }) as StudioCanvasAgentNode;

    agent.data.agentId = 'agent_snapshot';
    agent.data.agentName = 'Snapshot Agent';
    agent.data.memoryEnabled = true;
    agent.data.model = 'gpt-4.1-mini';
    agent.data.params = '{\n  "temperature": 0.2\n}';
    agent.data.provider = 'openai';
    agent.data.systemRole = 'Snapshot role';

    const dsl = buildWorkflowDsl({
      draft: {
        ...draft,
        edges: [
          { channel: 'main', id: 'input->agent', source: input.id, target: agent.id },
          { channel: 'main', id: 'agent->chat', source: agent.id, target: chat.id },
        ],
        nodes: [input, agent, chat],
      },
    });

    expect(dsl).toContain('"model": "gpt-4.1-mini"');
    expect(dsl).toContain('"provider": "openai"');
    expect(dsl).toContain('"memoryEnabled": true');
    expect(dsl).toContain('"systemRole": "Snapshot role"');
    expect(dsl).toContain('"temperature": 0.2');
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
      sourcePortId: 'main',
      source: clampedInput,
      targetPortId: 'main',
      target: clampedTransform,
    });
    const directPath = buildConnectorPathFromPoints({
      end: getNodeInputAnchor(clampedTransform, 'main'),
      start: getNodeOutputAnchor(clampedInput, 'main'),
    });
    expect(path.startsWith('M ')).toBe(true);
    expect(path.includes(' C ')).toBe(true);
    expect(directPath).toBe(path);
  });

  it('uses a stable minimum size when a node seed is missing', () => {
    const size = estimateNodeSize({
      data: { mode: 'instruction', prompt: undefined, title: undefined },
      id: 'transform_missing_seed',
      position: { x: 0, y: 0 },
      type: 'transform',
    } as unknown as StudioCanvasNode);

    expect(size).toEqual({ height: 152, width: 260 });
  });

  it('guards allowed connections between battery types', () => {
    expect(canConnectNodes('input', 'mcp-tool')).toBe(true);
    expect(canConnectNodes('input', 'agent')).toBe(true);
    expect(canConnectNodes('resource', 'transform')).toBe(true);
    expect(canConnectNodes('skill', 'chat-output')).toBe(false);
    expect(canConnectNodes('agent', 'transform')).toBe(true);
    expect(canConnectNodes('mcp-tool', 'transform')).toBe(true);
    expect(canConnectNodes('transform', 'chat-output')).toBe(true);
    expect(canConnectNodes('chat-output', 'transform')).toBe(false);
    expect(canConnectNodes('mcp-tool', 'input')).toBe(false);
  });

  it('defines stable multi-slot ports for studio batteries', () => {
    const draft = createDefaultStudioDraft();
    const toolNode = findNodeByType(draft.nodes, 'mcp-tool');
    const agentNode = createStudioNode('agent', { x: 0, y: 0 });
    const transformNode = findNodeByType(draft.nodes, 'transform');

    expect(draft.edges[0]).toMatchObject({
      channel: 'main',
    });
    expect(getNodeInputPorts(toolNode).map((port) => port.id)).toEqual(['main', 'context']);
    expect(getNodeOutputPorts(toolNode).map((port) => port.id)).toEqual(['main']);
    expect(getNodeOutputPorts(agentNode).map((port) => port.id)).toEqual(['main', 'handoff']);
    expect(getNodeInputAnchor(transformNode, 'context').y).toBeGreaterThan(
      getNodeInputAnchor(transformNode, 'main').y,
    );
  });

  it('derives concrete auto titles from selected agents, resources, skills, and tools', () => {
    const agentNode = createStudioNode('agent', { x: 0, y: 0 }) as StudioCanvasAgentNode;
    const toolNode = createStudioNode('mcp-tool', { x: 0, y: 0 }) as StudioCanvasToolNode;
    const resourceNode = createStudioNode('resource', { x: 0, y: 0 }) as StudioCanvasResourceNode;
    const skillNode = createStudioNode('skill', { x: 0, y: 0 }) as StudioCanvasSkillNode;

    agentNode.data.agentName = 'Research Agent';
    toolNode.data.toolName = 'listIssues';
    resourceNode.data.sourceType = 'skill-resource';
    resourceNode.data.skillName = 'Design Pack';
    resourceNode.data.resourcePath = 'assets/hero.png';
    skillNode.data.skillName = 'Weekly Reporter';

    expect(getStudioAutoNodeTitle(agentNode)).toBe('Research Agent');
    expect(getStudioAutoNodeTitle(toolNode, { serverName: 'github-demo' })).toBe('listIssues');
    expect(getStudioAutoNodeTitle(resourceNode)).toBe('assets/hero.png');
    expect(getStudioAutoNodeTitle(skillNode)).toBe('Weekly Reporter');
  });

  it('only syncs titles while they are still automatic', () => {
    expect(
      shouldStudioSyncNodeTitle({
        currentTitle: 'Agent',
        nextAutoTitle: 'Research Agent',
        nodeType: 'agent',
        previousAutoTitle: 'Writer Agent',
      }),
    ).toBe(true);

    expect(
      shouldStudioSyncNodeTitle({
        currentTitle: 'assets/hero.png',
        nextAutoTitle: 'assets/logo.png',
        nodeType: 'resource',
        previousAutoTitle: 'assets/hero.png',
      }),
    ).toBe(true);

    expect(
      shouldStudioSyncNodeTitle({
        currentTitle: 'Issue triage',
        nextAutoTitle: 'listIssues',
        nodeType: 'mcp-tool',
        previousAutoTitle: 'github-demo',
      }),
    ).toBe(false);
  });

  it('lays out connected batteries from left to right based on graph order', () => {
    const draft = createGraphDraft();
    const resource = createStudioNode('resource', { x: 1200, y: 520 });
    const skill = createStudioNode('skill', { x: 980, y: 640 });
    const tool = findNodeByType(draft.nodes, 'mcp-tool');
    const transform = findNodeByType(draft.nodes, 'transform');
    const laidOut = autoLayoutStudioNodes(
      [...draft.nodes, resource, skill],
      [
        ...draft.edges,
        {
          id: 'edge_resource_context',
          source: resource.id,
          sourcePortId: 'content',
          target: tool.id,
          targetPortId: 'context',
        },
        {
          id: 'edge_skill_context',
          source: skill.id,
          sourcePortId: 'content',
          target: transform.id,
          targetPortId: 'context',
        },
      ],
    );
    const laidOutInput = findNodeByType(laidOut, 'input');
    const laidOutTool = findNodeByType(laidOut, 'mcp-tool');
    const laidOutTransform = findNodeByType(laidOut, 'transform');
    const laidOutChat = findNodeByType(laidOut, 'chat-output');
    const laidOutResource = laidOut.find((node) => node.id === resource.id)!;
    const laidOutSkill = laidOut.find((node) => node.id === skill.id)!;

    expect(laidOutInput.position.x).toBeLessThan(laidOutTool.position.x);
    expect(laidOutTool.position.x).toBeLessThan(laidOutTransform.position.x);
    expect(laidOutTransform.position.x).toBeLessThan(laidOutChat.position.x);
    expect(laidOutResource.position.x).toBe(laidOutInput.position.x);
    expect(laidOutSkill.position.x).toBe(laidOutInput.position.x);
  });

  it('keeps the primary chat workflow component above disconnected components', () => {
    const draft = createGraphDraft();
    const isolatedAgent = createStudioNode('agent', { x: 80, y: 60 });
    const isolatedResource = createStudioNode('resource', { x: 120, y: 120 });
    const laidOut = autoLayoutStudioNodes(
      [...draft.nodes, isolatedAgent, isolatedResource],
      draft.edges,
    );
    const laidOutInput = findNodeByType(laidOut, 'input');
    const laidOutTool = findNodeByType(laidOut, 'mcp-tool');
    const laidOutTransform = findNodeByType(laidOut, 'transform');
    const laidOutChat = findNodeByType(laidOut, 'chat-output');
    const laidOutAgent = laidOut.find((node) => node.id === isolatedAgent.id)!;
    const laidOutResource = laidOut.find((node) => node.id === isolatedResource.id)!;

    expect(laidOutInput.position.y).toBeLessThan(laidOutAgent.position.y);
    expect(laidOutTool.position.y).toBeLessThan(laidOutAgent.position.y);
    expect(laidOutTransform.position.y).toBeLessThan(laidOutAgent.position.y);
    expect(laidOutChat.position.y).toBeLessThan(laidOutAgent.position.y);
    expect(laidOutInput.position.y).toBeLessThan(laidOutResource.position.y);
    expect(laidOutTool.position.y).toBeLessThan(laidOutResource.position.y);
    expect(laidOutTransform.position.y).toBeLessThan(laidOutResource.position.y);
    expect(laidOutChat.position.y).toBeLessThan(laidOutResource.position.y);
  });

  it('stacks independent workflow components into separate rows', () => {
    const firstInput = createStudioNode('input', { x: 72, y: 120 });
    const firstTool = createStudioNode('mcp-tool', { x: 420, y: 120 });
    const firstChat = createStudioNode('chat-output', { x: 760, y: 120 });
    const secondInput = createStudioNode('input', { x: 72, y: 540 });
    const secondTransform = createStudioNode('transform', { x: 420, y: 540 });
    const secondChat = createStudioNode('chat-output', { x: 760, y: 540 });
    const laidOut = autoLayoutStudioNodes(
      [firstInput, firstTool, firstChat, secondInput, secondTransform, secondChat],
      [
        {
          id: 'edge_first_1',
          source: firstInput.id,
          sourcePortId: 'prompt',
          target: firstTool.id,
          targetPortId: 'primary',
        },
        {
          id: 'edge_first_2',
          source: firstTool.id,
          sourcePortId: 'result',
          target: firstChat.id,
          targetPortId: 'message',
        },
        {
          id: 'edge_second_1',
          source: secondInput.id,
          sourcePortId: 'prompt',
          target: secondTransform.id,
          targetPortId: 'primary',
        },
        {
          id: 'edge_second_2',
          source: secondTransform.id,
          sourcePortId: 'result',
          target: secondChat.id,
          targetPortId: 'message',
        },
      ],
    );
    const laidOutFirstInput = laidOut.find((node) => node.id === firstInput.id)!;
    const laidOutSecondInput = laidOut.find((node) => node.id === secondInput.id)!;
    const laidOutFirstChat = laidOut.find((node) => node.id === firstChat.id)!;
    const laidOutSecondChat = laidOut.find((node) => node.id === secondChat.id)!;

    expect(laidOutFirstInput.position.y).toBeLessThan(laidOutSecondInput.position.y);
    expect(laidOutFirstChat.position.y).toBeLessThan(laidOutSecondChat.position.y);
    expect(laidOutFirstInput.position.x).toBe(laidOutSecondInput.position.x);
  });

  it('finds a valid fallback port when the nearest primary input is already occupied', () => {
    const upstreamA = createStudioNode('input', { x: 72, y: 120 });
    const upstreamB = createStudioNode('input', { x: 72, y: 320 });
    const transform = createStudioNode('transform', { x: 420, y: 180 });
    const busyState = getStudioConnectionState({
      edges: [
        {
          id: 'edge_busy_primary',
          source: upstreamA.id,
          sourcePortId: 'main',
          target: transform.id,
          targetPortId: 'main',
        },
      ],
      sourceNode: upstreamB,
      sourcePortId: 'main',
      targetNode: transform,
      targetPortId: 'main',
    });
    const target = findStudioConnectionTarget({
      edges: [
        {
          id: 'edge_busy_primary',
          source: upstreamA.id,
          sourcePortId: 'main',
          target: transform.id,
          targetPortId: 'main',
        },
      ],
      nodes: [upstreamA, upstreamB, transform],
      point: {
        x: transform.position.x + 12,
        y: getNodeInputAnchor(transform, 'main').y,
      },
      sourceId: upstreamB.id,
      sourcePortId: 'main',
    });

    expect(busyState.kind).toBe('busy');
    expect(target).toEqual({
      targetId: transform.id,
      targetPortId: 'context',
    });
  });

  it('replaces only single-capacity inputs and preserves multi-input ports', () => {
    const tool = createStudioNode('mcp-tool', { x: 420, y: 180 });

    expect(shouldStudioReplaceTargetPortEdges(tool, 'main')).toBe(true);
    expect(shouldStudioReplaceTargetPortEdges(tool, 'context')).toBe(false);
  });

  it('lets a resource battery snap onto tool context during drag connect', () => {
    const resource = createStudioNode('resource', { x: 72, y: 120 });
    const tool = createStudioNode('mcp-tool', { x: 420, y: 180 });

    const target = findStudioConnectionTarget({
      edges: [],
      nodes: [resource, tool],
      point: {
        x: tool.position.x + 12,
        y: getNodeInputAnchor(tool, 'context').y,
      },
      sourceId: resource.id,
      sourcePortId: 'content',
    });

    expect(target).toEqual({
      targetId: tool.id,
      targetPortId: 'context',
    });
  });

  it('lets a skill battery snap onto transform context during drag connect', () => {
    const skill = createStudioNode('skill', { x: 72, y: 120 });
    const transform = createStudioNode('transform', { x: 420, y: 180 });

    const target = findStudioConnectionTarget({
      edges: [],
      nodes: [skill, transform],
      point: {
        x: transform.position.x + 12,
        y: getNodeInputAnchor(transform, 'context').y,
      },
      sourceId: skill.id,
      sourcePortId: 'content',
    });

    expect(target).toEqual({
      targetId: transform.id,
      targetPortId: 'context',
    });
  });

  it('keeps node-body drops connectable and suggests logical placement for newly added batteries', () => {
    const input = createStudioNode('input', { x: 72, y: 120 });
    const tool = createStudioNode('mcp-tool', { x: 460, y: 180 });
    const target = findStudioConnectionTarget({
      edges: [],
      nodes: [input, tool],
      point: {
        x: tool.position.x + 56,
        y: tool.position.y + 54,
      },
      sourceId: input.id,
      sourcePortId: 'main',
    });
    const suggestedAgent = getSuggestedStudioNodePosition({
      nodes: [input, tool],
      selectedNode: tool,
      type: 'agent',
    });

    expect(target).toEqual({
      targetId: tool.id,
      targetPortId: 'main',
    });
    expect(suggestedAgent.x).toBeGreaterThan(tool.position.x);
    expect(suggestedAgent.y).toBe(tool.position.y);
  });

  it('normalizes stale edge port ids from older drafts', () => {
    const draft = createGraphDraft();
    const normalized = buildStudioDraft({
      ...draft,
      edges: draft.edges.map((edge, index) =>
        index === 0
          ? {
              ...edge,
              targetPortId: 'config',
            }
          : edge,
      ),
    });

    expect(normalized.edges[0]).toMatchObject({
      channel: 'main',
    });
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
