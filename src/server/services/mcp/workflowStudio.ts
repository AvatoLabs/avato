import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { type MCPClientParams } from '@/libs/mcp';
import {
  applyStudioPayloadBindings,
  buildStudioChatPreview,
  resolveStudioTemplateString,
  type StudioConnectionConfig,
} from '@/libs/mcp/workflowStudio';

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
    connection: workflowStudioConnectionSchema.optional(),
    payload: z.unknown(),
    payloadBindings: z.array(workflowStudioPayloadBindingSchema).default([]),
    title: z.string().optional(),
    toolName: z.string().optional(),
  }),
  id: z.string().min(1),
  type: z.literal('mcp-tool'),
});

const workflowStudioTransformNodeSchema = z.object({
  data: z.object({
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
    resourcePath: z.string().optional(),
    skillId: z.string().optional(),
    skillName: z.string().optional(),
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

const mergeIncomingOutputText = (params: {
  incomingEdges: WorkflowStudioPreviewWorkflow['edges'];
  nodeMap: Map<string, WorkflowStudioPreviewWorkflow['nodes'][number]>;
  parentResults: ExecutionResult[];
}) =>
  params.incomingEdges
    .map((edge, index) => {
      const text = params.parentResults[index]?.outputText?.trim();
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

const getTargetPortOrder = (
  nodeType: WorkflowStudioPreviewWorkflow['nodes'][number]['type'],
  portId?: string,
) => {
  const orderMap: Record<string, number> =
    nodeType === 'mcp-tool'
      ? { config: 2, context: 1, primary: 0 }
      : nodeType === 'transform'
        ? { context: 1, primary: 0 }
        : nodeType === 'chat-output'
          ? { context: 1, message: 0 }
          : {};

  return orderMap[portId || ''] ?? 99;
};

const pickSingleValue = <T>(values: T[], getKey: (value: T) => string | undefined) => {
  const keyedValues = values
    .map((value) => ({ key: getKey(value), value }))
    .filter((item): item is { key: string; value: T } => Boolean(item.key));

  if (keyedValues.length === 0) return undefined;

  const uniqueKeys = new Set(keyedValues.map((item) => item.key));
  if (uniqueKeys.size !== 1) return undefined;

  return keyedValues[0]?.value;
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

export interface WorkflowStudioPreviewResult {
  chatPreview: ReturnType<typeof buildStudioChatPreview>;
  toolResult?: ToolCallResult;
}

export const runWorkflowStudioPreview = async (params: {
  processContentBlocks: ProcessContentBlocksFn;
  workflow: WorkflowStudioPreviewWorkflowInput;
}): Promise<WorkflowStudioPreviewResult> => {
  const { processContentBlocks } = params;
  const workflow = workflowStudioDslSchema.parse(params.workflow);

  ensurePreviewNode(workflow);

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
      (left, right) =>
        getTargetPortOrder(node.type, left.targetPortId) -
        getTargetPortOrder(node.type, right.targetPortId),
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
          humanPrompt: node.data.humanPrompt,
          outputText: node.data.humanPrompt,
          toolRuns: [],
        };

        break;
      }

      case 'resource': {
        result = {
          humanPrompt: '',
          outputText: node.data.content,
          toolRuns: mergedToolRuns,
          toolName: primaryToolName,
        };

        break;
      }

      case 'skill': {
        result = {
          humanPrompt: '',
          outputText: node.data.content,
          toolRuns: mergedToolRuns,
          toolName: primaryToolName,
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
            upstreamResult: parentResult?.outputText,
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
          humanPrompt: mergedHumanPrompt,
          outputText:
            node.data.mode === 'template' ? resolvedPrompt : upstreamResult || resolvedPrompt,
          toolRuns: mergedToolRuns,
          toolName: primaryToolName,
          transformMode: node.data.mode,
          transformPrompt: resolvedPrompt,
        };

        break;
      }

      case 'chat-output': {
        result = {
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

    resultMap.set(nodeId, result);

    return result;
  };

  const finalResult = await evaluateNode(workflow.previewNodeId);

  return {
    chatPreview: buildStudioChatPreview({
      connection: finalResult.connection,
      humanPrompt: finalResult.humanPrompt,
      result: finalResult.outputText,
      success:
        buildPreviewToolResult(finalResult.toolRuns)?.success ?? Boolean(finalResult.outputText),
      toolName: finalResult.toolName,
      transformMode: finalResult.transformMode,
      transformPrompt: finalResult.transformPrompt,
    }),
    toolResult: buildPreviewToolResult(finalResult.toolRuns),
  };
};
