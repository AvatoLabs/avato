import { BUILTIN_AGENT_SLUGS, getAgentRuntimeConfig } from '@lobechat/builtin-agents';
import { builtinSkills } from '@lobechat/builtin-skills';
import {
  ComputerUseApiName,
  ComputerUseIdentifier,
  ComputerUseManifest,
} from '@lobechat/builtin-tool-computer-use';
import { LocalSystemManifest } from '@lobechat/builtin-tool-local-system';
import {
  type DeviceAttachment,
  type DeviceSystemInfo,
  generateSystemPrompt,
  RemoteDeviceManifest,
} from '@lobechat/builtin-tool-remote-device';
import { SkillsIdentifier, SkillsManifest } from '@lobechat/builtin-tool-skills';
import { WebBrowsingExecutionRuntime } from '@lobechat/builtin-tool-web-browsing/executionRuntime';
import { builtinTools } from '@lobechat/builtin-tools';
import { type TracePayload } from '@lobechat/const';
import {
  type FileContent,
  generateToolsFromManifest,
  type LobeToolManifest,
  type SkillMeta,
  ToolArgumentsRepairer,
  ToolNameResolver,
} from '@lobechat/context-engine';
import {
  type ChatStreamCallbacks,
  consumeStreamUntilDone,
  mergeMultipleChatMethodOptions,
  type ModelRuntime,
} from '@lobechat/model-runtime';
import { skillsPrompts } from '@lobechat/prompts';
import {
  type ChatToolPayload,
  type MessageToolCall,
  type UserInterventionConfig,
} from '@lobechat/types';
import { nanoid } from '@lobechat/utils';
import { LOBE_DEFAULT_MODEL_LIST } from 'model-bank';

import { AgentModel } from '@/database/models/agent';
import { AgentSkillModel } from '@/database/models/agentSkill';
import { FileModel } from '@/database/models/file';
import { PluginModel } from '@/database/models/plugin';
import { SessionModel } from '@/database/models/session';
import { SpaceModel } from '@/database/models/space';
import { UserModel } from '@/database/models/user';
import { type LobeChatDatabase } from '@/database/type';
import { filterBuiltinSkills } from '@/helpers/skillFilters';
import { createServerAgentToolsEngine, serverMessagesEngine } from '@/server/modules/Mecha';
import { createTraceOptions } from '@/server/modules/ModelRuntime';
import { FileService } from '@/server/services/file';
import { mcpService } from '@/server/services/mcp';
import { processContentBlocks } from '@/server/services/mcp/contentProcessor';
import { buildMobileChatUserMemoryPrompt } from '@/server/services/memory/buildMobileChatUserMemoryPrompt';
import { PluginGatewayService } from '@/server/services/pluginGateway';
import { SearchService } from '@/server/services/search';
import { ToolExecutionService } from '@/server/services/toolExecution';
import { BuiltinToolsExecutor } from '@/server/services/toolExecution/builtin';
import { deviceProxy } from '@/server/services/toolExecution/deviceProxy';
import { type ToolExecutionContext } from '@/server/services/toolExecution/types';
import { type ChatStreamPayload } from '@/types/openai/chat';

import { partitionToolsByIntervention } from './partitionToolsByIntervention';
import { readChatCompletionResult } from './responseParser';
import {
  getMobileInterventionResumeStore,
  type MobileInterventionResumeState,
} from './resumeStore';

const MAX_TOOL_ROUNDS = 5;

const LEGACY_BUILTIN_ROLE_PATTERNS: Partial<Record<string, RegExp>> = {
  [BUILTIN_AGENT_SLUGS.agentBuilder]: /You are Lobe,\s+an Agent Builder integrated into LobeHub\./,
  [BUILTIN_AGENT_SLUGS.groupSupervisor]:
    /You are LobeAI,\s+an intelligent team coordinator developed by LobeHub,/,
  [BUILTIN_AGENT_SLUGS.inbox]: /You are Lobe,\s+an AI Agent will help users\./,
};

const MOBILE_BUILTIN_SKILL_CONTEXT = {
  isDesktop: false,
  isWindows: false,
} as const;

const builtinSkillMetaMap = new Map<string, SkillMeta>(
  filterBuiltinSkills(builtinSkills, MOBILE_BUILTIN_SKILL_CONTEXT).map((skill) => [
    skill.identifier,
    {
      description: skill.description,
      identifier: skill.identifier,
      name: skill.name,
    },
  ]),
);

const builtinToolIdentifiers = new Set(builtinTools.map((tool) => tool.identifier));

type MobileMemoryEffort = 'high' | 'low' | 'medium';
type ToolSource = 'builtin' | 'klavis' | 'lobehubSkill' | 'mcp' | 'plugin';

export interface MobileMemoryPayload {
  effort?: MobileMemoryEffort;
  enabled?: boolean;
}

export interface MobileChatPayload extends ChatStreamPayload {
  activeDeviceId?: string;
  memory?: MobileMemoryPayload;
  operationId?: string;
  plugins?: string[];
  sessionId?: string;
  /** Optional Space for server builtin tools (sandbox export → `createFileRecord` / `space_blobs`). */
  spaceId?: string;
  topicId?: string;
}

interface ConversationConfig {
  chatConfig?: {
    enableHistoryCount?: boolean;
    historyCount?: number;
    inputTemplate?: string;
    memory?: { effort?: string; enabled?: boolean };
    searchMode?: 'auto' | 'off' | 'on';
  };
  files?: Array<{ content?: string | null; enabled?: boolean | null; id?: string; name?: string }>;
  id?: string;
  model?: string | null;
  plugins?: string[];
  provider?: string | null;
  slug?: string | null;
  sourceSets?: Array<{ enabled?: boolean | null; id?: string; name?: string }>;
  systemRole?: string | null;
}

interface McpPluginConfig {
  auth?: { token?: string; type: string };
  headers?: Record<string, string>;
  type: string;
  url: string;
}

interface MobileToolSet {
  enabledToolIds: string[];
  manifestMap: Record<string, LobeToolManifest>;
  sourceMap: Record<string, ToolSource>;
  tools?: NonNullable<ChatStreamPayload['tools']>;
}

interface MobileDeviceContext {
  activeDeviceComputerUseReady?: boolean;
  activeDeviceId?: string;
  deviceSystemInfo?: Record<string, string>;
  gatewayConfigured: boolean;
  onlineDevices: DeviceAttachment[];
}

interface MobileToolExecutionEvent {
  apiName: string;
  arguments: string;
  id: string;
  identifier: string;
  intervention?: { status: 'approved' } | { rejectedReason?: string; status: 'rejected' };
  pluginError?: { message: string };
  result: string;
  state?: Record<string, unknown>;
}

interface ToolLoopFinalAssistantResponse {
  content?: string;
  grounding?: Record<string, unknown>;
  performance?: Record<string, unknown>;
  reasoning?: string;
  usage?: Record<string, unknown>;
}

type StreamCompletionData = Parameters<NonNullable<ChatStreamCallbacks['onCompletion']>>[0];
type StreamGroundingData = Parameters<NonNullable<ChatStreamCallbacks['onGrounding']>>[0];
type StreamTextData = Parameters<NonNullable<ChatStreamCallbacks['onText']>>[0];
type StreamThinkingData = Parameters<NonNullable<ChatStreamCallbacks['onThinking']>>[0];
type StreamToolsCallingData = Parameters<NonNullable<ChatStreamCallbacks['onToolsCalling']>>[0];
type StreamUsageData = Parameters<NonNullable<ChatStreamCallbacks['onUsage']>>[0];

const normalizeMemoryEffort = (effort?: string): MobileMemoryEffort => {
  if (effort === 'low' || effort === 'medium' || effort === 'high') return effort;
  return 'medium';
};

const isLegacyBuiltinSystemRole = (slug: string, systemRole?: string | null) => {
  if (!systemRole) return false;

  const pattern = LEGACY_BUILTIN_ROLE_PATTERNS[slug];
  return pattern ? pattern.test(systemRole) : false;
};

const isModelSupportToolUse = (model: string, provider: string) => {
  const info = LOBE_DEFAULT_MODEL_LIST.find(
    (item) => item.id === model && item.providerId === provider,
  );
  return info?.abilities?.functionCall ?? true;
};

const resolveEnabledSkillMetas = async (
  pluginIds: string[],
  serverDB: LobeChatDatabase,
  userId: string,
): Promise<SkillMeta[]> => {
  if (pluginIds.length === 0) return [];

  const skillModel = new AgentSkillModel(serverDB, userId);
  const metasByIdentifier = new Map(builtinSkillMetaMap);

  const unresolvedIds = pluginIds.filter((pluginId) => !metasByIdentifier.has(pluginId));

  if (unresolvedIds.length > 0) {
    const dbSkills = await Promise.all(
      unresolvedIds.map((pluginId) => skillModel.findByIdentifier(pluginId)),
    );

    for (const skill of dbSkills) {
      if (!skill) continue;

      metasByIdentifier.set(skill.identifier, {
        description: skill.description || skill.manifest.description,
        identifier: skill.identifier,
        location: skill.manifest.repository || skill.manifest.sourceUrl,
        name: skill.name,
      });
    }
  }

  return pluginIds
    .map((pluginId) => metasByIdentifier.get(pluginId))
    .filter((skill): skill is SkillMeta => !!skill);
};

