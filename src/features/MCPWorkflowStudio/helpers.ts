import { type SkillResourceTreeNode } from '@lobechat/types';
import { safeParseJSON } from '@lobechat/utils';

import {
  buildStudioChatPreview,
  buildStudioWorkflowDefinition,
  type StudioConnectionConfig,
  type StudioNodeType,
  type StudioPayloadBinding,
  type StudioPayloadBindingSource,
  type StudioWorkflowDSL,
  type StudioWorkflowEdge,
  type StudioWorkflowNode,
} from '@/libs/mcp/workflowStudio';
import { nanoid } from '@/utils/uuid';

export interface StudioSavedToolDefinition {
  description?: string;
  name: string;
  parameters?: unknown;
}

export interface StudioNodePosition {
  x: number;
  y: number;
}

export interface StudioCanvasInputNode {
  data: {
    humanPrompt: string;
    title: string;
  };
  id: string;
  position: StudioNodePosition;
  type: 'input';
}

export interface StudioCanvasToolNode {
  data: {
    payload: string;
    payloadBindings: StudioPayloadBinding[];
    serverId?: string;
    title: string;
    toolName?: string;
  };
  id: string;
  position: StudioNodePosition;
  type: 'mcp-tool';
}

export interface StudioCanvasTransformNode {
  data: {
    mode: 'instruction' | 'template';
    prompt: string;
    title: string;
  };
  id: string;
  position: StudioNodePosition;
  type: 'transform';
}

export interface StudioCanvasResourceNode {
  data: {
    content: string;
    resourcePath?: string;
    skillId?: string;
    skillName?: string;
    title: string;
  };
  id: string;
  position: StudioNodePosition;
  type: 'resource';
}

export interface StudioCanvasSkillNode {
  data: {
    content: string;
    skillId?: string;
    skillName?: string;
    title: string;
  };
  id: string;
  position: StudioNodePosition;
  type: 'skill';
}

export interface StudioCanvasChatNode {
  data: {
    title: string;
  };
  id: string;
  position: StudioNodePosition;
  type: 'chat-output';
}

export type StudioCanvasNode =
  | StudioCanvasChatNode
  | StudioCanvasInputNode
  | StudioCanvasToolNode
  | StudioCanvasResourceNode
  | StudioCanvasSkillNode
  | StudioCanvasTransformNode;

export interface StudioLoadedServer {
  connection: StudioConnectionConfig;
  createdAt: number;
  id: string;
  name: string;
  origin?: 'custom' | 'installed';
  tools: StudioSavedToolDefinition[];
  updatedAt: number;
}

export interface StudioDraft {
  edges: StudioWorkflowEdge[];
  nodes: StudioCanvasNode[];
  previewNodeId?: string;
  selectedNodeId?: string;
  servers: StudioLoadedServer[];
}

export interface StudioSavedWorkflow {
  createdAt: number;
  draft: StudioDraft;
  id: string;
  name: string;
  updatedAt: number;
}

export interface StudioCanvasBounds {
  height: number;
  width: number;
}

export interface StudioNodePort {
  id: string;
  kind: 'input' | 'output';
}

const SENSITIVE_KEY = /authorization|secret|token|key|password/i;
export const STUDIO_STORAGE_KEY = 'lobehub-mcp-workflow-studio-draft';
export const STUDIO_LIBRARY_STORAGE_KEY = 'lobehub-mcp-workflow-studio-library';
export const STUDIO_CANVAS_PADDING = 24;
export const STUDIO_DEFAULT_CANVAS_BOUNDS = { height: 640, width: 1360 } as const;

const isRecord = (value: unknown): value is Record<string, any> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const redactRecord = (record?: Record<string, string>) => {
  if (!record) return undefined;

  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, SENSITIVE_KEY.test(key) ? '***' : value]),
  );
};

const redactUnknown = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(redactUnknown);
  if (!isRecord(value)) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, itemValue]) => [
      key,
      SENSITIVE_KEY.test(key) ? '***' : redactUnknown(itemValue),
    ]),
  );
};

const redactToken = (token?: string) => {
  if (!token) return undefined;

  return '***';
};

const sanitizeJsonString = (value: string, fallback = '{}') => {
  const parsed = safeParseJSON(value);

  if (parsed === undefined || parsed === null) return fallback;

  return JSON.stringify(redactUnknown(parsed), null, 2);
};

