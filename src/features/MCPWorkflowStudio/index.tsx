'use client';

import { DEFAULT_AGENT_CONFIG, isDesktop } from '@lobechat/const';
import { type LobeAgentConfig, type SkillListItem } from '@lobechat/types';
import { type LobeChatPluginManifest } from '@lobehub/chat-plugin-sdk';
import { Avatar, Button, Flexbox, Icon, Markdown, Segmented, Tag, Text } from '@lobehub/ui';
import { Alert, App, Input, Modal, Select, Switch } from 'antd';
import { type TextAreaRef } from 'antd/es/input/TextArea';
import { useResponsive } from 'antd-style';
import {
  ArrowRight,
  BookOpen,
  Bot,
  Cable,
  CirclePlus,
  FileText,
  Globe,
  Image as ImageIcon,
  Link2Off,
  Minus,
  Play,
  PlugZap,
  RotateCcw,
  ScanSearch,
  Sparkles,
  TerminalSquare,
  Trash2,
  Upload,
  Wrench,
  ZoomIn,
} from 'lucide-react';
import {
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  startTransition,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Rnd, type RndDragCallback } from 'react-rnd';

import ModelSelect from '@/features/ModelSelect';
import {
  HUMAN_PROMPT_VARIABLE,
  resolveStudioEdgeChannel,
  SERVER_IDENTIFIER_VARIABLE,
  type StudioChatPreview,
  type StudioPayloadBindingSource,
  type StudioResourceKind,
  supportsStudioNodeBreakpoint,
  TOOL_NAME_VARIABLE,
  TOOL_RESULT_VARIABLE,
  UPSTREAM_RESULT_VARIABLE,
} from '@/libs/mcp/workflowStudio';
import { lambdaClient, toolsClient } from '@/libs/trpc/client';
import { agentService } from '@/services/agent';
import { mcpService } from '@/services/mcp';
import { agentSkillService } from '@/services/skill';

import {
  autoLayoutStudioNodes,
  buildConnectorPath,
  buildConnectorPathFromPoints,
  buildDefaultToolArguments,
  buildStudioDraft,
  buildWorkflowDefinition,
  buildWorkflowDsl,
  clampNodePositions,
  createDefaultStudioDraft,
  createStudioNode,
  createStudioPayloadBinding,
  estimateNodeSize,
  findExistingStudioEdge,
  findStudioConnectionTarget,
  flattenStudioSkillResources,
  getNodeInputAnchor,
  getNodeInputPorts,
  getNodeOutputAnchor,
  getNodeOutputPorts,
  getPreferredStudioTargetPortId,
  getStudioAutoNodeTitle,
  getStudioConnectableInputPorts,
  getStudioConnectionState,
  getSuggestedStudioNodePosition,
  insertBindingToken,
  mergeStudioServers,
  parseStudioDraft,
  parseStudioWorkflowLibrary,
  resolveStudioInputPortId,
  resolveStudioOutputPortId,
  shouldStudioReplaceTargetPortEdges,
  shouldStudioSyncNodeTitle,
  STUDIO_DEFAULT_CANVAS_BOUNDS,
  STUDIO_STORAGE_KEY,
  type StudioCanvasNode,
  type StudioConnectionConfig,
  type StudioDraft,
  type StudioLoadedServer,
  type StudioNodePosition,
  type StudioSavedToolDefinition,
  type StudioSavedWorkflow,
} from './helpers';
import { styles } from './style';

interface StudioManifest extends LobeChatPluginManifest {}

interface StudioToolResult {
  content: string;
  state?: {
    content: unknown[];
    isError?: boolean;
  };
  success: boolean;
}

interface StudioAvailableAgent {
  avatar?: string | null;
  backgroundColor?: string | null;
  description?: string | null;
  id: string;
  title?: string | null;
}

type StudioAgentDetail = Pick<
  LobeAgentConfig,
  'chatConfig' | 'model' | 'params' | 'provider' | 'systemRole' | 'title'
>;

interface StudioPaletteState {
  x: number;
  y: number;
}

interface StudioPendingConnection {
  currentPosition: StudioNodePosition;
  sourceId: string;
  sourcePortId: string;
  targetId?: string;
  targetPortId?: string;
}

interface StudioBreakpointInfo {
  nodeId: string;
  nodeTitle: string;
  nodeType: StudioCanvasNode['type'];
}

interface StudioSelectionBox {
  additive: boolean;
  currentPosition: StudioNodePosition;
  origin: StudioNodePosition;
}

interface StudioViewport {
  x: number;
  y: number;
  zoom: number;
}

interface StudioHttpConnectionForm {
  authType: 'bearer' | 'none' | 'oauth2';
  headers: string;
  identifier: string;
  token: string;
  url: string;
}

interface StudioStdioConnectionForm {
  args: string;
  command: string;
  env: string;
  identifier: string;
}

const defaultHttpConnection: StudioHttpConnectionForm = {
  authType: 'none',
  headers: '{}',
  identifier: 'custom-http-mcp',
  token: '',
  url: '',
};

const defaultStdioConnection: StudioStdioConnectionForm = {
  args: '[]',
  command: 'npx',
  env: '{}',
  identifier: 'custom-stdio-mcp',
};

const STUDIO_MIN_ZOOM = 0.55;
const STUDIO_MAX_ZOOM = 1.8;
const STUDIO_ZOOM_STEP = 0.12;
const STUDIO_DEFAULT_VIEWPORT: StudioViewport = { x: 48, y: 32, zoom: 1 };

const parseStringArray = (value: string, invalidMessage: string) => {
  if (!value.trim()) return [];

  const parsed = JSON.parse(value);

  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string')) {
    throw new Error(invalidMessage);
  }

  return parsed;
};

const parseStringRecord = (value: string, invalidMessage: string) => {
  if (!value.trim()) return undefined;

  const parsed = JSON.parse(value);

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(invalidMessage);
  }

  return Object.fromEntries(
    Object.entries(parsed).map(([key, recordValue]) => [key, String(recordValue)]),
  );
};

