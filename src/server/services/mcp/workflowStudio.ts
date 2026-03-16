import { DEFAULT_AGENT_CONFIG } from '@lobechat/const';
import { type LobeChatDatabase } from '@lobechat/database';
import { TRPCError } from '@trpc/server';
import type OpenAI from 'openai';
import { z } from 'zod';

import { AgentModel } from '@/database/models/agent';
import { UserPersonaModel } from '@/database/models/userMemory/persona';
import { type MCPClientParams } from '@/libs/mcp';
import {
  applyStudioPayloadBindings,
  buildStudioChatPreview,
  buildStudioResourceContext,
  canConnectStudioPorts,
  canStudioTargetPortAcceptEdge,
  normalizeStudioWorkflowDefinition,
  resolveStudioEdgeChannel,
  resolveStudioSourcePortId,
  resolveStudioTargetPortId,
  resolveStudioTemplateString,
  type StudioConnectionConfig,
  type StudioNodeType,
  type StudioWorkflowEdgeChannel,
  supportsStudioNodeBreakpoint,
} from '@/libs/mcp/workflowStudio';
import {
  serverMessagesEngine,
  type ServerUserMemoryConfig,
} from '@/server/modules/Mecha/ContextEngineering';
import { initModelRuntimeFromDB } from '@/server/modules/ModelRuntime';

import { type ProcessContentBlocksFn } from './contentProcessor';
import { mcpService } from './index';

const workflowStudioHttpConnectionSchema = z.object({
  authType: z.enum(['bearer', 'none', 'oauth2']).optional(),
  headers: z.record(z.string()).optional(),
  identifier: z.string().min(1),
  token: z.string().optional(),
  type: z.literal('http'),
  url: z.string().url(),
});

const workflowStudioStdioConnectionSchema = z.object({
  args: z.array(z.string()).optional().default([]),
  command: z.string().min(1),
  env: z.record(z.string()).optional(),
  identifier: z.string().min(1),
  type: z.literal('stdio'),
});

const workflowStudioConnectionSchema = z.union([
  workflowStudioHttpConnectionSchema,
  workflowStudioStdioConnectionSchema,
]);

const workflowStudioPayloadBindingSchema = z.object({
  id: z.string().min(1),
  source: z.enum(['humanPrompt', 'serverIdentifier', 'toolName', 'upstreamResult']),
  targetPath: z.string(),
});

const workflowStudioEdgeSchema = z.object({
  channel: z.enum(['context', 'handoff', 'main']).optional(),
  id: z.string().min(1),
  payloadBindings: z.array(workflowStudioPayloadBindingSchema).optional().default([]),
  sourcePortId: z.string().optional(),
  source: z.string().min(1),
  targetPortId: z.string().optional(),
  target: z.string().min(1),
});

const workflowStudioInputNodeSchema = z.object({
  data: z.object({
    humanPrompt: z.string().default(''),
    title: z.string().optional(),
  }),
  id: z.string().min(1),
  type: z.literal('input'),
});

const workflowStudioToolNodeSchema = z.object({
  data: z.object({
    breakpoint: z.boolean().optional(),
    connection: workflowStudioConnectionSchema.optional(),
    payload: z.unknown(),
    payloadBindings: z.array(workflowStudioPayloadBindingSchema).default([]),
    title: z.string().optional(),
    toolName: z.string().optional(),
  }),
  id: z.string().min(1),
  type: z.literal('mcp-tool'),
});

const workflowStudioAgentNodeSchema = z.object({
  data: z.object({
    agentId: z.string().optional(),
    agentName: z.string().optional(),
    breakpoint: z.boolean().optional(),
    inputTemplate: z.string().optional(),
    memoryEnabled: z.boolean().optional(),
    model: z.string().optional(),
    params: z.record(z.unknown()).optional(),
    prompt: z.string().default(''),
    provider: z.string().optional(),
    systemRole: z.string().optional(),
    title: z.string().optional(),
  }),
  id: z.string().min(1),
  type: z.literal('agent'),
});

const workflowStudioTransformNodeSchema = z.object({
  data: z.object({
    breakpoint: z.boolean().optional(),
    mode: z.enum(['instruction', 'template']).default('instruction'),
    prompt: z.string(),
    title: z.string().optional(),
  }),
  id: z.string().min(1),
  type: z.literal('transform'),
});