const mergeBuiltinRuntimeConfig = (config?: ConversationConfig): ConversationConfig | undefined => {
  if (!config?.slug) return config;
  if (
    !Object.values(BUILTIN_AGENT_SLUGS).includes(
      config.slug as (typeof BUILTIN_AGENT_SLUGS)[keyof typeof BUILTIN_AGENT_SLUGS],
    )
  ) {
    return config;
  }

  const runtimeConfig = getAgentRuntimeConfig(config.slug, {
    model: config.model || undefined,
    plugins: config.plugins ?? [],
  });

  if (!runtimeConfig) return config;

  const shouldApplyRuntimeSystemRole =
    !config.systemRole || isLegacyBuiltinSystemRole(config.slug, config.systemRole);

  return {
    ...config,
    ...(shouldApplyRuntimeSystemRole && runtimeConfig.systemRole
      ? { systemRole: runtimeConfig.systemRole }
      : {}),
    ...(runtimeConfig.plugins?.length ? { plugins: runtimeConfig.plugins } : {}),
  };
};

const readSessionConversationConfig = async (
  serverDB: LobeChatDatabase,
  userId: string,
  sessionId?: string,
): Promise<ConversationConfig | undefined> => {
  if (!sessionId) return undefined;

  try {
    const agentModel = new AgentModel(serverDB, userId);
    const agentConfig = await agentModel.findBySessionId(sessionId);
    if (agentConfig) return mergeBuiltinRuntimeConfig(agentConfig as ConversationConfig);

    const sessionModel = new SessionModel(serverDB, userId);
    const session = await sessionModel.findByIdOrSlug(sessionId);

    return (session as { config?: ConversationConfig })?.config;
  } catch (error) {
    console.error('[webapi/chat] failed to read session conversation config:', error);
    return undefined;
  }
};

const readConversationFileContents = async (
  serverDB: LobeChatDatabase,
  userId: string,
  sessionId?: string,
): Promise<FileContent[] | undefined> => {
  if (!sessionId) return undefined;

  try {
    return await new FileModel(serverDB, userId).getSessionAssignedFileContents(sessionId);
  } catch (error) {
    console.error('[webapi/chat] failed to read conversation-scoped files:', error);
    return undefined;
  }
};

const readMemoryContext = async (params: {
  conversationConfig?: ConversationConfig;
  explicitMemory?: MobileMemoryPayload;
  serverDB: LobeChatDatabase;
  topicId?: string;
  userId: string;
}) => {
  const memorySource = params.explicitMemory || params.conversationConfig?.chatConfig?.memory;
  if (!memorySource || memorySource.enabled === false) return undefined;

  try {
    const effort = normalizeMemoryEffort(memorySource.effort);
    return await buildMobileChatUserMemoryPrompt({
      effort,
      serverDB: params.serverDB,
      topicId: params.topicId,
      userId: params.userId,
    });
  } catch (error) {
    console.error('[webapi/chat] failed to inject memory context:', error);
    return undefined;
  }
};

const getSearchSystemMessage = async (messages: MobileChatPayload['messages']) => {
  const lastUserMsg = [...(messages || [])].reverse().find((message) => message.role === 'user');
  const searchQuery =
    typeof lastUserMsg?.content === 'string'
      ? lastUserMsg.content
      : Array.isArray(lastUserMsg?.content)
        ? (lastUserMsg.content as any[])
            .filter((block: any) => block.type === 'text')
            .map((block: any) => block.text)
            .join(' ')
        : '';

  if (!searchQuery) return undefined;

  const webSearchRuntime = new WebBrowsingExecutionRuntime({
    searchService: new SearchService(),
  });
  const searchResult = await webSearchRuntime.search({ query: searchQuery });

  if (!searchResult.success || !searchResult.content) return undefined;

  return `<web_search_results>\n${searchResult.content}\n</web_search_results>\n\nPlease answer the user's question based on the above search results. Cite sources when possible.`;
};

const dedupeTools = (tools: NonNullable<ChatStreamPayload['tools']>) => {
  const seen = new Set<string>();

  return tools.filter((tool) => {
    const name = tool.function.name;
    if (seen.has(name)) return false;
    seen.add(name);
    return true;
  });
};

const createMobileOperationId = (payload: Pick<MobileChatPayload, 'sessionId' | 'topicId'>) =>
  `mob_${Date.now()}_${payload.sessionId || 'direct'}_${payload.topicId || 'none'}_${nanoid(8)}`;

const isEligibleDevice = (device: DeviceAttachment) =>
  device.online && device.allowRemoteTools === true;

const canUseRemoteComputer = (device?: DeviceAttachment) =>
  !!device && isEligibleDevice(device) && device.allowRemoteComputerUse === true;

const shouldProcessToolContentBlocks = (toolCall: ChatToolPayload) =>
  toolCall.source === 'mcp' ||
  (toolCall.identifier === ComputerUseIdentifier &&
    toolCall.apiName === ComputerUseApiName.screenshot);

const toDeviceSystemInfoVariables = (
  systemInfo: DeviceSystemInfo,
  device?: DeviceAttachment,
): Record<string, string> => ({
  arch: systemInfo.arch,
  desktopPath: systemInfo.desktopPath,
  documentsPath: systemInfo.documentsPath,
  downloadsPath: systemInfo.downloadsPath,
  homePath: systemInfo.homePath,
  musicPath: systemInfo.musicPath,
  picturesPath: systemInfo.picturesPath,
  platform: device?.platform ?? 'unknown',
  userDataPath: systemInfo.userDataPath,
  videosPath: systemInfo.videosPath,
  workingDirectory: systemInfo.workingDirectory,
});

const hasRemoteDeviceActivation = (toolCall: ChatToolPayload, executionState?: unknown) => {
  if (toolCall.identifier !== RemoteDeviceManifest.identifier) return undefined;
  if (!isExecutionStateRecord(executionState)) return undefined;

  const metadata = executionState.metadata;
  if (!isExecutionStateRecord(metadata)) return undefined;

  const activeDeviceId = metadata.activeDeviceId;
  return typeof activeDeviceId === 'string' && activeDeviceId.trim()
    ? {
        activeDeviceComputerUseReady: metadata.activeDeviceComputerUseReady === true,
        activeDeviceId: activeDeviceId.trim(),
      }
    : undefined;
};

const toModelChatPayload = (payload: MobileChatPayload): MobileChatPayload => {
  const data = { ...payload };
  delete (data as any).memory;
  delete (data as any).plugins;
  delete (data as any).sessionId;
  delete (data as any).activeDeviceId;
  delete (data as any).operationId;
  return data;
};

export const buildMobileToolExecutionContext = (params: {
  activeDeviceId?: string;
  operationId?: string;
  processContentBlocks?: ToolExecutionContext['processContentBlocks'];
  serverDB: LobeChatDatabase;
  sourceSetIds?: string[];
  spaceId?: string;
  toolCall: ChatToolPayload;
  toolManifestMap: Record<string, LobeToolManifest>;
  topicId?: string;
  userId: string;
}): ToolExecutionContext => ({
  activeDeviceId: params.activeDeviceId,
  messageId: params.toolCall.id,
  operationId: params.operationId,
  processContentBlocks: params.processContentBlocks,
  serverDB: params.serverDB,
  sourceSetIds: params.sourceSetIds,
  spaceId: params.spaceId,
  toolManifestMap: params.toolManifestMap,
  topicId: params.topicId,
  userId: params.userId,
});

const isExecutionStateRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const serializeToolExecutionContent = (content: unknown) =>
  typeof content === 'string' ? content : JSON.stringify(content);

const buildComputerUseScreenshotObservation = (
  toolCall: ChatToolPayload,
  execution: { state?: unknown; success?: boolean },
) => {
  if (
    toolCall.identifier !== ComputerUseIdentifier ||
    toolCall.apiName !== ComputerUseApiName.screenshot ||
    execution.success === false ||
    !isExecutionStateRecord(execution.state)
  ) {
    return undefined;
  }

  const imageUrl = execution.state.imageUrl;
  if (typeof imageUrl !== 'string' || !imageUrl) return undefined;

  const width = execution.state.width;
  const height = execution.state.height;
  const source =
    typeof execution.state.source === 'string' ? execution.state.source : 'remote desktop';
  const size =
    typeof width === 'number' && typeof height === 'number' ? ` (${width}x${height})` : '';

  return {
    content: [
      {
        text: `Remote Computer Use observation: screenshot from ${source}${size}.`,
        type: 'text',
      },
      {
        image_url: { detail: 'auto', url: imageUrl },
        type: 'image_url',
      },
    ],
    role: 'user',
  } as any;
};