const sanitizeConnection = (connection: StudioConnectionConfig): StudioConnectionConfig =>
  connection.type === 'http'
    ? {
        authType: connection.authType,
        headers: redactRecord(connection.headers),
        identifier: connection.identifier,
        token: connection.authType === 'none' ? undefined : redactToken(connection.token),
        type: connection.type,
        url: connection.url,
      }
    : {
        args: connection.args || [],
        command: connection.command,
        env: redactRecord(connection.env),
        identifier: connection.identifier,
        type: connection.type,
      };

const parsePayloadBindings = (value: unknown): StudioPayloadBinding[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      if (!isRecord(item)) return undefined;

      const source =
        item.source === 'serverIdentifier' ||
        item.source === 'toolName' ||
        item.source === 'upstreamResult'
          ? item.source
          : 'humanPrompt';

      return {
        id: typeof item.id === 'string' && item.id ? item.id : `binding_${index}`,
        source,
        targetPath: String(item.targetPath || ''),
      } satisfies StudioPayloadBinding;
    })
    .filter((item): item is StudioPayloadBinding => Boolean(item));
};

const parsePosition = (value: unknown, fallback: StudioNodePosition): StudioNodePosition => ({
  x: Number(isRecord(value) ? value.x : fallback.x) || fallback.x,
  y: Number(isRecord(value) ? value.y : fallback.y) || fallback.y,
});

const parseCanvasNode = (value: unknown, fallbackIndex = 0): StudioCanvasNode | undefined => {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.type !== 'string') {
    return undefined;
  }

  const fallbackPosition = {
    x: 80 + fallbackIndex * 40,
    y: 80 + fallbackIndex * 24,
  };
  const position = parsePosition(value.position, fallbackPosition);

  switch (value.type) {
    case 'input': {
      return {
        data: {
          humanPrompt: String(value.data?.humanPrompt || ''),
          title: String(value.data?.title || 'Input'),
        },
        id: value.id,
        position,
        type: 'input',
      };
    }

    case 'mcp-tool': {
      return {
        data: {
          payload: String(value.data?.payload || '{}'),
          payloadBindings: parsePayloadBindings(value.data?.payloadBindings),
          serverId: typeof value.data?.serverId === 'string' ? value.data.serverId : undefined,
          title: String(value.data?.title || 'MCP Tool'),
          toolName: typeof value.data?.toolName === 'string' ? value.data.toolName : undefined,
        },
        id: value.id,
        position,
        type: 'mcp-tool',
      };
    }

    case 'transform': {
      return {
        data: {
          mode: value.data?.mode === 'template' ? 'template' : 'instruction',
          prompt: String(value.data?.prompt || ''),
          title: String(value.data?.title || 'Transform'),
        },
        id: value.id,
        position,
        type: 'transform',
      };
    }

    case 'resource': {
      return {
        data: {
          content: String(value.data?.content || ''),
          resourcePath:
            typeof value.data?.resourcePath === 'string' ? value.data.resourcePath : undefined,
          skillId: typeof value.data?.skillId === 'string' ? value.data.skillId : undefined,
          skillName: typeof value.data?.skillName === 'string' ? value.data.skillName : undefined,
          title: String(value.data?.title || 'Resource'),
        },
        id: value.id,
        position,
        type: 'resource',
      };
    }

    case 'skill': {
      return {
        data: {
          content: String(value.data?.content || ''),
          skillId: typeof value.data?.skillId === 'string' ? value.data.skillId : undefined,
          skillName: typeof value.data?.skillName === 'string' ? value.data.skillName : undefined,
          title: String(value.data?.title || 'Skill'),
        },
        id: value.id,
        position,
        type: 'skill',
      };
    }

    case 'chat-output': {
      return {
        data: {
          title: String(value.data?.title || 'Chat'),
        },
        id: value.id,
        position,
        type: 'chat-output',
      };
    }

    default: {
      return undefined;
    }
  }
};

const parseWorkflowEdge = (value: unknown): StudioWorkflowEdge | undefined => {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.source !== 'string' ||
    typeof value.target !== 'string'
  ) {
    return undefined;
  }

  return {
    id: value.id,
    payloadBindings: parsePayloadBindings(value.payloadBindings),
    sourcePortId: typeof value.sourcePortId === 'string' ? value.sourcePortId : undefined,
    source: value.source,
    targetPortId: typeof value.targetPortId === 'string' ? value.targetPortId : undefined,
    target: value.target,
  };
};

