import { type LobeTool } from '@lobechat/types';

import {
  resolveStudioEdgeChannel,
  type StudioConnectionConfig,
  type StudioNodeType,
} from '@/libs/mcp/workflowStudio';
import { nanoid } from '@/utils/uuid';

interface WorkflowStudioSavedWorkflowDraft {
  [key: string]: unknown;
}

export interface WorkflowStudioSavedWorkflow {
  createdAt: number;
  draft: WorkflowStudioSavedWorkflowDraft;
  id: string;
  name: string;
  updatedAt: number;
}

export interface WorkflowStudioInstalledServerTool {
  description?: string;
  name: string;
  parameters?: unknown;
}

export interface WorkflowStudioInstalledServer {
  avatar?: string;
  connection: StudioConnectionConfig;
  createdAt: number;
  description?: string;
  id: string;
  name: string;
  origin: 'installed';
  tools: WorkflowStudioInstalledServerTool[];
  updatedAt: number;
}

interface WorkflowStudioSettingsState {
  workflows: WorkflowStudioSavedWorkflow[];
}

const WORKFLOW_STUDIO_SETTINGS_KEY = 'workflowStudio';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isWorkflowDraft = (value: unknown): value is WorkflowStudioSavedWorkflowDraft =>
  isRecord(value);

const STUDIO_NODE_TYPES = new Set<StudioNodeType>([
  'agent',
  'chat-output',
  'input',
  'mcp-tool',
  'resource',
  'skill',
  'transform',
]);

const isStudioNodeType = (value: unknown): value is StudioNodeType =>
  typeof value === 'string' && STUDIO_NODE_TYPES.has(value as StudioNodeType);

const parseWorkflowPayloadBindings = (value: unknown) => {
  if (!Array.isArray(value)) return [];

  return value.reduce<Array<{ id: string; source: string; targetPath: string }>>((acc, item) => {
    if (!isRecord(item) || typeof item.id !== 'string') return acc;

    acc.push({
      id: item.id,
      source: typeof item.source === 'string' ? item.source : 'humanPrompt',
      targetPath: typeof item.targetPath === 'string' ? item.targetPath : '',
    });

    return acc;
  }, []);
};

const normalizeWorkflowStudioDraft = (draft: WorkflowStudioSavedWorkflowDraft) => {
  const nodes = Array.isArray(draft.nodes)
    ? draft.nodes.reduce<Array<Record<string, unknown> & { id: string; type: StudioNodeType }>>(
        (acc, item) => {
          if (!isRecord(item) || typeof item.id !== 'string' || !isStudioNodeType(item.type)) {
            return acc;
          }

          acc.push({
            ...item,
            id: item.id,
            type: item.type,
          });

          return acc;
        },
        [],
      )
    : [];
  const nodeTypeMap = new Map(nodes.map((node) => [node.id, node.type]));
  const edges = Array.isArray(draft.edges)
    ? draft.edges.reduce<Array<Record<string, unknown>>>((acc, item) => {
        if (
          !isRecord(item) ||
          typeof item.id !== 'string' ||
          typeof item.source !== 'string' ||
          typeof item.target !== 'string'
        ) {
          return acc;
        }

        const sourceType = nodeTypeMap.get(item.source);
        const targetType = nodeTypeMap.get(item.target);
        if (!sourceType || !targetType) return acc;

        acc.push({
          channel: resolveStudioEdgeChannel({
            channel: typeof item.channel === 'string' ? item.channel : undefined,
            sourcePortId: typeof item.sourcePortId === 'string' ? item.sourcePortId : undefined,
            sourceType,
            targetPortId: typeof item.targetPortId === 'string' ? item.targetPortId : undefined,
            targetType,
          }),
          id: item.id,
          payloadBindings: parseWorkflowPayloadBindings(item.payloadBindings),
          source: item.source,
          target: item.target,
        });

        return acc;
      }, [])
    : [];

  return {
    ...draft,
    edges,
    nodes,
    previewNodeId: typeof draft.previewNodeId === 'string' ? draft.previewNodeId : undefined,
    selectedNodeId: typeof draft.selectedNodeId === 'string' ? draft.selectedNodeId : undefined,
    servers: Array.isArray(draft.servers)
      ? draft.servers.filter((item): item is Record<string, unknown> => isRecord(item))
      : [],
  } satisfies WorkflowStudioSavedWorkflowDraft;
};

