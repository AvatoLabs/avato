import { type SkillResourceTreeNode } from '@lobechat/types';
import { safeParseJSON } from '@lobechat/utils';

import {
  buildStudioChatPreview,
  buildStudioWorkflowDefinition,
  canConnectStudioNodes,
  canConnectStudioPorts,
  canStudioTargetPortAcceptEdge,
  getStudioDefaultNodeTitle,
  getStudioDefaultTransformPrompt,
  getStudioNodePorts,
  inferStudioResourceKind,
  resolveStudioEdgeChannel,
  resolveStudioSourcePortId as resolveStudioWorkflowSourcePortId,
  resolveStudioTargetPortId as resolveStudioWorkflowTargetPortId,
  type StudioConnectionConfig,
  type StudioNodePortDefinition,
  type StudioNodeType,
  type StudioPayloadBinding,
  type StudioPayloadBindingSource,
  type StudioResourceKind,
  type StudioResourceSource,
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
    breakpoint?: boolean;
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

export interface StudioCanvasAgentNode {
  data: {
    agentId?: string;
    agentName?: string;
    breakpoint?: boolean;
    inputTemplate?: string;
    memoryEnabled?: boolean;
    model?: string;
    params?: string;
    prompt: string;
    provider?: string;
    systemRole?: string;
    title: string;
  };
  id: string;
  position: StudioNodePosition;
  type: 'agent';
}

export interface StudioCanvasTransformNode {
  data: {
    breakpoint?: boolean;
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
    kind: StudioResourceKind;
    mimeType?: string;
    resourcePath?: string;
    skillId?: string;
    skillName?: string;
    sizeBytes?: number;
    sourceLabel?: string;
    sourceType: StudioResourceSource;
    sourceUri?: string;
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
  | StudioCanvasAgentNode
  | StudioCanvasChatNode
  | StudioCanvasInputNode
  | StudioCanvasToolNode
  | StudioCanvasResourceNode
  | StudioCanvasSkillNode
  | StudioCanvasTransformNode;

const getStudioResourceAutoTitle = (data: StudioCanvasResourceNode['data']) => {
  if (data.sourceType === 'skill-resource') {
    return data.resourcePath || data.sourceUri || data.sourceLabel || data.skillName;
  }

  return data.sourceLabel || data.sourceUri || data.skillName;
};

export const getStudioAutoNodeTitle = (
  node: StudioCanvasNode,
  options?: {
    serverName?: string;
  },
) => {
  switch (node.type) {
    case 'agent': {
      return node.data.agentName || getStudioDefaultNodeTitle('agent');
    }
    case 'mcp-tool': {
      return node.data.toolName || options?.serverName || getStudioDefaultNodeTitle('mcp-tool');
    }
    case 'resource': {
      return getStudioResourceAutoTitle(node.data) || getStudioDefaultNodeTitle('resource');
    }
    case 'skill': {
      return node.data.skillName || getStudioDefaultNodeTitle('skill');
    }
    default: {
      return getStudioDefaultNodeTitle(node.type);
    }
  }
};

export const shouldStudioSyncNodeTitle = (params: {
  currentTitle?: string;
  nextAutoTitle?: string;
  nodeType: StudioCanvasNode['type'];
  previousAutoTitle?: string;
}) => {
  const currentTitle = params.currentTitle?.trim();
  if (!currentTitle) return true;

  const autoTitles = new Set(
    [getStudioDefaultNodeTitle(params.nodeType), params.previousAutoTitle, params.nextAutoTitle]
      .filter((value): value is string => Boolean(value?.trim()))
      .map((value) => value.trim()),
  );

  return autoTitles.has(currentTitle);
};

export interface StudioLoadedServer {
  avatar?: string;
  connection: StudioConnectionConfig;
  createdAt: number;
  description?: string;
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

export type StudioNodePort = StudioNodePortDefinition;

const SENSITIVE_KEY = /authorization|secret|token|key|password/i;
export const STUDIO_STORAGE_KEY = 'lobehub-mcp-workflow-studio-draft';
export const STUDIO_LIBRARY_STORAGE_KEY = 'lobehub-mcp-workflow-studio-library';
export const STUDIO_CANVAS_PADDING = 24;
export const STUDIO_DEFAULT_CANVAS_BOUNDS = { height: 640, width: 1360 } as const;

const STUDIO_AUTO_LAYOUT_BASE_X = 72;
const STUDIO_AUTO_LAYOUT_BASE_Y = 88;
const STUDIO_AUTO_LAYOUT_COLUMN_GAP = 320;
const STUDIO_AUTO_LAYOUT_ROW_GAP = 52;
const STUDIO_CONNECTION_INPUT_RAIL_X = 88;
const STUDIO_CONNECTION_INPUT_RAIL_Y = 26;
const STUDIO_CONNECTION_SNAP_RADIUS = 104;
const STUDIO_CONNECTION_FALLBACK_RADIUS = 156;

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
          title: String(value.data?.title || getStudioDefaultNodeTitle('input')),
        },
        id: value.id,
        position,
        type: 'input',
      };
    }

    case 'agent': {
      return {
        data: {
          agentId: typeof value.data?.agentId === 'string' ? value.data.agentId : undefined,
          agentName: typeof value.data?.agentName === 'string' ? value.data.agentName : undefined,
          breakpoint: value.data?.breakpoint === true,
          inputTemplate:
            typeof value.data?.inputTemplate === 'string' ? value.data.inputTemplate : undefined,
          memoryEnabled:
            typeof value.data?.memoryEnabled === 'boolean' ? value.data.memoryEnabled : undefined,
          model: typeof value.data?.model === 'string' ? value.data.model : undefined,
          params:
            typeof value.data?.params === 'string'
              ? sanitizeJsonString(value.data.params)
              : isRecord(value.data?.params)
                ? JSON.stringify(value.data.params, null, 2)
                : undefined,
          prompt: String(value.data?.prompt || ''),
          provider: typeof value.data?.provider === 'string' ? value.data.provider : undefined,
          systemRole:
            typeof value.data?.systemRole === 'string' ? value.data.systemRole : undefined,
          title: String(value.data?.title || getStudioDefaultNodeTitle('agent')),
        },
        id: value.id,
        position,
        type: 'agent',
      };
    }

    case 'mcp-tool': {
      return {
        data: {
          breakpoint: value.data?.breakpoint === true,
          payload: String(value.data?.payload || '{}'),
          payloadBindings: parsePayloadBindings(value.data?.payloadBindings),
          serverId: typeof value.data?.serverId === 'string' ? value.data.serverId : undefined,
          title: String(value.data?.title || getStudioDefaultNodeTitle('mcp-tool')),
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
          breakpoint: value.data?.breakpoint === true,
          mode: value.data?.mode === 'template' ? 'template' : 'instruction',
          prompt: String(value.data?.prompt || getStudioDefaultTransformPrompt()),
          title: String(value.data?.title || getStudioDefaultNodeTitle('transform')),
        },
        id: value.id,
        position,
        type: 'transform',
      };
    }

    case 'resource': {
      const sourceUri =
        typeof value.data?.sourceUri === 'string'
          ? value.data.sourceUri
          : typeof value.data?.resourcePath === 'string'
            ? value.data.resourcePath
            : undefined;
      return {
        data: {
          content: String(value.data?.content || ''),
          kind: inferStudioResourceKind({
            content: typeof value.data?.content === 'string' ? value.data.content : undefined,
            mimeType: typeof value.data?.mimeType === 'string' ? value.data.mimeType : undefined,
            sourceUri,
          }),
          mimeType: typeof value.data?.mimeType === 'string' ? value.data.mimeType : undefined,
          resourcePath:
            typeof value.data?.resourcePath === 'string' ? value.data.resourcePath : undefined,
          skillId: typeof value.data?.skillId === 'string' ? value.data.skillId : undefined,
          skillName: typeof value.data?.skillName === 'string' ? value.data.skillName : undefined,
          sizeBytes: typeof value.data?.sizeBytes === 'number' ? value.data.sizeBytes : undefined,
          sourceLabel:
            typeof value.data?.sourceLabel === 'string'
              ? value.data.sourceLabel
              : typeof value.data?.skillName === 'string'
                ? value.data.skillName
                : undefined,
          sourceType:
            value.data?.sourceType === 'skill-resource' || value.data?.skillId
              ? 'skill-resource'
              : value.data?.sourceType === 'upload'
                ? 'upload'
                : 'manual',
          sourceUri,
          title: String(value.data?.title || getStudioDefaultNodeTitle('resource')),
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
          title: String(value.data?.title || getStudioDefaultNodeTitle('skill')),
        },
        id: value.id,
        position,
        type: 'skill',
      };
    }

    case 'chat-output': {
      return {
        data: {
          title: String(value.data?.title || getStudioDefaultNodeTitle('chat-output')),
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
    channel:
      value.channel === 'context' || value.channel === 'handoff' || value.channel === 'main'
        ? value.channel
        : undefined,
    id: value.id,
    payloadBindings: parsePayloadBindings(value.payloadBindings),
    sourcePortId: typeof value.sourcePortId === 'string' ? value.sourcePortId : undefined,
    source: value.source,
    targetPortId: typeof value.targetPortId === 'string' ? value.targetPortId : undefined,
    target: value.target,
  };
};

function normalizeDraftEdges(
  edges: StudioWorkflowEdge[],
  nodes: StudioCanvasNode[],
): StudioWorkflowEdge[] {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));

  return edges.reduce<StudioWorkflowEdge[]>((acc, edge) => {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);

    if (!sourceNode || !targetNode) return acc;

    acc.push({
      channel: resolveStudioEdgeChannel({
        channel: edge.channel,
        sourcePortId: edge.sourcePortId,
        sourceType: sourceNode.type,
        targetPortId: edge.targetPortId,
        targetType: targetNode.type,
      }),
      payloadBindings: parsePayloadBindings(edge.payloadBindings),
      id: edge.id,
      source: edge.source,
      target: edge.target,
    });

    return acc;
  }, []);
}

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
    avatar: typeof value.avatar === 'string' ? value.avatar : undefined,
    connection,
    createdAt: Number(value.createdAt || 0),
    description: typeof value.description === 'string' ? value.description : undefined,
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
          title: getStudioDefaultNodeTitle('input'),
        },
        id,
        position,
        type,
      };
    }

    case 'agent': {
      return {
        data: {
          breakpoint: false,
          memoryEnabled: false,
          params: '{}',
          prompt: '{{upstreamResult}}{{humanPrompt}}',
          title: getStudioDefaultNodeTitle('agent'),
        },
        id,
        position,
        type,
      };
    }

    case 'mcp-tool': {
      return {
        data: {
          breakpoint: false,
          payload: '{}',
          payloadBindings: [],
          title: getStudioDefaultNodeTitle('mcp-tool'),
        },
        id,
        position,
        type,
      };
    }

    case 'transform': {
      return {
        data: {
          breakpoint: false,
          mode: 'instruction',
          prompt: getStudioDefaultTransformPrompt(),
          title: getStudioDefaultNodeTitle('transform'),
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
          kind: 'text',
          sourceType: 'manual',
          title: getStudioDefaultNodeTitle('resource'),
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
          title: getStudioDefaultNodeTitle('skill'),
        },
        id,
        position,
        type,
      };
    }

    case 'chat-output': {
      return {
        data: {
          title: getStudioDefaultNodeTitle('chat-output'),
        },
        id,
        position,
        type,
      };
    }
  }
};