const parseLoadedServer = (value: unknown): StudioLoadedServer | undefined => {
  if (!isRecord(value) || typeof value.id !== 'string' || !isRecord(value.connection)) {
    return undefined;
  }

  const connection =
    value.connection.type === 'stdio'
      ? {
          args: Array.isArray(value.connection.args)
            ? value.connection.args.filter((item): item is string => typeof item === 'string')
            : [],
          command: String(value.connection.command || ''),
          env: isRecord(value.connection.env)
            ? Object.fromEntries(
                Object.entries(value.connection.env).map(([key, itemValue]) => [
                  key,
                  String(itemValue),
                ]),
              )
            : undefined,
          identifier: String(value.connection.identifier || value.name || 'stdio-server'),
          type: 'stdio' as const,
        }
      : {
          authType:
            value.connection.authType === 'bearer' || value.connection.authType === 'oauth2'
              ? value.connection.authType
              : 'none',
          headers: isRecord(value.connection.headers)
            ? Object.fromEntries(
                Object.entries(value.connection.headers).map(([key, itemValue]) => [
                  key,
                  String(itemValue),
                ]),
              )
            : undefined,
          identifier: String(value.connection.identifier || value.name || 'http-server'),
          token: typeof value.connection.token === 'string' ? value.connection.token : undefined,
          type: 'http' as const,
          url: String(value.connection.url || ''),
        };

  return {
    connection,
    createdAt: Number(value.createdAt || 0),
    id: value.id,
    name: String(value.name || connection.identifier),
    origin:
      value.origin === 'installed' ? 'installed' : value.origin === 'custom' ? 'custom' : undefined,
    tools: Array.isArray(value.tools)
      ? value.tools.reduce<StudioSavedToolDefinition[]>((acc, tool) => {
          if (!isRecord(tool) || typeof tool.name !== 'string') return acc;

          acc.push({
            description: typeof tool.description === 'string' ? tool.description : undefined,
            name: tool.name,
            parameters: tool.parameters,
          });

          return acc;
        }, [])
      : [],
    updatedAt: Number(value.updatedAt || 0),
  };
};

export const createStudioPayloadBinding = (
  source: StudioPayloadBindingSource = 'humanPrompt',
): StudioPayloadBinding => ({
  id: `binding_${nanoid(8)}`,
  source,
  targetPath: '',
});

export const createStudioNode = (
  type: StudioNodeType,
  position: StudioNodePosition,
): StudioCanvasNode => {
  const id = `${type}_${nanoid(8)}`;

  switch (type) {
    case 'input': {
      return {
        data: {
          humanPrompt: '',
          title: 'Input',
        },
        id,
        position,
        type,
      };
    }

    case 'mcp-tool': {
      return {
        data: {
          payload: '{}',
          payloadBindings: [],
          title: 'MCP Tool',
        },
        id,
        position,
        type,
      };
    }

    case 'transform': {
      return {
        data: {
          mode: 'instruction',
          prompt: 'Summarize the upstream result for chat.',
          title: 'Transform',
        },
        id,
        position,
        type,
      };
    }

    case 'resource': {
      return {
        data: {
          content: '',
          title: 'Resource',
        },
        id,
        position,
        type,
      };
    }

    case 'skill': {
      return {
        data: {
          content: '',
          title: 'Skill',
        },
        id,
        position,
        type,
      };
    }

    case 'chat-output': {
      return {
        data: {
          title: 'Chat',
        },
        id,
        position,
        type,
      };
    }
  }
};

export const createDefaultStudioDraft = (): StudioDraft => {
  const input = createStudioNode('input', { x: 48, y: 160 });
  const tool = createStudioNode('mcp-tool', { x: 360, y: 88 });
  const transform = createStudioNode('transform', { x: 700, y: 160 });
  const chat = createStudioNode('chat-output', { x: 1040, y: 96 });

  return {
    edges: [
      {
        id: `edge_${nanoid(6)}`,
        source: input.id,
        sourcePortId: 'prompt',
        target: tool.id,
        targetPortId: 'primary',
      },
      {
        id: `edge_${nanoid(6)}`,
        source: tool.id,
        sourcePortId: 'result',
        target: transform.id,
        targetPortId: 'primary',
      },
      {
        id: `edge_${nanoid(6)}`,
        source: transform.id,
        sourcePortId: 'result',
        target: chat.id,
        targetPortId: 'message',
      },
    ],
    nodes: [input, tool, transform, chat],
    previewNodeId: chat.id,
    selectedNodeId: tool.id,
    servers: [],
  };
};