const workflowStudioResourceNodeSchema = z.object({
  data: z.object({
    content: z.string().default(''),
    kind: z.enum(['file', 'image', 'text']).optional(),
    mimeType: z.string().optional(),
    resourcePath: z.string().optional(),
    skillId: z.string().optional(),
    skillName: z.string().optional(),
    sizeBytes: z.number().optional(),
    sourceLabel: z.string().optional(),
    sourceType: z.enum(['manual', 'skill-resource', 'upload']).optional(),
    sourceUri: z.string().optional(),
    title: z.string().optional(),
  }),
  id: z.string().min(1),
  type: z.literal('resource'),
});

const workflowStudioSkillNodeSchema = z.object({
  data: z.object({
    content: z.string().default(''),
    skillId: z.string().optional(),
    skillName: z.string().optional(),
    title: z.string().optional(),
  }),
  id: z.string().min(1),
  type: z.literal('skill'),
});

const workflowStudioChatNodeSchema = z.object({
  data: z.object({
    target: z.literal('chat'),
    title: z.string().optional(),
  }),
  id: z.string().min(1),
  type: z.literal('chat-output'),
});

const workflowStudioNodeSchema = z.discriminatedUnion('type', [
  workflowStudioAgentNodeSchema,
  workflowStudioInputNodeSchema,
  workflowStudioToolNodeSchema,
  workflowStudioResourceNodeSchema,
  workflowStudioSkillNodeSchema,
  workflowStudioTransformNodeSchema,
  workflowStudioChatNodeSchema,
]);

export const workflowStudioDslSchema = z.object({
  edges: z.array(workflowStudioEdgeSchema),
  nodes: z.array(workflowStudioNodeSchema).min(1),
  policy: z.object({
    retries: z.object({
      tool: z.number().int().min(0).max(3),
    }),
    timeouts: z.object({
      toolMs: z.number().int().min(1000).max(300_000),
    }),
  }),
  previewNodeId: z.string().min(1),
  trigger: z.object({
    type: z.literal('manual'),
  }),
  version: z.literal('2.0'),
});

export const workflowStudioPreviewInputSchema = z.object({
  workflow: workflowStudioDslSchema,
});

export type WorkflowStudioPreviewInput = z.input<typeof workflowStudioPreviewInputSchema>;
export type WorkflowStudioPreviewWorkflowInput = WorkflowStudioPreviewInput['workflow'];
export type WorkflowStudioPreviewWorkflow = z.infer<typeof workflowStudioDslSchema>;

const createClientParams = (connection: StudioConnectionConfig): MCPClientParams =>
  connection.type === 'http'
    ? {
        auth:
          connection.authType === undefined
            ? undefined
            : connection.authType === 'none'
              ? { type: 'none' }
              : connection.authType === 'bearer'
                ? { token: connection.token, type: 'bearer' }
                : { accessToken: connection.token, type: 'oauth2' },
        headers: connection.headers,
        name: connection.identifier,
        type: 'http',
        url: connection.url || '',
      }
    : {
        args: connection.args || [],
        command: connection.command || '',
        env: connection.env,
        name: connection.identifier,
        type: 'stdio',
      };

interface ExecutionResult {
  agentName?: string;
  channelOutputs: Partial<Record<StudioWorkflowEdgeChannel, string>>;
  connection?: StudioConnectionConfig;
  humanPrompt: string;
  outputText?: string;
  toolName?: string;
  toolRuns: ToolExecutionRun[];
  transformMode?: 'instruction' | 'template';
  transformPrompt?: string;
}

type ToolCallResult = Awaited<ReturnType<typeof mcpService.callTool>>;

interface ToolExecutionRun {
  connection?: StudioConnectionConfig;
  nodeId: string;
  nodeTitle: string;
  result: ToolCallResult;
  toolName?: string;
}

interface WorkflowStudioBreakpoint {
  nodeId: string;
  nodeTitle: string;
  nodeType: StudioNodeType;
}

interface WorkflowStudioBreakpointSnapshot extends WorkflowStudioBreakpoint {
  result: ExecutionResult;
}