const createNodeSummary = (
  node: StudioCanvasNode,
  agents: StudioAvailableAgent[],
  servers: StudioLoadedServer[],
  t: (key: string) => string,
) => {
  const getResourceKindLabel = (kind: StudioResourceKind) => t(`mcpStudio.resource.kind.${kind}`);
  const formatPromptPreview = (value?: string) => {
    if (!value?.trim()) return undefined;

    return value
      .replaceAll(/\}\}\s*\{\{/g, '}} · {{')
      .replaceAll(HUMAN_PROMPT_VARIABLE, t('mcpStudio.variables.humanPrompt'))
      .replaceAll(SERVER_IDENTIFIER_VARIABLE, t('mcpStudio.variables.serverIdentifier'))
      .replaceAll(TOOL_NAME_VARIABLE, t('mcpStudio.variables.toolName'))
      .replaceAll(TOOL_RESULT_VARIABLE, t('mcpStudio.variables.toolResult'))
      .replaceAll(UPSTREAM_RESULT_VARIABLE, t('mcpStudio.variables.upstreamResult'))
      .replaceAll(/\{\{([^}]+)\}\}/g, '$1')
      .replaceAll(/[ \t]*\n[ \t]*/g, '\n')
      .replaceAll(/\n{3,}/g, '\n\n')
      .trim();
  };

  switch (node.type) {
    case 'input': {
      return node.data.humanPrompt || t('mcpStudio.summary.input');
    }
    case 'agent': {
      const agent = node.data.agentId
        ? agents.find((item) => item.id === node.data.agentId)
        : undefined;
      const agentLabel = node.data.agentName || agent?.title;
      const promptPreview = formatPromptPreview(node.data.prompt);

      if (!agentLabel) return t('mcpStudio.summary.agent');

      return (
        [agentLabel, promptPreview].filter(Boolean).join(' · ') || t('mcpStudio.summary.agent')
      );
    }
    case 'resource': {
      const label =
        node.data.sourceLabel || node.data.sourceUri || node.data.skillName || node.data.title;
      const summary = [
        getResourceKindLabel(node.data.kind),
        label !== node.data.title ? label : undefined,
        node.data.mimeType,
        node.data.content ? t('mcpStudio.summary.resourceImported') : undefined,
      ]
        .filter(Boolean)
        .join(' · ');

      if (summary) return summary;

      return (
        formatPromptPreview(node.data.content)?.slice(0, 160) || t('mcpStudio.summary.resource')
      );
    }
    case 'skill': {
      return (
        [node.data.skillName, node.data.content ? t('mcpStudio.summary.skillImported') : undefined]
          .filter(Boolean)
          .join(' · ') || t('mcpStudio.summary.skill')
      );
    }
    case 'mcp-tool': {
      const server = node.data.serverId
        ? servers.find((item) => item.id === node.data.serverId)
        : undefined;
      return (
        [server?.name, node.data.toolName].filter(Boolean).join(' · ') ||
        t('mcpStudio.summary.tool')
      );
    }
    case 'transform': {
      return formatPromptPreview(node.data.prompt) || t('mcpStudio.summary.transform');
    }
    case 'chat-output': {
      return t('mcpStudio.summary.chat');
    }
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const stringifyStudioAgentParams = (value: unknown) =>
  isRecord(value) ? JSON.stringify(value, null, 2) : '{}';

const getSkillAvatar = (skill?: SkillListItem) => {
  if (!skill) return undefined;

  const manifest = isRecord(skill.manifest) ? skill.manifest : undefined;
  if (typeof manifest?.avatar === 'string') return manifest.avatar;

  const meta = isRecord(manifest?.meta) ? manifest.meta : undefined;
  return typeof meta?.avatar === 'string' ? meta.avatar : undefined;
};

const initialDraft = createDefaultStudioDraft();

const isPromptEditableNode = (
  node: StudioCanvasNode | undefined,
): node is Extract<StudioCanvasNode, { type: 'agent' | 'transform' }> =>
  node?.type === 'agent' || node?.type === 'transform';

const getNodeTypeIcon = (
  node: StudioCanvasNode,
  toolConnectionType?: StudioLoadedServer['connection']['type'],
) =>
  node.type === 'input'
    ? Cable
    : node.type === 'resource'
      ? node.data.kind === 'image'
        ? ImageIcon
        : FileText
      : node.type === 'skill'
        ? BookOpen
        : node.type === 'agent'
          ? Bot
          : node.type === 'transform'
            ? Sparkles
            : node.type === 'chat-output'
              ? Bot
              : toolConnectionType === 'stdio'
                ? TerminalSquare
                : Globe;

const toggleSelectionValue = (values: string[], value: string) =>
  values.includes(value) ? values.filter((item) => item !== value) : [...values, value];

const areStudioSelectionsEqual = (left: string[], right: string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const areStudioCanvasBoundsEqual = (
  left: { height: number; width: number },
  right: { height: number; width: number },
) => left.height === right.height && left.width === right.width;

const areStudioNodePositionsEqual = (left: StudioCanvasNode[], right: StudioCanvasNode[]) =>
  left.length === right.length &&
  left.every(
    (node, index) =>
      node.id === right[index]?.id &&
      node.position.x === right[index]?.position.x &&
      node.position.y === right[index]?.position.y,
  );

const areStudioPointsEqual = (left: StudioNodePosition, right: StudioNodePosition) =>
  left.x === right.x && left.y === right.y;

const clampStudioZoom = (zoom: number) =>
  Math.min(STUDIO_MAX_ZOOM, Math.max(STUDIO_MIN_ZOOM, Number.isFinite(zoom) ? zoom : 1));

const MCPWorkflowStudio = () => {
  const { t } = useTranslation('setting');
  const { message } = App.useApp();
  const { mobile } = useResponsive();
  const canvasRef = useRef<HTMLDivElement>(null);
  const resourceFileInputRef = useRef<HTMLInputElement>(null);
  const pendingConnectionRef = useRef<StudioPendingConnection | undefined>(undefined);
  const promptTextareaRef = useRef<TextAreaRef>(null);
  const viewportRef = useRef<StudioViewport>(STUDIO_DEFAULT_VIEWPORT);
  const viewportInitializedRef = useRef(false);
  const panSessionRef = useRef<
    | {
        originPointer: StudioNodePosition;
        originViewport: StudioViewport;
      }
    | undefined
  >(undefined);
  const selectionBoxRef = useRef<StudioSelectionBox | undefined>(undefined);

  const [nodes, setNodes] = useState<StudioCanvasNode[]>(initialDraft.nodes);
  const [edges, setEdges] = useState(initialDraft.edges);
  const [servers, setServers] = useState<StudioLoadedServer[]>([]);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>(
    initialDraft.selectedNodeId ? [initialDraft.selectedNodeId] : [],
  );
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);
  const [previewNodeId, setPreviewNodeId] = useState<string | undefined>(
    initialDraft.previewNodeId,
  );
  const [palette, setPalette] = useState<StudioPaletteState>();
  const [pendingConnection, setPendingConnection] = useState<StudioPendingConnection>();
  const [selectionBox, setSelectionBox] = useState<StudioSelectionBox>();
  const [viewport, setViewport] = useState<StudioViewport>(STUDIO_DEFAULT_VIEWPORT);
  const [editingNodeId, setEditingNodeId] = useState<string>();
  const [renamingNodeId, setRenamingNodeId] = useState<string>();
  const [spacePressed, setSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [canvasBounds, setCanvasBounds] = useState<{ height: number; width: number }>(
    STUDIO_DEFAULT_CANVAS_BOUNDS,
  );
  const [workflowLibrary, setWorkflowLibrary] = useState<StudioSavedWorkflow[]>([]);
  const [availableAgents, setAvailableAgents] = useState<StudioAvailableAgent[]>([]);
  const [agentConfigMap, setAgentConfigMap] = useState<Record<string, StudioAgentDetail>>({});
  const [availableSkills, setAvailableSkills] = useState<SkillListItem[]>([]);
  const [skillResources, setSkillResources] = useState<
    Record<string, Array<{ label: string; value: string }>>
  >({});
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>();
  const [workflowName, setWorkflowName] = useState('');
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [serverModalOpen, setServerModalOpen] = useState(false);
  const [connectionMode, setConnectionMode] = useState<'http' | 'stdio'>('http');
  const [httpForm, setHttpForm] = useState<StudioHttpConnectionForm>(defaultHttpConnection);
  const [stdioForm, setStdioForm] = useState<StudioStdioConnectionForm>(defaultStdioConnection);
  const [workflowSaving, setWorkflowSaving] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);
  const [runLoading, setRunLoading] = useState(false);
  const [toolResult, setToolResult] = useState<StudioToolResult>();
  const [executedChatPreview, setExecutedChatPreview] = useState<StudioChatPreview>();
  const [breakpointInfo, setBreakpointInfo] = useState<StudioBreakpointInfo>();
  const [lastRunAt, setLastRunAt] = useState<string>();
  const [errorMessage, setErrorMessage] = useState<string>();

  const draft = useMemo<StudioDraft>(
    () => ({
      edges,
      nodes,
      previewNodeId,
      selectedNodeId:
        selectedNodeIds.length === 1 && selectedEdgeIds.length === 0
          ? selectedNodeIds[0]
          : undefined,
      servers,
    }),
    [edges, nodes, previewNodeId, selectedEdgeIds.length, selectedNodeIds, servers],
  );
  const getNode = (id?: string) => nodes.find((node) => node.id === id);
  const sanitizedDraft = useMemo(() => buildStudioDraft(draft), [draft]);
  const selectedNode =
    selectedNodeIds.length === 1 && selectedEdgeIds.length === 0
      ? nodes.find((node) => node.id === selectedNodeIds[0])
      : undefined;
  const selectedEdge =
    selectedEdgeIds.length === 1 && selectedNodeIds.length === 0
      ? edges.find((edge) => edge.id === selectedEdgeIds[0])
      : undefined;
  const selectedEdgeSourceNode = selectedEdge
    ? nodes.find((node) => node.id === selectedEdge.source)
    : undefined;
  const selectedEdgeTargetNode = selectedEdge
    ? nodes.find((node) => node.id === selectedEdge.target)
    : undefined;
  const selectedToolNode = selectedNode?.type === 'mcp-tool' ? selectedNode : undefined;
  const selectedAgentNode = selectedNode?.type === 'agent' ? selectedNode : undefined;
  const selectedSkillNode = selectedNode?.type === 'skill' ? selectedNode : undefined;
  const selectedPromptNode = isPromptEditableNode(selectedNode) ? selectedNode : undefined;
  const selectedServer = selectedToolNode?.data.serverId
    ? servers.find((item) => item.id === selectedToolNode.data.serverId)
    : undefined;
  const selectedTool = selectedServer?.tools.find(
    (item) => item.name === selectedToolNode?.data.toolName,
  );
  const selectedAgent = selectedAgentNode?.data.agentId
    ? availableAgents.find((item) => item.id === selectedAgentNode.data.agentId)
    : undefined;
  const selectedAgentConfig = selectedAgentNode?.data.agentId
    ? agentConfigMap[selectedAgentNode.data.agentId]
    : undefined;
  const selectedSkill = selectedSkillNode?.data.skillId
    ? availableSkills.find((item) => item.id === selectedSkillNode.data.skillId)
    : undefined;
  const selectedWorkflow = workflowLibrary.find((item) => item.id === selectedWorkflowId);
  const previewNode = previewNodeId ? nodes.find((node) => node.id === previewNodeId) : undefined;
  const installedServers = servers.filter((server) => server.origin === 'installed');
  const selectedResourceNode = selectedNode?.type === 'resource' ? selectedNode : undefined;
  const pendingSourceNode = pendingConnection?.sourceId
    ? getNode(pendingConnection.sourceId)
    : undefined;
  const pendingTargetNode = pendingConnection?.targetId
    ? getNode(pendingConnection.targetId)
    : undefined;
  const pendingSourcePortId = pendingConnection?.sourcePortId;
  const pendingTargetPortId = pendingConnection?.targetPortId;
  const selectedResourceOptions = selectedResourceNode?.data.skillId
    ? skillResources[selectedResourceNode.data.skillId] || []
    : [];
  const selectionCount = selectedNodeIds.length + selectedEdgeIds.length;
  const isMultiAgentMode = nodes.filter((node) => node.type === 'agent').length > 1;
  const effectiveAgentProvider =
    selectedAgentNode?.data.provider ||
    selectedAgentConfig?.provider ||
    DEFAULT_AGENT_CONFIG.provider;
  const effectiveAgentModel =
    selectedAgentNode?.data.model || selectedAgentConfig?.model || DEFAULT_AGENT_CONFIG.model;
  const effectiveAgentSystemRole =
    selectedAgentNode?.data.systemRole ?? selectedAgentConfig?.systemRole ?? '';
  const effectiveAgentParams =
    selectedAgentNode?.data.params || stringifyStudioAgentParams(selectedAgentConfig?.params);
  const effectiveAgentMemoryEnabled =
    selectedAgentNode?.data.memoryEnabled ??
    selectedAgentConfig?.chatConfig?.memory?.enabled === true;
  const syncConcreteNodeTitle = (
    currentNode: StudioCanvasNode,
    nextNode: StudioCanvasNode,
    options?: {
      nextServerName?: string;
      previousServerName?: string;
    },
  ) => {
    const previousAutoTitle = getStudioAutoNodeTitle(currentNode, {
      serverName: options?.previousServerName,
    });
    const nextAutoTitle = getStudioAutoNodeTitle(nextNode, {
      serverName: options?.nextServerName,
    });

    if (
      !shouldStudioSyncNodeTitle({
        currentTitle: currentNode.data.title,
        nextAutoTitle,
        nodeType: currentNode.type,
        previousAutoTitle,
      })
    ) {
      return nextNode;
    }

    return {
      ...nextNode,
      data: {
        ...nextNode.data,
        title: nextAutoTitle,
      },
    };
  };
  const applyAgentConfigSnapshot = useEffectEvent(
    (
      node: Extract<StudioCanvasNode, { type: 'agent' }>,
      agentId: string,
      config?: StudioAgentDetail,
    ): Extract<StudioCanvasNode, { type: 'agent' }> => {
      const fallbackAgent = availableAgents.find((item) => item.id === agentId);

      return syncConcreteNodeTitle(node, {
        ...node,
        data: {
          ...node.data,
          agentId,
          agentName: config?.title || fallbackAgent?.title || agentId,
          inputTemplate: config?.chatConfig?.inputTemplate,
          memoryEnabled: config?.chatConfig?.memory?.enabled === true,
          model: config?.model || DEFAULT_AGENT_CONFIG.model,
          params: stringifyStudioAgentParams(config?.params),
          provider: config?.provider || DEFAULT_AGENT_CONFIG.provider,
          systemRole: config?.systemRole || '',
        },
      }) as Extract<StudioCanvasNode, { type: 'agent' }>;
    },
  );
  const workflowDsl = useMemo(
    () =>
      buildWorkflowDsl({
        draft,
        previewNodeId,
      }),
    [draft, previewNodeId],
  );
  const transformVariableOptions = [
    { label: t('mcpStudio.variables.humanPrompt'), token: HUMAN_PROMPT_VARIABLE },
    { label: t('mcpStudio.variables.serverIdentifier'), token: SERVER_IDENTIFIER_VARIABLE },
    { label: t('mcpStudio.variables.toolName'), token: TOOL_NAME_VARIABLE },
    { label: t('mcpStudio.variables.toolResult'), token: TOOL_RESULT_VARIABLE },
    { label: t('mcpStudio.variables.upstreamResult'), token: UPSTREAM_RESULT_VARIABLE },
  ];
  const bindingSourceOptions = [
    { label: t('mcpStudio.variables.humanPrompt'), value: 'humanPrompt' },
    { label: t('mcpStudio.variables.serverIdentifier'), value: 'serverIdentifier' },
    { label: t('mcpStudio.variables.toolName'), value: 'toolName' },
    { label: t('mcpStudio.variables.upstreamResult'), value: 'upstreamResult' },
  ] satisfies Array<{ label: string; value: StudioPayloadBindingSource }>;
  const agentOptions = availableAgents.map((agent) => ({
    label: agent.title || agent.id,
    value: agent.id,
  }));
  const skillOptions = availableSkills.map((skill) => ({
    label: skill.name,
    value: skill.id,
  }));
  const chatPreview =
    executedChatPreview ||
    ({
      assistant: toolResult?.content || t('mcpStudio.run.idle'),
      system: t('mcpStudio.run.desc'),
      user:
        nodes.find((node) => node.type === 'input')?.data.humanPrompt || t('mcpStudio.run.idle'),
    } satisfies StudioChatPreview);
  const canRunPreview = useMemo(() => {
    if (!previewNodeId) return false;

    const nodeMap = new Map(nodes.map((node) => [node.id, node]));
    const incomingEdgeMap = new Map<string, typeof edges>();
    for (const edge of edges) {
      const current = incomingEdgeMap.get(edge.target) || [];
      current.push(edge);
      incomingEdgeMap.set(edge.target, current);
    }

    const visiting = new Set<string>();
    const visited = new Set<string>();
    let sawExecutableSource = false;

    const visit = (nodeId: string): boolean => {
      if (visiting.has(nodeId)) return false;
      if (visited.has(nodeId)) return true;

      const node = nodeMap.get(nodeId);
      if (!node) return false;

      if (node.type === 'mcp-tool') {
        if (!node.data.serverId || !node.data.toolName) return false;
        sawExecutableSource = true;
      }

      if (node.type === 'agent') {
        if (!node.data.agentId) return false;
        sawExecutableSource = true;
      }

      if (node.type === 'input' || node.type === 'resource' || node.type === 'skill') {
        sawExecutableSource = true;
      }

      const incoming = incomingEdgeMap.get(nodeId) || [];
      if (
        incoming.length === 0 &&
        node.type !== 'agent' &&
        node.type !== 'input' &&
        node.type !== 'mcp-tool' &&
        node.type !== 'resource' &&
        node.type !== 'skill'
      ) {
        return false;
      }

      visiting.add(nodeId);
      for (const edge of incoming) {
        if (!visit(edge.source)) return false;
      }
      visiting.delete(nodeId);
      visited.add(nodeId);

      return true;
    };

    return visit(previewNodeId) && sawExecutableSource;
  }, [edges, nodes, previewNodeId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedDraft = parseStudioDraft(window.localStorage.getItem(STUDIO_STORAGE_KEY));

    if (storedDraft) {
      startTransition(() => {
        setNodes(storedDraft.nodes);
        setEdges(storedDraft.edges);
        setPreviewNodeId(storedDraft.previewNodeId);
        setSelectedNodeIds(storedDraft.selectedNodeId ? [storedDraft.selectedNodeId] : []);
        setSelectedEdgeIds([]);
        setServers((state) => mergeStudioServers(state, storedDraft.servers));
      });
    }

    setDraftHydrated(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        const [result, skillResult, agentResult] = await Promise.all([
          lambdaClient.workflowStudio.bootstrap.query(),
          agentSkillService.list(),
          agentService.queryAgents({ limit: 200 }),
        ]);
        if (cancelled) return;

        setWorkflowLibrary(parseStudioWorkflowLibrary(JSON.stringify(result.workflows)));
        setServers((state) => mergeStudioServers(state, result.servers as StudioLoadedServer[]));
        setAvailableSkills(skillResult.data);
        setAvailableAgents(agentResult);
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to bootstrap workflow studio:', error);
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const agentId = selectedAgentNode?.data.agentId;
    if (!agentId || agentConfigMap[agentId]) return;

    let cancelled = false;

    void agentService
      .getAgentConfigById(agentId)
      .then((config) => {
        if (cancelled || !config) return;

        setAgentConfigMap((state) => (state[agentId] ? state : { ...state, [agentId]: config }));
      })
      .catch((error) => {
        if (!cancelled) console.error('Failed to load workflow studio agent config:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [agentConfigMap, selectedAgentNode?.data.agentId]);

  useEffect(() => {
    const agentId = selectedAgentNode?.data.agentId;
    if (!selectedAgentNode || !agentId) return;

    const config = agentConfigMap[agentId];
    if (!config) return;

    const hasSnapshot =
      Boolean(selectedAgentNode.data.model) ||
      Boolean(selectedAgentNode.data.provider) ||
      selectedAgentNode.data.systemRole !== undefined ||
      selectedAgentNode.data.params !== undefined ||
      selectedAgentNode.data.inputTemplate !== undefined ||
      selectedAgentNode.data.memoryEnabled !== undefined;
    if (hasSnapshot) return;

    updateNode(selectedAgentNode.id, (node) =>
      node.type === 'agent' && node.data.agentId === agentId
        ? applyAgentConfigSnapshot(node, agentId, config)
        : node,
    );
  }, [
    agentConfigMap,
    applyAgentConfigSnapshot,
    selectedAgentNode,
    selectedAgentNode?.data.agentId,
  ]);

  useEffect(() => {
    if (!draftHydrated || typeof window === 'undefined') return;

    window.localStorage.setItem(STUDIO_STORAGE_KEY, JSON.stringify(sanitizedDraft));
  }, [draftHydrated, sanitizedDraft]);

  useEffect(() => {
    if (mobile || !canvasRef.current) return;

    const element = canvasRef.current;
    const updateBounds = () => {
      const nextBounds = {
        height: Math.max(element.clientHeight, STUDIO_DEFAULT_CANVAS_BOUNDS.height),
        width: Math.max(element.clientWidth, STUDIO_DEFAULT_CANVAS_BOUNDS.width),
      };

      setCanvasBounds((state) =>
        areStudioCanvasBoundsEqual(state, nextBounds) ? state : nextBounds,
      );
    };

    updateBounds();

    const observer = new ResizeObserver(() => updateBounds());
    observer.observe(element);

    return () => observer.disconnect();
  }, [mobile]);

  useEffect(() => {
    if (mobile) return;

    setNodes((state) => {
      const nextNodes = clampNodePositions(state, canvasBounds);

      return areStudioNodePositionsEqual(state, nextNodes) ? state : nextNodes;
    });
  }, [canvasBounds, mobile]);

  useEffect(() => {
    setSelectedNodeIds((state) => {
      const nextSelectedNodeIds = state.filter((id) => nodes.some((node) => node.id === id));

      return areStudioSelectionsEqual(state, nextSelectedNodeIds) ? state : nextSelectedNodeIds;
    });
  }, [nodes]);

  useEffect(() => {
    if (!renamingNodeId || nodes.some((node) => node.id === renamingNodeId)) return;

    setRenamingNodeId(undefined);
  }, [nodes, renamingNodeId]);

  useEffect(() => {
    setSelectedEdgeIds((state) => {
      const nextSelectedEdgeIds = state.filter((id) => edges.some((edge) => edge.id === id));

      return areStudioSelectionsEqual(state, nextSelectedEdgeIds) ? state : nextSelectedEdgeIds;
    });
  }, [edges]);

  useEffect(() => {
    if (previewNodeId && nodes.some((node) => node.id === previewNodeId)) return;

    setPreviewNodeId(nodes.find((node) => node.type === 'chat-output')?.id);
  }, [nodes, previewNodeId]);

  useEffect(() => {
    setExecutedChatPreview(undefined);
    setBreakpointInfo(undefined);
    setToolResult(undefined);
    setErrorMessage(undefined);
    setLastRunAt(undefined);
  }, [nodes, edges, previewNodeId, servers]);

  useEffect(() => {
    pendingConnectionRef.current = pendingConnection;
  }, [pendingConnection]);

  useEffect(() => {
    selectionBoxRef.current = selectionBox;
  }, [selectionBox]);

  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  const clearSelection = () => {
    setSelectedNodeIds([]);
    setSelectedEdgeIds([]);
  };

  const applyDraft = (nextDraft: StudioDraft) => {
    setNodes(nextDraft.nodes);
    setEdges(nextDraft.edges);
    setPreviewNodeId(nextDraft.previewNodeId);
    setSelectedNodeIds(nextDraft.selectedNodeId ? [nextDraft.selectedNodeId] : []);
    setSelectedEdgeIds([]);
    setServers((state) => mergeStudioServers(state, nextDraft.servers));
    setBreakpointInfo(undefined);
    setExecutedChatPreview(undefined);
    setToolResult(undefined);
    setErrorMessage(undefined);
    setLastRunAt(undefined);
    setRenamingNodeId(undefined);
  };

  const getViewportPoint = (clientX: number, clientY: number): StudioNodePosition | undefined => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return undefined;

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const getCanvasPoint = (clientX: number, clientY: number): StudioNodePosition | undefined => {
    const viewportPoint = getViewportPoint(clientX, clientY);
    if (!viewportPoint) return undefined;

    return {
      x: Math.max(
        0,
        Math.min(
          (viewportPoint.x - viewportRef.current.x) / viewportRef.current.zoom,
          canvasBounds.width,
        ),
      ),
      y: Math.max(
        0,
        Math.min(
          (viewportPoint.y - viewportRef.current.y) / viewportRef.current.zoom,
          canvasBounds.height,
        ),
      ),
    };
  };

  const toViewportPoint = (point: StudioNodePosition) => ({
    x: point.x * viewport.zoom + viewport.x,
    y: point.y * viewport.zoom + viewport.y,
  });

  const updateViewportZoom = (nextZoom: number, anchor?: StudioNodePosition) => {
    const clampedZoom = clampStudioZoom(nextZoom);

    setViewport((state) => {
      if (!anchor || clampedZoom === state.zoom) {
        return clampedZoom === state.zoom ? state : { ...state, zoom: clampedZoom };
      }

      const worldX = (anchor.x - state.x) / state.zoom;
      const worldY = (anchor.y - state.y) / state.zoom;
      const nextViewport = {
        x: anchor.x - worldX * clampedZoom,
        y: anchor.y - worldY * clampedZoom,
        zoom: clampedZoom,
      };

      return nextViewport;
    });
  };

  const fitViewportToNodes = useEffectEvent(() => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || nodes.length === 0) {
      setViewport(STUDIO_DEFAULT_VIEWPORT);

      return;
    }

    const padding = 96;
    const bounds = nodes.reduce(
      (acc, node) => {
        const size = estimateNodeSize(node);

        return {
          bottom: Math.max(acc.bottom, node.position.y + size.height),
          left: Math.min(acc.left, node.position.x),
          right: Math.max(acc.right, node.position.x + size.width),
          top: Math.min(acc.top, node.position.y),
        };
      },
      {
        bottom: Number.NEGATIVE_INFINITY,
        left: Number.POSITIVE_INFINITY,
        right: Number.NEGATIVE_INFINITY,
        top: Number.POSITIVE_INFINITY,
      },
    );

    const contentWidth = Math.max(bounds.right - bounds.left + padding * 2, 320);
    const contentHeight = Math.max(bounds.bottom - bounds.top + padding * 2, 240);
    const nextZoom = clampStudioZoom(
      Math.min(rect.width / contentWidth, rect.height / contentHeight),
    );

    setViewport({
      x: rect.width / 2 - ((bounds.left + bounds.right) / 2) * nextZoom,
      y: rect.height / 2 - ((bounds.top + bounds.bottom) / 2) * nextZoom,
      zoom: nextZoom,
    });
  });

  useEffect(() => {
    if (mobile || !draftHydrated || viewportInitializedRef.current) return;

    viewportInitializedRef.current = true;
    requestAnimationFrame(() => fitViewportToNodes());
  }, [draftHydrated, fitViewportToNodes, mobile]);

  const getSelectionBounds = (box: StudioSelectionBox) => ({
    bottom: Math.max(box.origin.y, box.currentPosition.y),
    left: Math.min(box.origin.x, box.currentPosition.x),
    right: Math.max(box.origin.x, box.currentPosition.x),
    top: Math.min(box.origin.y, box.currentPosition.y),
  });

  const intersectsSelectionBounds = (
    bounds: { bottom: number; left: number; right: number; top: number },
    target: { bottom: number; left: number; right: number; top: number },
  ) =>
    !(
      target.left > bounds.right ||
      target.right < bounds.left ||
      target.top > bounds.bottom ||
      target.bottom < bounds.top
    );

  const getConnectionState = (params: {
    sourceNode: StudioCanvasNode;
    sourcePortId: string;
    targetNode: StudioCanvasNode;
    targetPortId: string;
  }) =>
    getStudioConnectionState({
      edges,
      sourceNode: params.sourceNode,
      sourcePortId: params.sourcePortId,
      targetNode: params.targetNode,
      targetPortId: params.targetPortId,
    });

  const findConnectionTarget = (
    point: StudioNodePosition,
    sourceId: string,
    sourcePortId: string,
  ) =>
    findStudioConnectionTarget({
      edges,
      nodes,
      point,
      sourceId,
      sourcePortId,
    });

  const updateNode = (id: string, updater: (node: StudioCanvasNode) => StudioCanvasNode) => {
    setNodes((state) => state.map((node) => (node.id === id ? updater(node) : node)));
  };

  const updateToolBindingsForEdge = (
    edgeId: string,
    updater: (
      bindings: NonNullable<
        Extract<StudioCanvasNode, { type: 'mcp-tool' }>['data']['payloadBindings']
      >,
    ) => Extract<StudioCanvasNode, { type: 'mcp-tool' }>['data']['payloadBindings'],
  ) => {
    const edge = edges.find((item) => item.id === edgeId);
    if (!edge) return;
    const targetNode = getNode(edge.target);
    const incomingEdges = edges.filter((item) => item.target === edge.target);
    const currentBindings =
      edge.payloadBindings && edge.payloadBindings.length > 0
        ? edge.payloadBindings
        : targetNode?.type === 'mcp-tool' && incomingEdges.length === 1
          ? targetNode.data.payloadBindings
          : [];

    setEdges((state) =>
      state.map((item) =>
        item.id === edgeId
          ? {
              ...item,
              payloadBindings: updater(currentBindings),
            }
          : item,
      ),
    );

    if (targetNode?.type === 'mcp-tool' && incomingEdges.length === 1) {
      updateNode(edge.target, (node) =>
        node.type === 'mcp-tool'
          ? {
              ...node,
              data: {
                ...node.data,
                payloadBindings: [],
              },
            }
          : node,
      );
    }
  };

  const updateNodeTitle = (id: string, title: string) => {
    updateNode(id, (node) => {
      switch (node.type) {
        case 'input': {
          return { ...node, data: { ...node.data, title } };
        }
        case 'agent': {
          return { ...node, data: { ...node.data, title } };
        }
        case 'resource': {
          return { ...node, data: { ...node.data, title } };
        }
        case 'skill': {
          return { ...node, data: { ...node.data, title } };
        }
        case 'mcp-tool': {
          return { ...node, data: { ...node.data, title } };
        }
        case 'transform': {
          return { ...node, data: { ...node.data, title } };
        }
        case 'chat-output': {
          return { ...node, data: { ...node.data, title } };
        }
      }
    });
  };

  const handleSelectAgent = async (nodeId: string, agentId: string) => {
    const fallbackAgent = availableAgents.find((item) => item.id === agentId);

    updateNode(nodeId, (node) =>
      node.type === 'agent'
        ? syncConcreteNodeTitle(node, {
            ...node,
            data: {
              ...node.data,
              agentId,
              agentName: fallbackAgent?.title || agentId,
              inputTemplate: undefined,
              memoryEnabled: undefined,
              model: undefined,
              params: undefined,
              provider: undefined,
              systemRole: undefined,
            },
          })
        : node,
    );

    const cachedConfig = agentConfigMap[agentId];
    if (cachedConfig) {
      updateNode(nodeId, (node) =>
        node.type === 'agent' && node.data.agentId === agentId
          ? applyAgentConfigSnapshot(node, agentId, cachedConfig)
          : node,
      );

      return;
    }

    try {
      const config = await agentService.getAgentConfigById(agentId);
      if (!config) return;

      setAgentConfigMap((state) => ({ ...state, [agentId]: config }));
      updateNode(nodeId, (node) =>
        node.type === 'agent' && node.data.agentId === agentId
          ? applyAgentConfigSnapshot(node, agentId, config)
          : node,
      );
    } catch (error) {
      console.error('Failed to load workflow studio agent config:', error);
    }
  };

  const handleNodeSelect = (node: StudioCanvasNode, additive = false) => {
    if (additive) {
      setSelectedNodeIds((state) => toggleSelectionValue(state, node.id));
      return;
    }

    setSelectedNodeIds([node.id]);
    setSelectedEdgeIds([]);
    if (node.type === 'chat-output') setPreviewNodeId(node.id);
    setEditingNodeId(undefined);
    setRenamingNodeId(undefined);
    setPalette(undefined);
  };

  const handleEdgeSelect = (edgeId: string, additive = false) => {
    if (additive) {
      setSelectedEdgeIds((state) => toggleSelectionValue(state, edgeId));
      return;
    }

    setSelectedEdgeIds([edgeId]);
    setSelectedNodeIds([]);
    setEditingNodeId(undefined);
    setRenamingNodeId(undefined);
    setPalette(undefined);
  };

  const handleNodeDoubleClick = (node: StudioCanvasNode) => {
    handleNodeSelect(node);
    if (node.type === 'agent' || node.type === 'input' || node.type === 'transform') {
      setEditingNodeId(node.id);
    }
  };

  const handleNodeDragStop =
    (nodeId: string): RndDragCallback =>
    (_event, data) => {
      setNodes((state) =>
        clampNodePositions(
          state.map((node) =>
            node.id === nodeId ? { ...node, position: { x: data.x, y: data.y } } : node,
          ),
          canvasBounds,
        ),
      );
    };

  const handleCanvasDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    const point = getCanvasPoint(event.clientX, event.clientY);
    if (!point) return;

    setPalette({
      x: Math.max(20, point.x),
      y: Math.max(20, point.y),
    });
    clearSelection();
    setPendingConnection(undefined);
    setEditingNodeId(undefined);
    setRenamingNodeId(undefined);
  };

  const handleStartPan = (clientX: number, clientY: number) => {
    const point = getViewportPoint(clientX, clientY);
    if (!point) return;

    panSessionRef.current = {
      originPointer: point,
      originViewport: viewportRef.current,
    };
    setIsPanning(true);
    setPalette(undefined);
    setEditingNodeId(undefined);
    setRenamingNodeId(undefined);
  };

  const handleCanvasPointerDown = (event: ReactPointerEvent<HTMLDivElement | SVGSVGElement>) => {
    if (pendingConnectionRef.current) return;

    if (event.button === 1 || (event.button === 0 && spacePressed)) {
      event.preventDefault();
      handleStartPan(event.clientX, event.clientY);

      return;
    }

    if (event.button !== 0 || event.detail > 1) return;

    const target = event.target as Element | null;
    if (target?.closest('[data-studio-ignore-selection="true"]')) return;

    const point = getCanvasPoint(event.clientX, event.clientY);
    if (!point) return;

    const additive = event.metaKey || event.ctrlKey || event.shiftKey;

    if (!additive) clearSelection();

    setSelectionBox({
      additive,
      currentPosition: point,
      origin: point,
    });
    setPalette(undefined);
    setEditingNodeId(undefined);
    setRenamingNodeId(undefined);
  };

  const addBattery = (type: StudioCanvasNode['type']) => {
    const nextPosition: StudioNodePosition =
      palette ||
      getSuggestedStudioNodePosition({
        nodes,
        selectedNode,
        type,
      });
    const node = createStudioNode(type, nextPosition);

    setNodes((state) => clampNodePositions([...state, node], canvasBounds));
    setSelectedNodeIds([node.id]);
    setSelectedEdgeIds([]);
    if (type === 'chat-output') setPreviewNodeId(node.id);
    setPalette(undefined);
    setEditingNodeId(
      type === 'agent' || type === 'input' || type === 'transform' ? node.id : undefined,
    );
  };

  const handleCanvasWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();

    const anchor = getViewportPoint(event.clientX, event.clientY);
    const direction = event.deltaY > 0 ? -1 : 1;
    const delta = direction * STUDIO_ZOOM_STEP;

    updateViewportZoom(viewportRef.current.zoom + delta, anchor);
  };

  const handleStartConnection = (
    event: ReactPointerEvent<HTMLElement>,
    sourceId: string,
    sourcePortId: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const sourceNode = getNode(sourceId);
    if (!sourceNode) return;

    setPendingConnection({
      currentPosition:
        getCanvasPoint(event.clientX, event.clientY) ||
        getNodeOutputAnchor(sourceNode, sourcePortId),
      sourceId,
      sourcePortId,
    });
    setPalette(undefined);
    setSelectedEdgeIds([]);
    setEditingNodeId(undefined);
    setRenamingNodeId(undefined);
  };

  const handleCompleteConnection = (
    sourceId: string,
    sourcePortId: string,
    targetId: string,
    targetPortId: string,
  ) => {
    if (sourceId === targetId) return;

    const sourceNode = getNode(sourceId);
    const targetNode = getNode(targetId);
    if (!sourceNode || !targetNode) return;

    const connectionState = getConnectionState({
      sourceNode,
      sourcePortId,
      targetNode,
      targetPortId,
    });
    if (connectionState.kind === 'invalid') {
      message.warning(t('mcpStudio.messages.invalidPort'));
      return;
    }
    if (connectionState.kind === 'busy') {
      message.warning(t('mcpStudio.messages.portBusy'));
      return;
    }

    startTransition(() => {
      const existingEdge =
        connectionState.kind === 'duplicate'
          ? connectionState.edge
          : findExistingStudioEdge({
              edges,
              sourceId,
              sourceNode,
              sourcePortId,
              targetId,
              targetNode,
              targetPortId,
            });
      if (existingEdge) {
        setSelectedEdgeIds([existingEdge.id]);
        setSelectedNodeIds([]);
        return;
      }

      const nextEdge = {
        channel: resolveStudioEdgeChannel({
          sourcePortId,
          sourceType: sourceNode.type,
          targetPortId,
          targetType: targetNode.type,
        }),
        id: `edge_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        payloadBindings: [],
        source: sourceId,
        target: targetId,
      };
      const shouldReplaceExistingEdges = shouldStudioReplaceTargetPortEdges(
        targetNode,
        targetPortId,
      );

      setEdges((state) =>
        shouldReplaceExistingEdges
          ? [
              ...state.filter(
                (edge) =>
                  !(
                    edge.target === targetId &&
                    resolveStudioInputPortId(targetNode, edge.targetPortId, edge.channel) ===
                      targetPortId
                  ),
              ),
              nextEdge,
            ]
          : [...state, nextEdge],
      );
      setSelectedEdgeIds([nextEdge.id]);
      setSelectedNodeIds([]);
    });
  };

  const handlePendingPointerMove = useEffectEvent((event: PointerEvent) => {
    const current = pendingConnectionRef.current;
    if (!current) return;

    const point = getCanvasPoint(event.clientX, event.clientY);
    if (!point) return;

    const target = findConnectionTarget(point, current.sourceId, current.sourcePortId);

    setPendingConnection((state) => {
      if (!state) return state;

      const nextTargetId = target?.targetId;
      const nextTargetPortId = target?.targetPortId;

      if (
        areStudioPointsEqual(state.currentPosition, point) &&
        state.targetId === nextTargetId &&
        state.targetPortId === nextTargetPortId
      ) {
        return state;
      }

      return {
        ...state,
        currentPosition: point,
        targetId: nextTargetId,
        targetPortId: nextTargetPortId,
      };
    });
  });

  const handlePendingPointerEnd = useEffectEvent((event: PointerEvent) => {
    const current = pendingConnectionRef.current;
    if (!current) return;

    const point = getCanvasPoint(event.clientX, event.clientY);
    const target = point
      ? findConnectionTarget(point, current.sourceId, current.sourcePortId) || {
          targetId: current.targetId,
          targetPortId: current.targetPortId,
        }
      : {
          targetId: current.targetId,
          targetPortId: current.targetPortId,
        };

    if (target?.targetId && target?.targetPortId) {
      handleCompleteConnection(
        current.sourceId,
        current.sourcePortId,
        target.targetId,
        target.targetPortId,
      );
    }

    setPendingConnection(undefined);
  });

  useEffect(() => {
    if (!pendingConnection?.sourceId) return;

    window.addEventListener('pointermove', handlePendingPointerMove);
    window.addEventListener('pointerup', handlePendingPointerEnd);
    window.addEventListener('pointercancel', handlePendingPointerEnd);

    return () => {
      window.removeEventListener('pointermove', handlePendingPointerMove);
      window.removeEventListener('pointerup', handlePendingPointerEnd);
      window.removeEventListener('pointercancel', handlePendingPointerEnd);
    };
  }, [handlePendingPointerEnd, handlePendingPointerMove, pendingConnection?.sourceId]);

  const handleSelectionPointerMove = useEffectEvent((event: PointerEvent) => {
    const current = selectionBoxRef.current;
    if (!current) return;

    const point = getCanvasPoint(event.clientX, event.clientY);
    if (!point) return;

    setSelectionBox((state) =>
      state
        ? {
            ...state,
            currentPosition: point,
          }
        : state,
    );
  });

  const handleSelectionPointerEnd = useEffectEvent((event: PointerEvent) => {
    const current = selectionBoxRef.current;
    if (!current) return;

    const point = getCanvasPoint(event.clientX, event.clientY) || current.currentPosition;
    const finalBox = {
      ...current,
      currentPosition: point,
    };
    const bounds = getSelectionBounds(finalBox);
    const selectedNodes = nodes
      .filter((node) => {
        const size = estimateNodeSize(node);

        return intersectsSelectionBounds(bounds, {
          bottom: node.position.y + size.height,
          left: node.position.x,
          right: node.position.x + size.width,
          top: node.position.y,
        });
      })
      .map((node) => node.id);
    const selectedEdgesInBounds = edges
      .filter((edge) => {
        const sourceNode = getNode(edge.source);
        const targetNode = getNode(edge.target);
        if (!sourceNode || !targetNode) return false;

        const start = getNodeOutputAnchor(
          sourceNode,
          resolveStudioOutputPortId(sourceNode, edge.sourcePortId, edge.channel),
        );
        const end = getNodeInputAnchor(
          targetNode,
          resolveStudioInputPortId(targetNode, edge.targetPortId, edge.channel),
        );

        return intersectsSelectionBounds(bounds, {
          bottom: Math.max(start.y, end.y),
          left: Math.min(start.x, end.x),
          right: Math.max(start.x, end.x),
          top: Math.min(start.y, end.y),
        });
      })
      .map((edge) => edge.id);

    setSelectedNodeIds((state) =>
      finalBox.additive ? [...new Set([...state, ...selectedNodes])] : selectedNodes,
    );
    setSelectedEdgeIds((state) =>
      finalBox.additive
        ? [...new Set([...state, ...selectedEdgesInBounds])]
        : selectedEdgesInBounds,
    );
    setSelectionBox(undefined);
  });

  useEffect(() => {
    if (!selectionBox) return;

    window.addEventListener('pointermove', handleSelectionPointerMove);
    window.addEventListener('pointerup', handleSelectionPointerEnd);
    window.addEventListener('pointercancel', handleSelectionPointerEnd);

    return () => {
      window.removeEventListener('pointermove', handleSelectionPointerMove);
      window.removeEventListener('pointerup', handleSelectionPointerEnd);
      window.removeEventListener('pointercancel', handleSelectionPointerEnd);
    };
  }, [handleSelectionPointerEnd, handleSelectionPointerMove, selectionBox]);

  const handlePanPointerMove = useEffectEvent((event: PointerEvent) => {
    const session = panSessionRef.current;
    if (!session) return;

    const point = getViewportPoint(event.clientX, event.clientY);
    if (!point) return;

    setViewport({
      x: session.originViewport.x + (point.x - session.originPointer.x),
      y: session.originViewport.y + (point.y - session.originPointer.y),
      zoom: session.originViewport.zoom,
    });
  });

  const handlePanPointerEnd = useEffectEvent(() => {
    if (!panSessionRef.current) return;

    panSessionRef.current = undefined;
    setIsPanning(false);
  });

  useEffect(() => {
    if (!isPanning) return;

    window.addEventListener('pointermove', handlePanPointerMove);
    window.addEventListener('pointerup', handlePanPointerEnd);
    window.addEventListener('pointercancel', handlePanPointerEnd);

    return () => {
      window.removeEventListener('pointermove', handlePanPointerMove);
      window.removeEventListener('pointerup', handlePanPointerEnd);
      window.removeEventListener('pointercancel', handlePanPointerEnd);
    };
  }, [handlePanPointerEnd, handlePanPointerMove, isPanning]);

  const handleSelectionKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (selectionCount === 0) return;
    if (event.key !== 'Backspace' && event.key !== 'Delete') return;

    const target = event.target as HTMLElement | null;
    if (
      target &&
      (target.isContentEditable ||
        target.tagName === 'INPUT' ||
        target.tagName === 'SELECT' ||
        target.tagName === 'TEXTAREA')
    ) {
      return;
    }

    event.preventDefault();
    handleDeleteSelection();
  });

  useEffect(() => {
    window.addEventListener('keydown', handleSelectionKeyDown);

    return () => {
      window.removeEventListener('keydown', handleSelectionKeyDown);
    };
  }, [handleSelectionKeyDown]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== ' ') return;

      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          target.tagName === 'INPUT' ||
          target.tagName === 'SELECT' ||
          target.tagName === 'TEXTAREA')
      ) {
        return;
      }

      event.preventDefault();
      setSpacePressed(true);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === ' ') setSpacePressed(false);
    };

    const handleBlur = () => setSpacePressed(false);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  const handleRemoveEdge = (edgeId: string) => {
    setSelectedEdgeIds((state) => state.filter((id) => id !== edgeId));
    setEdges((state) => state.filter((edge) => edge.id !== edgeId));
  };

  const handleDeleteSelection = () => {
    if (selectionCount === 0) return;

    const selectedNodeIdSet = new Set(selectedNodeIds);
    const selectedEdgeIdSet = new Set(selectedEdgeIds);

    startTransition(() => {
      setNodes((state) => state.filter((node) => !selectedNodeIdSet.has(node.id)));
      setEdges((state) =>
        state.filter(
          (edge) =>
            !selectedEdgeIdSet.has(edge.id) &&
            !selectedNodeIdSet.has(edge.source) &&
            !selectedNodeIdSet.has(edge.target),
        ),
      );
      if (previewNodeId && selectedNodeIdSet.has(previewNodeId)) {
        const nextPreview = nodes.find(
          (node) => !selectedNodeIdSet.has(node.id) && node.type === 'chat-output',
        )?.id;
        setPreviewNodeId(nextPreview);
      }
      clearSelection();
      setEditingNodeId(undefined);
      setRenamingNodeId(undefined);
    });

    message.success(t('mcpStudio.messages.selectionDeleted', { count: selectionCount }));
  };

  const handleDeleteNode = (nodeId: string) => {
    startTransition(() => {
      setNodes((state) => state.filter((node) => node.id !== nodeId));
      setEdges((state) => state.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
      setSelectedNodeIds((state) => state.filter((id) => id !== nodeId));
      setSelectedEdgeIds((state) =>
        state.filter((edgeId) => {
          const edge = edges.find((item) => item.id === edgeId);

          return Boolean(edge) && edge.source !== nodeId && edge.target !== nodeId;
        }),
      );
      if (previewNodeId === nodeId) {
        const nextPreview = nodes.find(
          (node) => node.id !== nodeId && node.type === 'chat-output',
        )?.id;
        setPreviewNodeId(nextPreview);
      }
      setEditingNodeId(undefined);
      setRenamingNodeId(undefined);
    });

    message.success(t('mcpStudio.messages.nodeDeleted'));
  };

  const handleAutoLayout = () => {
    setNodes((state) => clampNodePositions(autoLayoutStudioNodes(state, edges), canvasBounds));
    requestAnimationFrame(() => fitViewportToNodes());
    message.success(t('mcpStudio.messages.layoutReset'));
  };

  const handleSaveWorkflow = async () => {
    const nextName = workflowName.trim() || t('mcpStudio.library.defaultName');

    setWorkflowSaving(true);

    try {
      const result = await lambdaClient.workflowStudio.upsertWorkflow.mutate({
        draft: sanitizedDraft as unknown as Record<string, unknown>,
        id: selectedWorkflowId,
        name: nextName,
      });

      setWorkflowLibrary(parseStudioWorkflowLibrary(JSON.stringify(result.workflows)));
      setSelectedWorkflowId(result.entry.id);
      setWorkflowName(result.entry.name);
      message.success(
        selectedWorkflowId ? t('mcpStudio.library.updated') : t('mcpStudio.library.saved'),
      );
    } catch (error) {
      console.error('Failed to save workflow studio workflow:', error);
      message.error(t('mcpStudio.messages.librarySyncFailed'));
    } finally {
      setWorkflowSaving(false);
    }
  };

  const handleLoadWorkflow = () => {
    if (!selectedWorkflow) return;

    applyDraft(selectedWorkflow.draft);
    setWorkflowName(selectedWorkflow.name);
    requestAnimationFrame(() => fitViewportToNodes());
    message.success(t('mcpStudio.library.loaded'));
  };

  const handleNewWorkflow = () => {
    const nextDraft = createDefaultStudioDraft();

    applyDraft(nextDraft);
    setSelectedWorkflowId(undefined);
    setWorkflowName('');
    requestAnimationFrame(() => fitViewportToNodes());
    message.success(t('mcpStudio.messages.newDraft'));
  };

  const handleDeleteWorkflow = async () => {
    if (!selectedWorkflowId) return;

    setWorkflowSaving(true);

    try {
      const workflows = await lambdaClient.workflowStudio.deleteWorkflow.mutate({
        id: selectedWorkflowId,
      });

      setWorkflowLibrary(parseStudioWorkflowLibrary(JSON.stringify(workflows)));
      setSelectedWorkflowId(undefined);
      message.success(t('mcpStudio.library.removed'));
    } catch (error) {
      console.error('Failed to delete workflow studio workflow:', error);
      message.error(t('mcpStudio.messages.librarySyncFailed'));
    } finally {
      setWorkflowSaving(false);
    }
  };

  const handleRun = async () => {
    if (!previewNodeId || !canRunPreview) return;

    setRunLoading(true);
    setErrorMessage(undefined);

    try {
      const response = await toolsClient.mcp.runWorkflowPreview.mutate({
        workflow: buildWorkflowDefinition({
          draft,
          previewNodeId,
        }),
      });

      setBreakpointInfo(response.breakpoint as StudioBreakpointInfo | undefined);
      setExecutedChatPreview(response.chatPreview);
      setToolResult(response.toolResult as StudioToolResult | undefined);
      setLastRunAt(new Date().toLocaleTimeString());
      if (response.breakpoint) {
        message.info(
          t('mcpStudio.messages.breakpointPaused', { nodeTitle: response.breakpoint.nodeTitle }),
        );
      } else {
        message.success(t('mcpStudio.messages.runSuccess'));
      }
    } catch (error) {
      const errorText = error instanceof Error ? error.message : t('mcpStudio.messages.runFailed');
      setBreakpointInfo(undefined);
      setErrorMessage(errorText);
      message.error(t('mcpStudio.messages.runFailed'));
    } finally {
      setRunLoading(false);
    }
  };

  const handleLoadServer = async () => {
    setConnectLoading(true);
    setErrorMessage(undefined);

    try {
      let manifest: StudioManifest;
      let connection: StudioConnectionConfig;

      if (connectionMode === 'http') {
        const identifier = httpForm.identifier.trim();
        const url = httpForm.url.trim();

        if (!identifier || !url) {
          throw new Error(t('mcpStudio.messages.missingHttp'));
        }

        manifest = await mcpService.getStreamableMcpServerManifest({
          auth:
            httpForm.authType === 'none'
              ? { type: 'none' }
              : httpForm.authType === 'bearer'
                ? { token: httpForm.token.trim(), type: 'bearer' }
                : { accessToken: httpForm.token.trim(), type: 'oauth2' },
          headers: parseStringRecord(httpForm.headers, t('mcpStudio.messages.invalidRecord')),
          identifier,
          url,
        });

        connection = {
          authType: httpForm.authType,
          headers: parseStringRecord(httpForm.headers, t('mcpStudio.messages.invalidRecord')),
          identifier,
          token: httpForm.token.trim() || undefined,
          type: 'http',
          url,
        };
      } else {
        if (!isDesktop) {
          throw new Error(t('mcpStudio.connection.desktopOnly'));
        }

        const identifier = stdioForm.identifier.trim();
        const command = stdioForm.command.trim();

        if (!identifier || !command) {
          throw new Error(t('mcpStudio.messages.missingStdio'));
        }

        manifest = await mcpService.getStdioMcpServerManifest({
          args: parseStringArray(stdioForm.args, t('mcpStudio.messages.invalidArray')),
          command,
          env: parseStringRecord(stdioForm.env, t('mcpStudio.messages.invalidRecord')),
          name: identifier,
        });

        connection = {
          args: parseStringArray(stdioForm.args, t('mcpStudio.messages.invalidArray')),
          command,
          env: parseStringRecord(stdioForm.env, t('mcpStudio.messages.invalidRecord')),
          identifier,
          type: 'stdio',
        };
      }

      const tools = Array.isArray(manifest.api)
        ? manifest.api.map(
            (item) =>
              ({
                description: typeof item.description === 'string' ? item.description : undefined,
                name: item.name,
                parameters: item.parameters,
              }) satisfies StudioSavedToolDefinition,
          )
        : [];
      const existing = servers.find(
        (server) => server.connection.identifier === connection.identifier,
      );
      const now = Date.now();
      const entry: StudioLoadedServer = {
        connection,
        createdAt: existing?.createdAt || now,
        id: existing?.id || `server_${now}`,
        name: connection.identifier,
        origin: 'custom',
        tools,
        updatedAt: now,
      };

      setServers((state) => mergeStudioServers(state, [entry]));
      setServerModalOpen(false);
      message.success(t('mcpStudio.messages.serverLoaded', { count: tools.length }));
    } catch (error) {
      const errorText =
        error instanceof Error ? error.message : t('mcpStudio.messages.connectFailed');
      setErrorMessage(errorText);
      message.error(t('mcpStudio.messages.connectFailed'));
    } finally {
      setConnectLoading(false);
    }
  };

  const loadSkillResourceOptions = async (skillId: string) => {
    if (skillResources[skillId]) return skillResources[skillId]!;

    const tree = await agentSkillService.listResources(skillId);
    const options = flattenStudioSkillResources(tree);

    setSkillResources((state) => ({ ...state, [skillId]: options }));

    return options;
  };

  const updateResourceNode = (
    nodeId: string,
    updater: (
      data: Extract<StudioCanvasNode, { type: 'resource' }>['data'],
    ) => Extract<StudioCanvasNode, { type: 'resource' }>['data'],
  ) => {
    updateNode(nodeId, (node) =>
      node.type === 'resource'
        ? {
            ...node,
            data: updater(node.data),
          }
        : node,
    );
  };

  const handleImportSkillNode = async (nodeId: string, skillId: string) => {
    try {
      const skill = await agentSkillService.getById(skillId);
      const content = skill?.content || '';

      if (!content) {
        throw new Error(t('mcpStudio.messages.skillEmpty'));
      }

      updateNode(nodeId, (node) =>
        node.type === 'skill'
          ? syncConcreteNodeTitle(node, {
              ...node,
              data: {
                ...node.data,
                content,
                skillId,
                skillName: skill?.name || node.data.skillName,
              },
            })
          : node,
      );

      message.success(t('mcpStudio.messages.skillImported'));
    } catch (error) {
      console.error('Failed to import skill into studio:', error);
      message.error(t('mcpStudio.messages.skillImportFailed'));
    }
  };

  const handleSelectResourceSkill = async (nodeId: string, skillId: string) => {
    const skill = availableSkills.find((item) => item.id === skillId);

    updateNode(nodeId, (node) =>
      node.type === 'resource'
        ? syncConcreteNodeTitle(node, {
            ...node,
            data: {
              ...node.data,
              kind: 'text',
              content: '',
              resourcePath: undefined,
              skillId,
              skillName: skill?.name,
              sourceLabel: skill?.name,
              sourceType: 'skill-resource',
              sourceUri: undefined,
            },
          })
        : node,
    );

    try {
      await loadSkillResourceOptions(skillId);
    } catch (error) {
      console.error('Failed to load skill resources:', error);
      message.error(t('mcpStudio.messages.resourceListFailed'));
    }
  };

  const handleImportResourceNode = async (
    nodeId: string,
    skillId: string,
    resourcePath: string,
  ) => {
    try {
      const [resource, skill] = await Promise.all([
        agentSkillService.readResource(skillId, resourcePath),
        agentSkillService.getById(skillId),
      ]);

      if (resource.encoding !== 'utf8') {
        throw new Error(t('mcpStudio.messages.resourceBinary'));
      }

      updateNode(nodeId, (node) =>
        node.type === 'resource'
          ? syncConcreteNodeTitle(node, {
              ...node,
              data: {
                ...node.data,
                content: resource.content,
                kind: 'text',
                mimeType: 'text/plain',
                resourcePath,
                skillId,
                skillName: skill?.name || node.data.skillName,
                sourceLabel: skill?.name || node.data.sourceLabel,
                sourceType: 'skill-resource',
                sourceUri: resourcePath,
              },
            })
          : node,
      );

      message.success(t('mcpStudio.messages.resourceImported'));
    } catch (error) {
      console.error('Failed to import resource into studio:', error);
      message.error(t('mcpStudio.messages.resourceImportFailed'));
    }
  };

  const handleUploadResourceFile = async (nodeId: string, file?: File) => {
    if (!file) return;

    try {
      const kind = file.type.startsWith('image/')
        ? 'image'
        : file.type.startsWith('text/') ||
            /\.(?:md|markdown|txt|json|ya?ml|csv|xml|log)$/i.test(file.name)
          ? 'text'
          : 'file';
      const content = kind === 'text' ? await file.text() : '';

      updateNode(nodeId, (node) =>
        node.type === 'resource'
          ? syncConcreteNodeTitle(node, {
              ...node,
              data: {
                ...node.data,
                content,
                kind,
                mimeType: file.type || node.data.mimeType,
                resourcePath: undefined,
                sizeBytes: file.size,
                skillId: undefined,
                skillName: undefined,
                sourceLabel: file.name,
                sourceType: 'upload',
                sourceUri: file.name,
              },
            })
          : node,
      );

      message.success(t('mcpStudio.messages.resourceImported'));
    } catch (error) {
      console.error('Failed to attach local resource to studio:', error);
      message.error(t('mcpStudio.messages.resourceImportFailed'));
    }
  };

  const insertPromptVariable = (token: string) => {
    if (!selectedPromptNode) return;

    const textarea = promptTextareaRef.current?.resizableTextArea?.textArea;
    const { nextSelection, nextValue } = insertBindingToken({
      selectionEnd: textarea?.selectionEnd,
      selectionStart: textarea?.selectionStart,
      token,
      value: selectedPromptNode.data.prompt,
    });

    updateNode(selectedPromptNode.id, (node) =>
      node.type === 'agent' || node.type === 'transform'
        ? {
            ...node,
            data: {
              ...node.data,
              prompt: nextValue,
            },
          }
        : node,
    );

    requestAnimationFrame(() => {
      const nextTextarea = promptTextareaRef.current?.resizableTextArea?.textArea;
      nextTextarea?.focus();
      nextTextarea?.setSelectionRange(nextSelection, nextSelection);
    });
  };

  const getEdgeSummary = (edge: StudioDraft['edges'][number]) => {
    const sourceNode = getNode(edge.source);
    const targetNode = getNode(edge.target);

    if (!sourceNode || !targetNode) return t('mcpStudio.connections.none');

    if (targetNode.type === 'mcp-tool') {
      const incomingEdges = edges.filter((item) => item.target === targetNode.id);
      const bindingCount =
        edge.payloadBindings?.length ||
        (incomingEdges.length === 1 ? targetNode.data.payloadBindings.length : 0);

      return bindingCount > 0
        ? t('mcpStudio.binding.count', { count: bindingCount })
        : t('mcpStudio.wire.payload');
    }

    if (targetNode.type === 'transform') {
      return t('mcpStudio.wire.upstream');
    }

    if (targetNode.type === 'agent') {
      return t('mcpStudio.wire.agent');
    }

    return t('mcpStudio.wire.output');
  };

  const getEdgeRouteLabel = (edge: StudioDraft['edges'][number]) => {
    const sourceNode = getNode(edge.source);
    const targetNode = getNode(edge.target);

    if (!sourceNode || !targetNode) return `${edge.source} -> ${edge.target}`;

    return `${sourceNode.data.title} -> ${targetNode.data.title}`;
  };

  const renderNode = (node: StudioCanvasNode) => {
    const size = estimateNodeSize(node);
    const isSelected = selectedNodeIds.includes(node.id);
    const isEditing =
      editingNodeId === node.id &&
      (node.type === 'agent' || node.type === 'input' || node.type === 'transform');
    const isRenaming = renamingNodeId === node.id;
    const incomingEdges = edges.filter((edge) => edge.target === node.id);
    const outgoingEdges = edges.filter((edge) => edge.source === node.id);
    const inputPorts = getNodeInputPorts(node);
    const outputPorts = getNodeOutputPorts(node).filter(
      (port) =>
        port.id !== 'handoff' ||
        isMultiAgentMode ||
        outgoingEdges.some(
          (edge) => resolveStudioOutputPortId(node, edge.sourcePortId, edge.channel) === port.id,
        ) ||
        pendingConnection?.sourceId === node.id,
    );
    const isPendingSourceNode = pendingConnection?.sourceId === node.id;
    const isPendingTargetNode = pendingConnection?.targetId === node.id;
    const activeInputPortIds = new Set(
      incomingEdges
        .map((edge) => resolveStudioInputPortId(node, edge.targetPortId, edge.channel))
        .filter(Boolean),
    );
    const activeOutputPortIds = new Set(
      outgoingEdges
        .map((edge) => resolveStudioOutputPortId(node, edge.sourcePortId, edge.channel))
        .filter(Boolean),
    );
    const visibleInputPorts = inputPorts.filter(
      (port, index) =>
        index === 0 ||
        activeInputPortIds.has(port.id) ||
        (isPendingTargetNode && pendingTargetPortId === port.id),
    );
    const visibleOutputPorts = outputPorts.filter(
      (port, index) =>
        index === 0 || activeOutputPortIds.has(port.id) || isSelected || isPendingSourceNode,
    );
    const connectableInputPorts =
      pendingSourceNode && node.id !== pendingSourceNode.id
        ? getStudioConnectableInputPorts({
            edges,
            sourceNode: pendingSourceNode,
            sourcePortId: pendingSourcePortId || getNodeOutputPorts(pendingSourceNode)[0]?.id || '',
            targetNode: node,
          })
        : [];
    const connectableInputPortIds = new Set(connectableInputPorts.map(({ port }) => port.id));
    const canAcceptPendingConnection = connectableInputPorts.length > 0;
    const nodeServer =
      node.type === 'mcp-tool' && node.data.serverId
        ? servers.find((item) => item.id === node.data.serverId)
        : undefined;
    const icon = getNodeTypeIcon(node, nodeServer?.connection.type);

    return (
      <Rnd
        bounds="parent"
        className={styles.nodeShell}
        disableDragging={isEditing || isRenaming}
        enableResizing={false}
        key={node.id}
        position={node.position}
        scale={viewport.zoom}
        size={size}
        onDragStop={handleNodeDragStop(node.id)}
      >
        <div
          className={`${styles.node} ${isSelected ? styles.nodeSelected : ''} ${isEditing || isRenaming ? styles.nodeEditing : ''} ${canAcceptPendingConnection ? styles.nodeConnectable : ''}`}
          data-studio-ignore-selection="true"
          onClick={(event) => {
            event.stopPropagation();
            handleNodeSelect(node, event.metaKey || event.ctrlKey || event.shiftKey);
          }}
          onDoubleClick={(event) => {
            event.stopPropagation();
            handleNodeDoubleClick(node);
          }}
          onPointerUp={(event) => {
            if (!pendingConnection?.sourceId || connectableInputPorts.length === 0) return;

            event.preventDefault();
            event.stopPropagation();

            const point = getCanvasPoint(event.clientX, event.clientY) || node.position;
            const preferredTarget =
              findConnectionTarget(
                point,
                pendingConnection.sourceId,
                pendingConnection.sourcePortId,
              ) ||
              (() => {
                const nearestPortId = getPreferredStudioTargetPortId({
                  point,
                  ports: connectableInputPorts,
                  targetNode: node,
                });

                return nearestPortId
                  ? { targetId: node.id, targetPortId: nearestPortId }
                  : undefined;
              })();

            if (preferredTarget?.targetId === node.id && preferredTarget.targetPortId) {
              handleCompleteConnection(
                pendingConnection.sourceId,
                pendingConnection.sourcePortId,
                node.id,
                preferredTarget.targetPortId,
              );
              setPendingConnection(undefined);
            }
          }}
        >
          {visibleInputPorts.map((port) => {
            const anchor = getNodeInputAnchor(node, port.id);
            const top = anchor.y - node.position.y;
            const portTargeted =
              pendingConnection?.targetId === node.id && pendingTargetPortId === port.id;
            const portConnectable = connectableInputPortIds.has(port.id);

            return (
              <div
                className={`${styles.nodePortWrap} ${styles.nodePortWrapInput}`}
                key={`${node.id}-${port.id}-input`}
                style={{ top }}
                onPointerEnter={() => {
                  if (!pendingConnection?.sourceId || !portConnectable) return;

                  setPendingConnection((current) =>
                    !current || (current.targetId === node.id && current.targetPortId === port.id)
                      ? current
                      : {
                          ...current,
                          targetId: node.id,
                          targetPortId: port.id,
                        },
                  );
                }}
                onPointerLeave={() => {
                  if (
                    !pendingConnection?.sourceId ||
                    pendingConnection.targetId !== node.id ||
                    pendingConnection.targetPortId !== port.id
                  ) {
                    return;
                  }

                  setPendingConnection((current) =>
                    !current ||
                    (current.targetId === undefined && current.targetPortId === undefined)
                      ? current
                      : {
                          ...current,
                          targetId: undefined,
                          targetPortId: undefined,
                        },
                  );
                }}
                onPointerUp={(event) => {
                  if (!pendingConnection?.sourceId || !portConnectable) return;

                  event.preventDefault();
                  event.stopPropagation();
                  handleCompleteConnection(
                    pendingConnection.sourceId,
                    pendingConnection.sourcePortId,
                    node.id,
                    port.id,
                  );
                  setPendingConnection(undefined);
                }}
              >
                <button
                  className={`${styles.nodePort} ${styles.nodePortInput} ${portConnectable ? styles.nodePortConnectable : ''} ${portTargeted ? styles.nodePortTarget : ''}`}
                  title={t('mcpStudio.connections.incoming')}
                  type="button"
                />
              </div>
            );
          })}
          {visibleOutputPorts.map((port) => {
            const anchor = getNodeOutputAnchor(node, port.id);
            const top = anchor.y - node.position.y;
            const portActive =
              pendingConnection?.sourceId === node.id && pendingSourcePortId === port.id;

            return (
              <div
                className={`${styles.nodePortWrap} ${styles.nodePortWrapOutput}`}
                key={`${node.id}-${port.id}-output`}
                style={{ top }}
                onPointerDown={(event) => handleStartConnection(event, node.id, port.id)}
              >
                <button
                  className={`${styles.nodePort} ${styles.nodePortOutput} ${portActive ? styles.nodePortActive : ''}`}
                  title={t('mcpStudio.connections.outgoing')}
                  type="button"
                />
              </div>
            );
          })}

          <Flexbox gap={12} height={'100%'}>
            <Flexbox gap={6}>
              <Flexbox horizontal align={'center'} className={styles.nodeTitleRow} gap={8}>
                <Flexbox
                  horizontal
                  align={'center'}
                  gap={8}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    setRenamingNodeId(node.id);
                    setEditingNodeId(undefined);
                  }}
                >
                  <Icon icon={icon} />
                  {isRenaming ? (
                    <Input
                      autoFocus
                      className={styles.nodeTitleInput}
                      size="small"
                      value={node.data.title}
                      onBlur={() => setRenamingNodeId(undefined)}
                      onChange={(event) => updateNodeTitle(node.id, event.target.value)}
                      onPressEnter={() => setRenamingNodeId(undefined)}
                    />
                  ) : (
                    <Text strong>{node.data.title}</Text>
                  )}
                </Flexbox>
                {previewNodeId === node.id && (
                  <Tag color={'success'}>{t('mcpStudio.runtime.output')}</Tag>
                )}
              </Flexbox>
            </Flexbox>

            {isEditing && node.type === 'input' ? (
              <Input.TextArea
                autoFocus
                autoSize={{ minRows: 4, maxRows: 10 }}
                value={node.data.humanPrompt}
                onBlur={() => setEditingNodeId(undefined)}
                onChange={(event) =>
                  updateNode(node.id, (current) =>
                    current.type === 'input'
                      ? {
                          ...current,
                          data: {
                            ...current.data,
                            humanPrompt: event.target.value,
                          },
                        }
                      : current,
                  )
                }
              />
            ) : isEditing && node.type === 'agent' ? (
              <Input.TextArea
                autoFocus
                autoSize={{ minRows: 4, maxRows: 10 }}
                value={node.data.prompt}
                onBlur={() => setEditingNodeId(undefined)}
                onChange={(event) =>
                  updateNode(node.id, (current) =>
                    current.type === 'agent'
                      ? {
                          ...current,
                          data: {
                            ...current.data,
                            prompt: event.target.value,
                          },
                        }
                      : current,
                  )
                }
              />
            ) : isEditing && node.type === 'transform' ? (
              <Input.TextArea
                autoFocus
                autoSize={{ minRows: 4, maxRows: 10 }}
                value={node.data.prompt}
                onBlur={() => setEditingNodeId(undefined)}
                onChange={(event) =>
                  updateNode(node.id, (current) =>
                    current.type === 'transform'
                      ? {
                          ...current,
                          data: {
                            ...current.data,
                            prompt: event.target.value,
                          },
                        }
                      : current,
                  )
                }
              />
            ) : (
              <Text className={styles.nodeText}>
                {createNodeSummary(node, availableAgents, servers, t)}
              </Text>
            )}
          </Flexbox>
        </div>
      </Rnd>
    );
  };

  const renderSelectedNodePanel = () => {
    if (!selectedNode) return null;

    const incomingEdges = edges.filter((edge) => edge.target === selectedNode.id);
    const outgoingEdges = edges.filter((edge) => edge.source === selectedNode.id);

    return (
      <Flexbox className={styles.sidebarCard} gap={16}>
        <Flexbox horizontal align={'center'} justify={'space-between'}>
          <Flexbox gap={4}>
            <Text strong>{t('mcpStudio.panel.selected')}</Text>
            <Text type={'secondary'}>{selectedNode.data.title}</Text>
          </Flexbox>
          <div className={styles.actions}>
            {selectedNode.type === 'chat-output' && previewNodeId !== selectedNode.id && (
              <Button size={'small'} onClick={() => setPreviewNodeId(selectedNode.id)}>
                {t('mcpStudio.runtime.setOutput')}
              </Button>
            )}
            <Button
              icon={<Icon icon={Trash2} />}
              size={'small'}
              onClick={() => handleDeleteNode(selectedNode.id)}
            />
          </div>
        </Flexbox>

        <Input
          placeholder={t('mcpStudio.node.title')}
          value={selectedNode.data.title}
          onChange={(event) => updateNodeTitle(selectedNode.id, event.target.value)}
        />

        {supportsStudioNodeBreakpoint(selectedNode.type) && (
          <div className={styles.connectionItem}>
            <Flexbox gap={4}>
              <Text strong>{t('mcpStudio.breakpoint.label')}</Text>
              <Text type={'secondary'}>{t('mcpStudio.breakpoint.desc')}</Text>
            </Flexbox>
            <Switch
              checked={'breakpoint' in selectedNode.data && selectedNode.data.breakpoint === true}
              onChange={(checked) =>
                updateNode(selectedNode.id, (node) =>
                  node.type === 'agent' || node.type === 'mcp-tool' || node.type === 'transform'
                    ? {
                        ...node,
                        data: {
                          ...node.data,
                          breakpoint: checked,
                        },
                      }
                    : node,
                )
              }
            />
          </div>
        )}

        {selectedNode.type === 'input' && (
          <Input.TextArea
            autoSize={{ minRows: 5, maxRows: 10 }}
            placeholder={t('mcpStudio.input.prompt')}
            value={selectedNode.data.humanPrompt}
            onChange={(event) =>
              updateNode(selectedNode.id, (node) =>
                node.type === 'input'
                  ? {
                      ...node,
                      data: {
                        ...node.data,
                        humanPrompt: event.target.value,
                      },
                    }
                  : node,
              )
            }
          />
        )}

        {selectedNode.type === 'agent' && (
          <Flexbox gap={12}>
            <Select
              options={agentOptions}
              placeholder={t('mcpStudio.agent.select')}
              style={{ width: '100%' }}
              value={selectedNode.data.agentId}
              onChange={(value) => void handleSelectAgent(selectedNode.id, value)}
            />

            {selectedAgent ? (
              <div className={styles.entityCard}>
                <Avatar
                  avatar={selectedAgent.avatar || <Icon icon={Bot} size={20} />}
                  background={selectedAgent.backgroundColor || undefined}
                  shape={'square'}
                  size={44}
                />
                <Flexbox className={styles.entityMeta} gap={4}>
                  <Text strong>{selectedAgent.title || selectedAgent.id}</Text>
                  <Text type={'secondary'}>
                    {selectedAgent.description || t('mcpStudio.agent.empty')}
                  </Text>
                  <div className={styles.entityTags}>
                    <Tag>{effectiveAgentProvider}</Tag>
                    <Tag>{effectiveAgentModel}</Tag>
                    {effectiveAgentMemoryEnabled && <Tag>{t('mcpStudio.agent.memory')}</Tag>}
                  </div>
                </Flexbox>
              </div>
            ) : (
              <Alert
                showIcon
                description={t('mcpStudio.agent.empty')}
                message={t('mcpStudio.agent.title')}
                type="warning"
              />
            )}

            {selectedNode.data.agentId && (
              <>
                <Flexbox gap={6}>
                  <Text strong>{t('mcpStudio.agent.model')}</Text>
                  <ModelSelect
                    style={{ width: '100%' }}
                    value={{ model: effectiveAgentModel, provider: effectiveAgentProvider }}
                    onChange={({ model, provider }) =>
                      updateNode(selectedNode.id, (node) =>
                        node.type === 'agent'
                          ? {
                              ...node,
                              data: {
                                ...node.data,
                                model,
                                provider,
                              },
                            }
                          : node,
                      )
                    }
                  />
                </Flexbox>

                <Flexbox gap={6}>
                  <Text strong>{t('mcpStudio.agent.systemRole')}</Text>
                  <Input.TextArea
                    autoSize={{ minRows: 4, maxRows: 8 }}
                    placeholder={t('mcpStudio.agent.systemRole')}
                    value={effectiveAgentSystemRole}
                    onChange={(event) =>
                      updateNode(selectedNode.id, (node) =>
                        node.type === 'agent'
                          ? {
                              ...node,
                              data: {
                                ...node.data,
                                systemRole: event.target.value,
                              },
                            }
                          : node,
                      )
                    }
                  />
                </Flexbox>

                <div className={styles.connectionItem}>
                  <Flexbox gap={4}>
                    <Text strong>{t('mcpStudio.agent.memory')}</Text>
                    <Text type={'secondary'}>{t('mcpStudio.agent.memoryDesc')}</Text>
                  </Flexbox>
                  <Switch
                    checked={effectiveAgentMemoryEnabled}
                    onChange={(checked) =>
                      updateNode(selectedNode.id, (node) =>
                        node.type === 'agent'
                          ? {
                              ...node,
                              data: {
                                ...node.data,
                                memoryEnabled: checked,
                              },
                            }
                          : node,
                      )
                    }
                  />
                </div>

                <Flexbox gap={6}>
                  <Text strong>{t('mcpStudio.agent.params')}</Text>
                  <Input.TextArea
                    autoSize={{ minRows: 5, maxRows: 10 }}
                    placeholder={t('mcpStudio.agent.params')}
                    value={effectiveAgentParams}
                    onChange={(event) =>
                      updateNode(selectedNode.id, (node) =>
                        node.type === 'agent'
                          ? {
                              ...node,
                              data: {
                                ...node.data,
                                params: event.target.value,
                              },
                            }
                          : node,
                      )
                    }
                  />
                </Flexbox>
              </>
            )}

            <Input.TextArea
              autoSize={{ minRows: 7, maxRows: 12 }}
              placeholder={t('mcpStudio.agent.prompt')}
              ref={promptTextareaRef}
              value={selectedNode.data.prompt}
              onChange={(event) =>
                updateNode(selectedNode.id, (node) =>
                  node.type === 'agent'
                    ? {
                        ...node,
                        data: {
                          ...node.data,
                          prompt: event.target.value,
                        },
                      }
                    : node,
                )
              }
            />

            <div className={styles.variablePanel}>
              <Text strong>{t('mcpStudio.variables.title')}</Text>
              <div className={styles.variableButtons}>
                {transformVariableOptions.map((item) => (
                  <Button
                    key={item.token}
                    size={'small'}
                    onClick={() => insertPromptVariable(item.token)}
                  >
                    {`${item.label} · ${item.token}`}
                  </Button>
                ))}
              </div>
            </div>
          </Flexbox>
        )}

        {selectedNode.type === 'resource' && (
          <Flexbox gap={12}>
            <Segmented
              block
              value={selectedNode.data.kind}
              options={[
                { label: t('mcpStudio.resource.kind.text'), value: 'text' },
                { label: t('mcpStudio.resource.kind.image'), value: 'image' },
                { label: t('mcpStudio.resource.kind.file'), value: 'file' },
              ]}
              onChange={(value) =>
                updateResourceNode(selectedNode.id, (data) => ({
                  ...data,
                  kind: value as StudioResourceKind,
                  sourceType: data.sourceType || 'manual',
                }))
              }
            />

            <Input
              placeholder={t('mcpStudio.resource.sourceLabel')}
              value={selectedNode.data.sourceLabel}
              onChange={(event) =>
                updateNode(selectedNode.id, (node) =>
                  node.type === 'resource'
                    ? syncConcreteNodeTitle(node, {
                        ...node,
                        data: {
                          ...node.data,
                          sourceLabel: event.target.value,
                          sourceType: node.data.sourceType || 'manual',
                        },
                      })
                    : node,
                )
              }
            />

            <Input
              placeholder={t('mcpStudio.resource.sourceUri')}
              value={selectedNode.data.sourceUri}
              onChange={(event) =>
                updateNode(selectedNode.id, (node) =>
                  node.type === 'resource'
                    ? syncConcreteNodeTitle(node, {
                        ...node,
                        data: {
                          ...node.data,
                          sourceType: node.data.sourceType || 'manual',
                          sourceUri: event.target.value,
                        },
                      })
                    : node,
                )
              }
            />

            <Input
              placeholder={t('mcpStudio.resource.mimeType')}
              value={selectedNode.data.mimeType}
              onChange={(event) =>
                updateResourceNode(selectedNode.id, (data) => ({
                  ...data,
                  mimeType: event.target.value,
                  sourceType: data.sourceType || 'manual',
                }))
              }
            />

            <div className={styles.actions}>
              <input
                hidden
                ref={resourceFileInputRef}
                type="file"
                onChange={(event) => {
                  void handleUploadResourceFile(selectedNode.id, event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
              <Button
                icon={<Icon icon={Upload} />}
                onClick={() => resourceFileInputRef.current?.click()}
              >
                {t('mcpStudio.resource.upload')}
              </Button>
              <Tag>{t(`mcpStudio.resource.sourceType.${selectedNode.data.sourceType}`)}</Tag>
              {typeof selectedNode.data.sizeBytes === 'number' && (
                <Tag>{`${selectedNode.data.sizeBytes} B`}</Tag>
              )}
            </div>

            <Alert
              showIcon
              description={t('mcpStudio.resource.importDesc')}
              message={t('mcpStudio.resource.importTitle')}
              type="info"
            />

            <Select
              options={skillOptions}
              placeholder={t('mcpStudio.resource.importSkill')}
              style={{ width: '100%' }}
              value={selectedNode.data.skillId}
              onChange={(value) => void handleSelectResourceSkill(selectedNode.id, value)}
            />

            <Select
              disabled={!selectedNode.data.skillId}
              options={selectedResourceOptions}
              placeholder={t('mcpStudio.resource.path')}
              style={{ width: '100%' }}
              value={selectedNode.data.resourcePath}
              onChange={(value) => {
                if (!selectedNode.data.skillId) return;

                void handleImportResourceNode(selectedNode.id, selectedNode.data.skillId, value);
              }}
            />

            <Input.TextArea
              autoSize={{ minRows: 8, maxRows: 16 }}
              placeholder={t('mcpStudio.resource.content')}
              value={selectedNode.data.content}
              onChange={(event) =>
                updateResourceNode(selectedNode.id, (data) => ({
                  ...data,
                  content: event.target.value,
                  sourceType: data.sourceType || 'manual',
                }))
              }
            />
          </Flexbox>
        )}

        {selectedNode.type === 'skill' && (
          <Flexbox gap={12}>
            <Select
              options={skillOptions}
              placeholder={t('mcpStudio.skill.skill')}
              style={{ width: '100%' }}
              value={selectedNode.data.skillId}
              onChange={(value) => void handleImportSkillNode(selectedNode.id, value)}
            />

            {selectedSkill && (
              <div className={styles.entityCard}>
                <Avatar avatar={getSkillAvatar(selectedSkill) || '🧩'} shape={'square'} size={44} />
                <Flexbox className={styles.entityMeta} gap={4}>
                  <Text strong>{selectedSkill.name}</Text>
                  <Text type={'secondary'}>
                    {selectedSkill.description || selectedSkill.manifest.description}
                  </Text>
                  <div className={styles.entityTags}>
                    <Tag>{selectedSkill.source}</Tag>
                  </div>
                </Flexbox>
              </div>
            )}

            <Input.TextArea
              autoSize={{ minRows: 8, maxRows: 16 }}
              placeholder={t('mcpStudio.skill.content')}
              value={selectedNode.data.content}
              onChange={(event) =>
                updateNode(selectedNode.id, (node) =>
                  node.type === 'skill'
                    ? {
                        ...node,
                        data: {
                          ...node.data,
                          content: event.target.value,
                        },
                      }
                    : node,
                )
              }
            />
          </Flexbox>
        )}

        {selectedNode.type === 'mcp-tool' && (
          <Flexbox gap={12}>
            <Select
              placeholder={t('mcpStudio.connection.identifier')}
              style={{ width: '100%' }}
              value={selectedNode.data.serverId}
              options={servers.map((server) => ({
                label:
                  server.origin === 'installed'
                    ? `${server.name} · ${t('mcpStudio.connection.installed')}`
                    : server.name,
                value: server.id,
              }))}
              onChange={(value) =>
                updateNode(selectedNode.id, (node) => {
                  if (node.type !== 'mcp-tool') return node;

                  const previousServerName = servers.find(
                    (server) => server.id === node.data.serverId,
                  )?.name;
                  const nextServer = servers.find((server) => server.id === value);
                  const nextNode: StudioCanvasNode = {
                    ...node,
                    data: {
                      ...node.data,
                      payload: buildDefaultToolArguments(nextServer?.tools[0]?.parameters),
                      serverId: value,
                      toolName: nextServer?.tools[0]?.name,
                    },
                  };

                  return syncConcreteNodeTitle(node, nextNode, {
                    nextServerName: nextServer?.name,
                    previousServerName,
                  });
                })
              }
            />

            {selectedServer && (
              <div className={styles.entityCard}>
                <Avatar
                  shape={'square'}
                  size={44}
                  avatar={
                    selectedServer.avatar || (
                      <Icon
                        icon={selectedServer.connection.type === 'stdio' ? TerminalSquare : Globe}
                        size={20}
                      />
                    )
                  }
                />
                <Flexbox className={styles.entityMeta} gap={4}>
                  <Text strong>{selectedServer.name}</Text>
                  <Text type={'secondary'}>
                    {selectedServer.description || t('mcpStudio.tool.desc')}
                  </Text>
                  <div className={styles.entityTags}>
                    <Tag>{selectedServer.connection.type.toUpperCase()}</Tag>
                    {selectedServer.origin === 'installed' && (
                      <Tag>{t('mcpStudio.connection.installed')}</Tag>
                    )}
                  </div>
                </Flexbox>
              </div>
            )}

            <Select
              disabled={!selectedServer}
              placeholder={t('mcpStudio.tool.title')}
              style={{ width: '100%' }}
              value={selectedNode.data.toolName}
              options={(selectedServer?.tools || []).map((tool) => ({
                label: tool.name,
                value: tool.name,
              }))}
              onChange={(value) =>
                updateNode(selectedNode.id, (node) => {
                  if (node.type !== 'mcp-tool') return node;

                  const serverName = servers.find(
                    (server) => server.id === node.data.serverId,
                  )?.name;
                  const nextNode: StudioCanvasNode = {
                    ...node,
                    data: {
                      ...node.data,
                      payload: buildDefaultToolArguments(
                        selectedServer?.tools.find((tool) => tool.name === value)?.parameters,
                      ),
                      toolName: value,
                    },
                  };

                  return syncConcreteNodeTitle(node, nextNode, {
                    nextServerName: serverName,
                    previousServerName: serverName,
                  });
                })
              }
            />

            <Input.TextArea
              autoSize={{ minRows: 7, maxRows: 12 }}
              placeholder={t('mcpStudio.tool.parameters')}
              value={selectedNode.data.payload}
              onChange={(event) =>
                updateNode(selectedNode.id, (node) =>
                  node.type === 'mcp-tool'
                    ? {
                        ...node,
                        data: {
                          ...node.data,
                          payload: event.target.value,
                        },
                      }
                    : node,
                )
              }
            />

            <div className={styles.connectionItem}>
              <Flexbox gap={4}>
                <Text strong>{t('mcpStudio.binding.title')}</Text>
                <Text type={'secondary'}>
                  {incomingEdges.length > 0
                    ? t('mcpStudio.binding.count', {
                        count: incomingEdges.reduce(
                          (count, edge) =>
                            count +
                            (edge.payloadBindings?.length ||
                              (incomingEdges.length === 1
                                ? selectedNode.data.payloadBindings.length
                                : 0)),
                          0,
                        ),
                      })
                    : t('mcpStudio.wire.attachPrompt')}
                </Text>
              </Flexbox>
            </div>

            {incomingEdges.map((edge) => (
              <div className={styles.connectionItem} key={edge.id}>
                <Text>{`${getEdgeRouteLabel(edge)} · ${getEdgeSummary(edge)}`}</Text>
                <Button size={'small'} onClick={() => handleEdgeSelect(edge.id)}>
                  {t('mcpStudio.wire.openInspector')}
                </Button>
              </div>
            ))}

            {Boolean(selectedTool?.parameters) && (
              <Alert
                showIcon
                message={selectedTool?.description || t('mcpStudio.tool.desc')}
                type="info"
              />
            )}
          </Flexbox>
        )}

        {selectedNode.type === 'transform' && (
          <Flexbox gap={12}>
            <Segmented
              block
              value={selectedNode.data.mode}
              options={[
                { label: t('mcpStudio.transform.mode.instruction'), value: 'instruction' },
                { label: t('mcpStudio.transform.mode.template'), value: 'template' },
              ]}
              onChange={(value) =>
                updateNode(selectedNode.id, (node) =>
                  node.type === 'transform'
                    ? {
                        ...node,
                        data: {
                          ...node.data,
                          mode: value as 'instruction' | 'template',
                        },
                      }
                    : node,
                )
              }
            />
            <Input.TextArea
              autoSize={{ minRows: 7, maxRows: 12 }}
              placeholder={t('mcpStudio.transform.prompt')}
              ref={promptTextareaRef}
              value={selectedNode.data.prompt}
              onChange={(event) =>
                updateNode(selectedNode.id, (node) =>
                  node.type === 'transform'
                    ? {
                        ...node,
                        data: {
                          ...node.data,
                          prompt: event.target.value,
                        },
                      }
                    : node,
                )
              }
            />
            <div className={styles.variablePanel}>
              <Text strong>{t('mcpStudio.variables.title')}</Text>
              <div className={styles.variableButtons}>
                {transformVariableOptions.map((item) => (
                  <Button
                    key={item.token}
                    size={'small'}
                    onClick={() => insertPromptVariable(item.token)}
                  >
                    {`${item.label} · ${item.token}`}
                  </Button>
                ))}
              </div>
            </div>
          </Flexbox>
        )}

        <Flexbox gap={8}>
          <Text strong>{t('mcpStudio.connections.title')}</Text>
          {incomingEdges.length === 0 && outgoingEdges.length === 0 ? (
            <Text type={'secondary'}>{t('mcpStudio.connections.none')}</Text>
          ) : null}
          {incomingEdges.map((edge) => (
            <div className={styles.connectionItem} key={edge.id}>
              <Text>{`${t('mcpStudio.connections.incoming')}: ${getEdgeRouteLabel(edge)}`}</Text>
              <Flexbox horizontal gap={8}>
                <Button size={'small'} onClick={() => handleEdgeSelect(edge.id)}>
                  {t('mcpStudio.wire.openInspector')}
                </Button>
                <Button
                  icon={<Icon icon={Link2Off} />}
                  size={'small'}
                  onClick={() => handleRemoveEdge(edge.id)}
                />
              </Flexbox>
            </div>
          ))}
          {outgoingEdges.map((edge) => (
            <div className={styles.connectionItem} key={edge.id}>
              <Text>{`${t('mcpStudio.connections.outgoing')}: ${getEdgeRouteLabel(edge)}`}</Text>
              <Button
                icon={<Icon icon={Link2Off} />}
                size={'small'}
                onClick={() => handleRemoveEdge(edge.id)}
              />
            </div>
          ))}
        </Flexbox>
      </Flexbox>
    );
  };

  const renderSelectedEdgePanel = () => {
    if (!selectedEdge || !selectedEdgeSourceNode || !selectedEdgeTargetNode) return null;

    const editableBindings =
      selectedEdgeTargetNode.type === 'mcp-tool'
        ? selectedEdge.payloadBindings?.length
          ? selectedEdge.payloadBindings
          : edges.filter((edge) => edge.target === selectedEdge.target).length === 1
            ? selectedEdgeTargetNode.data.payloadBindings
            : []
        : undefined;

    return (
      <Flexbox className={styles.sidebarCard} gap={16}>
        <Flexbox horizontal align={'center'} justify={'space-between'}>
          <Flexbox gap={4}>
            <Text strong>{t('mcpStudio.panel.wire')}</Text>
            <Text type={'secondary'}>{getEdgeRouteLabel(selectedEdge)}</Text>
          </Flexbox>
          <Button
            icon={<Icon icon={Link2Off} />}
            size={'small'}
            onClick={() => handleRemoveEdge(selectedEdge.id)}
          />
        </Flexbox>

        <div className={styles.wireRoute}>
          <Text>{selectedEdgeSourceNode.data.title}</Text>
          <Icon icon={ArrowRight} size={14} />
          <Text>{selectedEdgeTargetNode.data.title}</Text>
          <Text type={'secondary'}>{getEdgeSummary(selectedEdge)}</Text>
        </div>

        {editableBindings ? (
          <Flexbox className={styles.variablePanel} gap={8}>
            <Flexbox horizontal align={'center'} justify={'space-between'}>
              <Flexbox gap={4}>
                <Text strong>{t('mcpStudio.binding.title')}</Text>
                <Text type={'secondary'}>{t('mcpStudio.wire.bindingDesc')}</Text>
              </Flexbox>
              <Button
                icon={<Icon icon={CirclePlus} />}
                size={'small'}
                onClick={() =>
                  updateToolBindingsForEdge(selectedEdge.id, (bindings) => [
                    ...bindings,
                    createStudioPayloadBinding(),
                  ])
                }
              >
                {t('mcpStudio.binding.add')}
              </Button>
            </Flexbox>

            {editableBindings.length === 0 ? (
              <Text type={'secondary'}>{t('mcpStudio.binding.empty')}</Text>
            ) : (
              editableBindings.map((binding) => (
                <div className={styles.bindingRow} key={binding.id}>
                  <Select
                    options={bindingSourceOptions}
                    style={{ width: '100%' }}
                    value={binding.source}
                    onChange={(value) =>
                      updateToolBindingsForEdge(selectedEdge.id, (bindings) =>
                        bindings.map((item) =>
                          item.id === binding.id
                            ? {
                                ...item,
                                source: value as StudioPayloadBindingSource,
                              }
                            : item,
                        ),
                      )
                    }
                  />
                  <div className={styles.bindingArrow}>
                    <Icon icon={ArrowRight} size={14} />
                  </div>
                  <Input
                    placeholder={t('mcpStudio.binding.target')}
                    value={binding.targetPath}
                    onChange={(event) =>
                      updateToolBindingsForEdge(selectedEdge.id, (bindings) =>
                        bindings.map((item) =>
                          item.id === binding.id
                            ? {
                                ...item,
                                targetPath: event.target.value,
                              }
                            : item,
                        ),
                      )
                    }
                  />
                  <Button
                    icon={<Icon icon={Trash2} />}
                    size={'small'}
                    onClick={() =>
                      updateToolBindingsForEdge(selectedEdge.id, (bindings) =>
                        bindings.filter((item) => item.id !== binding.id),
                      )
                    }
                  />
                </div>
              ))
            )}
          </Flexbox>
        ) : (
          <Alert
            showIcon
            description={t('mcpStudio.wire.readonlyDesc')}
            message={t('mcpStudio.wire.readonlyTitle')}
            type="info"
          />
        )}
      </Flexbox>
    );
  };

  const renderSelectionPanel = () => {
    if (selectionCount === 0) return null;

    return (
      <Flexbox className={styles.sidebarCard} gap={16}>
        <Flexbox horizontal align={'center'} justify={'space-between'}>
          <Flexbox gap={4}>
            <Text strong>{t('mcpStudio.selection.title')}</Text>
            <Text type={'secondary'}>
              {t('mcpStudio.selection.count', {
                edges: selectedEdgeIds.length,
                nodes: selectedNodeIds.length,
              })}
            </Text>
          </Flexbox>
          <div className={styles.actions}>
            <Button size={'small'} onClick={clearSelection}>
              {t('mcpStudio.selection.clear')}
            </Button>
            <Button
              danger
              icon={<Icon icon={Trash2} />}
              size={'small'}
              onClick={handleDeleteSelection}
            >
              {t('mcpStudio.selection.delete')}
            </Button>
          </div>
        </Flexbox>

        <Alert
          showIcon
          description={t('mcpStudio.selection.shortcut')}
          message={t('mcpStudio.selection.desc')}
          type="info"
        />
      </Flexbox>
    );
  };

  const renderPreviewPanel = () => (
    <Flexbox className={`${styles.sidebarCard} ${styles.scrollPanel}`} gap={16}>
      <Flexbox horizontal align={'center'} justify={'space-between'}>
        <Flexbox gap={4}>
          <Text strong>{t('mcpStudio.panel.runtime')}</Text>
          <Text type={'secondary'}>
            {previewNode?.data.title || t('mcpStudio.runtime.noOutput')}
          </Text>
        </Flexbox>
        {lastRunAt && <Tag>{`${t('mcpStudio.meta.lastRun')}: ${lastRunAt}`}</Tag>}
      </Flexbox>

      <div className={styles.actions} style={{ justifyContent: 'flex-start' }}>
        {canRunPreview ? (
          <Button
            icon={<Icon icon={Play} />}
            loading={runLoading}
            type={'primary'}
            onClick={handleRun}
          >
            {t('mcpStudio.run.execute')}
          </Button>
        ) : (
          <Text type={'secondary'}>{t('mcpStudio.run.unavailable')}</Text>
        )}
      </div>

      {breakpointInfo && (
        <Alert
          showIcon
          message={t('mcpStudio.runtime.breakpoint')}
          type="warning"
          description={t('mcpStudio.runtime.breakpointDesc', {
            nodeTitle: breakpointInfo.nodeTitle,
          })}
        />
      )}

      <div className={styles.runtimePreview}>
        <Flexbox gap={12}>
          <div className={styles.chatRow}>
            <span className={styles.chatRole}>{t('mcpStudio.chat.system')}</span>
            <Text>{chatPreview.system}</Text>
          </div>
          <div className={styles.chatRow}>
            <span className={styles.chatRole}>{t('mcpStudio.chat.user')}</span>
            <Text>{chatPreview.user}</Text>
          </div>
          <div className={styles.chatRow}>
            <span className={styles.chatRole}>{t('mcpStudio.chat.assistant')}</span>
            <Text>{chatPreview.assistant}</Text>
          </div>
        </Flexbox>
      </div>

      <Flexbox gap={8}>
        <Text strong>{t('mcpStudio.preview.result')}</Text>
        <div className={styles.resultBody}>
          {toolResult?.content || executedChatPreview?.assistant ? (
            <Markdown>{toolResult?.content || executedChatPreview?.assistant || ''}</Markdown>
          ) : (
            <Text type={'secondary'}>{t('mcpStudio.preview.empty')}</Text>
          )}
        </div>
      </Flexbox>

      <Flexbox gap={8}>
        <Flexbox horizontal align={'center'} justify={'space-between'}>
          <Text strong>{t('mcpStudio.preview.dsl')}</Text>
          <Tag>{t('mcpStudio.meta.ready')}</Tag>
        </Flexbox>
        <div className={styles.resultBody}>
          <pre className={styles.codeBlock}>{workflowDsl}</pre>
        </div>
      </Flexbox>
    </Flexbox>
  );

  const nodeTypeOptions: Array<{ label: string; type: StudioCanvasNode['type'] }> = [
    { label: t('mcpStudio.node.input'), type: 'input' },
    { label: t('mcpStudio.node.resource'), type: 'resource' },
    { label: t('mcpStudio.node.skill'), type: 'skill' },
    { label: t('mcpStudio.node.agent'), type: 'agent' },
    { label: t('mcpStudio.node.tool'), type: 'mcp-tool' },
    { label: t('mcpStudio.node.transform'), type: 'transform' },
    { label: t('mcpStudio.node.chat'), type: 'chat-output' },
  ];

  return (
    <Flexbox className={styles.workspace} gap={16}>
      <Flexbox horizontal align={'center'} className={styles.toolbar} gap={8} wrap={'wrap'}>
        <div className={styles.toolbarGroup}>
          {nodeTypeOptions.map((item) => (
            <Button
              className={styles.toolButton}
              key={item.type}
              icon={
                <Icon
                  icon={
                    item.type === 'mcp-tool'
                      ? Wrench
                      : getNodeTypeIcon(createStudioNode(item.type, { x: 0, y: 0 }))
                  }
                />
              }
              onClick={() => addBattery(item.type)}
            >
              {item.label}
            </Button>
          ))}
          <Button icon={<Icon icon={PlugZap} />} onClick={() => setServerModalOpen(true)}>
            {t('mcpStudio.toolbar.loadMcp')}
          </Button>
          <Button icon={<Icon icon={RotateCcw} />} onClick={handleAutoLayout}>
            {t('mcpStudio.toolbar.autoLayout')}
          </Button>
          {canRunPreview && (
            <Button icon={<Icon icon={Play} />} loading={runLoading} onClick={handleRun}>
              {t('mcpStudio.run.execute')}
            </Button>
          )}
        </div>

        <div className={styles.toolbarGroup}>
          <Tag>{`${availableAgents.length} ${t('mcpStudio.toolbar.agents')}`}</Tag>
          <Tag>{`${servers.length} ${t('mcpStudio.toolbar.servers')}`}</Tag>
          <Tag>{`${installedServers.length} ${t('mcpStudio.connection.installed')}`}</Tag>
          <Tag>{`${nodes.length} ${t('mcpStudio.toolbar.batteries')}`}</Tag>
          <Tag>{`${edges.length} ${t('mcpStudio.toolbar.wires')}`}</Tag>
        </div>

        <div className={styles.toolbarSpacer} />

        <div className={styles.toolbarGroup}>
          <Input
            placeholder={t('mcpStudio.library.name')}
            value={workflowName}
            onChange={(event) => setWorkflowName(event.target.value)}
          />
          <Button loading={workflowSaving} onClick={() => void handleSaveWorkflow()}>
            {t('mcpStudio.library.save')}
          </Button>
          <Select
            placeholder={t('mcpStudio.library.select')}
            style={{ minWidth: 220 }}
            value={selectedWorkflowId}
            options={workflowLibrary.map((item) => ({
              label: item.name,
              value: item.id,
            }))}
            onChange={setSelectedWorkflowId}
          />
          <Button disabled={!selectedWorkflow} onClick={handleLoadWorkflow}>
            {t('mcpStudio.library.load')}
          </Button>
          <Button onClick={handleNewWorkflow}>{t('mcpStudio.library.new')}</Button>
          <Button
            disabled={!selectedWorkflowId}
            loading={workflowSaving}
            onClick={() => void handleDeleteWorkflow()}
          >
            {t('mcpStudio.library.delete')}
          </Button>
        </div>
      </Flexbox>

      {errorMessage && <Alert showIcon message={errorMessage} type="warning" />}

      <div className={styles.workspaceBody}>
        <div className={styles.previewRail}>{renderPreviewPanel()}</div>

        <div className={styles.canvasWrap}>
          <div
            className={`${styles.canvasStage} ${spacePressed || isPanning ? styles.canvasStagePanReady : ''}`}
            ref={canvasRef}
            onDoubleClick={handleCanvasDoubleClick}
            onPointerDown={handleCanvasPointerDown}
            onWheel={handleCanvasWheel}
          >
            <div
              className={styles.canvasWorld}
              style={{
                height: canvasBounds.height,
                transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
                width: canvasBounds.width,
              }}
            >
              <div className={styles.canvasGrid} />
              <svg
                className={styles.edgeLayer}
                data-studio-ignore-selection="false"
                viewBox={`0 0 ${canvasBounds.width} ${canvasBounds.height}`}
                onPointerDown={handleCanvasPointerDown}
              >
                {edges.map((edge) => {
                  const sourceNode = getNode(edge.source);
                  const targetNode = getNode(edge.target);
                  if (!sourceNode || !targetNode) return null;

                  const isSelected = selectedEdgeIds.includes(edge.id);

                  return (
                    <g key={edge.id}>
                      <path
                        className={styles.edgeHitArea}
                        data-studio-ignore-selection="true"
                        d={buildConnectorPath({
                          channel: edge.channel,
                          sourcePortId: edge.sourcePortId,
                          source: sourceNode,
                          targetPortId: edge.targetPortId,
                          target: targetNode,
                        })}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleEdgeSelect(
                            edge.id,
                            event.metaKey || event.ctrlKey || event.shiftKey,
                          );
                        }}
                      />
                      <path
                        className={`${styles.edgePath} ${isSelected ? styles.edgePathSelected : ''}`}
                        data-studio-ignore-selection="true"
                        d={buildConnectorPath({
                          channel: edge.channel,
                          sourcePortId: edge.sourcePortId,
                          source: sourceNode,
                          targetPortId: edge.targetPortId,
                          target: targetNode,
                        })}
                      />
                    </g>
                  );
                })}
                {pendingConnection && pendingSourceNode && (
                  <path
                    className={styles.edgePathDraft}
                    d={buildConnectorPathFromPoints({
                      end: pendingTargetNode
                        ? getNodeInputAnchor(pendingTargetNode, pendingTargetPortId)
                        : pendingConnection.currentPosition,
                      start: getNodeOutputAnchor(pendingSourceNode, pendingSourcePortId),
                    })}
                  />
                )}
              </svg>

              {nodes.map(renderNode)}

              {palette && (
                <div
                  className={styles.palette}
                  data-studio-ignore-selection="true"
                  style={{ left: palette.x, top: palette.y }}
                >
                  <Flexbox gap={8}>
                    <Text strong>{t('mcpStudio.toolbar.addBattery')}</Text>
                    {nodeTypeOptions.map((item) => (
                      <Button
                        key={item.type}
                        icon={
                          <Icon
                            icon={
                              item.type === 'mcp-tool'
                                ? Wrench
                                : getNodeTypeIcon(createStudioNode(item.type, { x: 0, y: 0 }))
                            }
                          />
                        }
                        onClick={() => addBattery(item.type)}
                      >
                        {item.label}
                      </Button>
                    ))}
                  </Flexbox>
                </div>
              )}
            </div>

            {selectionBox && (
              <div
                className={styles.selectionBox}
                style={{
                  height:
                    Math.abs(
                      toViewportPoint(selectionBox.currentPosition).y -
                        toViewportPoint(selectionBox.origin).y,
                    ) || 0,
                  left: Math.min(
                    toViewportPoint(selectionBox.origin).x,
                    toViewportPoint(selectionBox.currentPosition).x,
                  ),
                  top: Math.min(
                    toViewportPoint(selectionBox.origin).y,
                    toViewportPoint(selectionBox.currentPosition).y,
                  ),
                  width:
                    Math.abs(
                      toViewportPoint(selectionBox.currentPosition).x -
                        toViewportPoint(selectionBox.origin).x,
                    ) || 0,
                }}
              />
            )}

            <div className={styles.viewportToolbar} data-studio-ignore-selection="true">
              <Button
                icon={<Icon icon={Minus} />}
                size={'small'}
                onClick={() => updateViewportZoom(viewport.zoom - STUDIO_ZOOM_STEP)}
              />
              <Tag>{`${Math.round(viewport.zoom * 100)}%`}</Tag>
              <Button
                icon={<Icon icon={ZoomIn} />}
                size={'small'}
                onClick={() => updateViewportZoom(viewport.zoom + STUDIO_ZOOM_STEP)}
              />
              <Button
                icon={<Icon icon={ScanSearch} />}
                size={'small'}
                onClick={() => fitViewportToNodes()}
              >
                {t('mcpStudio.toolbar.fitView')}
              </Button>
            </div>

            <div className={styles.stageHint} data-studio-ignore-selection="true">
              <Text type={'secondary'}>
                {`${t('mcpStudio.canvas.hint')} · ${t('mcpStudio.canvas.panZoom')}`}
              </Text>
            </div>
          </div>
        </div>

        <div className={styles.sidebar}>
          {selectionCount > 1 || (selectedNodeIds.length > 0 && selectedEdgeIds.length > 0)
            ? renderSelectionPanel()
            : selectedEdge
              ? renderSelectedEdgePanel()
              : renderSelectedNodePanel()}
        </div>
      </div>

      <Modal
        destroyOnClose
        okButtonProps={{ loading: connectLoading }}
        okText={t('mcpStudio.connection.connect')}
        open={serverModalOpen}
        title={t('mcpStudio.toolbar.loadMcp')}
        onCancel={() => setServerModalOpen(false)}
        onOk={handleLoadServer}
      >
        <Flexbox gap={12}>
          <Segmented
            block
            value={connectionMode}
            options={[
              { label: t('mcpStudio.connection.http'), value: 'http' },
              { label: t('mcpStudio.connection.stdio'), value: 'stdio' },
            ]}
            onChange={(value) => setConnectionMode(value as 'http' | 'stdio')}
          />

          {connectionMode === 'http' ? (
            <Flexbox gap={12}>
              <Input
                placeholder={t('mcpStudio.connection.identifier')}
                value={httpForm.identifier}
                onChange={(event) =>
                  setHttpForm((state) => ({ ...state, identifier: event.target.value }))
                }
              />
              <Input
                placeholder={t('mcpStudio.connection.url')}
                value={httpForm.url}
                onChange={(event) =>
                  setHttpForm((state) => ({ ...state, url: event.target.value }))
                }
              />
              <Select
                style={{ width: '100%' }}
                value={httpForm.authType}
                options={[
                  { label: t('mcpStudio.connection.authNone'), value: 'none' },
                  { label: t('mcpStudio.connection.authBearer'), value: 'bearer' },
                  { label: t('mcpStudio.connection.authOAuth'), value: 'oauth2' },
                ]}
                onChange={(value) =>
                  setHttpForm((state) => ({
                    ...state,
                    authType: value as 'bearer' | 'none' | 'oauth2',
                  }))
                }
              />
              {httpForm.authType !== 'none' && (
                <Input
                  placeholder={t('mcpStudio.connection.token')}
                  value={httpForm.token}
                  onChange={(event) =>
                    setHttpForm((state) => ({ ...state, token: event.target.value }))
                  }
                />
              )}
              <Input.TextArea
                autoSize={{ minRows: 4, maxRows: 8 }}
                placeholder={t('mcpStudio.connection.headers')}
                value={httpForm.headers}
                onChange={(event) =>
                  setHttpForm((state) => ({ ...state, headers: event.target.value }))
                }
              />
            </Flexbox>
          ) : (
            <Flexbox gap={12}>
              {!isDesktop && (
                <Alert showIcon message={t('mcpStudio.connection.desktopOnly')} type="info" />
              )}
              <Input
                placeholder={t('mcpStudio.connection.identifier')}
                value={stdioForm.identifier}
                onChange={(event) =>
                  setStdioForm((state) => ({ ...state, identifier: event.target.value }))
                }
              />
              <Input
                placeholder={t('mcpStudio.connection.command')}
                value={stdioForm.command}
                onChange={(event) =>
                  setStdioForm((state) => ({ ...state, command: event.target.value }))
                }
              />
              <Input.TextArea
                autoSize={{ minRows: 3, maxRows: 6 }}
                placeholder={t('mcpStudio.connection.args')}
                value={stdioForm.args}
                onChange={(event) =>
                  setStdioForm((state) => ({ ...state, args: event.target.value }))
                }
              />
              <Input.TextArea
                autoSize={{ minRows: 4, maxRows: 8 }}
                placeholder={t('mcpStudio.connection.env')}
                value={stdioForm.env}
                onChange={(event) =>
                  setStdioForm((state) => ({ ...state, env: event.target.value }))
                }
              />
            </Flexbox>
          )}
        </Flexbox>
      </Modal>
    </Flexbox>
  );
};

export default MCPWorkflowStudio;