export const buildStudioDraft = (params: StudioDraft): StudioDraft => ({
  edges: params.edges.map((edge) => ({
    ...edge,
    payloadBindings: parsePayloadBindings(edge.payloadBindings),
    sourcePortId: edge.sourcePortId,
    targetPortId: edge.targetPortId,
  })),
  nodes: params.nodes.map((node) =>
    node.type === 'mcp-tool'
      ? {
          ...node,
          data: {
            ...node.data,
            payload: sanitizeJsonString(node.data.payload),
            payloadBindings: parsePayloadBindings(node.data.payloadBindings),
          },
        }
      : node.type === 'resource'
        ? {
            ...node,
            data: {
              ...node.data,
              content: String(node.data.content || ''),
            },
          }
        : node.type === 'skill'
          ? {
              ...node,
              data: {
                ...node.data,
                content: String(node.data.content || ''),
              },
            }
          : node,
  ),
  previewNodeId: params.previewNodeId,
  selectedNodeId: params.selectedNodeId,
  servers: params.servers.map((server) => ({
    ...server,
    connection: sanitizeConnection(server.connection),
  })),
});

export const mergeStudioServers = (
  base: StudioLoadedServer[],
  incoming: StudioLoadedServer[],
): StudioLoadedServer[] => {
  const merged = new Map(base.map((server) => [server.id, server]));

  for (const server of incoming) {
    merged.set(server.id, {
      ...merged.get(server.id),
      ...server,
    });
  }

  return [...merged.values()].sort((left, right) => left.name.localeCompare(right.name));
};

export const parseStudioDraft = (value: string | null | undefined): StudioDraft | undefined => {
  const parsed = value == null ? undefined : safeParseJSON(value);

  if (!isRecord(parsed)) return undefined;

  const nodes = Array.isArray(parsed.nodes)
    ? parsed.nodes
        .map((item, index) => parseCanvasNode(item, index))
        .filter((item): item is StudioCanvasNode => Boolean(item))
    : [];

  if (nodes.length === 0) return undefined;

  return {
    edges: Array.isArray(parsed.edges)
      ? parsed.edges
          .map(parseWorkflowEdge)
          .filter((item): item is StudioWorkflowEdge => Boolean(item))
      : [],
    nodes,
    previewNodeId:
      typeof parsed.previewNodeId === 'string' && parsed.previewNodeId
        ? parsed.previewNodeId
        : nodes.find((node) => node.type === 'chat-output')?.id,
    selectedNodeId:
      typeof parsed.selectedNodeId === 'string' ? parsed.selectedNodeId : nodes[0]?.id,
    servers: Array.isArray(parsed.servers)
      ? parsed.servers
          .map(parseLoadedServer)
          .filter((item): item is StudioLoadedServer => Boolean(item))
      : [],
  };
};

export const parseStudioWorkflowLibrary = (
  value: string | null | undefined,
): StudioSavedWorkflow[] => {
  const parsed = value == null ? undefined : safeParseJSON(value);

  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((item) => {
      if (!isRecord(item) || typeof item.id !== 'string' || typeof item.name !== 'string') {
        return undefined;
      }

      const draft = parseStudioDraft(JSON.stringify(item.draft));
      if (!draft) return undefined;

      return {
        createdAt: Number(item.createdAt || 0),
        draft,
        id: item.id,
        name: item.name,
        updatedAt: Number(item.updatedAt || 0),
      } satisfies StudioSavedWorkflow;
    })
    .filter((item): item is StudioSavedWorkflow => Boolean(item))
    .sort((left, right) => right.updatedAt - left.updatedAt);
};