class WorkflowStudioBreakpointError extends Error {
  snapshot: WorkflowStudioBreakpointSnapshot;

  constructor(snapshot: WorkflowStudioBreakpointSnapshot) {
    super(`Workflow paused at breakpoint "${snapshot.nodeTitle}".`);
    this.name = 'WorkflowStudioBreakpointError';
    this.snapshot = snapshot;
  }
}

const getNodeMap = (workflow: WorkflowStudioPreviewWorkflow) =>
  new Map(workflow.nodes.map((node) => [node.id, node]));

const getIncomingEdgeMap = (workflow: WorkflowStudioPreviewWorkflow) => {
  const map = new Map<string, WorkflowStudioPreviewWorkflow['edges']>();

  for (const edge of workflow.edges) {
    const current = map.get(edge.target) || [];
    current.push(edge);
    map.set(edge.target, current);
  }

  return map;
};

const resolveSourcePortId = (
  nodeType: WorkflowStudioPreviewWorkflow['nodes'][number]['type'],
  edge: WorkflowStudioPreviewWorkflow['edges'][number],
) =>
  resolveStudioSourcePortId({
    channel: edge.channel,
    nodeType,
    portId: edge.sourcePortId,
  });

const resolveTargetPortId = (
  nodeType: WorkflowStudioPreviewWorkflow['nodes'][number]['type'],
  edge: WorkflowStudioPreviewWorkflow['edges'][number],
) =>
  resolveStudioTargetPortId({
    channel: edge.channel,
    nodeType,
    portId: edge.targetPortId,
  });

const getPortKey = (nodeId: string, portId: string | undefined) =>
  `${nodeId}:${portId || 'default'}`;

