import { t } from 'i18next';

export interface StudioHttpConnectionConfig {
  authType?: 'bearer' | 'none' | 'oauth2';
  headers?: Record<string, string>;
  identifier: string;
  token?: string;
  type: 'http';
  url: string;
}

export interface StudioStdioConnectionConfig {
  args: string[];
  command: string;
  env?: Record<string, string>;
  identifier: string;
  type: 'stdio';
}

export type StudioConnectionConfig = StudioHttpConnectionConfig | StudioStdioConnectionConfig;
export type StudioResourceKind = 'file' | 'image' | 'text';
export type StudioResourceSource = 'manual' | 'skill-resource' | 'upload';

export type StudioNodeType =
  | 'agent'
  | 'chat-output'
  | 'input'
  | 'mcp-tool'
  | 'resource'
  | 'skill'
  | 'transform';
export type StudioPayloadBindingSource =
  | 'humanPrompt'
  | 'serverIdentifier'
  | 'toolName'
  | 'upstreamResult';
export type StudioWorkflowEdgeChannel = 'context' | 'handoff' | 'main';

export interface StudioPayloadBinding {
  id: string;
  source: StudioPayloadBindingSource;
  targetPath: string;
}

export interface StudioWorkflowEdge {
  channel?: StudioWorkflowEdgeChannel;
  id: string;
  payloadBindings?: StudioPayloadBinding[];
  source: string;
  sourcePortId?: string;
  target: string;
  targetPortId?: string;
}

export interface StudioWorkflowInputNode {
  data: {
    humanPrompt: string;
    title?: string;
  };
  id: string;
  type: 'input';
}

export interface StudioWorkflowToolNode {
  data: {
    breakpoint?: boolean;
    connection?: StudioConnectionConfig;
    payload: unknown;
    payloadBindings: StudioPayloadBinding[];
    title?: string;
    toolName?: string;
  };
  id: string;
  type: 'mcp-tool';
}

export interface StudioWorkflowAgentNode {
  data: {
    agentId?: string;
    agentName?: string;
    breakpoint?: boolean;
    inputTemplate?: string;
    memoryEnabled?: boolean;
    model?: string;
    params?: Record<string, unknown>;
    prompt: string;
    provider?: string;
    systemRole?: string;
    title?: string;
  };
  id: string;
  type: 'agent';
}

export interface StudioWorkflowTransformNode {
  data: {
    breakpoint?: boolean;
    mode: 'instruction' | 'template';
    prompt: string;
    title?: string;
  };
  id: string;
  type: 'transform';
}

export interface StudioWorkflowResourceNode {
  data: {
    content: string;
    kind?: StudioResourceKind;
    mimeType?: string;
    resourcePath?: string;
    skillId?: string;
    skillName?: string;
    sizeBytes?: number;
    sourceLabel?: string;
    sourceType?: StudioResourceSource;
    sourceUri?: string;
    title?: string;
  };
  id: string;
  type: 'resource';
}

export interface StudioWorkflowSkillNode {
  data: {
    content: string;
    skillId?: string;
    skillName?: string;
    title?: string;
  };
  id: string;
  type: 'skill';
}

export interface StudioWorkflowChatNode {
  data: {
    target: 'chat';
    title?: string;
  };
  id: string;
  type: 'chat-output';
}

export type StudioWorkflowNode =
  | StudioWorkflowAgentNode
  | StudioWorkflowChatNode
  | StudioWorkflowInputNode
  | StudioWorkflowToolNode
  | StudioWorkflowResourceNode
  | StudioWorkflowSkillNode
  | StudioWorkflowTransformNode;

export interface StudioWorkflowDSL {
  edges: StudioWorkflowEdge[];
  nodes: StudioWorkflowNode[];
  policy: {
    retries: { tool: number };
    timeouts: { toolMs: number };
  };
  previewNodeId: string;
  trigger: {
    type: 'manual';
  };
  version: '2.0';
}

export interface StudioChatPreview {
  assistant: string;
  system: string;
  user: string;
}

export interface StudioNodePortDefinition {
  id: string;
  kind: 'input' | 'output';
  labelKey: string;
  maxConnections?: number;
}

