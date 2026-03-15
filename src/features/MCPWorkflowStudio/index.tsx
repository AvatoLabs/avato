'use client';

import { isDesktop } from '@lobechat/const';
import { type SkillListItem } from '@lobechat/types';
import { type LobeChatPluginManifest } from '@lobehub/chat-plugin-sdk';
import { Button, Flexbox, Icon, Markdown, Segmented, Tag, Text } from '@lobehub/ui';
import { Alert, App, Input, Modal, Select } from 'antd';
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
  Link2Off,
  Play,
  PlugZap,
  RotateCcw,
  Sparkles,
  TerminalSquare,
  Trash2,
  Wrench,
} from 'lucide-react';
import {
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Rnd, type RndDragCallback } from 'react-rnd';

import {
  HUMAN_PROMPT_VARIABLE,
  SERVER_IDENTIFIER_VARIABLE,
  type StudioChatPreview,
  type StudioPayloadBindingSource,
  TOOL_NAME_VARIABLE,
  TOOL_RESULT_VARIABLE,
  UPSTREAM_RESULT_VARIABLE,
} from '@/libs/mcp/workflowStudio';
import { lambdaClient, toolsClient } from '@/libs/trpc/client';
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
  canConnectNodes,
  clampNodePositions,
  createDefaultStudioDraft,
  createStudioNode,
  createStudioPayloadBinding,
  estimateNodeSize,
  flattenStudioSkillResources,
  getNodeInputAnchor,
  getNodeInputPorts,
  getNodeOutputAnchor,
  getNodeOutputPorts,
  insertBindingToken,
  mergeStudioServers,
  parseStudioDraft,
  parseStudioWorkflowLibrary,
  STUDIO_DEFAULT_CANVAS_BOUNDS,
  STUDIO_STORAGE_KEY,
  type StudioCanvasNode,
  type StudioConnectionConfig,
  type StudioDraft,
  type StudioLoadedServer,
  type StudioNodePort,
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

const createNodeSummary = (node: StudioCanvasNode, servers: StudioLoadedServer[]) => {
  switch (node.type) {
    case 'input': {
      return node.data.humanPrompt || 'Double-click to edit the prompt.';
    }
    case 'resource': {
      return (
        [
          node.data.skillName,
          node.data.resourcePath,
          node.data.content ? 'Resource imported' : undefined,
        ]
          .filter(Boolean)
          .join(' · ') || 'Import a text resource from one of your skills.'
      );
    }
    case 'skill': {
      return (
        [node.data.skillName, node.data.content ? 'Skill imported' : undefined]
          .filter(Boolean)
          .join(' · ') || 'Import a skill into the graph.'
      );
    }
    case 'mcp-tool': {
      const server = node.data.serverId
        ? servers.find((item) => item.id === node.data.serverId)
        : undefined;
      return (
        [server?.name, node.data.toolName].filter(Boolean).join(' · ') ||
        'Pick an MCP server and a tool.'
      );
    }
    case 'transform': {
      return node.data.prompt || 'Double-click to edit the transform prompt.';
    }
    case 'chat-output': {
      return 'Select this output and run the graph to preview chat.';
    }
  }
};

const initialDraft = createDefaultStudioDraft();