const appendToolExecutionMessages = (
  messages: any[],
  toolCall: ChatToolPayload,
  execution: { content: unknown; state?: unknown; success?: boolean },
) => {
  const content = serializeToolExecutionContent(execution.content);
  messages.push({
    content,
    role: 'tool',
    tool_call_id: toolCall.id,
  } as any);

  const observation = buildComputerUseScreenshotObservation(toolCall, execution);
  if (observation) messages.push(observation);

  return content;
};

const hasMessageContent = (content: unknown) => {
  if (typeof content === 'string') return content.trim().length > 0;
  return Array.isArray(content) && content.length > 0;
};

const sanitizeToolCallHistory = (messages?: ChatStreamPayload['messages']) => {
  if (!messages?.length) return messages;

  const toolMessages = new Map<string, (typeof messages)[number]>();
  for (const message of messages) {
    if (message.role !== 'tool') continue;
    if (!message.tool_call_id) continue;
    if (!toolMessages.has(message.tool_call_id)) {
      toolMessages.set(message.tool_call_id, message);
    }
  }

  const consumedToolCallIds = new Set<string>();
  const sanitized: NonNullable<ChatStreamPayload['messages']> = [];

  for (const message of messages) {
    if (message.role === 'tool') {
      if (message.tool_call_id && consumedToolCallIds.has(message.tool_call_id)) continue;
      continue;
    }

    if (
      message.role === 'assistant' &&
      Array.isArray(message.tool_calls) &&
      message.tool_calls.length
    ) {
      const toolCalls = message.tool_calls.filter(
        (toolCall): toolCall is MessageToolCall & { id: string } =>
          typeof toolCall?.id === 'string',
      );

      const matchingToolMessages = toolCalls
        .map((toolCall) => toolMessages.get(toolCall.id))
        .filter((toolMessage): toolMessage is (typeof messages)[number] => !!toolMessage);

      if (toolCalls.length > 0 && matchingToolMessages.length === toolCalls.length) {
        sanitized.push(message);

        for (const toolCall of toolCalls) {
          const toolMessage = toolMessages.get(toolCall.id);
          if (!toolMessage || consumedToolCallIds.has(toolCall.id)) continue;

          sanitized.push(toolMessage);
          consumedToolCallIds.add(toolCall.id);
        }

        continue;
      }

      if (hasMessageContent(message.content)) {
        const { tool_calls, ...assistantWithoutToolCalls } = message;
        void tool_calls;
        sanitized.push(assistantWithoutToolCalls);
      }

      continue;
    }

    sanitized.push(message);
  }

  return sanitized;
};

const createToolExecutionEvent = (
  toolCall: ChatToolPayload,
  execution: { content: unknown; error?: { message: string }; state?: unknown },
): MobileToolExecutionEvent => ({
  apiName: toolCall.apiName,
  arguments: toolCall.arguments,
  id: toolCall.id,
  identifier: toolCall.identifier,
  intervention: { status: 'approved' },
  ...(execution.error ? { pluginError: execution.error } : {}),
  result: serializeToolExecutionContent(execution.content),
  ...(isExecutionStateRecord(execution.state) ? { state: execution.state } : {}),
});

const createToolRejectionExecutionEvent = (
  toolCall: ChatToolPayload,
  reason?: string,
): MobileToolExecutionEvent => {
  const content = reason
    ? `User reject this tool calling with reason: ${reason}`
    : 'User reject this tool calling without reason';
  return {
    apiName: toolCall.apiName,
    arguments: toolCall.arguments,
    id: toolCall.id,
    identifier: toolCall.identifier,
    intervention: { rejectedReason: reason, status: 'rejected' },
    result: content,
  };
};