export const HUMAN_PROMPT_VARIABLE = '{{humanPrompt}}';
export const SERVER_IDENTIFIER_VARIABLE = '{{serverIdentifier}}';
export const TOOL_NAME_VARIABLE = '{{toolName}}';
export const TOOL_RESULT_VARIABLE = '{{toolResult}}';
export const UPSTREAM_RESULT_VARIABLE = '{{upstreamResult}}';

const translateStudioText = (
  key: string,
  defaultValue: string,
  options?: Record<string, string | number>,
) => t(key, { defaultValue, ns: 'setting', ...options });

const studioDefaultNodeTitleMap = {
  'agent': 'Agent',
  'chat-output': 'Chat',
  'input': 'Input',
  'mcp-tool': 'MCP Tool',
  'resource': 'Resource',
  'skill': 'Skill',
  'transform': 'Transform',
} as const satisfies Record<StudioNodeType, string>;

const studioNodeTitleKeyMap = {
  'agent': 'mcpStudio.node.agent',
  'chat-output': 'mcpStudio.node.chat',
  'input': 'mcpStudio.node.input',
  'mcp-tool': 'mcpStudio.node.tool',
  'resource': 'mcpStudio.node.resource',
  'skill': 'mcpStudio.node.skill',
  'transform': 'mcpStudio.node.transform',
} as const satisfies Record<StudioNodeType, string>;

export const getStudioDefaultNodeTitle = (type: StudioNodeType) =>
  translateStudioText(studioNodeTitleKeyMap[type], studioDefaultNodeTitleMap[type]);

export const getStudioDefaultTransformPrompt = () =>
  translateStudioText('mcpStudio.transform.default', 'Summarize the upstream result for chat.');

const inferStudioResourceKindFromName = (value?: string) => {
  if (!value) return undefined;

  const normalized = value.toLowerCase();
  if (
    normalized.endsWith('.png') ||
    normalized.endsWith('.jpg') ||
    normalized.endsWith('.jpeg') ||
    normalized.endsWith('.gif') ||
    normalized.endsWith('.svg') ||
    normalized.endsWith('.webp') ||
    normalized.endsWith('.bmp') ||
    normalized.endsWith('.ico')
  ) {
    return 'image' satisfies StudioResourceKind;
  }

  if (
    normalized.endsWith('.txt') ||
    normalized.endsWith('.md') ||
    normalized.endsWith('.markdown') ||
    normalized.endsWith('.json') ||
    normalized.endsWith('.yaml') ||
    normalized.endsWith('.yml') ||
    normalized.endsWith('.csv') ||
    normalized.endsWith('.xml') ||
    normalized.endsWith('.log')
  ) {
    return 'text' satisfies StudioResourceKind;
  }

  return 'file' satisfies StudioResourceKind;
};

export const inferStudioResourceKind = (params: {
  content?: string;
  mimeType?: string;
  sourceUri?: string;
}): StudioResourceKind => {
  if (params.mimeType?.startsWith('image/')) return 'image';
  if (
    params.mimeType?.startsWith('text/') ||
    params.mimeType === 'application/json' ||
    params.mimeType === 'application/xml'
  ) {
    return 'text';
  }

  const inferredFromName = inferStudioResourceKindFromName(params.sourceUri);
  if (inferredFromName) return inferredFromName;

  if (params.content?.trim()) return 'text';

  return 'file';
};

export const resolveStudioResourceSource = (params: {
  resourcePath?: string;
  skillId?: string;
  sourceType?: StudioResourceSource;
}) => {
  if (params.sourceType) return params.sourceType;
  if (params.skillId || params.resourcePath) return 'skill-resource' satisfies StudioResourceSource;

  return 'manual' satisfies StudioResourceSource;
};