const MCPWorkflowStudio = () => {
  const { t } = useTranslation('setting');
  const { message } = App.useApp();
  const { mobile } = useResponsive();
  const canvasRef = useRef<HTMLDivElement>(null);
  const pendingConnectionRef = useRef<StudioPendingConnection | undefined>(undefined);
  const transformTextareaRef = useRef<TextAreaRef>(null);

  const [nodes, setNodes] = useState<StudioCanvasNode[]>(initialDraft.nodes);
  const [edges, setEdges] = useState(initialDraft.edges);
  const [servers, setServers] = useState<StudioLoadedServer[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(
    initialDraft.selectedNodeId,
  );
  const [selectedEdgeId, setSelectedEdgeId] = useState<string>();
  const [previewNodeId, setPreviewNodeId] = useState<string | undefined>(
    initialDraft.previewNodeId,
  );
  const [palette, setPalette] = useState<StudioPaletteState>();
  const [pendingConnection, setPendingConnection] = useState<StudioPendingConnection>();
  const [editingNodeId, setEditingNodeId] = useState<string>();
  const [renamingNodeId, setRenamingNodeId] = useState<string>();
  const [canvasBounds, setCanvasBounds] = useState<{ height: number; width: number }>(
    STUDIO_DEFAULT_CANVAS_BOUNDS,
  );
  const [workflowLibrary, setWorkflowLibrary] = useState<StudioSavedWorkflow[]>([]);
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
  const [lastRunAt, setLastRunAt] = useState<string>();
  const [errorMessage, setErrorMessage] = useState<string>();

  const draft = useMemo<StudioDraft>(
    () => ({
      edges,
      nodes,
      previewNodeId,
      selectedNodeId,
      servers,
    }),
    [edges, nodes, previewNodeId, selectedNodeId, servers],
  );
  const getNode = (id?: string) => nodes.find((node) => node.id === id);
  const sanitizedDraft = useMemo(() => buildStudioDraft(draft), [draft]);
  const selectedNode = nodes.find((node) => node.id === selectedNodeId);
  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId);
  const selectedEdgeSourceNode = selectedEdge
    ? nodes.find((node) => node.id === selectedEdge.source)
    : undefined;
  const selectedEdgeTargetNode = selectedEdge
    ? nodes.find((node) => node.id === selectedEdge.target)
    : undefined;
  const selectedToolNode = selectedNode?.type === 'mcp-tool' ? selectedNode : undefined;
  const selectedServer = selectedToolNode?.data.serverId
    ? servers.find((item) => item.id === selectedToolNode.data.serverId)
    : undefined;
  const selectedTool = selectedServer?.tools.find(
    (item) => item.name === selectedToolNode?.data.toolName,
  );
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
  const skillOptions = availableSkills.map((skill) => ({
    label: skill.name,
    value: skill.id,
  }));
  const getPortLabel = (node: StudioCanvasNode, port: StudioNodePort) => {
    switch (port.id) {
      case 'prompt': {
        return t('mcpStudio.port.prompt');
      }
      case 'primary': {
        return t('mcpStudio.port.primary');
      }
      case 'context': {
        return t('mcpStudio.port.context');
      }
      case 'config': {
        return t('mcpStudio.port.config');
      }
      case 'result': {
        return t('mcpStudio.port.result');
      }
      case 'message': {
        return t('mcpStudio.port.message');
      }
      case 'content': {
        return node.type === 'resource'
          ? t('mcpStudio.port.resource')
          : node.type === 'skill'
            ? t('mcpStudio.port.skill')
            : t('mcpStudio.port.content');
      }
      default: {
        return port.id;
      }
    }
  };
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

      if (node.type === 'input' || node.type === 'resource' || node.type === 'skill') {
        sawExecutableSource = true;
      }

      const incoming = incomingEdgeMap.get(nodeId) || [];
      if (incoming.length === 0 && node.type !== 'input' && node.type !== 'mcp-tool') {
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
        setSelectedNodeId(storedDraft.selectedNodeId);
        setServers((state) => mergeStudioServers(state, storedDraft.servers));
      });
    }

    setDraftHydrated(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        const [result, skillResult] = await Promise.all([
          lambdaClient.workflowStudio.bootstrap.query(),
          agentSkillService.list(),
        ]);
        if (cancelled) return;

        setWorkflowLibrary(parseStudioWorkflowLibrary(JSON.stringify(result.workflows)));
        setServers((state) => mergeStudioServers(state, result.servers as StudioLoadedServer[]));
        setAvailableSkills(skillResult.data);
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
    if (!draftHydrated || typeof window === 'undefined') return;

    window.localStorage.setItem(STUDIO_STORAGE_KEY, JSON.stringify(sanitizedDraft));
  }, [draftHydrated, sanitizedDraft]);

  useEffect(() => {
    if (mobile || !canvasRef.current) return;

    const element = canvasRef.current;
    const updateBounds = () => {
      setCanvasBounds({
        height: Math.max(element.clientHeight, STUDIO_DEFAULT_CANVAS_BOUNDS.height),
        width: Math.max(element.clientWidth, STUDIO_DEFAULT_CANVAS_BOUNDS.width),
      });
    };

    updateBounds();

    const observer = new ResizeObserver(() => updateBounds());
    observer.observe(element);

    return () => observer.disconnect();
  }, [mobile]);

  useEffect(() => {
    if (mobile) return;

    setNodes((state) => clampNodePositions(state, canvasBounds));
  }, [canvasBounds, mobile]);

  useEffect(() => {
    if (!selectedNodeId || nodes.some((node) => node.id === selectedNodeId)) return;

    setSelectedNodeId(nodes[0]?.id);
  }, [nodes, selectedNodeId]);

  useEffect(() => {
    if (!renamingNodeId || nodes.some((node) => node.id === renamingNodeId)) return;

    setRenamingNodeId(undefined);
  }, [nodes, renamingNodeId]);

  useEffect(() => {
    if (!selectedEdgeId || edges.some((edge) => edge.id === selectedEdgeId)) return;

    setSelectedEdgeId(undefined);
  }, [edges, selectedEdgeId]);

  useEffect(() => {
    if (previewNodeId && nodes.some((node) => node.id === previewNodeId)) return;

    setPreviewNodeId(nodes.find((node) => node.type === 'chat-output')?.id);
  }, [nodes, previewNodeId]);

  useEffect(() => {
    setExecutedChatPreview(undefined);
    setToolResult(undefined);
    setErrorMessage(undefined);
    setLastRunAt(undefined);
  }, [nodes, edges, previewNodeId, servers]);

  useEffect(() => {
    pendingConnectionRef.current = pendingConnection;
  }, [pendingConnection]);

  const applyDraft = (nextDraft: StudioDraft) => {
    setNodes(nextDraft.nodes);
    setEdges(nextDraft.edges);
    setPreviewNodeId(nextDraft.previewNodeId);
    setSelectedNodeId(nextDraft.selectedNodeId);
    setSelectedEdgeId(undefined);
    setServers((state) => mergeStudioServers(state, nextDraft.servers));
    setExecutedChatPreview(undefined);
    setToolResult(undefined);
    setErrorMessage(undefined);
    setLastRunAt(undefined);
    setRenamingNodeId(undefined);
  };

  const getCanvasPoint = (clientX: number, clientY: number): StudioNodePosition | undefined => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return undefined;

    return {
      x: Math.max(0, Math.min(clientX - rect.left, canvasBounds.width)),
      y: Math.max(0, Math.min(clientY - rect.top, canvasBounds.height)),
    };
  };

  const findConnectionTarget = (
    point: StudioNodePosition,
    sourceId: string,
    sourcePortId: string,
  ) => {
    const sourceNode = getNode(sourceId);
    if (!sourceNode) return undefined;

    let bestMatch:
      | {
          distance: number;
          targetId: string;
          targetPortId: string;
        }
      | undefined;

    for (const node of [...nodes].reverse()) {
      if (node.id === sourceId || !canConnectNodes(sourceNode.type, node.type)) continue;

      for (const port of getNodeInputPorts(node)) {
        const anchor = getNodeInputAnchor(node, port.id);
        const distance = Math.hypot(point.x - anchor.x, point.y - anchor.y);

        if (distance > 28) continue;

        const duplicateEdge = edges.find(
          (edge) =>
            edge.source === sourceId &&
            (edge.sourcePortId || getNodeOutputPorts(sourceNode)[0]?.id) === sourcePortId &&
            edge.target === node.id &&
            (edge.targetPortId || getNodeInputPorts(node)[0]?.id) === port.id,
        );

        if (duplicateEdge) {
          return {
            targetId: node.id,
            targetPortId: port.id,
          };
        }

        if (!bestMatch || distance < bestMatch.distance) {
          bestMatch = {
            distance,
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

  const handleNodeSelect = (node: StudioCanvasNode) => {
    setSelectedNodeId(node.id);
    setSelectedEdgeId(undefined);
    if (node.type === 'chat-output') setPreviewNodeId(node.id);
    setEditingNodeId(undefined);
    setRenamingNodeId(undefined);
    setPalette(undefined);
  };

  const handleEdgeSelect = (edgeId: string) => {
    setSelectedEdgeId(edgeId);
    setSelectedNodeId(undefined);
    setEditingNodeId(undefined);
    setRenamingNodeId(undefined);
    setPalette(undefined);
  };

  const handleNodeDoubleClick = (node: StudioCanvasNode) => {
    handleNodeSelect(node);
    if (node.type === 'input' || node.type === 'transform') {
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
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    setPalette({
      x: Math.max(20, event.clientX - rect.left),
      y: Math.max(20, event.clientY - rect.top),
    });
    setSelectedEdgeId(undefined);
    setPendingConnection(undefined);
    setEditingNodeId(undefined);
    setRenamingNodeId(undefined);
  };

  const addBattery = (type: StudioCanvasNode['type']) => {
    const nextPosition: StudioNodePosition = palette || { x: 160, y: 160 };
    const node = createStudioNode(type, nextPosition);

    setNodes((state) => clampNodePositions([...state, node], canvasBounds));
    setSelectedNodeId(node.id);
    setSelectedEdgeId(undefined);
    if (type === 'chat-output') setPreviewNodeId(node.id);
    setPalette(undefined);
    setEditingNodeId(type === 'input' || type === 'transform' ? node.id : undefined);
  };

  const handleStartConnection = (
    event: ReactPointerEvent<HTMLButtonElement>,
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
    setSelectedEdgeId(undefined);
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

    if (!canConnectNodes(sourceNode.type, targetNode.type)) {
      return;
    }

    startTransition(() => {
      const existingEdge = edges.find(
        (edge) =>
          edge.source === sourceId &&
          (edge.sourcePortId || getNodeOutputPorts(sourceNode)[0]?.id) === sourcePortId &&
          edge.target === targetId &&
          (edge.targetPortId || getNodeInputPorts(targetNode)[0]?.id) === targetPortId,
      );
      if (existingEdge) {
        setSelectedEdgeId(existingEdge.id);
        setSelectedNodeId(undefined);
        return;
      }

      const nextEdge = {
        id: `edge_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        payloadBindings: [],
        source: sourceId,
        sourcePortId,
        target: targetId,
        targetPortId,
      };

      setEdges((state) => [
        ...state.filter(
          (edge) =>
            !(
              edge.target === targetId &&
              (edge.targetPortId || getNodeInputPorts(targetNode)[0]?.id) === targetPortId
            ),
        ),
        nextEdge,
      ]);
      setSelectedEdgeId(nextEdge.id);
      setSelectedNodeId(undefined);
    });
  };

  useEffect(() => {
    if (!pendingConnection?.sourceId) return;

    const handlePointerMove = (event: PointerEvent) => {
      const point = getCanvasPoint(event.clientX, event.clientY);
      if (!point) return;
      const target = findConnectionTarget(
        point,
        pendingConnectionRef.current?.sourceId || '',
        pendingConnectionRef.current?.sourcePortId || '',
      );

      setPendingConnection((current) =>
        current
          ? {
              ...current,
              currentPosition: point,
              targetId: target?.targetId,
              targetPortId: target?.targetPortId,
            }
          : current,
      );
    };

    const handlePointerEnd = (event: PointerEvent) => {
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
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
    };
  }, [canvasBounds.height, canvasBounds.width, edges, nodes, pendingConnection?.sourceId]);

  const handleRemoveEdge = (edgeId: string) => {
    if (selectedEdgeId === edgeId) setSelectedEdgeId(undefined);
    setEdges((state) => state.filter((edge) => edge.id !== edgeId));
  };

  const handleDeleteNode = (nodeId: string) => {
    startTransition(() => {
      setNodes((state) => state.filter((node) => node.id !== nodeId));
      setEdges((state) => state.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
      if (selectedNodeId === nodeId) setSelectedNodeId(undefined);
      if (selectedEdge && (selectedEdge.source === nodeId || selectedEdge.target === nodeId)) {
        setSelectedEdgeId(undefined);
      }
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
    setNodes((state) => clampNodePositions(autoLayoutStudioNodes(state), canvasBounds));
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
    message.success(t('mcpStudio.library.loaded'));
  };

  const handleNewWorkflow = () => {
    const nextDraft = createDefaultStudioDraft();

    applyDraft(nextDraft);
    setSelectedWorkflowId(undefined);
    setWorkflowName('');
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

      setExecutedChatPreview(response.chatPreview);
      setToolResult(response.toolResult as StudioToolResult | undefined);
      setLastRunAt(new Date().toLocaleTimeString());
      message.success(t('mcpStudio.messages.runSuccess'));
    } catch (error) {
      const errorText = error instanceof Error ? error.message : t('mcpStudio.messages.runFailed');
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

  const handleImportSkillNode = async (nodeId: string, skillId: string) => {
    try {
      const skill = await agentSkillService.getById(skillId);
      const content = skill?.content || '';

      if (!content) {
        throw new Error(t('mcpStudio.messages.skillEmpty'));
      }

      updateNode(nodeId, (node) =>
        node.type === 'skill'
          ? {
              ...node,
              data: {
                ...node.data,
                content,
                skillId,
                skillName: skill?.name || node.data.skillName,
              },
            }
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
        ? {
            ...node,
            data: {
              ...node.data,
              content: '',
              resourcePath: undefined,
              skillId,
              skillName: skill?.name,
            },
          }
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
          ? {
              ...node,
              data: {
                ...node.data,
                content: resource.content,
                resourcePath,
                skillId,
                skillName: skill?.name || node.data.skillName,
              },
            }
          : node,
      );

      message.success(t('mcpStudio.messages.resourceImported'));
    } catch (error) {
      console.error('Failed to import resource into studio:', error);
      message.error(t('mcpStudio.messages.resourceImportFailed'));
    }
  };

  const insertTransformVariable = (token: string) => {
    if (!selectedNode || selectedNode.type !== 'transform') return;

    const textarea = transformTextareaRef.current?.resizableTextArea?.textArea;
    const { nextSelection, nextValue } = insertBindingToken({
      selectionEnd: textarea?.selectionEnd,
      selectionStart: textarea?.selectionStart,
      token,
      value: selectedNode.data.prompt,
    });

    updateNode(selectedNode.id, (node) =>
      node.type === 'transform'
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
      const nextTextarea = transformTextareaRef.current?.resizableTextArea?.textArea;
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

    return t('mcpStudio.wire.output');
  };

  const getEdgeRouteLabel = (edge: StudioDraft['edges'][number]) => {
    const sourceNode = getNode(edge.source);
    const targetNode = getNode(edge.target);

    if (!sourceNode || !targetNode) return `${edge.source} -> ${edge.target}`;

    const sourcePort =
      getNodeOutputPorts(sourceNode).find((port) => port.id === edge.sourcePortId) ||
      getNodeOutputPorts(sourceNode)[0];
    const targetPort =
      getNodeInputPorts(targetNode).find((port) => port.id === edge.targetPortId) ||
      getNodeInputPorts(targetNode)[0];

    return `${sourceNode.data.title}.${sourcePort ? getPortLabel(sourceNode, sourcePort) : edge.source} -> ${targetNode.data.title}.${targetPort ? getPortLabel(targetNode, targetPort) : edge.target}`;
  };

  const renderNode = (node: StudioCanvasNode) => {
    const size = estimateNodeSize(node);
    const isSelected = node.id === selectedNodeId;
    const isEditing =
      editingNodeId === node.id && (node.type === 'input' || node.type === 'transform');
    const isRenaming = renamingNodeId === node.id;
    const incomingEdges = edges.filter((edge) => edge.target === node.id);
    const inputPorts = getNodeInputPorts(node);
    const outputPorts = getNodeOutputPorts(node);
    const incomingBindingCount =
      node.type === 'mcp-tool'
        ? incomingEdges.reduce((count, edge) => count + (edge.payloadBindings?.length || 0), 0) ||
          (incomingEdges.length === 1 ? node.data.payloadBindings.length : 0)
        : 0;
    const canAcceptPendingConnection = Boolean(
      pendingSourceNode &&
      node.id !== pendingSourceNode.id &&
      canConnectNodes(pendingSourceNode.type, node.type),
    );
    const nodeServer =
      node.type === 'mcp-tool' && node.data.serverId
        ? servers.find((item) => item.id === node.data.serverId)
        : undefined;
    const icon =
      node.type === 'input'
        ? Cable
        : node.type === 'resource'
          ? FileText
          : node.type === 'skill'
            ? BookOpen
            : node.type === 'transform'
              ? Sparkles
              : node.type === 'chat-output'
                ? Bot
                : nodeServer?.connection.type === 'stdio'
                  ? TerminalSquare
                  : Globe;

    return (
      <Rnd
        bounds="parent"
        className={styles.nodeShell}
        disableDragging={isEditing || isRenaming}
        enableResizing={false}
        key={node.id}
        position={node.position}
        size={size}
        onDragStop={handleNodeDragStop(node.id)}
      >
        <div
          className={`${styles.node} ${isSelected ? styles.nodeSelected : ''} ${isEditing || isRenaming ? styles.nodeEditing : ''} ${canAcceptPendingConnection ? styles.nodeConnectable : ''}`}
          onClick={(event) => {
            event.stopPropagation();
            handleNodeSelect(node);
          }}
          onDoubleClick={(event) => {
            event.stopPropagation();
            handleNodeDoubleClick(node);
          }}
        >
          {inputPorts.map((port) => {
            const anchor = getNodeInputAnchor(node, port.id);
            const top = anchor.y - node.position.y;
            const portTargeted =
              pendingConnection?.targetId === node.id && pendingTargetPortId === port.id;

            return (
              <div
                className={`${styles.nodePortWrap} ${styles.nodePortWrapInput}`}
                key={`${node.id}-${port.id}-input`}
                style={{ top }}
              >
                <button
                  className={`${styles.nodePort} ${styles.nodePortInput} ${canAcceptPendingConnection ? styles.nodePortConnectable : ''} ${portTargeted ? styles.nodePortTarget : ''}`}
                  title={`${t('mcpStudio.connections.incoming')} · ${getPortLabel(node, port)}`}
                  type="button"
                  onPointerEnter={() => {
                    if (!pendingConnection?.sourceId || !canAcceptPendingConnection) return;

                    setPendingConnection((current) =>
                      current
                        ? {
                            ...current,
                            targetId: node.id,
                            targetPortId: port.id,
                          }
                        : current,
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
                      current
                        ? {
                            ...current,
                            targetId: undefined,
                            targetPortId: undefined,
                          }
                        : current,
                    );
                  }}
                  onPointerUp={(event) => {
                    if (!pendingConnection?.sourceId || !canAcceptPendingConnection) return;

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
                />
              </div>
            );
          })}
          {outputPorts.map((port) => {
            const anchor = getNodeOutputAnchor(node, port.id);
            const top = anchor.y - node.position.y;
            const portActive =
              pendingConnection?.sourceId === node.id && pendingSourcePortId === port.id;

            return (
              <div
                className={`${styles.nodePortWrap} ${styles.nodePortWrapOutput}`}
                key={`${node.id}-${port.id}-output`}
                style={{ top }}
              >
                <button
                  className={`${styles.nodePort} ${styles.nodePortOutput} ${portActive ? styles.nodePortActive : ''}`}
                  title={`${t('mcpStudio.connections.outgoing')} · ${getPortLabel(node, port)}`}
                  type="button"
                  onPointerDown={(event) => handleStartConnection(event, node.id, port.id)}
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
              <Flexbox horizontal className={styles.nodeBadgeRow} gap={6} wrap={'wrap'}>
                {incomingEdges.length > 0 && (
                  <Tag bordered={false}>{`${incomingEdges.length} in`}</Tag>
                )}
                {incomingBindingCount > 0 && (
                  <Tag bordered={false}>{`${incomingBindingCount} bindings`}</Tag>
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
              <Text className={styles.nodeText}>{createNodeSummary(node, servers)}</Text>
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

        {selectedNode.type === 'resource' && (
          <Flexbox gap={12}>
            <Select
              options={skillOptions}
              placeholder={t('mcpStudio.resource.skill')}
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
                updateNode(selectedNode.id, (node) =>
                  node.type === 'resource'
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

        {selectedNode.type === 'skill' && (
          <Flexbox gap={12}>
            <Select
              options={skillOptions}
              placeholder={t('mcpStudio.skill.skill')}
              style={{ width: '100%' }}
              value={selectedNode.data.skillId}
              onChange={(value) => void handleImportSkillNode(selectedNode.id, value)}
            />

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
                updateNode(selectedNode.id, (node) =>
                  node.type === 'mcp-tool'
                    ? {
                        ...node,
                        data: {
                          ...node.data,
                          payload: buildDefaultToolArguments(
                            servers.find((server) => server.id === value)?.tools[0]?.parameters,
                          ),
                          serverId: value,
                          toolName: servers.find((server) => server.id === value)?.tools[0]?.name,
                        },
                      }
                    : node,
                )
              }
            />

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
                updateNode(selectedNode.id, (node) =>
                  node.type === 'mcp-tool'
                    ? {
                        ...node,
                        data: {
                          ...node.data,
                          payload: buildDefaultToolArguments(
                            selectedServer?.tools.find((tool) => tool.name === value)?.parameters,
                          ),
                          toolName: value,
                        },
                      }
                    : node,
                )
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
              ref={transformTextareaRef}
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
                    onClick={() => insertTransformVariable(item.token)}
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
          <Tag>{`${selectedEdgeSourceNode.data.title}.${getPortLabel(
            selectedEdgeSourceNode,
            getNodeOutputPorts(selectedEdgeSourceNode).find(
              (port) => port.id === selectedEdge.sourcePortId,
            ) || getNodeOutputPorts(selectedEdgeSourceNode)[0]!,
          )}`}</Tag>
          <Icon icon={ArrowRight} size={14} />
          <Tag color={selectedEdgeTargetNode.type === 'mcp-tool' ? 'processing' : 'default'}>
            {`${selectedEdgeTargetNode.data.title}.${getPortLabel(
              selectedEdgeTargetNode,
              getNodeInputPorts(selectedEdgeTargetNode).find(
                (port) => port.id === selectedEdge.targetPortId,
              ) || getNodeInputPorts(selectedEdgeTargetNode)[0]!,
            )}`}
          </Tag>
          <Tag bordered={false}>{getEdgeSummary(selectedEdge)}</Tag>
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
                    item.type === 'input'
                      ? Cable
                      : item.type === 'resource'
                        ? FileText
                        : item.type === 'skill'
                          ? BookOpen
                          : item.type === 'mcp-tool'
                            ? Wrench
                            : item.type === 'transform'
                              ? Sparkles
                              : Bot
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
            className={styles.canvasStage}
            ref={canvasRef}
            onDoubleClick={handleCanvasDoubleClick}
          >
            <svg
              className={styles.edgeLayer}
              viewBox={`0 0 ${canvasBounds.width} ${canvasBounds.height}`}
            >
              {edges.map((edge) => {
                const sourceNode = getNode(edge.source);
                const targetNode = getNode(edge.target);
                if (!sourceNode || !targetNode) return null;

                const isSelected = selectedEdgeId === edge.id;

                return (
                  <g key={edge.id}>
                    <path
                      className={styles.edgeHitArea}
                      d={buildConnectorPath({
                        sourcePortId: edge.sourcePortId,
                        source: sourceNode,
                        targetPortId: edge.targetPortId,
                        target: targetNode,
                      })}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleEdgeSelect(edge.id);
                      }}
                    />
                    <path
                      className={`${styles.edgePath} ${isSelected ? styles.edgePathSelected : ''}`}
                      d={buildConnectorPath({
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
              <div className={styles.palette} style={{ left: palette.x, top: palette.y }}>
                <Flexbox gap={8}>
                  <Text strong>{t('mcpStudio.toolbar.addBattery')}</Text>
                  {nodeTypeOptions.map((item) => (
                    <Button
                      key={item.type}
                      icon={
                        <Icon
                          icon={
                            item.type === 'input'
                              ? Cable
                              : item.type === 'resource'
                                ? FileText
                                : item.type === 'skill'
                                  ? BookOpen
                                  : item.type === 'mcp-tool'
                                    ? Wrench
                                    : item.type === 'transform'
                                      ? Sparkles
                                      : Bot
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

            <div className={styles.stageHint}>
              <Text type={'secondary'}>{t('mcpStudio.canvas.hint')}</Text>
            </div>
          </div>
        </div>

        <div className={styles.sidebar}>
          {selectedEdge ? renderSelectedEdgePanel() : renderSelectedNodePanel()}
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