const createStaticSSETextResponse = (params: {
  assistant?: ToolLoopFinalAssistantResponse;
  interventionRequired?: {
    payload: { pendingToolCalls: ChatToolPayload[]; sessionId?: string; topicId?: string };
  };
  toolCalls?: (ChatToolPayload & { intervention?: { status: string } })[];
  toolExecutions?: MobileToolExecutionEvent[];
}) => {
  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  const writeEvent = async (event: string, data: unknown) => {
    await writer.write(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
  };

  void (async () => {
    try {
      if (params.toolCalls?.length) {
        await writeEvent('tool_calls', params.toolCalls);
      }

      if (params.toolExecutions?.length) {
        await writeEvent('tool_executions', params.toolExecutions);
      }

      if (params.interventionRequired) {
        await writeEvent('intervention_required', params.interventionRequired.payload);
      }

      if (params.assistant?.grounding) {
        await writeEvent('grounding', params.assistant.grounding);
      }

      if (params.assistant?.reasoning) {
        await writeEvent('reasoning', params.assistant.reasoning);
      }

      if (params.assistant?.content) {
        await writeEvent('text', params.assistant.content);
      }

      if (params.assistant?.usage) {
        await writeEvent('usage', params.assistant.usage);
      }

      if (params.assistant?.performance) {
        await writeEvent('performance', params.assistant.performance);
      }
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Content-Type': 'text/event-stream; charset=utf-8',
    },
    status: 200,
  });
};

const normalizeToolCalls = (
  toolCalls: any[],
  manifestMap: Record<string, LobeToolManifest>,
  sourceMap: Record<string, ToolSource>,
) => {
  const resolver = new ToolNameResolver();
  const resolved = resolver.resolve(toolCalls, manifestMap);

  return resolved.map((payload) => {
    const manifest = manifestMap[payload.identifier];
    const repairer = new ToolArgumentsRepairer(manifest);
    const repairedArgs = repairer.parse(payload.apiName, payload.arguments);

    return {
      ...payload,
      arguments: JSON.stringify(repairedArgs),
      source: sourceMap[payload.identifier],
    } satisfies ChatToolPayload;
  });
};

export class MobileChatService {
  private readonly modelRuntime: ModelRuntime;
  private readonly provider: string;
  private readonly requestSignal: AbortSignal;
  private readonly serverDB: LobeChatDatabase;
  private readonly spaceModel: SpaceModel;
  private readonly userId: string;

  constructor(params: {
    modelRuntime: ModelRuntime;
    provider: string;
    requestSignal: AbortSignal;
    serverDB: LobeChatDatabase;
    userId: string;
  }) {
    this.modelRuntime = params.modelRuntime;
    this.provider = params.provider;
    this.requestSignal = params.requestSignal;
    this.serverDB = params.serverDB;
    this.spaceModel = new SpaceModel(params.serverDB, params.userId);
    this.userId = params.userId;
  }

  private assertAccessibleSpace = async (spaceId?: string | null) => {
    if (!spaceId) return;

    const space = await this.spaceModel.findAccessibleSpaceById(spaceId);
    if (!space?.id) {
      throw new Error('SPACE_ACCESS_DENIED');
    }
  };

  private resolveDeviceContext = async (
    requestedDeviceId?: string,
  ): Promise<MobileDeviceContext> => {
    if (!deviceProxy.isConfigured) {
      return { gatewayConfigured: false, onlineDevices: [] };
    }

    let onlineDevices: DeviceAttachment[] = [];
    try {
      onlineDevices = await deviceProxy.queryDeviceList(this.userId);
    } catch (error) {
      console.warn('[webapi/chat] failed to query remote desktop devices:', error);
    }

    const eligibleDevices = onlineDevices.filter(isEligibleDevice);
    const normalizedRequestedDeviceId = requestedDeviceId?.trim();
    const activeDevice = normalizedRequestedDeviceId
      ? eligibleDevices.find((device) => device.deviceId === normalizedRequestedDeviceId)
      : eligibleDevices.length === 1
        ? eligibleDevices[0]
        : undefined;

    if (!activeDevice) {
      return { gatewayConfigured: true, onlineDevices };
    }

    let deviceSystemInfo: Record<string, string> | undefined;
    try {
      const systemInfo = await deviceProxy.queryDeviceSystemInfo(
        this.userId,
        activeDevice.deviceId,
      );
      if (systemInfo) {
        deviceSystemInfo = toDeviceSystemInfoVariables(systemInfo, activeDevice);
      }
    } catch (error) {
      console.warn(
        `[webapi/chat] failed to query system info for remote device ${activeDevice.deviceId}:`,
        error,
      );
    }

    return {
      activeDeviceId: activeDevice.deviceId,
      activeDeviceComputerUseReady: canUseRemoteComputer(activeDevice),
      deviceSystemInfo,
      gatewayConfigured: true,
      onlineDevices,
    };
  };

  private ensureActiveDeviceToolSet = (
    toolSet: MobileToolSet,
    options: { allowRemoteComputerUse?: boolean } = {},
  ): MobileToolSet => {
    if (
      toolSet.manifestMap[LocalSystemManifest.identifier] &&
      (!options.allowRemoteComputerUse || toolSet.manifestMap[ComputerUseManifest.identifier])
    ) {
      return toolSet;
    }

    const localSystemManifest = LocalSystemManifest as unknown as LobeToolManifest;
    const computerUseManifest = ComputerUseManifest as unknown as LobeToolManifest;

    return {
      ...toolSet,
      enabledToolIds: [
        ...new Set([
          ...toolSet.enabledToolIds,
          LocalSystemManifest.identifier,
          ...(options.allowRemoteComputerUse ? [ComputerUseManifest.identifier] : []),
        ]),
      ],
      manifestMap: {
        ...toolSet.manifestMap,
        ...(options.allowRemoteComputerUse
          ? { [ComputerUseManifest.identifier]: computerUseManifest }
          : {}),
        [LocalSystemManifest.identifier]: localSystemManifest,
      },
      sourceMap: {
        ...toolSet.sourceMap,
        ...(options.allowRemoteComputerUse ? { [ComputerUseManifest.identifier]: 'builtin' } : {}),
        [LocalSystemManifest.identifier]: 'builtin',
      },
      tools: dedupeTools([
        ...(toolSet.tools ?? []),
        ...(options.allowRemoteComputerUse ? generateToolsFromManifest(computerUseManifest) : []),
        ...generateToolsFromManifest(localSystemManifest),
      ] as NonNullable<ChatStreamPayload['tools']>),
    };
  };

  private applyDeviceActivation = (params: {
    activeDeviceId?: string;
    executionState?: unknown;
    toolCall: ChatToolPayload;
    toolSet: MobileToolSet;
  }) => {
    const activation = hasRemoteDeviceActivation(params.toolCall, params.executionState);
    if (!activation) {
      return { activeDeviceId: params.activeDeviceId, toolSet: params.toolSet };
    }

    return {
      activeDeviceId: activation.activeDeviceId,
      toolSet: this.ensureActiveDeviceToolSet(params.toolSet, {
        allowRemoteComputerUse: activation.activeDeviceComputerUseReady,
      }),
    };
  };

  private executeMobileTool = async (params: {
    activeDeviceId?: string;
    boundProcessContentBlocks: NonNullable<ToolExecutionContext['processContentBlocks']>;
    operationId: string;
    sourceSetIds?: string[];
    toolCall: ChatToolPayload;
    toolExecutionService: ToolExecutionService;
    toolSet: MobileToolSet;
    payload: MobileChatPayload;
  }) => {
    const execution = await params.toolExecutionService.executeTool(
      params.toolCall,
      buildMobileToolExecutionContext({
        activeDeviceId: params.activeDeviceId,
        operationId: params.operationId,
        processContentBlocks: shouldProcessToolContentBlocks(params.toolCall)
          ? params.boundProcessContentBlocks
          : undefined,
        serverDB: this.serverDB,
        sourceSetIds: params.sourceSetIds,
        spaceId: params.payload.spaceId,
        toolCall: params.toolCall,
        toolManifestMap: params.toolSet.manifestMap,
        topicId: params.payload.topicId,
        userId: this.userId,
      }),
    );

    const activation = this.applyDeviceActivation({
      activeDeviceId: params.activeDeviceId,
      executionState: execution.state,
      toolCall: params.toolCall,
      toolSet: params.toolSet,
    });

    return { execution, ...activation };
  };

  private resolveToolSet = async (params: {
    conversationConfig?: ConversationConfig;
    deviceContext: MobileDeviceContext;
    pluginIds: string[];
    skillMetas: SkillMeta[];
    payload: MobileChatPayload;
  }): Promise<MobileToolSet | undefined> => {
    const { conversationConfig, deviceContext, pluginIds, skillMetas, payload } = params;
    if (!isModelSupportToolUse(payload.model, this.provider)) return undefined;

    const toolNameResolver = new ToolNameResolver();

    const deviceToolIds = deviceContext.gatewayConfigured
      ? [
          RemoteDeviceManifest.identifier,
          ...(deviceContext.activeDeviceId
            ? [
                LocalSystemManifest.identifier,
                ...(deviceContext.activeDeviceComputerUseReady
                  ? [ComputerUseManifest.identifier]
                  : []),
              ]
            : []),
        ]
      : [];
    const toolIds = [
      ...new Set([
        ...pluginIds,
        ...(skillMetas.length > 0 ? [SkillsIdentifier] : []),
        ...deviceToolIds,
      ]),
    ];

    if (toolIds.length === 0) return undefined;

    const pluginModel = new PluginModel(this.serverDB, this.userId);
    const installedPlugins = (await pluginModel.query()) ?? [];
    const installedPluginMap = new Map(
      installedPlugins.map((plugin) => [plugin.identifier, plugin]),
    );

    console.info(
      `[webapi/chat] resolving tools for plugins: ${JSON.stringify(toolIds)}, installed: ${installedPlugins.map((plugin) => plugin.identifier).join(',')}`,
    );

    const toolsEngine = createServerAgentToolsEngine(
      {
        installedPlugins,
        isModelSupportToolUse,
      },
      {
        agentConfig: {
          chatConfig: conversationConfig?.chatConfig,
          plugins: toolIds,
        },
        deviceContext: deviceContext.gatewayConfigured
          ? {
              activeDeviceComputerUseReady: deviceContext.activeDeviceComputerUseReady === true,
              activeDeviceReady: !!deviceContext.activeDeviceId,
              deviceOnline: deviceContext.onlineDevices.some(isEligibleDevice),
              gatewayConfigured: true,
            }
          : undefined,
        model: payload.model,
        provider: this.provider,
      },
    );

    const generated = toolsEngine.generateToolsDetailed({
      model: payload.model,
      provider: this.provider,
      skipDefaultTools: true,
      toolIds,
    });

    const manifestMap: Record<string, LobeToolManifest> = {};
    const sourceMap: Record<string, ToolSource> = {};
    const generatedTools = [...(generated.tools || [])];

    for (const manifest of generated.enabledManifests) {
      if (!Array.isArray(manifest.api) || manifest.api.length === 0) {
        console.warn(
          `[webapi/chat] plugin "${manifest.identifier}" was enabled without a valid api array, falling back to manifest/MCP resolution`,
        );
        continue;
      }

      manifestMap[manifest.identifier] =
        manifest.identifier === RemoteDeviceManifest.identifier
          ? ({
              ...manifest,
              systemRole: generateSystemPrompt(deviceContext.onlineDevices),
            } as LobeToolManifest)
          : manifest;

      if (builtinToolIdentifiers.has(manifest.identifier)) {
        sourceMap[manifest.identifier] = 'builtin';
        continue;
      }

      const plugin = installedPluginMap.get(manifest.identifier);
      sourceMap[manifest.identifier] = plugin?.customParams?.mcp ? 'mcp' : 'plugin';
    }

    const unresolvedToolIds = toolIds.filter((toolId) => !manifestMap[toolId]);

    for (const toolId of unresolvedToolIds) {
      const plugin = installedPluginMap.get(toolId);
      if (!plugin) {
        console.warn(`[webapi/chat] plugin "${toolId}" not found in installed plugins`);
        continue;
      }

      let manifestApi = (plugin.manifest as any)?.api as
        | Array<{ description?: string; name: string; parameters: any }>
        | undefined;

      if (!manifestApi?.length) {
        const manifestUrl = (plugin.customParams as any)?.manifestUrl as string | undefined;
        if (manifestUrl) {
          try {
            console.info(`[webapi/chat] refetching manifest for "${toolId}" from ${manifestUrl}`);
            const response = await fetch(manifestUrl, { signal: AbortSignal.timeout(5000) });
            if (response.ok) {
              const freshManifest = await response.json();
              manifestApi = freshManifest?.api;
              if (manifestApi?.length) {
                await pluginModel.update(toolId, { manifest: freshManifest });
                console.info(
                  `[webapi/chat] recovered ${manifestApi.length} tools from manifestUrl for "${toolId}"`,
                );
              }
            }
          } catch (error) {
            console.warn(`[webapi/chat] failed to refetch manifest for "${toolId}":`, error);
          }
        }
      }

      if (manifestApi?.length) {
        const manifest = {
          ...(plugin.manifest as object),
          api: manifestApi,
          identifier: plugin.identifier,
        } as LobeToolManifest;

        manifestMap[plugin.identifier] = manifest;
        sourceMap[plugin.identifier] = plugin.customParams?.mcp ? 'mcp' : 'plugin';

        generatedTools.push(
          ...manifestApi.map((tool) => ({
            function: {
              description: tool.description,
              name: toolNameResolver.generate(
                plugin.identifier,
                tool.name,
                plugin.customParams?.mcp ? 'mcp' : (plugin.manifest as any)?.type,
              ),
              parameters: tool.parameters,
            },
            type: 'function' as const,
          })),
        );
        continue;
      }

      const mcpConfig = plugin.customParams?.mcp as McpPluginConfig | undefined;
      if (!mcpConfig || mcpConfig.type !== 'http' || !mcpConfig.url) {
        console.warn(
          `[webapi/chat] plugin "${toolId}" has no manifest tools and no valid MCP config`,
        );
        continue;
      }

      const clientParams: Record<string, any> = {
        name: plugin.identifier,
        type: 'http' as const,
        url: mcpConfig.url,
      };
      if (mcpConfig.auth) clientParams.auth = mcpConfig.auth;
      if (mcpConfig.headers) clientParams.headers = mcpConfig.headers;

      try {
        const mcpTools = await mcpService.listTools(clientParams as any);
        const manifest = {
          ...(plugin.manifest as object),
          api: mcpTools,
          identifier: plugin.identifier,
          mcpParams: mcpConfig,
          meta: (plugin.manifest as any)?.meta || { title: plugin.identifier },
          type: 'mcp',
        } as unknown as LobeToolManifest;

        manifestMap[plugin.identifier] = manifest;
        sourceMap[plugin.identifier] = 'mcp';

        generatedTools.push(
          ...mcpTools.map((tool) => ({
            function: {
              description: tool.description,
              name: toolNameResolver.generate(plugin.identifier, tool.name, 'mcp'),
              parameters: tool.parameters,
            },
            type: 'function' as const,
          })),
        );

        console.info(
          `[webapi/chat] fetched ${mcpTools.length} tools from MCP server for "${toolId}"`,
        );
      } catch (error) {
        console.error(`[webapi/chat] failed to list tools for ${plugin.identifier}:`, error);
      }
    }

    const tools = dedupeTools(generatedTools);

    if (tools.length === 0) {
      console.warn(
        '[webapi/chat] plugin IDs found but no tools resolved — check manifest/MCP server',
      );
      return undefined;
    }

    console.info(
      `[webapi/chat] injected ${tools.length} tools: ${tools.map((tool) => tool.function.name).join(', ')}`,
    );

    return {
      enabledToolIds: Object.keys(manifestMap),
      manifestMap,
      sourceMap,
      tools,
    };
  };

  private buildMessages = async (params: {
    conversationConfig?: ConversationConfig;
    conversationFileContents?: FileContent[];
    deviceSystemInfo?: Record<string, string>;
    memoryContext?: string;
    payload: MobileChatPayload;
    skillMetas: SkillMeta[];
    toolSet?: MobileToolSet;
  }) => {
    const {
      conversationConfig,
      conversationFileContents,
      deviceSystemInfo,
      memoryContext,
      payload,
      skillMetas,
      toolSet,
    } = params;

    const skillContext =
      skillMetas.length > 0
        ? [skillsPrompts(skillMetas), SkillsManifest.systemRole].filter(Boolean).join('\n\n')
        : undefined;

    const systemRole = [memoryContext, conversationConfig?.systemRole, skillContext]
      .filter(Boolean)
      .join('\n\n');

    if (skillContext) {
      console.info(
        `[webapi/chat] injected skill context for ${skillMetas.length} skills: ${skillMetas.map((skill) => skill.identifier).join(', ')}`,
      );
    }

    const shouldUseServerMessagesEngine =
      (conversationFileContents?.length ?? 0) > 0 ||
      !!conversationConfig ||
      !!memoryContext ||
      !!skillContext ||
      (toolSet?.enabledToolIds.length ?? 0) > 0;

    const messages = !shouldUseServerMessagesEngine
      ? payload.messages
      : await serverMessagesEngine({
          enableHistoryCount: conversationConfig?.chatConfig?.enableHistoryCount,
          historyCount: conversationConfig?.chatConfig?.historyCount,
          inputTemplate: conversationConfig?.chatConfig?.inputTemplate,
          knowledge:
            conversationConfig || conversationFileContents
              ? {
                  conversationFileContents,
                  fileContents: conversationConfig?.files
                    ?.filter((file) => file.enabled === true)
                    .map((file) => ({
                      content: file.content ?? '',
                      fileId: file.id ?? '',
                      filename: file.name ?? '',
                    })),
                  sourceSets: conversationConfig?.sourceSets
                    ?.filter((kb) => kb.enabled === true)
                    .map((kb) => ({
                      id: kb.id ?? '',
                      name: kb.name ?? '',
                    })),
                }
              : undefined,
          messages: payload.messages as any,
          model: payload.model,
          provider: this.provider,
          systemRole: systemRole || undefined,
          toolsConfig: toolSet
            ? {
                manifests: Object.values(toolSet.manifestMap),
                tools: toolSet.enabledToolIds,
              }
            : undefined,
          additionalVariables: deviceSystemInfo,
        });

    return sanitizeToolCallHistory(messages) || [];
  };

  private createToolExecutionService = () => {
    const fileService = new FileService(this.serverDB, this.userId);
    const builtinToolsExecutor = new BuiltinToolsExecutor(this.serverDB, this.userId);
    const toolExecutionService = new ToolExecutionService({
      builtinToolsExecutor,
      mcpService,
      pluginGatewayService: new PluginGatewayService(),
    });

    const boundProcessContentBlocks: NonNullable<
      ToolExecutionContext['processContentBlocks']
    > = async (blocks) => processContentBlocks(blocks, fileService);

    return { boundProcessContentBlocks, toolExecutionService };
  };

  private streamToolLoopFallback = async (params: {
    activeDeviceId?: string;
    conversationConfig?: ConversationConfig;
    operationId: string;
    payload: MobileChatPayload;
    runtimeOptions: Record<string, any>;
    toolSet: MobileToolSet;
  }) => {
    const { activeDeviceId, conversationConfig, operationId, payload, runtimeOptions, toolSet } =
      params;
    const encoder = new TextEncoder();
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const { boundProcessContentBlocks, toolExecutionService } = this.createToolExecutionService();
    const sourceSetIds = conversationConfig?.sourceSets
      ?.filter((kb) => kb.enabled === true)
      .map((kb) => kb.id)
      .filter(Boolean) as string[] | undefined;

    const writeEvent = async (event: string, data: unknown) => {
      await writer.write(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
    };

    const writeText = async (text: string) => {
      if (!text) return;
      await writer.write(encoder.encode(`event: text\ndata: ${JSON.stringify(text)}\n\n`));
    };

    void (async () => {
      try {
        let currentActiveDeviceId = activeDeviceId;
        let loopMessages = sanitizeToolCallHistory(payload.messages) || [];
        let loopToolSet = toolSet;

        for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
          loopMessages = sanitizeToolCallHistory(loopMessages) || [];
          let roundContent = '';
          let roundReasoning = '';
          let roundGrounding: unknown;
          let roundPerformance: unknown;
          let roundUsage: unknown;
          let rawToolCalls: MessageToolCall[] = [];
          let normalizedToolCalls: ChatToolPayload[] = [];

          console.info(
            `[webapi/chat] streaming fallback round ${round + 1}: ${loopMessages.length} messages, ${payload.tools?.length ?? 0} tools`,
          );

          const response = await this.modelRuntime.chat(
            {
              ...toModelChatPayload(payload),
              apiMode: 'chatCompletion',
              messages: loopMessages,
              stream: true,
              tools: loopToolSet.tools,
            } as any,
            {
              ...runtimeOptions,
              ...mergeMultipleChatMethodOptions([
                runtimeOptions as any,
                {
                  callback: {
                    onCompletion: async ({ grounding, speed, usage }: StreamCompletionData) => {
                      roundGrounding = grounding;
                      roundPerformance = speed;
                      roundUsage = usage;
                    },
                    onGrounding: async (grounding: StreamGroundingData) => {
                      roundGrounding = grounding;
                    },
                    onText: async (text: StreamTextData) => {
                      roundContent += text;
                    },
                    onThinking: async (reasoning: StreamThinkingData) => {
                      roundReasoning += reasoning;
                    },
                    onToolsCalling: async ({ toolsCalling }: StreamToolsCallingData) => {
                      rawToolCalls = toolsCalling;
                      normalizedToolCalls = normalizeToolCalls(
                        toolsCalling,
                        loopToolSet.manifestMap,
                        loopToolSet.sourceMap,
                      );
                    },
                    onUsage: async (usage: StreamUsageData) => {
                      roundUsage = usage;
                    },
                  },
                } as any,
              ]),
            },
          );

          await consumeStreamUntilDone(response);

          if (normalizedToolCalls.length === 0) {
            if (roundGrounding) await writeEvent('grounding', roundGrounding);
            if (roundReasoning) await writeEvent('reasoning', roundReasoning);
            await writeText(roundContent);
            if (roundUsage) await writeEvent('usage', roundUsage);
            if (roundPerformance) await writeEvent('performance', roundPerformance);
            break;
          }

          let userInterventionConfig: UserInterventionConfig | undefined;
          try {
            const userModel = new UserModel(this.serverDB, this.userId);
            const settings = await userModel.getUserSettings();
            userInterventionConfig = (settings as any)?.tool?.humanIntervention;
          } catch {
            //
          }

          const [toolsNeedingIntervention, toolsToExecute] = partitionToolsByIntervention(
            normalizedToolCalls,
            userInterventionConfig,
            loopToolSet.manifestMap,
          );

          if (toolsNeedingIntervention.length > 0) {
            const fallbackToolExecutions: MobileToolExecutionEvent[] = [];
            loopMessages = [
              ...loopMessages,
              {
                content: roundContent,
                role: 'assistant',
                ...(roundReasoning ? { reasoning_content: roundReasoning } : {}),
                tool_calls: rawToolCalls,
              } as any,
            ];

            for (const toolCall of toolsToExecute) {
              const result = await this.executeMobileTool({
                activeDeviceId: currentActiveDeviceId,
                boundProcessContentBlocks,
                operationId,
                payload,
                sourceSetIds,
                toolCall,
                toolExecutionService,
                toolSet: loopToolSet,
              });
              const { execution } = result;
              currentActiveDeviceId = result.activeDeviceId;
              loopToolSet = result.toolSet;
              fallbackToolExecutions.push(createToolExecutionEvent(toolCall, execution));
              appendToolExecutionMessages(loopMessages, toolCall, execution);
            }

            const pendingWithStatus = toolsNeedingIntervention.map((t) => ({
              ...t,
              intervention: { status: 'pending' as const },
            }));
            const allToolCallsForClient = [
              ...toolsToExecute.map((t) => ({
                ...t,
                intervention: { status: 'approved' as const },
              })),
              ...pendingWithStatus,
            ].sort((a, b) => {
              const ai = normalizedToolCalls.findIndex((n) => n.id === a.id);
              const bi = normalizedToolCalls.findIndex((n) => n.id === b.id);
              return ai - bi;
            });

            await writeEvent('tool_calls', allToolCallsForClient);
            if (fallbackToolExecutions.length > 0)
              await writeEvent('tool_executions', fallbackToolExecutions);
            await writeEvent('intervention_required', {
              pendingToolCalls: pendingWithStatus,
              sessionId: payload.sessionId,
              topicId: payload.topicId,
            });

            const resumeStore = getMobileInterventionResumeStore();
            resumeStore.set(
              resumeStore.key(this.userId, payload.sessionId ?? '', payload.topicId),
              {
                loopMessages,
                payload: {
                  ...payload,
                  activeDeviceId: currentActiveDeviceId,
                  messages: loopMessages,
                  operationId,
                },
                pendingToolCalls: pendingWithStatus,
                round,
                toolSet: loopToolSet,
                userId: this.userId,
              },
            );
            break;
          }

          console.info(
            `[webapi/chat] streaming fallback round ${round + 1}: executing ${normalizedToolCalls.length} tools`,
          );

          await writeEvent('tool_calls', normalizedToolCalls);

          loopMessages = [
            ...loopMessages,
            {
              content: roundContent,
              role: 'assistant',
              ...(roundReasoning ? { reasoning_content: roundReasoning } : {}),
              tool_calls: rawToolCalls,
            } as any,
          ];

          const toolExecutions: MobileToolExecutionEvent[] = [];

          for (const toolCall of normalizedToolCalls) {
            const result = await this.executeMobileTool({
              activeDeviceId: currentActiveDeviceId,
              boundProcessContentBlocks,
              operationId,
              payload,
              sourceSetIds,
              toolCall,
              toolExecutionService,
              toolSet: loopToolSet,
            });
            const { execution } = result;
            currentActiveDeviceId = result.activeDeviceId;
            loopToolSet = result.toolSet;

            toolExecutions.push(createToolExecutionEvent(toolCall, execution));
            appendToolExecutionMessages(loopMessages, toolCall, execution);
          }

          if (toolExecutions.length > 0) {
            await writeEvent('tool_executions', toolExecutions);
          }

          if (round === MAX_TOOL_ROUNDS - 1) {
            if (roundGrounding) await writeEvent('grounding', roundGrounding);
            if (roundReasoning) await writeEvent('reasoning', roundReasoning);
            await writeText(roundContent);
            if (roundUsage) await writeEvent('usage', roundUsage);
            if (roundPerformance) await writeEvent('performance', roundPerformance);
          }
        }
      } catch (error) {
        console.error('[webapi/chat] streaming tool fallback failed:', error);
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: {
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Content-Type': 'text/event-stream; charset=utf-8',
      },
      status: 200,
    });
  };

  handleChat = async (payload: MobileChatPayload, tracePayload?: TracePayload) => {
    await this.assertAccessibleSpace(payload.spaceId);
    const operationId = payload.operationId || createMobileOperationId(payload);

    const conversationConfig = await readSessionConversationConfig(
      this.serverDB,
      this.userId,
      payload.sessionId,
    );

    const pluginIds = conversationConfig?.plugins?.length
      ? conversationConfig.plugins
      : (payload.plugins ?? []);

    if (payload.sessionId) {
      console.info(
        `[webapi/chat] session=${payload.sessionId} agentId=${conversationConfig?.id} agentPlugins=${JSON.stringify(pluginIds)}`,
      );
    } else if (pluginIds.length > 0) {
      console.info(
        `[webapi/chat] using plugins from request payload: ${JSON.stringify(pluginIds)}`,
      );
    }

    const [conversationFileContents, memoryContext, skillMetas, deviceContext] = await Promise.all([
      readConversationFileContents(this.serverDB, this.userId, payload.sessionId),
      readMemoryContext({
        conversationConfig,
        explicitMemory: payload.memory,
        serverDB: this.serverDB,
        topicId: payload.topicId,
        userId: this.userId,
      }),
      resolveEnabledSkillMetas(pluginIds, this.serverDB, this.userId),
      this.resolveDeviceContext(payload.activeDeviceId),
    ]);

    const toolSet = await this.resolveToolSet({
      conversationConfig,
      deviceContext,
      payload,
      pluginIds,
      skillMetas,
    });

    const messages = await this.buildMessages({
      conversationConfig,
      conversationFileContents,
      deviceSystemInfo: deviceContext.deviceSystemInfo,
      memoryContext,
      payload,
      skillMetas,
      toolSet,
    });

    const data = toModelChatPayload({
      ...payload,
      activeDeviceId: deviceContext.activeDeviceId,
      messages,
      operationId,
      ...(toolSet?.tools ? { tools: toolSet.tools } : {}),
    });
    const sourceSetIds = conversationConfig?.sourceSets
      ?.filter((kb) => kb.enabled === true)
      .map((kb) => kb.id)
      .filter(Boolean) as string[] | undefined;

    const traceOptions = tracePayload?.enabled
      ? createTraceOptions(data, { provider: this.provider, trace: tracePayload })
      : {};
    const runtimeOptions = {
      ...traceOptions,
      signal: this.requestSignal,
      user: this.userId,
    };

    if (toolSet) {
      Object.values(toolSet.manifestMap).forEach((manifest) => {
        const maybeMcpParams = (manifest as any).mcpParams as McpPluginConfig | undefined;
        if (!maybeMcpParams) return;
        (manifest as any).mcpParams = maybeMcpParams;
      });
    }

    const originalMessages = sanitizeToolCallHistory(data.messages) || [];
    data.messages = originalMessages;
    let toolLoopSucceeded = false;
    let toolExecutionsForResponse: MobileToolExecutionEvent[] = [];
    let finalAssistantForResponse: ToolLoopFinalAssistantResponse | undefined;
    let activeDeviceIdForTools = deviceContext.activeDeviceId;
    let effectiveToolSet = toolSet;

    if (toolSet?.tools?.length) {
      try {
        const { boundProcessContentBlocks, toolExecutionService } =
          this.createToolExecutionService();

        let loopMessages = [...originalMessages];
        let loopToolSet = toolSet;
        let toolsWereCalled = false;
        const loopToolExecutions: MobileToolExecutionEvent[] = [];

        for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
          loopMessages = sanitizeToolCallHistory(loopMessages) || [];
          console.info(
            `[webapi/chat] tool-loop round ${round + 1}: ${loopMessages.length} messages, ${loopToolSet.tools?.length ?? 0} tools`,
          );

          const response = await this.modelRuntime.chat(
            {
              ...data,
              apiMode: 'chatCompletion',
              messages: loopMessages,
              responseMode: 'json',
              stream: false,
              tools: loopToolSet.tools,
            } as any,
            runtimeOptions,
          );

          const result = await readChatCompletionResult(response);
          const choice = result?.choices?.[0];
          const assistantMessage = choice?.message;
          const finalContent =
            typeof assistantMessage?.content === 'string' ? assistantMessage.content : undefined;
          const finalReasoning =
            typeof (assistantMessage as any)?.reasoning_content === 'string'
              ? (assistantMessage as any).reasoning_content
              : undefined;
          const finalGrounding = isExecutionStateRecord((result as any)?.grounding)
            ? ((result as any).grounding as Record<string, unknown>)
            : undefined;
          const finalUsage = isExecutionStateRecord((result as any)?.usage)
            ? ((result as any).usage as Record<string, unknown>)
            : undefined;
          const finalPerformance = isExecutionStateRecord((result as any)?.speed)
            ? ((result as any).speed as Record<string, unknown>)
            : undefined;

          if (!assistantMessage?.tool_calls?.length) {
            console.info(
              `[webapi/chat] round ${round + 1}: no tool_calls (finish_reason=${choice?.finish_reason}), content preview: "${(assistantMessage?.content || '').slice(0, 150)}"`,
            );
            if (round === 0 && !choice) {
              console.warn(
                `[webapi/chat] round 1: unexpected response shape, keys=${Object.keys(result || {}).join(',')}`,
              );
            }

            if (
              toolsWereCalled &&
              (finalContent || finalReasoning || finalGrounding || finalUsage || finalPerformance)
            ) {
              finalAssistantForResponse = {
                ...(finalContent ? { content: finalContent } : {}),
                ...(finalReasoning ? { reasoning: finalReasoning } : {}),
                ...(finalGrounding ? { grounding: finalGrounding } : {}),
                ...(finalUsage ? { usage: finalUsage } : {}),
                ...(finalPerformance ? { performance: finalPerformance } : {}),
              };
            }

            break;
          }

          toolsWereCalled = true;
          const normalizedToolCalls = normalizeToolCalls(
            assistantMessage.tool_calls,
            loopToolSet.manifestMap,
            loopToolSet.sourceMap,
          );

          console.info(
            `[webapi/chat] round ${round + 1}: model called ${normalizedToolCalls.length} tools: ${normalizedToolCalls.map((toolCall) => toolCall.apiName).join(', ')}`,
          );

          let userInterventionConfig: UserInterventionConfig | undefined;
          try {
            const userModel = new UserModel(this.serverDB, this.userId);
            const settings = await userModel.getUserSettings();
            userInterventionConfig = (settings as any)?.tool?.humanIntervention;
          } catch (err) {
            console.warn('[webapi/chat] failed to read user intervention config:', err);
          }

          const [toolsNeedingIntervention, toolsToExecute] = partitionToolsByIntervention(
            normalizedToolCalls,
            userInterventionConfig,
            loopToolSet.manifestMap,
          );

          if (toolsNeedingIntervention.length > 0) {
            loopMessages = [
              ...loopMessages,
              {
                content: assistantMessage.content || '',
                role: 'assistant',
                ...(finalReasoning ? { reasoning_content: finalReasoning } : {}),
                tool_calls: assistantMessage.tool_calls,
              } as any,
            ];

            for (const toolCall of toolsToExecute) {
              console.info(
                `[webapi/chat] executing tool (auto): ${toolCall.identifier}:${toolCall.apiName}`,
              );
              const result = await this.executeMobileTool({
                activeDeviceId: activeDeviceIdForTools,
                boundProcessContentBlocks,
                operationId,
                payload,
                sourceSetIds,
                toolCall,
                toolExecutionService,
                toolSet: loopToolSet,
              });
              const { execution } = result;
              activeDeviceIdForTools = result.activeDeviceId;
              loopToolSet = result.toolSet;
              effectiveToolSet = loopToolSet;
              loopToolExecutions.push(createToolExecutionEvent(toolCall, execution));
              appendToolExecutionMessages(loopMessages, toolCall, execution);
            }

            const pendingWithStatus = toolsNeedingIntervention.map((t) => ({
              ...t,
              intervention: { status: 'pending' as const },
            }));
            const allToolCallsForClient = [
              ...toolsToExecute.map((t) => ({
                ...t,
                intervention: { status: 'approved' as const },
              })),
              ...pendingWithStatus,
            ].sort((a, b) => {
              const ai = normalizedToolCalls.findIndex((n) => n.id === a.id);
              const bi = normalizedToolCalls.findIndex((n) => n.id === b.id);
              return ai - bi;
            });

            const resumeStore = getMobileInterventionResumeStore();
            const rk = resumeStore.key(this.userId, payload.sessionId ?? '', payload.topicId);
            resumeStore.set(rk, {
              loopMessages: [...loopMessages],
              payload: {
                ...payload,
                activeDeviceId: activeDeviceIdForTools,
                messages: loopMessages,
                operationId,
              },
              pendingToolCalls: pendingWithStatus,
              round,
              toolSet: loopToolSet,
              userId: this.userId,
            });

            return createStaticSSETextResponse({
              interventionRequired: {
                payload: {
                  pendingToolCalls: pendingWithStatus,
                  sessionId: payload.sessionId,
                  topicId: payload.topicId,
                },
              },
              toolCalls: allToolCallsForClient,
              toolExecutions: loopToolExecutions,
            });
          }

          loopMessages = [
            ...loopMessages,
            {
              content: assistantMessage.content || '',
              role: 'assistant',
              ...(finalReasoning ? { reasoning_content: finalReasoning } : {}),
              tool_calls: assistantMessage.tool_calls,
            } as any,
          ];

          for (const toolCall of normalizedToolCalls) {
            console.info(
              `[webapi/chat] executing tool: ${toolCall.identifier}:${toolCall.apiName}`,
            );

            const result = await this.executeMobileTool({
              activeDeviceId: activeDeviceIdForTools,
              boundProcessContentBlocks,
              operationId,
              payload,
              sourceSetIds,
              toolCall,
              toolExecutionService,
              toolSet: loopToolSet,
            });
            const { execution } = result;
            activeDeviceIdForTools = result.activeDeviceId;
            loopToolSet = result.toolSet;
            effectiveToolSet = loopToolSet;

            const content = serializeToolExecutionContent(execution.content);

            console.info(
              `[webapi/chat] tool ${toolCall.identifier}:${toolCall.apiName} result: ${content.slice(0, 200)}${content.length > 200 ? '...' : ''}`,
            );

            loopToolExecutions.push(createToolExecutionEvent(toolCall, execution));

            appendToolExecutionMessages(loopMessages, toolCall, execution);
          }
        }

        if (toolsWereCalled) {
          data.messages = sanitizeToolCallHistory(loopMessages) || [];
          data.tools = loopToolSet.tools;
          toolExecutionsForResponse = loopToolExecutions;
          toolLoopSucceeded = true;
        }
      } catch (error) {
        console.error(
          '[webapi/chat] tool calling loop error, falling back to original messages:',
          error,
        );
        data.messages = originalMessages;
      }
    }

    if (toolLoopSucceeded && finalAssistantForResponse) {
      console.info(
        '[webapi/chat] returning tool-loop final assistant response without re-streaming',
      );
      return createStaticSSETextResponse({
        assistant: finalAssistantForResponse,
        toolExecutions: toolExecutionsForResponse,
      });
    }

    if (effectiveToolSet?.tools?.length && toolLoopSucceeded) {
      delete data.tools;
    }

    if (data.enabledSearch) {
      try {
        const searchSystemMessage = await getSearchSystemMessage(data.messages);
        if (searchSystemMessage) {
          console.info(
            `[webapi/chat] builtin web search succeeded: ${searchSystemMessage.length} chars`,
          );
          data.messages = [
            ...(data.messages || []),
            {
              content: searchSystemMessage,
              role: 'system',
            } as any,
          ];
        } else {
          console.warn('[webapi/chat] builtin web search returned no results');
        }
      } catch (error) {
        console.error('[webapi/chat] builtin web search failed:', error);
      }

      delete (data as any).enabledSearch;
    }

    console.info(
      `[webapi/chat] final streaming call: tools=${data.tools?.length ?? 0}, messages=${data.messages?.length ?? 0}`,
    );

    if (!toolLoopSucceeded && effectiveToolSet?.tools?.length) {
      return this.streamToolLoopFallback({
        activeDeviceId: activeDeviceIdForTools,
        conversationConfig,
        operationId,
        payload: {
          ...data,
          activeDeviceId: activeDeviceIdForTools,
          operationId,
          sessionId: payload.sessionId,
        },
        runtimeOptions,
        toolSet: effectiveToolSet,
      });
    }

    const streamResponse = await this.modelRuntime.chat(data, runtimeOptions);
    if (!toolLoopSucceeded || !streamResponse.body || !toolSet) return streamResponse;

    if (toolExecutionsForResponse.length === 0) return streamResponse;

    const toolEventChunk = `event: tool_executions\ndata: ${JSON.stringify(toolExecutionsForResponse)}\n\n`;
    const encoder = new TextEncoder();
    const toolChunkBytes = encoder.encode(toolEventChunk);

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    void (async () => {
      try {
        await writer.write(toolChunkBytes);
        const reader = streamResponse.body!.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          await writer.write(value);
        }
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: streamResponse.headers,
      status: streamResponse.status,
    });
  };

  /**
   * Continue after user approves a pending tool call, or rejects one and continues the loop
   * (same as Web rejectAndContinue). Exactly one of approvedToolCall or rejectedToolCall applies.
   */
  continueIntervention = async (params: {
    approvedToolCall?: ChatToolPayload;
    payload: MobileChatPayload;
    rejectedToolCall?: { id: string; reason?: string };
    resumeState: MobileInterventionResumeState;
  }) => {
    const { approvedToolCall, rejectedToolCall, payload, resumeState } = params;
    await this.assertAccessibleSpace(payload.spaceId);

    const hasApprove = Boolean(approvedToolCall);
    const hasReject = Boolean(rejectedToolCall);
    if (hasApprove === hasReject) {
      throw new Error('Provide exactly one of approvedToolCall or rejectedToolCall');
    }

    const { loopMessages, pendingToolCalls, round } = resumeState;
    const operationId = payload.operationId || createMobileOperationId(payload);
    let activeDeviceIdForTools = payload.activeDeviceId;
    let loopToolSet = resumeState.toolSet as MobileToolSet;
    const { boundProcessContentBlocks, toolExecutionService } = this.createToolExecutionService();
    const conversationConfig = await readSessionConversationConfig(
      this.serverDB,
      this.userId,
      payload.sessionId,
    );
    const sourceSetIds = conversationConfig?.sourceSets
      ?.filter((kb) => kb.enabled === true)
      .map((kb) => kb.id)
      .filter(Boolean) as string[] | undefined;

    let newLoopMessages: any[];
    let toolExecEvent: MobileToolExecutionEvent;
    let settledTool: ChatToolPayload;

    if (approvedToolCall) {
      const result = await this.executeMobileTool({
        activeDeviceId: activeDeviceIdForTools,
        boundProcessContentBlocks,
        operationId,
        payload,
        sourceSetIds,
        toolCall: approvedToolCall,
        toolExecutionService,
        toolSet: loopToolSet,
      });
      const { execution } = result;
      activeDeviceIdForTools = result.activeDeviceId;
      loopToolSet = result.toolSet;

      newLoopMessages = [...loopMessages];
      appendToolExecutionMessages(newLoopMessages, approvedToolCall, execution);

      toolExecEvent = createToolExecutionEvent(approvedToolCall, execution);
      settledTool = approvedToolCall;
    } else {
      const rt = pendingToolCalls.find((p) => p.id === rejectedToolCall!.id);
      if (!rt) {
        throw new Error('Rejected tool id is not in pending list');
      }
      const rejectContent = rejectedToolCall!.reason
        ? `User reject this tool calling with reason: ${rejectedToolCall!.reason}`
        : 'User reject this tool calling without reason';
      newLoopMessages = [
        ...loopMessages,
        {
          content: rejectContent,
          role: 'tool',
          tool_call_id: rejectedToolCall!.id,
        } as any,
      ];
      toolExecEvent = createToolRejectionExecutionEvent(rt, rejectedToolCall!.reason);
      settledTool = rt;
    }

    const settledId = settledTool.id;
    const remainingPending = pendingToolCalls.filter((p) => p.id !== settledId);
    const resumeStore = getMobileInterventionResumeStore();

    const settledForClient: ChatToolPayload & {
      intervention: { rejectedReason?: string; status: 'approved' | 'rejected' };
    } = approvedToolCall
      ? { ...settledTool, intervention: { status: 'approved' as const } }
      : {
          ...settledTool,
          intervention: {
            rejectedReason: rejectedToolCall!.reason,
            status: 'rejected' as const,
          },
        };

    if (remainingPending.length > 0) {
      resumeStore.set(resumeStore.key(this.userId, payload.sessionId ?? '', payload.topicId), {
        loopMessages: newLoopMessages,
        payload: {
          ...payload,
          activeDeviceId: activeDeviceIdForTools,
          messages: newLoopMessages,
          operationId,
        },
        pendingToolCalls: remainingPending,
        round,
        toolSet: loopToolSet,
        userId: this.userId,
      });

      const allToolCallsForClient = [
        settledForClient,
        ...remainingPending.map((p) => ({
          ...p,
          intervention: { status: 'pending' as const },
        })),
      ];

      return createStaticSSETextResponse({
        interventionRequired: {
          payload: {
            pendingToolCalls: remainingPending,
            sessionId: payload.sessionId,
            topicId: payload.topicId,
          },
        },
        toolCalls: allToolCallsForClient,
        toolExecutions: [toolExecEvent],
      });
    }

    resumeStore.delete(resumeStore.key(this.userId, payload.sessionId ?? '', payload.topicId));

    const data = toModelChatPayload({
      ...payload,
      activeDeviceId: activeDeviceIdForTools,
      messages: sanitizeToolCallHistory(newLoopMessages) || [],
      operationId,
      ...(loopToolSet?.tools ? { tools: loopToolSet.tools } : {}),
    });

    const runtimeOptions = {
      signal: this.requestSignal,
      user: this.userId,
    };

    const response = await this.modelRuntime.chat(
      {
        ...data,
        apiMode: 'chatCompletion',
        messages: data.messages,
        responseMode: 'json',
        stream: false,
        tools: loopToolSet.tools,
      } as any,
      runtimeOptions,
    );

    const result = await readChatCompletionResult(response);
    const choice = result?.choices?.[0];
    const assistantMessage = choice?.message;
    const finalContent =
      typeof assistantMessage?.content === 'string' ? assistantMessage.content : undefined;
    const finalReasoning =
      typeof (assistantMessage as any)?.reasoning_content === 'string'
        ? (assistantMessage as any).reasoning_content
        : undefined;
    const finalGrounding = isExecutionStateRecord((result as any)?.grounding)
      ? ((result as any).grounding as Record<string, unknown>)
      : undefined;
    const finalUsage = isExecutionStateRecord((result as any)?.usage)
      ? ((result as any).usage as Record<string, unknown>)
      : undefined;
    const finalPerformance = isExecutionStateRecord((result as any)?.speed)
      ? ((result as any).speed as Record<string, unknown>)
      : undefined;

    if (assistantMessage?.tool_calls?.length) {
      const normalized = normalizeToolCalls(
        assistantMessage.tool_calls,
        loopToolSet.manifestMap,
        loopToolSet.sourceMap,
      );
      let userInterventionConfig: UserInterventionConfig | undefined;
      try {
        const userModel = new UserModel(this.serverDB, this.userId);
        const settings = await userModel.getUserSettings();
        userInterventionConfig = (settings as any)?.tool?.humanIntervention;
      } catch {
        //
      }
      const [needing, toExecute] = partitionToolsByIntervention(
        normalized,
        userInterventionConfig,
        loopToolSet.manifestMap,
      );
      if (needing.length > 0) {
        const fullLoop = [
          ...newLoopMessages,
          {
            content: assistantMessage.content || '',
            role: 'assistant',
            ...(finalReasoning ? { reasoning_content: finalReasoning } : {}),
            tool_calls: assistantMessage.tool_calls,
          } as any,
        ];
        const execEvents: MobileToolExecutionEvent[] = [];
        for (const tc of toExecute) {
          const result = await this.executeMobileTool({
            activeDeviceId: activeDeviceIdForTools,
            boundProcessContentBlocks,
            operationId,
            payload,
            sourceSetIds,
            toolCall: tc,
            toolExecutionService,
            toolSet: loopToolSet,
          });
          const { execution: ex } = result;
          activeDeviceIdForTools = result.activeDeviceId;
          loopToolSet = result.toolSet;
          appendToolExecutionMessages(fullLoop, tc, ex);
          execEvents.push(createToolExecutionEvent(tc, ex));
        }
        const pendingWithStatus = needing.map((t) => ({
          ...t,
          intervention: { status: 'pending' as const },
        }));
        const allToolCalls = [
          ...toExecute.map((t) => ({ ...t, intervention: { status: 'approved' as const } })),
          ...pendingWithStatus,
        ].sort((a, b) => {
          const ai = normalized.findIndex((n) => n.id === a.id);
          const bi = normalized.findIndex((n) => n.id === b.id);
          return ai - bi;
        });
        const store = getMobileInterventionResumeStore();
        store.set(store.key(this.userId, payload.sessionId ?? '', payload.topicId), {
          loopMessages: fullLoop,
          payload: {
            ...payload,
            activeDeviceId: activeDeviceIdForTools,
            messages: fullLoop,
            operationId,
          },
          pendingToolCalls: pendingWithStatus,
          round: round + 1,
          toolSet: loopToolSet,
          userId: this.userId,
        });
        return createStaticSSETextResponse({
          interventionRequired: {
            payload: {
              pendingToolCalls: pendingWithStatus,
              sessionId: payload.sessionId,
              topicId: payload.topicId,
            },
          },
          toolCalls: allToolCalls,
          toolExecutions: [toolExecEvent, ...execEvents],
        });
      }
    }

    return createStaticSSETextResponse({
      assistant: {
        ...(finalContent ? { content: finalContent } : {}),
        ...(finalReasoning ? { reasoning: finalReasoning } : {}),
        ...(finalGrounding ? { grounding: finalGrounding } : {}),
        ...(finalUsage ? { usage: finalUsage } : {}),
        ...(finalPerformance ? { performance: finalPerformance } : {}),
      },
      toolExecutions: [toolExecEvent],
    });
  };
}