export const buildStudioResourceContext = (params: {
  content?: string;
  kind?: StudioResourceKind;
  mimeType?: string;
  sizeBytes?: number;
  sourceLabel?: string;
  sourceType?: StudioResourceSource;
  sourceUri?: string;
  title?: string;
}) => {
  const kind = inferStudioResourceKind({
    content: params.content,
    mimeType: params.mimeType,
    sourceUri: params.sourceUri,
  });
  const content = params.content?.trim();

  if (kind === 'text' && content && !params.mimeType && !params.sourceLabel && !params.sourceUri) {
    return content;
  }

  const header =
    kind === 'image' ? '[Image Resource]' : kind === 'file' ? '[File Resource]' : '[Text Resource]';
  const lines = [
    header,
    params.title ? `Node: ${params.title}` : undefined,
    params.sourceLabel ? `Name: ${params.sourceLabel}` : undefined,
    params.sourceUri ? `Source: ${params.sourceUri}` : undefined,
    params.mimeType ? `MIME: ${params.mimeType}` : undefined,
    params.sizeBytes ? `Size: ${params.sizeBytes} bytes` : undefined,
    params.sourceType === 'skill-resource' ? 'Imported from a skill resource.' : undefined,
    content ? `${kind === 'text' ? 'Content' : 'Notes'}:\n${content}` : undefined,
  ].filter((value): value is string => Boolean(value));

  return lines.join('\n');
};

const studioNodePorts = {
  'agent': [
    {
      id: 'main',
      kind: 'input',
      labelKey: 'mcpStudio.port.main',
      maxConnections: 1,
    },
    {
      id: 'context',
      kind: 'input',
      labelKey: 'mcpStudio.port.context',
    },
    {
      id: 'main',
      kind: 'output',
      labelKey: 'mcpStudio.port.main',
    },
    {
      id: 'handoff',
      kind: 'output',
      labelKey: 'mcpStudio.port.handoff',
    },
  ],
  'chat-output': [
    {
      id: 'main',
      kind: 'input',
      labelKey: 'mcpStudio.port.main',
      maxConnections: 1,
    },
  ],
  'input': [
    {
      id: 'main',
      kind: 'output',
      labelKey: 'mcpStudio.port.main',
    },
  ],
  'mcp-tool': [
    {
      id: 'main',
      kind: 'input',
      labelKey: 'mcpStudio.port.main',
      maxConnections: 1,
    },
    {
      id: 'context',
      kind: 'input',
      labelKey: 'mcpStudio.port.context',
    },
    {
      id: 'main',
      kind: 'output',
      labelKey: 'mcpStudio.port.main',
    },
  ],
  'resource': [
    {
      id: 'context',
      kind: 'output',
      labelKey: 'mcpStudio.port.context',
    },
  ],
  'skill': [
    {
      id: 'context',
      kind: 'output',
      labelKey: 'mcpStudio.port.context',
    },
  ],
  'transform': [
    {
      id: 'main',
      kind: 'input',
      labelKey: 'mcpStudio.port.main',
      maxConnections: 1,
    },
    {
      id: 'context',
      kind: 'input',
      labelKey: 'mcpStudio.port.context',
    },
    {
      id: 'main',
      kind: 'output',
      labelKey: 'mcpStudio.port.main',
    },
  ],
} as const satisfies Record<StudioNodeType, readonly StudioNodePortDefinition[]>;

const studioLegacyPortAliases = {
  'agent': {
    input: {
      primary: 'main',
    },
    output: {
      result: 'main',
    },
  },
  'chat-output': {
    input: {
      context: 'main',
      message: 'main',
    },
    output: {},
  },
  'input': {
    input: {},
    output: {
      prompt: 'main',
    },
  },
  'mcp-tool': {
    input: {
      primary: 'main',
    },
    output: {
      result: 'main',
    },
  },
  'resource': {
    input: {},
    output: {
      content: 'context',
    },
  },
  'skill': {
    input: {},
    output: {
      content: 'context',
    },
  },
  'transform': {
    input: {
      primary: 'main',
    },
    output: {
      result: 'main',
    },
  },
} as const satisfies Record<
  StudioNodeType,
  Record<'input' | 'output', Partial<Record<string, StudioNodePortDefinition['id']>>>
>;

const STUDIO_PROCESSOR_NODE_TYPES = [
  'agent',
  'mcp-tool',
  'transform',
] as const satisfies readonly StudioNodeType[];
const STUDIO_MAIN_ONLY_TARGET_NODE_TYPES = [
  'agent',
  'chat-output',
  'mcp-tool',
  'transform',
] as const satisfies readonly StudioNodeType[];

const isStudioProcessorNodeType = (nodeType: StudioNodeType) =>
  STUDIO_PROCESSOR_NODE_TYPES.includes(nodeType as (typeof STUDIO_PROCESSOR_NODE_TYPES)[number]);