const ensurePreviewNode = (workflow: WorkflowStudioPreviewWorkflow) => {
  const previewNode = workflow.nodes.find((node) => node.id === workflow.previewNodeId);

  if (!previewNode) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Workflow preview node "${workflow.previewNodeId}" was not found.`,
    });
  }

  if (previewNode.type !== 'chat-output') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Workflow preview node must be a chat output battery.',
    });
  }
};

const validateWorkflowGraph = (workflow: WorkflowStudioPreviewWorkflow) => {
  const nodeMap = getNodeMap(workflow);
  const incomingPortCounts = new Map<string, number>();

  for (const edge of workflow.edges) {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);

    if (!sourceNode || !targetNode) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Workflow edge "${edge.id}" points to a missing node.`,
      });
    }

    const channel = resolveStudioEdgeChannel({
      channel: edge.channel,
      sourcePortId: edge.sourcePortId,
      sourceType: sourceNode.type,
      targetPortId: edge.targetPortId,
      targetType: targetNode.type,
    });
    const sourcePortId = resolveSourcePortId(sourceNode.type, edge);
    const targetPortId = resolveTargetPortId(targetNode.type, edge);

    if (!sourcePortId || !targetPortId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Workflow edge "${edge.id}" is missing a valid source or target port.`,
      });
    }

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
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Workflow edge "${edge.id}" has an invalid connection route.`,
      });
    }

    const portKey = getPortKey(targetNode.id, targetPortId);
    const currentCount = incomingPortCounts.get(portKey) || 0;

    if (
      !canStudioTargetPortAcceptEdge({
        currentCount,
        targetPortId,
        targetType: targetNode.type,
      })
    ) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Workflow port "${targetNode.id}.${targetPortId}" does not accept more connections.`,
      });
    }

    incomingPortCounts.set(portKey, currentCount + 1);
    edge.channel = channel;
  }
};

const uniqueText = (values: Array<string | undefined>) => [
  ...new Set(
    values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)),
  ),
];

const joinTextBlocks = (values: Array<string | undefined>) => uniqueText(values).join('\n\n');

const getNodeLabel = (
  nodeMap: Map<string, WorkflowStudioPreviewWorkflow['nodes'][number]>,
  nodeId: string,
) => nodeMap.get(nodeId)?.data.title || nodeId;

const getExecutionEdgeText = (params: {
  edge: WorkflowStudioPreviewWorkflow['edges'][number];
  nodeMap: Map<string, WorkflowStudioPreviewWorkflow['nodes'][number]>;
  result: ExecutionResult | undefined;
}) => {
  const sourceNode = params.nodeMap.get(params.edge.source);
  const channel =
    sourceNode && params.nodeMap.get(params.edge.target)
      ? resolveStudioEdgeChannel({
          channel: params.edge.channel,
          sourcePortId: params.edge.sourcePortId,
          sourceType: sourceNode.type,
          targetPortId: params.edge.targetPortId,
          targetType: params.nodeMap.get(params.edge.target)!.type,
        })
      : params.edge.channel;

  return (
    (channel ? params.result?.channelOutputs[channel]?.trim() : undefined) ||
    params.result?.outputText?.trim()
  );
};

const mergeIncomingOutputText = (params: {
  incomingEdges: WorkflowStudioPreviewWorkflow['edges'];
  nodeMap: Map<string, WorkflowStudioPreviewWorkflow['nodes'][number]>;
  parentResults: ExecutionResult[];
}) =>
  params.incomingEdges
    .map((edge, index) => {
      const text = getExecutionEdgeText({
        edge,
        nodeMap: params.nodeMap,
        result: params.parentResults[index],
      });
      if (!text) return undefined;

      if (params.incomingEdges.length === 1) return text;

      return `${getNodeLabel(params.nodeMap, edge.source)}:\n${text}`;
    })
    .filter((value): value is string => Boolean(value))
    .join('\n\n');

const mergeToolRunText = (toolRuns: ToolExecutionRun[]) =>
  toolRuns
    .map((toolRun) => {
      const text = toolRun.result.content?.trim();
      if (!text) return undefined;

      if (toolRuns.length === 1) return text;

      return `${toolRun.nodeTitle} (${toolRun.toolName || 'tool'}):\n${text}`;
    })
    .filter((value): value is string => Boolean(value))
    .join('\n\n');

const getTargetPortOrder = (channel?: StudioWorkflowEdgeChannel) => (channel === 'context' ? 1 : 0);

const pickSingleValue = <T>(values: T[], getKey: (value: T) => string | undefined) => {
  const keyedValues = values
    .map((value) => ({ key: getKey(value), value }))
    .filter((item): item is { key: string; value: T } => Boolean(item.key));

  if (keyedValues.length === 0) return undefined;

  const uniqueKeys = new Set(keyedValues.map((item) => item.key));
  if (uniqueKeys.size !== 1) return undefined;

  return keyedValues[0]?.value;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const sanitizeStudioAgentParams = (value: unknown): Record<string, unknown> => {
  if (!isRecord(value)) return {};

  return Object.fromEntries(
    Object.entries(value).filter(
      ([key]) => key !== 'messages' && key !== 'model' && key !== 'provider' && key !== 'stream',
    ),
  );
};

const loadStudioAgentUserMemory = async (params: {
  enabled: boolean;
  serverDB: LobeChatDatabase;
  userId: string;
}): Promise<ServerUserMemoryConfig | undefined> => {
  if (!params.enabled) return undefined;

  try {
    const personaModel = new UserPersonaModel(params.serverDB, params.userId);
    const persona = await personaModel.getLatestPersonaDocument();

    if (!persona?.persona) return undefined;

    return {
      fetchedAt: Date.now(),
      memories: {
        contexts: [],
        experiences: [],
        persona: {
          narrative: persona.persona,
          tagline: persona.tagline,
        },
        preferences: [],
      },
    };
  } catch {
    return undefined;
  }
};

const buildPreviewToolResult = (toolRuns: ToolExecutionRun[]): ToolCallResult | undefined => {
  if (toolRuns.length === 0) return undefined;
  if (toolRuns.length === 1) return toolRuns[0]?.result;

  const content = mergeToolRunText(toolRuns);

  return {
    content,
    state: {
      content: [{ text: content, type: 'text' }],
      isError: toolRuns.some((toolRun) => toolRun.result.state?.isError),
    },
    success: toolRuns.every((toolRun) => toolRun.result.success),
  };
};

const extractChatCompletionText = (completion: OpenAI.ChatCompletion) => {
  const content = completion.choices[0]?.message?.content;

  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  return content
    .map((item) =>
      typeof item === 'string' ? item : item.type === 'text' && 'text' in item ? item.text : '',
    )
    .filter(Boolean)
    .join('\n');
};

const executeStudioAgent = async (params: {
  agentId: string;
  agentName?: string;
  inputTemplate?: string;
  memoryEnabled?: boolean;
  model?: string;
  params?: Record<string, unknown>;
  prompt: string;
  provider?: string;
  serverDB: LobeChatDatabase;
  systemRole?: string;
  userId: string;
}) => {
  const agentModel = new AgentModel(params.serverDB, params.userId);
  const agent = await agentModel.getAgentConfigById(params.agentId);

  if (!agent && !params.model && !params.provider) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Agent "${params.agentId}" was not found.`,
    });
  }

  const provider = params.provider || agent?.provider || DEFAULT_AGENT_CONFIG.provider;
  const model = params.model || agent?.model || DEFAULT_AGENT_CONFIG.model;
  const systemRole = params.systemRole ?? agent?.systemRole ?? '';
  const runtimeParams = {
    ...sanitizeStudioAgentParams(agent?.params),
    ...sanitizeStudioAgentParams(params.params),
  };
  const userMemory = await loadStudioAgentUserMemory({
    enabled: params.memoryEnabled ?? agent?.chatConfig?.memory?.enabled === true,
    serverDB: params.serverDB,
    userId: params.userId,
  });
  const messages = await serverMessagesEngine({
    inputTemplate: params.inputTemplate ?? agent?.chatConfig?.inputTemplate,
    messages: [{ content: params.prompt, role: 'user' }],
    model,
    provider,
    systemRole,
    userMemory,
  });
  const modelRuntime = await initModelRuntimeFromDB(params.serverDB, params.userId, provider);
  const response = await modelRuntime.chat({
    ...runtimeParams,
    messages,
    model,
    stream: false,
  });
  const completion = (await response.json()) as OpenAI.ChatCompletion;

  return {
    agentName: params.agentName || agent?.title || params.agentId,
    content: extractChatCompletionText(completion),
  };
};