const parseWorkflow = (value: unknown): WorkflowStudioSavedWorkflow | undefined => {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    !isWorkflowDraft(value.draft)
  ) {
    return undefined;
  }

  return {
    createdAt: Number(value.createdAt || 0),
    draft: normalizeWorkflowStudioDraft(value.draft),
    id: value.id,
    name: value.name,
    updatedAt: Number(value.updatedAt || 0),
  };
};

export const parseWorkflowStudioSettingsState = (
  toolSettings: unknown,
): WorkflowStudioSettingsState => {
  if (!isRecord(toolSettings)) return { workflows: [] };

  const rawState = toolSettings[WORKFLOW_STUDIO_SETTINGS_KEY];
  if (!isRecord(rawState) || !Array.isArray(rawState.workflows)) return { workflows: [] };

  return {
    workflows: rawState.workflows
      .map(parseWorkflow)
      .filter((item): item is WorkflowStudioSavedWorkflow => Boolean(item))
      .sort((left, right) => right.updatedAt - left.updatedAt),
  };
};

export const applyWorkflowStudioSettingsState = (
  toolSettings: unknown,
  state: WorkflowStudioSettingsState,
) => {
  const nextToolSettings = isRecord(toolSettings) ? { ...toolSettings } : {};

  return {
    ...nextToolSettings,
    [WORKFLOW_STUDIO_SETTINGS_KEY]: state,
  };
};

export const upsertWorkflowStudioWorkflow = (params: {
  draft: WorkflowStudioSavedWorkflowDraft;
  id?: string;
  name: string;
  now?: number;
  state: WorkflowStudioSettingsState;
}) => {
  const now = params.now ?? Date.now();
  const name = params.name.trim();
  const existing = params.id
    ? params.state.workflows.find((item) => item.id === params.id)
    : undefined;
  const entry: WorkflowStudioSavedWorkflow = existing
    ? {
        ...existing,
        draft: normalizeWorkflowStudioDraft(params.draft),
        name,
        updatedAt: now,
      }
    : {
        createdAt: now,
        draft: normalizeWorkflowStudioDraft(params.draft),
        id: params.id || `wf_${nanoid(10)}`,
        name,
        updatedAt: now,
      };

  const workflows = [...params.state.workflows.filter((item) => item.id !== entry.id), entry].sort(
    (left, right) => right.updatedAt - left.updatedAt,
  );

  return {
    entry,
    state: { workflows },
  };
};

export const removeWorkflowStudioWorkflow = (params: {
  id: string;
  state: WorkflowStudioSettingsState;
}): WorkflowStudioSettingsState => ({
  workflows: params.state.workflows.filter((item) => item.id !== params.id),
});

export const extractInstalledWorkflowStudioServers = (
  plugins: LobeTool[],
): WorkflowStudioInstalledServer[] => {
  const now = Date.now();

  return plugins
    .flatMap((plugin) => {
      const mcp = plugin.customParams?.mcp;
      if (!mcp || (mcp.type !== 'http' && mcp.type !== 'stdio')) return [];

      const manifestTools = Array.isArray(plugin.manifest?.api) ? plugin.manifest.api : [];
      const tools = manifestTools.reduce<WorkflowStudioInstalledServerTool[]>((acc, item) => {
        if (!item || typeof item.name !== 'string') return acc;

        acc.push({
          description: typeof item.description === 'string' ? item.description : undefined,
          name: item.name,
          parameters: item.parameters,
        });

        return acc;
      }, []);

      const connection: StudioConnectionConfig =
        mcp.type === 'http'
          ? {
              authType: mcp.auth?.type,
              headers: mcp.headers,
              identifier: plugin.identifier,
              token: mcp.auth?.type === 'oauth2' ? mcp.auth.accessToken : mcp.auth?.token,
              type: 'http',
              url: mcp.url || '',
            }
          : {
              args: mcp.args || [],
              command: mcp.command || '',
              env: mcp.env,
              identifier: plugin.identifier,
              type: 'stdio',
            };

      return [
        {
          avatar: plugin.manifest?.meta?.avatar,
          connection,
          createdAt: now,
          description: plugin.manifest?.meta?.description,
          id: plugin.identifier,
          name:
            plugin.manifest?.meta?.title ||
            (typeof (plugin.manifest as { name?: unknown } | null | undefined)?.name === 'string'
              ? ((plugin.manifest as { name?: string }).name as string)
              : plugin.identifier),
          origin: 'installed' as const,
          tools,
          updatedAt: now,
        },
      ];
    })
    .sort((left, right) => left.name.localeCompare(right.name));
};