const isStudioMainOnlyTargetNodeType = (nodeType: StudioNodeType) =>
  STUDIO_MAIN_ONLY_TARGET_NODE_TYPES.includes(
    nodeType as (typeof STUDIO_MAIN_ONLY_TARGET_NODE_TYPES)[number],
  );

const isStudioEdgeChannel = (value: string | undefined): value is StudioWorkflowEdgeChannel =>
  value === 'main' || value === 'context' || value === 'handoff';

const normalizeStudioPortId = (
  nodeType: StudioNodeType,
  kind: 'input' | 'output',
  portId: string | undefined,
) => {
  if (!portId) return undefined;

  return studioLegacyPortAliases[nodeType][kind][portId] || portId;
};

export const getStudioNodePorts = (
  nodeType: StudioNodeType,
  kind?: 'input' | 'output',
): StudioNodePortDefinition[] =>
  studioNodePorts[nodeType].filter((port) => (kind ? port.kind === kind : true));

export const getStudioNodePort = (
  nodeType: StudioNodeType,
  portId: string | undefined,
  kind?: 'input' | 'output',
): StudioNodePortDefinition | undefined => {
  const normalizedPortId = normalizeStudioPortId(nodeType, kind || 'input', portId);
  if (!normalizedPortId) return undefined;

  return getStudioNodePorts(nodeType, kind).find((port) => port.id === normalizedPortId);
};

export const supportsStudioNodeBreakpoint = (nodeType: StudioNodeType) =>
  nodeType === 'agent' || nodeType === 'mcp-tool' || nodeType === 'transform';

export const canConnectStudioNodes = (sourceType: StudioNodeType, targetType: StudioNodeType) => {
  if (targetType === 'input' || targetType === 'resource' || targetType === 'skill') return false;
  if (sourceType === 'chat-output') return false;

  if (targetType === 'chat-output') {
    return (
      sourceType === 'agent' ||
      sourceType === 'input' ||
      sourceType === 'mcp-tool' ||
      sourceType === 'transform'
    );
  }

  return (
    sourceType === 'agent' ||
    sourceType === 'input' ||
    sourceType === 'mcp-tool' ||
    sourceType === 'resource' ||
    sourceType === 'skill' ||
    sourceType === 'transform'
  );
};

export const resolveStudioEdgeChannel = (params: {
  channel?: string;
  sourcePortId?: string;
  sourceType: StudioNodeType;
  targetPortId?: string;
  targetType: StudioNodeType;
}): StudioWorkflowEdgeChannel => {
  if (isStudioEdgeChannel(params.channel)) return params.channel;

  const sourcePortId =
    normalizeStudioPortId(params.sourceType, 'output', params.sourcePortId) ||
    getStudioNodePorts(params.sourceType, 'output')[0]?.id;
  const targetPortId =
    normalizeStudioPortId(params.targetType, 'input', params.targetPortId) ||
    getStudioNodePorts(params.targetType, 'input')[0]?.id;

  if (sourcePortId === 'handoff') return 'handoff';
  if (params.sourceType === 'resource' || params.sourceType === 'skill') return 'context';
  if (targetPortId === 'context') return 'context';

  return 'main';
};

export const resolveStudioSourcePortId = (params: {
  channel?: StudioWorkflowEdgeChannel | string;
  nodeType: StudioNodeType;
  portId?: string;
}) => {
  const normalizedPortId = normalizeStudioPortId(params.nodeType, 'output', params.portId);

  if (normalizedPortId && getStudioNodePort(params.nodeType, normalizedPortId, 'output')) {
    return normalizedPortId;
  }

  if (params.channel === 'handoff' && getStudioNodePort(params.nodeType, 'handoff', 'output')) {
    return 'handoff';
  }

  if (
    (params.nodeType === 'resource' || params.nodeType === 'skill') &&
    getStudioNodePort(params.nodeType, 'context', 'output')
  ) {
    return 'context';
  }

  return getStudioNodePorts(params.nodeType, 'output')[0]?.id;
};

