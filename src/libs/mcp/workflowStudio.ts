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

export type StudioNodeType =
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

export interface StudioPayloadBinding {
  id: string;
  source: StudioPayloadBindingSource;
  targetPath: string;
}

export interface StudioWorkflowEdge {
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
    connection?: StudioConnectionConfig;
    payload: unknown;
    payloadBindings: StudioPayloadBinding[];
    title?: string;
    toolName?: string;
  };
  id: string;
  type: 'mcp-tool';
}

export interface StudioWorkflowTransformNode {
  data: {
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
    resourcePath?: string;
    skillId?: string;
    skillName?: string;
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

export const HUMAN_PROMPT_VARIABLE = '{{humanPrompt}}';
export const SERVER_IDENTIFIER_VARIABLE = '{{serverIdentifier}}';
export const TOOL_NAME_VARIABLE = '{{toolName}}';
export const TOOL_RESULT_VARIABLE = '{{toolResult}}';
export const UPSTREAM_RESULT_VARIABLE = '{{upstreamResult}}';

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
  const prompt = trimBlock(params.transformPrompt, 'Shape the workflow output for chat.');
  const result = trimBlock(params.result, 'Run the flow to preview a chat-ready answer.');
  const request = trimBlock(params.humanPrompt, 'Run the selected workflow output.');
  const serverIdentifier = params.connection?.identifier || 'workflow';
  const toolLabel = params.toolName || 'tool';

  if (params.transformMode === 'template') {
    return {
      assistant: result,
      system: prompt,
      user: request,
    } satisfies StudioChatPreview;
  }

  return {
    assistant: params.success ? result : 'Run the flow to preview a chat-ready answer.',
    system: prompt,
    user: `Run ${toolLabel} through ${serverIdentifier} and prepare the response for chat. Request: ${request}`,
  } satisfies StudioChatPreview;
};

export const buildStudioWorkflowDefinition = (params: {
  edges: StudioWorkflowEdge[];
  nodes: StudioWorkflowNode[];
  previewNodeId: string;
  toolRetries?: number;
  toolTimeoutMs?: number;
}): StudioWorkflowDSL => ({
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