export const createDefaultStudioDraft = (): StudioDraft => {
  const input = createStudioNode('input', {
    x: STUDIO_AUTO_LAYOUT_BASE_X,
    y: STUDIO_AUTO_LAYOUT_BASE_Y,
  });
  const tool = createStudioNode('mcp-tool', {
    x: STUDIO_AUTO_LAYOUT_BASE_X,
    y: STUDIO_AUTO_LAYOUT_BASE_Y,
  });
  const transform = createStudioNode('transform', {
    x: STUDIO_AUTO_LAYOUT_BASE_X,
    y: STUDIO_AUTO_LAYOUT_BASE_Y,
  });
  const chat = createStudioNode('chat-output', {
    x: STUDIO_AUTO_LAYOUT_BASE_X,
    y: STUDIO_AUTO_LAYOUT_BASE_Y,
  });
  const edges: StudioWorkflowEdge[] = [
    {
      channel: 'main',
      id: `edge_${nanoid(6)}`,
      source: input.id,
      target: tool.id,
    },
    {
      channel: 'main',
      id: `edge_${nanoid(6)}`,
      source: tool.id,
      target: transform.id,
    },
    {
      channel: 'main',
      id: `edge_${nanoid(6)}`,
      source: transform.id,
      target: chat.id,
    },
  ];

  return {
    edges,
    nodes: autoLayoutStudioNodes([input, tool, transform, chat], edges),
    previewNodeId: chat.id,
    selectedNodeId: tool.id,
    servers: [],
  };
};