export const upsertStudioWorkflowLibrary = (params: {
  draft: StudioDraft;
  id?: string;
  library: StudioSavedWorkflow[];
  name: string;
  now?: number;
}) => {
  const now = params.now ?? Date.now();
  const sanitizedDraft = buildStudioDraft(params.draft);
  const name = params.name.trim();
  const existing = params.id ? params.library.find((item) => item.id === params.id) : undefined;
  const entry: StudioSavedWorkflow = existing
    ? {
        ...existing,
        draft: sanitizedDraft,
        name,
        updatedAt: now,
      }
    : {
        createdAt: now,
        draft: sanitizedDraft,
        id: params.id || `wf_${nanoid(10)}`,
        name,
        updatedAt: now,
      };

  const library = [...params.library.filter((item) => item.id !== entry.id), entry].sort(
    (left, right) => right.updatedAt - left.updatedAt,
  );

  return { entry, library };
};

export const removeStudioWorkflowFromLibrary = (params: {
  id: string;
  library: StudioSavedWorkflow[];
}) => params.library.filter((item) => item.id !== params.id);

const getNodeSizeSeed = (node: StudioCanvasNode) => {
  switch (node.type) {
    case 'input': {
      return node.data.humanPrompt;
    }
    case 'mcp-tool': {
      return `${node.data.toolName || ''} ${node.data.payload} ${node.data.payloadBindings.map((item) => item.targetPath).join(' ')}`;
    }
    case 'resource': {
      return `${node.data.skillName || ''} ${node.data.resourcePath || ''} ${node.data.content}`;
    }
    case 'skill': {
      return `${node.data.skillName || ''} ${node.data.content}`;
    }
    case 'transform': {
      return node.data.prompt;
    }
    case 'chat-output': {
      return node.data.title;
    }
  }
};

export const estimateNodeSize = (node: StudioCanvasNode) => {
  const seed = getNodeSizeSeed(node);
  const lines = Math.max(1, Math.ceil(seed.trim().length / 26));
  const height = Math.min(132 + lines * 20, 280);
  const width = Math.min(Math.max(220, 220 + Math.min(seed.trim().length, 80) * 1.15), 360);

  return { height, width };
};

export const clampNodePositions = (
  nodes: StudioCanvasNode[],
  bounds: StudioCanvasBounds,
): StudioCanvasNode[] =>
  nodes.map((node) => {
    const size = estimateNodeSize(node);
    const maxX = Math.max(bounds.width - size.width - STUDIO_CANVAS_PADDING, 0);
    const maxY = Math.max(bounds.height - size.height - STUDIO_CANVAS_PADDING, 0);

    return {
      ...node,
      position: {
        x: Math.min(Math.max(Number.isFinite(node.position.x) ? node.position.x : 0, 0), maxX),
        y: Math.min(Math.max(Number.isFinite(node.position.y) ? node.position.y : 0, 0), maxY),
      },
    };
  });

export const buildConnectorPath = (params: {
  sourcePortId?: string;
  source: StudioCanvasNode;
  targetPortId?: string;
  target: StudioCanvasNode;
}) => {
  return buildConnectorPathFromPoints({
    end: getNodeInputAnchor(params.target, params.targetPortId),
    start: getNodeOutputAnchor(params.source, params.sourcePortId),
  });
};

export const getNodePorts = (node: StudioCanvasNode): StudioNodePort[] => {
  switch (node.type) {
    case 'input': {
      return [{ id: 'prompt', kind: 'output' }];
    }
    case 'resource': {
      return [{ id: 'content', kind: 'output' }];
    }
    case 'skill': {
      return [{ id: 'content', kind: 'output' }];
    }
    case 'mcp-tool': {
      return [
        { id: 'primary', kind: 'input' },
        { id: 'context', kind: 'input' },
        { id: 'config', kind: 'input' },
        { id: 'result', kind: 'output' },
      ];
    }
    case 'transform': {
      return [
        { id: 'primary', kind: 'input' },
        { id: 'context', kind: 'input' },
        { id: 'result', kind: 'output' },
      ];
    }
    case 'chat-output': {
      return [
        { id: 'message', kind: 'input' },
        { id: 'context', kind: 'input' },
      ];
    }
  }
};

export const getNodeInputPorts = (node: StudioCanvasNode) =>
  getNodePorts(node).filter((port) => port.kind === 'input');

export const getNodeOutputPorts = (node: StudioCanvasNode) =>
  getNodePorts(node).filter((port) => port.kind === 'output');

const getPortYOffset = (count: number, index: number, height: number) => {
  if (count <= 1) return height / 2;

  const top = 58;
  const bottom = height - 34;
  const span = Math.max(bottom - top, 24);

  return top + (span * index) / (count - 1);
};