export interface WorkflowStudioPreviewResult {
  breakpoint?: WorkflowStudioBreakpoint;
  chatPreview: ReturnType<typeof buildStudioChatPreview>;
  toolResult?: ToolCallResult;
}

export const runWorkflowStudioPreview = async (params: {
  serverDB: LobeChatDatabase;
  processContentBlocks: ProcessContentBlocksFn;
  userId: string;
  workflow: WorkflowStudioPreviewWorkflowInput;
}): Promise<WorkflowStudioPreviewResult> => {
  const { processContentBlocks, serverDB, userId } = params;
  const workflow = normalizeStudioWorkflowDefinition(
    workflowStudioDslSchema.parse(params.workflow),
  );

  ensurePreviewNode(workflow);
  validateWorkflowGraph(workflow);

  const nodeMap = getNodeMap(workflow);
  const incomingEdgeMap = getIncomingEdgeMap(workflow);
  const resultMap = new Map<string, ExecutionResult>();

  const evaluateNode = async (nodeId: string, stack: string[] = []): Promise<ExecutionResult> => {
    const cached = resultMap.get(nodeId);
    if (cached) return cached;

    if (stack.includes(nodeId)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Workflow graph contains a cycle, which the preview runtime does not support.',
      });
    }

    const node = nodeMap.get(nodeId);
    if (!node) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Workflow node "${nodeId}" was not found.`,
      });
    }

    const incomingEdges = [...(incomingEdgeMap.get(nodeId) || [])].sort(
      (left, right) => getTargetPortOrder(left.channel) - getTargetPortOrder(right.channel),
    );
    const parentResults = await Promise.all(
      incomingEdges.map((edge) => evaluateNode(edge.source, [...stack, nodeId])),
    );
    const mergedHumanPrompt = joinTextBlocks(parentResults.map((result) => result.humanPrompt));
    const mergedParentOutput = mergeIncomingOutputText({
      incomingEdges,
      nodeMap,
      parentResults,
    });
    const mergedToolRuns = parentResults.flatMap((result) => result.toolRuns);
    const mergedToolResultText = mergeToolRunText(mergedToolRuns);
    const primaryTransformMode = pickSingleValue(
      parentResults
        .map((result) => result.transformMode)
        .filter((value): value is NonNullable<ExecutionResult['transformMode']> => Boolean(value)),
      (value) => value,
    );
    const primaryTransformPrompt = pickSingleValue(
      parentResults
        .map((result) => result.transformPrompt)
        .filter((value): value is string => Boolean(value)),
      (value) => value,
    );
    const primaryAgentName = pickSingleValue(
      parentResults
        .map((result) => result.agentName)
        .filter((value): value is string => Boolean(value)),
      (value) => value,
    );
    const primaryConnection = pickSingleValue(
      [
        mergedToolRuns.at(-1)?.connection,
        ...parentResults.map((result) => result.connection),
      ].filter((value): value is StudioConnectionConfig => Boolean(value)),
      (value) => value.identifier,
    );
    const primaryToolName = pickSingleValue(
      [mergedToolRuns.at(-1)?.toolName, ...parentResults.map((result) => result.toolName)].filter(
        (value): value is string => Boolean(value),
      ),
      (value) => value,
    );

    let result: ExecutionResult;

    switch (node.type) {
      case 'input': {
        result = {
          channelOutputs: {
            main: node.data.humanPrompt,
          },
          humanPrompt: node.data.humanPrompt,
          outputText: node.data.humanPrompt,
          toolRuns: [],
        };

        break;
      }

      case 'resource': {
        const resourceContent = buildStudioResourceContext({
          content: node.data.content,
          kind: node.data.kind,
          mimeType: node.data.mimeType,
          sizeBytes: node.data.sizeBytes,
          sourceLabel: node.data.sourceLabel || node.data.skillName,
          sourceType: node.data.sourceType,
          sourceUri: node.data.sourceUri || node.data.resourcePath,
          title: node.data.title,
        });

        result = {
          channelOutputs: {
            context: resourceContent,
          },
          humanPrompt: '',
          outputText: resourceContent,
          toolRuns: mergedToolRuns,
          toolName: primaryToolName,
        };

        break;
      }

      case 'skill': {
        result = {
          channelOutputs: {
            context: node.data.content,
          },
          humanPrompt: '',
          outputText: node.data.content,
          toolRuns: mergedToolRuns,
          toolName: primaryToolName,
        };

        break;
      }

      case 'agent': {
        if (!node.data.agentId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Agent battery "${node.id}" does not have an agent selected.`,
          });
        }

        const upstreamResult = mergedParentOutput || mergedToolResultText || mergedHumanPrompt;
        const resolvedPrompt = resolveStudioTemplateString({
          humanPrompt: mergedHumanPrompt,
          serverIdentifier: primaryConnection?.identifier,
          template: node.data.prompt,
          toolName: primaryToolName,
          toolResult: mergedToolResultText,
          upstreamResult,
        });
        const agentResult = await executeStudioAgent({
          agentId: node.data.agentId,
          agentName: node.data.agentName,
          inputTemplate: node.data.inputTemplate,
          memoryEnabled: node.data.memoryEnabled,
          model: node.data.model,
          params: node.data.params,
          prompt: resolvedPrompt,
          provider: node.data.provider,
          serverDB,
          systemRole: node.data.systemRole,
          userId,
        });

        result = {
          agentName: agentResult.agentName || node.data.agentName,
          channelOutputs: {
            handoff: agentResult.content,
            main: agentResult.content,
          },
          connection: primaryConnection,
          humanPrompt: mergedHumanPrompt,
          outputText: agentResult.content,
          toolName: primaryToolName,
          toolRuns: mergedToolRuns,
        };

        break;
      }

      case 'mcp-tool': {
        if (!node.data.connection) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Tool battery "${node.id}" does not have an MCP server attached.`,
          });
        }

        if (!node.data.toolName) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Tool battery "${node.id}" does not have a tool selected.`,
          });
        }
        const connection = node.data.connection;

        const payload = incomingEdges.reduce<unknown>((currentPayload, edge, index) => {
          const parentResult = parentResults[index];
          const fallbackBindings =
            incomingEdges.length === 1 &&
            (!edge.payloadBindings || edge.payloadBindings.length === 0)
              ? node.data.payloadBindings
              : undefined;

          return applyStudioPayloadBindings({
            bindings: edge.payloadBindings?.length ? edge.payloadBindings : fallbackBindings,
            humanPrompt: parentResult?.humanPrompt || '',
            payload: currentPayload,
            serverIdentifier: connection.identifier,
            toolName: node.data.toolName,
            upstreamResult: getExecutionEdgeText({
              edge,
              nodeMap,
              result: parentResult,
            }),
          });
        }, node.data.payload);
        const toolResult = await mcpService.callTool({
          argsStr: JSON.stringify(payload ?? {}),
          clientParams: createClientParams(connection),
          processContentBlocks,
          toolName: node.data.toolName,
        });
        const toolRun: ToolExecutionRun = {
          connection,
          nodeId: node.id,
          nodeTitle: node.data.title || node.id,
          result: toolResult,
          toolName: node.data.toolName,
        };

        result = {
          channelOutputs: {
            main: toolResult.content,
          },
          connection,
          humanPrompt: mergedHumanPrompt,
          outputText: toolResult.content,
          toolRuns: [...mergedToolRuns, toolRun],
          toolName: node.data.toolName,
        };

        break;
      }

      case 'transform': {
        const upstreamResult = mergedParentOutput || mergedToolResultText;
        const resolvedPrompt = resolveStudioTemplateString({
          humanPrompt: mergedHumanPrompt,
          serverIdentifier: primaryConnection?.identifier,
          template: node.data.prompt,
          toolName: primaryToolName,
          toolResult: mergedToolResultText,
          upstreamResult,
        });

        result = {
          connection: primaryConnection,
          channelOutputs: {
            main: node.data.mode === 'template' ? resolvedPrompt : upstreamResult || resolvedPrompt,
          },
          humanPrompt: mergedHumanPrompt,
          outputText:
            node.data.mode === 'template' ? resolvedPrompt : upstreamResult || resolvedPrompt,
          agentName: primaryAgentName,
          toolRuns: mergedToolRuns,
          toolName: primaryToolName,
          transformMode: node.data.mode,
          transformPrompt: resolvedPrompt,
        };

        break;
      }

      case 'chat-output': {
        result = {
          agentName: primaryAgentName,
          channelOutputs: {
            main: mergedParentOutput || mergedToolResultText,
          },
          connection: primaryConnection,
          humanPrompt: mergedHumanPrompt,
          outputText: mergedParentOutput || mergedToolResultText,
          toolRuns: mergedToolRuns,
          toolName: primaryToolName,
          transformMode: primaryTransformMode,
          transformPrompt: primaryTransformPrompt,
        };

        break;
      }
    }

    if (
      supportsStudioNodeBreakpoint(node.type) &&
      node.id !== workflow.previewNodeId &&
      'breakpoint' in node.data &&
      node.data.breakpoint === true
    ) {
      throw new WorkflowStudioBreakpointError({
        nodeId: node.id,
        nodeTitle: node.data.title || node.id,
        nodeType: node.type,
        result,
      });
    }

    resultMap.set(nodeId, result);

    return result;
  };

  let breakpoint: WorkflowStudioBreakpoint | undefined;
  let finalResult: ExecutionResult;

  try {
    finalResult = await evaluateNode(workflow.previewNodeId);
  } catch (error) {
    if (!(error instanceof WorkflowStudioBreakpointError)) throw error;

    breakpoint = {
      nodeId: error.snapshot.nodeId,
      nodeTitle: error.snapshot.nodeTitle,
      nodeType: error.snapshot.nodeType,
    };
    finalResult = error.snapshot.result;
  }

  return {
    breakpoint,
    chatPreview: buildStudioChatPreview({
      connection: finalResult.connection,
      humanPrompt: finalResult.humanPrompt,
      result: finalResult.outputText,
      success:
        buildPreviewToolResult(finalResult.toolRuns)?.success ?? Boolean(finalResult.outputText),
      toolName: finalResult.agentName || finalResult.toolName,
      transformMode: finalResult.transformMode,
      transformPrompt: finalResult.transformPrompt,
    }),
    toolResult: buildPreviewToolResult(finalResult.toolRuns),
  };
};