export const resolveStudioTargetPortId = (params: {
  channel?: StudioWorkflowEdgeChannel | string;
  nodeType: StudioNodeType;
  portId?: string;
}) => {
  const normalizedPortId = normalizeStudioPortId(params.nodeType, 'input', params.portId);

  if (normalizedPortId && getStudioNodePort(params.nodeType, normalizedPortId, 'input')) {
    return normalizedPortId;
  }

  if (params.channel === 'context' && getStudioNodePort(params.nodeType, 'context', 'input')) {
    return 'context';
  }

  return getStudioNodePorts(params.nodeType, 'input')[0]?.id;
};

export const canConnectStudioPorts = (params: {
  sourceId?: string;
  sourcePortId: string | undefined;
  sourceType: StudioNodeType;
  targetId?: string;
  targetPortId: string | undefined;
  targetType: StudioNodeType;
}) => {
  if (params.sourceId && params.targetId && params.sourceId === params.targetId) return false;
  if (!canConnectStudioNodes(params.sourceType, params.targetType)) return false;

  const sourcePortId = resolveStudioSourcePortId({
    nodeType: params.sourceType,
    portId: params.sourcePortId,
  });
  const targetPortId = resolveStudioTargetPortId({
    nodeType: params.targetType,
    portId: params.targetPortId,
  });
  if (!sourcePortId || !targetPortId) return false;

  const sourcePort = getStudioNodePort(params.sourceType, sourcePortId, 'output');
  const targetPort = getStudioNodePort(params.targetType, targetPortId, 'input');

  if (!sourcePort || !targetPort) return false;

  if (sourcePort.id === 'handoff') {
    return (
      params.sourceType === 'agent' && params.targetType === 'agent' && targetPort.id === 'main'
    );
  }

  if (
    sourcePort.id === 'context' ||
    params.sourceType === 'resource' ||
    params.sourceType === 'skill'
  ) {
    return isStudioProcessorNodeType(params.targetType) && targetPort.id === 'context';
  }

  if (targetPort.id === 'context') {
    return isStudioProcessorNodeType(params.targetType);
  }

  return isStudioMainOnlyTargetNodeType(params.targetType) && targetPort.id === 'main';
};

export const canStudioTargetPortAcceptEdge = (params: {
  currentCount: number;
  targetPortId: string | undefined;
  targetType: StudioNodeType;
}) => {
  const targetPort = getStudioNodePort(params.targetType, params.targetPortId, 'input');

  if (!targetPort) return false;
  if (targetPort.maxConnections === undefined) return true;

  return params.currentCount < targetPort.maxConnections;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const cloneJsonValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(cloneJsonValue);
  if (!isRecord(value)) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, itemValue]) => [key, cloneJsonValue(itemValue)]),
  );
};

const normalizeBindingPath = (value: string) =>
  value
    .split('.')
    .map((part) => part.trim())
    .filter(Boolean)
    .join('.');

const setNestedValue = (record: Record<string, unknown>, path: string, value: string) => {
  const segments = normalizeBindingPath(path).split('.').filter(Boolean);

  if (segments.length === 0) return record;

  let cursor = record;

  for (const [index, segment] of segments.entries()) {
    if (index === segments.length - 1) {
      cursor[segment] = value;
      continue;
    }

    const nextValue = cursor[segment];
    const nextRecord = isRecord(nextValue) ? nextValue : {};

    cursor[segment] = nextRecord;
    cursor = nextRecord;
  }

  return record;
};

export const resolveStudioTemplateString = (params: {
  humanPrompt?: string;
  serverIdentifier?: string;
  template: string;
  toolName?: string;
  toolResult?: string;
  upstreamResult?: string;
}) =>
  Object.entries({
    [HUMAN_PROMPT_VARIABLE]: params.humanPrompt || '',
    [SERVER_IDENTIFIER_VARIABLE]: params.serverIdentifier || '',
    [TOOL_NAME_VARIABLE]: params.toolName || '',
    [TOOL_RESULT_VARIABLE]: params.toolResult || '',
    [UPSTREAM_RESULT_VARIABLE]: params.upstreamResult || '',
  }).reduce(
    (text, [pattern, replacement]) => text.replaceAll(pattern, replacement),
    params.template,
  );