export const getNodeInputAnchor = (node: StudioCanvasNode, portId?: string): StudioNodePosition => {
  const size = estimateNodeSize(node);
  const ports = getNodeInputPorts(node);
  const index = Math.max(
    0,
    ports.findIndex((port) => port.id === portId),
  );

  return {
    x: node.position.x,
    y: node.position.y + getPortYOffset(ports.length, index, size.height),
  };
};

export const getNodeOutputAnchor = (
  node: StudioCanvasNode,
  portId?: string,
): StudioNodePosition => {
  const size = estimateNodeSize(node);
  const ports = getNodeOutputPorts(node);
  const index = Math.max(
    0,
    ports.findIndex((port) => port.id === portId),
  );

  return {
    x: node.position.x + size.width,
    y: node.position.y + getPortYOffset(ports.length, index, size.height),
  };
};

export const buildConnectorPathFromPoints = (params: {
  end: StudioNodePosition;
  start: StudioNodePosition;
}) => {
  const controlOffset = Math.max(Math.abs(params.end.x - params.start.x) * 0.45, 84);

  return `M ${params.start.x} ${params.start.y} C ${params.start.x + controlOffset} ${params.start.y}, ${params.end.x - controlOffset} ${params.end.y}, ${params.end.x} ${params.end.y}`;
};

export const buildDefaultToolArguments = (schema: unknown) => {
  if (!isRecord(schema)) return '{}';
  if ('example' in schema) return JSON.stringify(schema.example, null, 2);
  if ('default' in schema) return JSON.stringify(schema.default, null, 2);
  if (schema.type !== 'object' || !isRecord(schema.properties)) return '{}';

  const result = Object.fromEntries(
    Object.entries(schema.properties).map(([key, value]) => {
      if (!isRecord(value)) return [key, ''];
      if (value.type === 'boolean') return [key, false];
      if (value.type === 'number' || value.type === 'integer') return [key, 0];
      if (value.type === 'array') return [key, []];
      if (value.type === 'object') return [key, {}];

      return [key, ''];
    }),
  );

  return JSON.stringify(result, null, 2);
};

export const insertBindingToken = (params: {
  selectionEnd?: number | null;
  selectionStart?: number | null;
  token: string;
  value: string;
}) => {
  const { selectionEnd, selectionStart, token, value } = params;
  const start = Math.max(0, Math.min(selectionStart ?? value.length, value.length));
  const end = Math.max(start, Math.min(selectionEnd ?? start, value.length));
  const nextValue = `${value.slice(0, start)}${token}${value.slice(end)}`;
  const nextSelection = start + token.length;

  return {
    nextSelection,
    nextValue,
  };
};

export const canConnectNodes = (sourceType: StudioNodeType, targetType: StudioNodeType) => {
  if (sourceType === targetType && sourceType === 'chat-output') return false;
  if (targetType === 'input') return false;
  if (sourceType === 'chat-output') return false;

  switch (targetType) {
    case 'mcp-tool': {
      return (
        sourceType === 'input' ||
        sourceType === 'mcp-tool' ||
        sourceType === 'resource' ||
        sourceType === 'skill' ||
        sourceType === 'transform'
      );
    }
    case 'transform': {
      return (
        sourceType === 'input' ||
        sourceType === 'mcp-tool' ||
        sourceType === 'resource' ||
        sourceType === 'skill' ||
        sourceType === 'transform'
      );
    }
    case 'chat-output': {
      return (
        sourceType === 'input' ||
        sourceType === 'mcp-tool' ||
        sourceType === 'resource' ||
        sourceType === 'skill' ||
        sourceType === 'transform'
      );
    }
    default: {
      return false;
    }
  }
};

export const autoLayoutStudioNodes = (nodes: StudioCanvasNode[]): StudioCanvasNode[] => {
  const groups: Record<StudioNodeType, StudioCanvasNode[]> = {
    'chat-output': [],
    'input': [],
    'mcp-tool': [],
    'resource': [],
    'skill': [],
    'transform': [],
  };

  for (const node of nodes) groups[node.type].push(node);

  const columns: StudioNodeType[] = [
    'input',
    'resource',
    'skill',
    'mcp-tool',
    'transform',
    'chat-output',
  ];

  return columns.flatMap((type, columnIndex) =>
    groups[type].map((node, rowIndex) => ({
      ...node,
      position: {
        x: 56 + columnIndex * 320,
        y: 72 + rowIndex * 220 + (columnIndex % 2 === 0 ? 40 : 0),
      },
    })),
  );
};