export const buildStudioDraft = (params: StudioDraft): StudioDraft => ({
  edges: normalizeDraftEdges(
    params.edges,
    params.nodes.map((node) =>
      node.type === 'agent'
        ? {
            ...node,
            data: {
              ...node.data,
              breakpoint: node.data.breakpoint === true,
              params: sanitizeJsonString(node.data.params || '{}'),
              prompt: String(node.data.prompt || ''),
            },
          }
        : node.type === 'mcp-tool'
          ? {
              ...node,
              data: {
                ...node.data,
                breakpoint: node.data.breakpoint === true,
                payload: sanitizeJsonString(node.data.payload),
                payloadBindings: parsePayloadBindings(node.data.payloadBindings),
              },
            }
          : node.type === 'transform'
            ? {
                ...node,
                data: {
                  ...node.data,
                  breakpoint: node.data.breakpoint === true,
                },
              }
            : node.type === 'resource'
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    content: String(node.data.content || ''),
                    kind: inferStudioResourceKind({
                      content: String(node.data.content || ''),
                      mimeType: node.data.mimeType,
                      sourceUri: node.data.sourceUri || node.data.resourcePath,
                    }),
                    sourceType:
                      node.data.sourceType || (node.data.skillId ? 'skill-resource' : 'manual'),
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
  ),
  nodes: params.nodes.map((node) =>
    node.type === 'agent'
      ? {
          ...node,
          data: {
            ...node.data,
            breakpoint: node.data.breakpoint === true,
            params: sanitizeJsonString(node.data.params || '{}'),
            prompt: String(node.data.prompt || ''),
          },
        }
      : node.type === 'mcp-tool'
        ? {
            ...node,
            data: {
              ...node.data,
              breakpoint: node.data.breakpoint === true,
              payload: sanitizeJsonString(node.data.payload),
              payloadBindings: parsePayloadBindings(node.data.payloadBindings),
            },
          }
        : node.type === 'transform'
          ? {
              ...node,
              data: {
                ...node.data,
                breakpoint: node.data.breakpoint === true,
              },
            }
          : node.type === 'resource'
            ? {
                ...node,
                data: {
                  ...node.data,
                  content: String(node.data.content || ''),
                  kind: inferStudioResourceKind({
                    content: String(node.data.content || ''),
                    mimeType: node.data.mimeType,
                    sourceUri: node.data.sourceUri || node.data.resourcePath,
                  }),
                  sourceType:
                    node.data.sourceType || (node.data.skillId ? 'skill-resource' : 'manual'),
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
    avatar: server.avatar,
    connection: sanitizeConnection(server.connection),
    description: server.description,
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
    edges: normalizeDraftEdges(
      Array.isArray(parsed.edges)
        ? parsed.edges
            .map(parseWorkflowEdge)
            .filter((item): item is StudioWorkflowEdge => Boolean(item))
        : [],
      nodes,
    ),
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
    case 'agent': {
      return `${node.data.agentName || ''} ${node.data.prompt}`;
    }
    case 'mcp-tool': {
      return `${node.data.toolName || ''} ${node.data.payload} ${node.data.payloadBindings.map((item) => item.targetPath).join(' ')}`;
    }
    case 'resource': {
      return `${node.data.sourceLabel || node.data.skillName || ''} ${node.data.sourceUri || node.data.resourcePath || ''} ${node.data.mimeType || ''} ${node.data.content}`;
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
  const width = Math.min(Math.max(260, 260 + Math.min(seed.trim().length, 80) * 1.05), 400);

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
  channel?: StudioWorkflowEdge['channel'];
  sourcePortId?: string;
  source: StudioCanvasNode;
  targetPortId?: string;
  target: StudioCanvasNode;
}) => {
  return buildConnectorPathFromPoints({
    end: getNodeInputAnchor(
      params.target,
      resolveStudioInputPortId(params.target, params.targetPortId, params.channel),
    ),
    start: getNodeOutputAnchor(
      params.source,
      resolveStudioOutputPortId(params.source, params.sourcePortId, params.channel),
    ),
  });
};

export const getNodePorts = (node: StudioCanvasNode): StudioNodePort[] => {
  return getStudioNodePorts(node.type);
};

export const getNodeInputPorts = (node: StudioCanvasNode) =>
  getNodePorts(node).filter((port) => port.kind === 'input');

export const getNodeOutputPorts = (node: StudioCanvasNode) =>
  getNodePorts(node).filter((port) => port.kind === 'output');

export interface StudioConnectionStateBusy {
  kind: 'busy';
}

export interface StudioConnectionStateConnectable {
  kind: 'connectable';
}

export interface StudioConnectionStateDuplicate {
  edge: StudioWorkflowEdge;
  kind: 'duplicate';
}

export interface StudioConnectionStateInvalid {
  kind: 'invalid';
}

export type StudioConnectionState =
  | StudioConnectionStateBusy
  | StudioConnectionStateConnectable
  | StudioConnectionStateDuplicate
  | StudioConnectionStateInvalid;

export interface StudioConnectableInputPort {
  port: StudioNodePort;
  state: StudioConnectionStateConnectable | StudioConnectionStateDuplicate;
}

export const resolveStudioInputPortId = (
  node: StudioCanvasNode,
  portId?: string,
  channel?: StudioWorkflowEdge['channel'],
) =>
  resolveStudioWorkflowTargetPortId({
    channel,
    nodeType: node.type,
    portId,
  });

export const resolveStudioOutputPortId = (
  node: StudioCanvasNode,
  portId?: string,
  channel?: StudioWorkflowEdge['channel'],
) =>
  resolveStudioWorkflowSourcePortId({
    channel,
    nodeType: node.type,
    portId,
  });

export const shouldStudioReplaceTargetPortEdges = (
  targetNode: StudioCanvasNode,
  targetPortId?: string,
) =>
  (
    getNodeInputPorts(targetNode).find(
      (port) => port.id === resolveStudioInputPortId(targetNode, targetPortId),
    ) || getNodeInputPorts(targetNode)[0]
  )?.maxConnections === 1;

export const findExistingStudioEdge = (params: {
  edges: StudioWorkflowEdge[];
  sourceId: string;
  sourceNode: StudioCanvasNode;
  sourcePortId: string;
  targetId: string;
  targetNode: StudioCanvasNode;
  targetPortId: string;
}) =>
  params.edges.find(
    (edge) =>
      edge.source === params.sourceId &&
      resolveStudioOutputPortId(params.sourceNode, edge.sourcePortId, edge.channel) ===
        params.sourcePortId &&
      edge.target === params.targetId &&
      resolveStudioInputPortId(params.targetNode, edge.targetPortId, edge.channel) ===
        params.targetPortId,
  );

const getIncomingStudioPortEdgeCount = (
  edges: StudioWorkflowEdge[],
  targetNode: StudioCanvasNode,
  targetPortId: string,
) =>
  edges.filter(
    (edge) =>
      edge.target === targetNode.id &&
      resolveStudioInputPortId(targetNode, edge.targetPortId, edge.channel) === targetPortId,
  ).length;

export const getStudioConnectionState = (params: {
  edges: StudioWorkflowEdge[];
  sourceNode: StudioCanvasNode;
  sourcePortId: string;
  targetNode: StudioCanvasNode;
  targetPortId: string;
}): StudioConnectionState => {
  const sourcePortId = resolveStudioOutputPortId(params.sourceNode, params.sourcePortId);
  const targetPortId = resolveStudioInputPortId(params.targetNode, params.targetPortId);
  const { edges, sourceNode, targetNode } = params;
  if (!sourcePortId || !targetPortId) return { kind: 'invalid' };

  if (
    !canConnectStudioPorts({
      sourceId: sourceNode.id,
      sourcePortId,
      sourceType: sourceNode.type,
      targetId: targetNode.id,
      targetPortId,
      targetType: targetNode.type,
    })
  ) {
    return { kind: 'invalid' };
  }

  const existingEdge = findExistingStudioEdge({
    edges,
    sourceId: sourceNode.id,
    sourceNode,
    sourcePortId,
    targetId: targetNode.id,
    targetNode,
    targetPortId,
  });
  if (existingEdge) return { edge: existingEdge, kind: 'duplicate' };

  if (
    !canStudioTargetPortAcceptEdge({
      currentCount: getIncomingStudioPortEdgeCount(edges, targetNode, targetPortId),
      targetPortId,
      targetType: targetNode.type,
    })
  ) {
    return { kind: 'busy' };
  }

  return { kind: 'connectable' };
};

export const getStudioConnectableInputPorts = (params: {
  edges: StudioWorkflowEdge[];
  sourceNode: StudioCanvasNode;
  sourcePortId: string;
  targetNode: StudioCanvasNode;
}): StudioConnectableInputPort[] =>
  getNodeInputPorts(params.targetNode).flatMap((port) => {
    const state = getStudioConnectionState({
      edges: params.edges,
      sourceNode: params.sourceNode,
      sourcePortId: params.sourcePortId,
      targetNode: params.targetNode,
      targetPortId: port.id,
    });

    if (state.kind === 'invalid' || state.kind === 'busy') return [];

    return [{ port, state }];
  });

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

const getNodeInputRailBounds = (node: StudioCanvasNode) => {
  const size = estimateNodeSize(node);

  return {
    bottom: node.position.y + size.height + STUDIO_CONNECTION_INPUT_RAIL_Y,
    left: node.position.x - STUDIO_CONNECTION_INPUT_RAIL_X,
    right: node.position.x + Math.min(size.width * 0.4, 132),
    top: node.position.y - STUDIO_CONNECTION_INPUT_RAIL_Y,
  };
};

const getDistanceToBounds = (
  point: StudioNodePosition,
  bounds: { bottom: number; left: number; right: number; top: number },
) => {
  const dx =
    point.x < bounds.left
      ? bounds.left - point.x
      : point.x > bounds.right
        ? point.x - bounds.right
        : 0;
  const dy =
    point.y < bounds.top
      ? bounds.top - point.y
      : point.y > bounds.bottom
        ? point.y - bounds.bottom
        : 0;

  return Math.hypot(dx, dy);
};

const isPointWithinBounds = (
  point: StudioNodePosition,
  bounds: { bottom: number; left: number; right: number; top: number },
) =>
  point.x >= bounds.left &&
  point.x <= bounds.right &&
  point.y >= bounds.top &&
  point.y <= bounds.bottom;

export const getPreferredStudioTargetPortId = (params: {
  point: StudioNodePosition;
  ports: StudioConnectableInputPort[];
  targetNode: StudioCanvasNode;
}) => {
  let bestMatch: { id: string; score: number } | undefined;

  for (const { port } of params.ports) {
    const anchor = getNodeInputAnchor(params.targetNode, port.id);
    const score =
      Math.abs(params.point.y - anchor.y) + Math.max(0, anchor.x - params.point.x) * 0.28;

    if (!bestMatch || score < bestMatch.score) {
      bestMatch = { id: port.id, score };
    }
  }

  return bestMatch?.id;
};

export const findStudioConnectionTarget = (params: {
  edges: StudioWorkflowEdge[];
  nodes: StudioCanvasNode[];
  point: StudioNodePosition;
  sourceId: string;
  sourcePortId: string;
}) => {
  const sourceNode = params.nodes.find((node) => node.id === params.sourceId);
  if (!sourceNode) return undefined;

  let bestMatch:
    | {
        score: number;
        targetId: string;
        targetPortId: string;
      }
    | undefined;

  for (const node of [...params.nodes].reverse()) {
    if (node.id === params.sourceId) continue;

    const connectablePorts = getStudioConnectableInputPorts({
      edges: params.edges,
      sourceNode,
      sourcePortId: params.sourcePortId,
      targetNode: node,
    });
    if (connectablePorts.length === 0) continue;

    const railBounds = getNodeInputRailBounds(node);
    const withinRail = isPointWithinBounds(params.point, railBounds);
    const railDistance = getDistanceToBounds(params.point, railBounds);
    const preferredPortId = getPreferredStudioTargetPortId({
      point: params.point,
      ports: connectablePorts,
      targetNode: node,
    });

    for (const { port } of connectablePorts) {
      const anchor = getNodeInputAnchor(node, port.id);
      const anchorDistance = Math.hypot(params.point.x - anchor.x, params.point.y - anchor.y);
      const canSnap =
        withinRail ||
        anchorDistance <= STUDIO_CONNECTION_SNAP_RADIUS ||
        railDistance <= STUDIO_CONNECTION_FALLBACK_RADIUS;

      if (!canSnap) continue;

      const score =
        (preferredPortId === port.id ? 0 : 18) +
        Math.abs(params.point.y - anchor.y) +
        Math.max(0, anchor.x - params.point.x) * 0.28 +
        railDistance * 0.46;

      if (!bestMatch || score < bestMatch.score) {
        bestMatch = {
          score,
          targetId: node.id,
          targetPortId: port.id,
        };
      }
    }
  }

  return bestMatch
    ? {
        targetId: bestMatch.targetId,
        targetPortId: bestMatch.targetPortId,
      }
    : undefined;
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
  return canConnectStudioNodes(sourceType, targetType);
};

const getNodeBaseLayer = (type: StudioNodeType) => {
  switch (type) {
    case 'input':
    case 'resource':
    case 'skill': {
      return 0;
    }
    case 'agent': {
      return 1;
    }
    case 'mcp-tool': {
      return 2;
    }
    case 'transform': {
      return 3;
    }
    case 'chat-output': {
      return 4;
    }
  }
};

const getNodeTypeOrder = (type: StudioNodeType) => {
  switch (type) {
    case 'input': {
      return 0;
    }
    case 'resource': {
      return 1;
    }
    case 'skill': {
      return 2;
    }
    case 'agent': {
      return 3;
    }
    case 'mcp-tool': {
      return 4;
    }
    case 'transform': {
      return 5;
    }
    case 'chat-output': {
      return 6;
    }
  }
};

const compareStudioLayoutNodes = (left: StudioCanvasNode, right: StudioCanvasNode) =>
  getNodeTypeOrder(left.type) - getNodeTypeOrder(right.type) ||
  left.position.y - right.position.y ||
  left.data.title.localeCompare(right.data.title);

const STUDIO_AUTO_LAYOUT_COMPONENT_GAP = 96;

const getStudioConnectedComponents = (
  nodes: StudioCanvasNode[],
  edges: StudioWorkflowEdge[],
): StudioCanvasNode[][] => {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const adjacency = new Map<string, Set<string>>(nodes.map((node) => [node.id, new Set<string>()]));

  for (const edge of edges) {
    if (!nodeMap.has(edge.source) || !nodeMap.has(edge.target) || edge.source === edge.target) {
      continue;
    }

    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  }

  const visited = new Set<string>();
  const components: StudioCanvasNode[][] = [];

  for (const node of [...nodes].sort(compareStudioLayoutNodes)) {
    if (visited.has(node.id)) continue;

    const queue = [node.id];
    const componentIds: string[] = [];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;

      visited.add(currentId);
      componentIds.push(currentId);

      for (const nextId of [...(adjacency.get(currentId) || [])].sort((leftId, rightId) =>
        compareStudioLayoutNodes(nodeMap.get(leftId)!, nodeMap.get(rightId)!),
      )) {
        if (!visited.has(nextId)) queue.push(nextId);
      }
    }

    components.push(
      componentIds
        .map((id) => nodeMap.get(id))
        .filter((item): item is StudioCanvasNode => Boolean(item))
        .sort(compareStudioLayoutNodes),
    );
  }

  return components;
};

const getStudioComponentPriority = (
  component: StudioCanvasNode[],
  edges: StudioWorkflowEdge[],
): [number, number, number, number, number] => {
  const componentNodeIds = new Set(component.map((node) => node.id));
  const componentEdgeCount = edges.filter(
    (edge) => componentNodeIds.has(edge.source) && componentNodeIds.has(edge.target),
  ).length;
  const hasChatOutput = component.some((node) => node.type === 'chat-output') ? 1 : 0;
  const minTypeOrder = Math.min(...component.map((node) => getNodeTypeOrder(node.type)));
  const minY = Math.min(...component.map((node) => node.position.y));

  return [-hasChatOutput, -componentEdgeCount, -component.length, minTypeOrder, minY];
};

const compareStudioComponentPriority = (
  left: [number, number, number, number, number],
  right: [number, number, number, number, number],
) => {
  for (let index = 0; index < left.length; index += 1) {
    const delta = left[index]! - right[index]!;
    if (delta !== 0) return delta;
  }

  return 0;
};

const layoutStudioComponent = (params: {
  edges: StudioWorkflowEdge[];
  nodes: StudioCanvasNode[];
  origin: StudioNodePosition;
}) => {
  const { edges, nodes, origin } = params;
  if (nodes.length === 0) return [];

  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  const indegree = new Map(nodes.map((node) => [node.id, 0]));

  for (const edge of edges) {
    if (!nodeMap.has(edge.source) || !nodeMap.has(edge.target) || edge.source === edge.target) {
      continue;
    }

    incoming.set(edge.target, [...(incoming.get(edge.target) || []), edge.source]);
    outgoing.set(edge.source, [...(outgoing.get(edge.source) || []), edge.target]);
    indegree.set(edge.target, (indegree.get(edge.target) || 0) + 1);
  }

  const sortNodeIds = (ids: string[]) =>
    [...ids].sort((leftId, rightId) =>
      compareStudioLayoutNodes(nodeMap.get(leftId)!, nodeMap.get(rightId)!),
    );

  const queue = sortNodeIds(
    nodes.filter((node) => (indegree.get(node.id) || 0) === 0).map((node) => node.id),
  );
  const orderedIds: string[] = [];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;

    visited.add(currentId);
    orderedIds.push(currentId);

    for (const targetId of sortNodeIds(outgoing.get(currentId) || [])) {
      indegree.set(targetId, Math.max((indegree.get(targetId) || 0) - 1, 0));

      if ((indegree.get(targetId) || 0) === 0) {
        queue.push(targetId);
      }
    }

    queue.sort((leftId, rightId) =>
      compareStudioLayoutNodes(nodeMap.get(leftId)!, nodeMap.get(rightId)!),
    );
  }

  for (const node of [...nodes].sort(compareStudioLayoutNodes)) {
    if (!visited.has(node.id)) orderedIds.push(node.id);
  }

  const rawLayerMap = new Map<string, number>();

  for (const nodeId of orderedIds) {
    const node = nodeMap.get(nodeId);
    if (!node) continue;

    const parentLayers = (incoming.get(nodeId) || [])
      .map((parentId) => rawLayerMap.get(parentId))
      .filter((value): value is number => value !== undefined);
    const baseLayer = getNodeBaseLayer(node.type);
    const rawLayer =
      parentLayers.length > 0
        ? Math.max(baseLayer, ...parentLayers.map((value) => value + 1))
        : baseLayer;

    rawLayerMap.set(nodeId, rawLayer);
  }

  const compressedLayers = [...new Set(rawLayerMap.values())].sort((left, right) => left - right);
  const layerIndexMap = new Map(compressedLayers.map((layer, index) => [layer, index]));
  const layeredNodes = new Map<number, string[]>();

  for (const nodeId of orderedIds) {
    const rawLayer = rawLayerMap.get(nodeId);
    if (rawLayer === undefined) continue;

    const layer = layerIndexMap.get(rawLayer) || 0;
    layeredNodes.set(layer, [...(layeredNodes.get(layer) || []), nodeId]);
  }

  const positionedNodes = new Map<string, StudioNodePosition>();

  for (const layer of [...layeredNodes.keys()].sort((left, right) => left - right)) {
    const columnNodeIds = [...(layeredNodes.get(layer) || [])].sort((leftId, rightId) => {
      const leftNode = nodeMap.get(leftId)!;
      const rightNode = nodeMap.get(rightId)!;
      const leftParents = incoming.get(leftId) || [];
      const rightParents = incoming.get(rightId) || [];
      const leftParentY =
        leftParents.reduce(
          (sum, parentId) =>
            sum +
            (positionedNodes.get(parentId)?.y ??
              nodeMap.get(parentId)?.position.y ??
              leftNode.position.y),
          0,
        ) / Math.max(leftParents.length, 1);
      const rightParentY =
        rightParents.reduce(
          (sum, parentId) =>
            sum +
            (positionedNodes.get(parentId)?.y ??
              nodeMap.get(parentId)?.position.y ??
              rightNode.position.y),
          0,
        ) / Math.max(rightParents.length, 1);

      return leftParentY - rightParentY || compareStudioLayoutNodes(leftNode, rightNode);
    });

    let nextY = origin.y;

    for (const nodeId of columnNodeIds) {
      const node = nodeMap.get(nodeId);
      if (!node) continue;

      const size = estimateNodeSize(node);
      const parentIds = incoming.get(nodeId) || [];
      const preferredY =
        parentIds.length > 0
          ? parentIds.reduce(
              (sum, parentId) =>
                sum +
                (positionedNodes.get(parentId)?.y ?? nodeMap.get(parentId)?.position.y ?? origin.y),
              0,
            ) /
              parentIds.length -
            size.height / 2
          : Math.max(node.position.y, origin.y);
      const y = Math.max(nextY, Math.max(preferredY, origin.y));

      positionedNodes.set(nodeId, {
        x: origin.x + layer * STUDIO_AUTO_LAYOUT_COLUMN_GAP,
        y,
      });
      nextY = y + size.height + STUDIO_AUTO_LAYOUT_ROW_GAP;
    }
  }

  return nodes.map((node) => ({
    ...node,
    position: positionedNodes.get(node.id) || node.position,
  }));
};

export const autoLayoutStudioNodes = (
  nodes: StudioCanvasNode[],
  edges: StudioWorkflowEdge[] = [],
): StudioCanvasNode[] => {
  if (nodes.length === 0) return [];

  const sortedComponents = getStudioConnectedComponents(nodes, edges).sort((left, right) =>
    compareStudioComponentPriority(
      getStudioComponentPriority(left, edges),
      getStudioComponentPriority(right, edges),
    ),
  );
  const positionedNodes = new Map<string, StudioCanvasNode>();
  let currentY = STUDIO_AUTO_LAYOUT_BASE_Y;

  for (const component of sortedComponents) {
    const componentNodeIdSet = new Set(component.map((node) => node.id));
    const componentEdges = edges.filter(
      (edge) => componentNodeIdSet.has(edge.source) && componentNodeIdSet.has(edge.target),
    );
    const laidOutComponent = layoutStudioComponent({
      edges: componentEdges,
      nodes: component,
      origin: { x: STUDIO_AUTO_LAYOUT_BASE_X, y: currentY },
    });

    for (const node of laidOutComponent) {
      positionedNodes.set(node.id, node);
    }

    const componentBottom = Math.max(
      ...laidOutComponent.map((node) => node.position.y + estimateNodeSize(node).height),
    );
    currentY = componentBottom + STUDIO_AUTO_LAYOUT_COMPONENT_GAP;
  }

  return nodes.map((node) => positionedNodes.get(node.id) || node);
};

export const getSuggestedStudioNodePosition = (params: {
  nodes: StudioCanvasNode[];
  selectedNode?: StudioCanvasNode;
  type: StudioNodeType;
}) => {
  const baseX =
    STUDIO_AUTO_LAYOUT_BASE_X + getNodeBaseLayer(params.type) * STUDIO_AUTO_LAYOUT_COLUMN_GAP;
  const sameLayerNodes = params.nodes
    .filter((node) => getNodeBaseLayer(node.type) === getNodeBaseLayer(params.type))
    .sort((left, right) => left.position.y - right.position.y);

  if (params.selectedNode) {
    const selectedNode = params.selectedNode;
    const nextNodeSize = estimateNodeSize(createStudioNode(params.type, { x: 0, y: 0 }));

    if (canConnectStudioNodes(selectedNode.type, params.type)) {
      const selectedSize = estimateNodeSize(selectedNode);

      return {
        x: selectedNode.position.x + selectedSize.width + 148,
        y: selectedNode.position.y,
      };
    }

    if (canConnectStudioNodes(params.type, selectedNode.type)) {
      return {
        x: Math.max(STUDIO_CANVAS_PADDING, selectedNode.position.x - nextNodeSize.width - 148),
        y: selectedNode.position.y,
      };
    }
  }

  const nextY =
    sameLayerNodes.length > 0
      ? Math.max(...sameLayerNodes.map((node) => node.position.y + estimateNodeSize(node).height)) +
        STUDIO_AUTO_LAYOUT_ROW_GAP
      : STUDIO_AUTO_LAYOUT_BASE_Y;

  return {
    x: baseX,
    y: nextY,
  };
};

const parseJsonRecordString = (value?: string) => {
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
    case 'agent': {
      return {
        data: {
          agentId: node.data.agentId,
          agentName: node.data.agentName,
          breakpoint: node.data.breakpoint,
          inputTemplate: node.data.inputTemplate,
          memoryEnabled: node.data.memoryEnabled,
          model: node.data.model,
          params: parseJsonRecordString(node.data.params),
          prompt: node.data.prompt,
          provider: node.data.provider,
          systemRole: node.data.systemRole,
          title: node.data.title,
        },
        id: node.id,
        type: 'agent',
      };
    }
    case 'mcp-tool': {
      return {
        data: {
          breakpoint: node.data.breakpoint,
          connection: node.data.serverId
            ? serverMap.get(node.data.serverId)?.connection
            : undefined,
          payload: parseJsonRecordString(node.data.payload),
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
          kind: node.data.kind,
          mimeType: node.data.mimeType,
          resourcePath: node.data.resourcePath,
          skillId: node.data.skillId,
          skillName: node.data.skillName,
          sizeBytes: node.data.sizeBytes,
          sourceLabel: node.data.sourceLabel,
          sourceType: node.data.sourceType,
          sourceUri: node.data.sourceUri,
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
          breakpoint: node.data.breakpoint,
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
  const normalizedEdges = normalizeDraftEdges(params.draft.edges, params.draft.nodes);
  const previewNodeId =
    params.previewNodeId ||
    params.draft.previewNodeId ||
    params.draft.nodes.find((node) => node.type === 'chat-output')?.id ||
    params.draft.nodes[0]?.id;

  return buildStudioWorkflowDefinition({
    edges: normalizedEdges,
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