export const applyStudioPayloadBindings = (params: {
  bindings: StudioPayloadBinding[] | undefined;
  humanPrompt: string;
  payload: unknown;
  serverIdentifier?: string;
  toolName?: string;
  upstreamResult?: string;
}) => {
  const basePayload = isRecord(params.payload)
    ? (cloneJsonValue(params.payload) as Record<string, unknown>)
    : {};
  const sourceValues: Record<StudioPayloadBindingSource, string> = {
    humanPrompt: params.humanPrompt,
    serverIdentifier: params.serverIdentifier || '',
    toolName: params.toolName || '',
    upstreamResult: params.upstreamResult || '',
  };

  for (const binding of params.bindings || []) {
    const targetPath = normalizeBindingPath(binding.targetPath);
    if (!targetPath) continue;

    setNestedValue(basePayload, targetPath, sourceValues[binding.source] || '');
  }

  return basePayload;
};

const trimBlock = (value?: string, fallback?: string) => {
  const text = value?.trim();

  if (!text) return fallback || '';

  return text.length > 280 ? `${text.slice(0, 277)}...` : text;
};

export const buildStudioChatPreview = (params: {
  connection?: StudioConnectionConfig;
  humanPrompt?: string;
  result?: string;
  success?: boolean;
  toolName?: string;
  transformMode?: 'instruction' | 'template';
  transformPrompt?: string;
}) => {
  const prompt = trimBlock(
    params.transformPrompt,
    translateStudioText('mcpStudio.preview.fallback.system', 'Shape the workflow output for chat.'),
  );
  const result = trimBlock(
    params.result,
    translateStudioText(
      'mcpStudio.preview.fallback.assistant',
      'Run the flow to preview a chat-ready answer.',
    ),
  );
  const request = trimBlock(
    params.humanPrompt,
    translateStudioText('mcpStudio.preview.fallback.request', 'Run the selected workflow output.'),
  );
  const serverIdentifier =
    params.connection?.identifier ||
    translateStudioText('mcpStudio.preview.fallback.server', 'workflow');
  const toolLabel =
    params.toolName || translateStudioText('mcpStudio.preview.fallback.tool', 'tool');

  if (params.transformMode === 'template') {
    return {
      assistant: result,
      system: prompt,
      user: request,
    } satisfies StudioChatPreview;
  }

  return {
    assistant: params.success
      ? result
      : translateStudioText(
          'mcpStudio.preview.fallback.assistant',
          'Run the flow to preview a chat-ready answer.',
        ),
    system: prompt,
    user: translateStudioText(
      'mcpStudio.preview.fallback.user',
      'Run {{tool}} through {{server}} and prepare the response for chat. Request: {{request}}',
      {
        request,
        server: serverIdentifier,
        tool: toolLabel,
      },
    ),
  } satisfies StudioChatPreview;
};

export const normalizeStudioWorkflowEdges = (params: {
  edges: StudioWorkflowEdge[];
  nodes: StudioWorkflowNode[];
}): StudioWorkflowEdge[] => {
  const nodeMap = new Map(params.nodes.map((node) => [node.id, node]));

  return params.edges.reduce<StudioWorkflowEdge[]>((acc, edge) => {
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
      id: edge.id,
      payloadBindings: edge.payloadBindings,
      source: edge.source,
      target: edge.target,
    });

    return acc;
  }, []);
};

export const normalizeStudioWorkflowDefinition = (
  workflow: StudioWorkflowDSL,
): StudioWorkflowDSL => ({
  ...workflow,
  edges: normalizeStudioWorkflowEdges({
    edges: workflow.edges,
    nodes: workflow.nodes,
  }),
});

export const buildStudioWorkflowDefinition = (params: {
  edges: StudioWorkflowEdge[];
  nodes: StudioWorkflowNode[];
  previewNodeId: string;
  toolRetries?: number;
  toolTimeoutMs?: number;
}): StudioWorkflowDSL =>
  normalizeStudioWorkflowDefinition({
    edges: params.edges,
    nodes: params.nodes,
    policy: {
      retries: { tool: params.toolRetries ?? 1 },
      timeouts: { toolMs: params.toolTimeoutMs ?? 60_000 },
    },
    previewNodeId: params.previewNodeId,
    trigger: {
      type: 'manual',
    },
    version: '2.0',
  });