const parseToolPayload = (value: string) => {
  const parsed = safeParseJSON(value);

  if (parsed === undefined || parsed === null) return {};
  if (typeof parsed === 'object') return parsed;

  return {};
};

const toWorkflowNode = (
  node: StudioCanvasNode,
  serverMap: Map<string, StudioLoadedServer>,
): StudioWorkflowNode => {
  switch (node.type) {
    case 'input': {
      return {
        data: {
          humanPrompt: node.data.humanPrompt,
          title: node.data.title,
        },
        id: node.id,
        type: 'input',
      };
    }
    case 'mcp-tool': {
      return {
        data: {
          connection: node.data.serverId
            ? serverMap.get(node.data.serverId)?.connection
            : undefined,
          payload: parseToolPayload(node.data.payload),
          payloadBindings: parsePayloadBindings(node.data.payloadBindings),
          title: node.data.title,
          toolName: node.data.toolName,
        },
        id: node.id,
        type: 'mcp-tool',
      };
    }
    case 'resource': {
      return {
        data: {
          content: node.data.content,
          resourcePath: node.data.resourcePath,
          skillId: node.data.skillId,
          skillName: node.data.skillName,
          title: node.data.title,
        },
        id: node.id,
        type: 'resource',
      };
    }
    case 'skill': {
      return {
        data: {
          content: node.data.content,
          skillId: node.data.skillId,
          skillName: node.data.skillName,
          title: node.data.title,
        },
        id: node.id,
        type: 'skill',
      };
    }
    case 'transform': {
      return {
        data: {
          mode: node.data.mode,
          prompt: node.data.prompt,
          title: node.data.title,
        },
        id: node.id,
        type: 'transform',
      };
    }
    case 'chat-output': {
      return {
        data: {
          target: 'chat',
          title: node.data.title,
        },
        id: node.id,
        type: 'chat-output',
      };
    }
  }
};

export const buildWorkflowDsl = (params: { draft: StudioDraft; previewNodeId?: string }) => {
  const sanitizedDraft = buildStudioDraft(params.draft);
  const serverMap = new Map(sanitizedDraft.servers.map((server) => [server.id, server]));
  const previewNodeId =
    params.previewNodeId ||
    sanitizedDraft.previewNodeId ||
    sanitizedDraft.nodes.find((node) => node.type === 'chat-output')?.id ||
    sanitizedDraft.nodes[0]?.id;

  return JSON.stringify(
    buildStudioWorkflowDefinition({
      edges: sanitizedDraft.edges,
      nodes: sanitizedDraft.nodes.map((node) => toWorkflowNode(node, serverMap)),
      previewNodeId,
    }) satisfies StudioWorkflowDSL,
    null,
    2,
  );
};

export const buildWorkflowDefinition = (params: { draft: StudioDraft; previewNodeId?: string }) => {
  const serverMap = new Map(params.draft.servers.map((server) => [server.id, server]));
  const previewNodeId =
    params.previewNodeId ||
    params.draft.previewNodeId ||
    params.draft.nodes.find((node) => node.type === 'chat-output')?.id ||
    params.draft.nodes[0]?.id;

  return buildStudioWorkflowDefinition({
    edges: params.draft.edges.map((edge) => ({
      ...edge,
      payloadBindings: parsePayloadBindings(edge.payloadBindings),
    })),
    nodes: params.draft.nodes.map((node) => toWorkflowNode(node, serverMap)),
    previewNodeId,
  });
};

export const buildChatPreview = buildStudioChatPreview;
export type { StudioConnectionConfig };

export const flattenStudioSkillResources = (
  tree: SkillResourceTreeNode[],
): Array<{ label: string; value: string }> => {
  const files: Array<{ label: string; value: string }> = [];

  const walk = (nodes: SkillResourceTreeNode[]) => {
    for (const node of nodes) {
      if (node.type === 'file') {
        files.push({
          label: node.path,
          value: node.path,
        });
        continue;
      }

      if (node.children) walk(node.children);
    }
  };

  walk(tree);

  return files.sort((left, right) => left.label.localeCompare(right.label));
};
