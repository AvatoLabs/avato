import { BUILTIN_AGENT_SLUGS, getAgentRuntimeConfig } from '@lobechat/builtin-agents';
import { builtinSkills } from '@lobechat/builtin-skills';
import { SkillsIdentifier, SkillsManifest } from '@lobechat/builtin-tool-skills';
import { WebBrowsingExecutionRuntime } from '@lobechat/builtin-tool-web-browsing/executionRuntime';
import { builtinTools } from '@lobechat/builtin-tools';
import { type TracePayload } from '@lobechat/const';
import {
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
import { type ChatToolPayload, type MessageToolCall } from '@lobechat/types';
import { LOBE_DEFAULT_MODEL_LIST } from 'model-bank';

import { AgentModel } from '@/database/models/agent';
import { AgentSkillModel } from '@/database/models/agentSkill';
import { PluginModel } from '@/database/models/plugin';
import { SessionModel } from '@/database/models/session';
import { UserMemoryIdentityModel } from '@/database/models/userMemory/identity';
import { type LobeChatDatabase } from '@/database/type';
import { filterBuiltinSkills } from '@/helpers/skillFilters';
import { createServerAgentToolsEngine, serverMessagesEngine } from '@/server/modules/Mecha';
import { createTraceOptions } from '@/server/modules/ModelRuntime';
import { FileService } from '@/server/services/file';
import { mcpService } from '@/server/services/mcp';
import { processContentBlocks } from '@/server/services/mcp/contentProcessor';
import { PluginGatewayService } from '@/server/services/pluginGateway';
import { SearchService } from '@/server/services/search';
import { ToolExecutionService } from '@/server/services/toolExecution';
import { BuiltinToolsExecutor } from '@/server/services/toolExecution/builtin';
import { type ChatStreamPayload } from '@/types/openai/chat';

import { readChatCompletionResult } from './responseParser';

const MAX_TOOL_ROUNDS = 5;

const MEMORY_LIMIT_BY_EFFORT = {
  high: 50,
  low: 12,
  medium: 30,
} as const;

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

type MobileMemoryEffort = keyof typeof MEMORY_LIMIT_BY_EFFORT;
type ToolSource = 'builtin' | 'klavis' | 'lobehubSkill' | 'mcp' | 'plugin';

export interface MobileMemoryPayload {
  effort?: MobileMemoryEffort;
  enabled?: boolean;
}

export interface MobileChatPayload extends ChatStreamPayload {
  memory?: MobileMemoryPayload;
  plugins?: string[];
  sessionId?: string;
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
  knowledgeBases?: Array<{ enabled?: boolean | null; id?: string; name?: string }>;
  model?: string | null;
  plugins?: string[];
  provider?: string | null;
  slug?: string | null;
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

interface MobileToolExecutionEvent {
  apiName: string;
  arguments: string;
  id: string;
  identifier: string;
  intervention?: { status: 'approved' };
  result: string;
  state?: Record<string, unknown>;
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

const buildMemoryContext = (
  memories: Array<{
    description?: string | null;
    role?: string | null;
    type?: string | null;
  }>,
) => {
  const lines = memories
    .map((item) => {
      const role = item.role || item.type || 'user';
      const content = item.description?.trim();
      if (!content) return null;
      return `[${role}] ${content}`;
    })
    .filter(Boolean);

  if (lines.length === 0) return undefined;

  return `## User Memory\n${lines.join('\n')}`;
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

const readMemoryContext = async (params: {
  conversationConfig?: ConversationConfig;
  explicitMemory?: MobileMemoryPayload;
  serverDB: LobeChatDatabase;
  userId: string;
}) => {
  const memorySource = params.explicitMemory || params.conversationConfig?.chatConfig?.memory;
  if (!memorySource || memorySource.enabled === false) return undefined;

  try {
    const effort = normalizeMemoryEffort(memorySource.effort);
    const limit = MEMORY_LIMIT_BY_EFFORT[effort];
    const memoryModel = new UserMemoryIdentityModel(params.serverDB, params.userId);
    const memories = await memoryModel.queryForInjection(limit);

    return buildMemoryContext(memories);
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

const isExecutionStateRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const serializeToolExecutionContent = (content: unknown) =>
  typeof content === 'string' ? content : JSON.stringify(content);

const createToolExecutionEvent = (
  toolCall: ChatToolPayload,
  execution: { content: unknown; state?: unknown },
): MobileToolExecutionEvent => ({
  apiName: toolCall.apiName,
  arguments: toolCall.arguments,
  id: toolCall.id,
  identifier: toolCall.identifier,
  intervention: { status: 'approved' },
  result: serializeToolExecutionContent(execution.content),
  ...(isExecutionStateRecord(execution.state) ? { state: execution.state } : {}),
});

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
    this.userId = params.userId;
  }

  private resolveToolSet = async (params: {
    conversationConfig?: ConversationConfig;
    pluginIds: string[];
    skillMetas: SkillMeta[];
    payload: MobileChatPayload;
  }): Promise<MobileToolSet | undefined> => {
    const { conversationConfig, pluginIds, skillMetas, payload } = params;
    if (pluginIds.length === 0) return undefined;
    if (!isModelSupportToolUse(payload.model, this.provider)) return undefined;

    const toolNameResolver = new ToolNameResolver();
    const pluginModel = new PluginModel(this.serverDB, this.userId);
    const installedPlugins = await pluginModel.query();
    const installedPluginMap = new Map(
      installedPlugins.map((plugin) => [plugin.identifier, plugin]),
    );

    const toolIds =
      skillMetas.length > 0 ? [...new Set([...pluginIds, SkillsIdentifier])] : pluginIds;

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
      manifestMap[manifest.identifier] = manifest;

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
    memoryContext?: string;
    payload: MobileChatPayload;
    skillMetas: SkillMeta[];
    toolSet?: MobileToolSet;
  }) => {
    const { conversationConfig, memoryContext, payload, skillMetas, toolSet } = params;

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
      !!conversationConfig ||
      !!memoryContext ||
      !!skillContext ||
      (toolSet?.enabledToolIds.length ?? 0) > 0;

    if (!shouldUseServerMessagesEngine) return payload.messages;

    return serverMessagesEngine({
      enableHistoryCount: conversationConfig?.chatConfig?.enableHistoryCount,
      historyCount: conversationConfig?.chatConfig?.historyCount,
      inputTemplate: conversationConfig?.chatConfig?.inputTemplate,
      knowledge: conversationConfig
        ? {
            fileContents: conversationConfig.files
              ?.filter((file) => file.enabled === true)
              .map((file) => ({
                content: file.content ?? '',
                fileId: file.id ?? '',
                filename: file.name ?? '',
              })),
            knowledgeBases: conversationConfig.knowledgeBases
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
    });
  };

  private createToolExecutionService = () => {
    const fileService = new FileService(this.serverDB, this.userId);
    const builtinToolsExecutor = new BuiltinToolsExecutor(this.serverDB, this.userId);
    const toolExecutionService = new ToolExecutionService({
      builtinToolsExecutor,
      mcpService,
      pluginGatewayService: new PluginGatewayService(),
    });

    const boundProcessContentBlocks = async (blocks: any[]) =>
      processContentBlocks(blocks, fileService);

    return { boundProcessContentBlocks, toolExecutionService };
  };

  private streamToolLoopFallback = async (params: {
    payload: MobileChatPayload;
    runtimeOptions: Record<string, any>;
    toolSet: MobileToolSet;
  }) => {
    const { payload, runtimeOptions, toolSet } = params;
    const encoder = new TextEncoder();
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const { boundProcessContentBlocks, toolExecutionService } = this.createToolExecutionService();

    const writeEvent = async (event: string, data: unknown) => {
      await writer.write(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
    };

    const writeText = async (text: string) => {
      if (!text) return;
      await writer.write(encoder.encode(`event: text\ndata: ${JSON.stringify(text)}\n\n`));
    };

    void (async () => {
      try {
        let loopMessages = [...(payload.messages || [])];

        for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
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
              ...payload,
              apiMode: 'chatCompletion',
              messages: loopMessages,
              stream: true,
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
                        toolSet.manifestMap,
                        toolSet.sourceMap,
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

          console.info(
            `[webapi/chat] streaming fallback round ${round + 1}: executing ${normalizedToolCalls.length} tools`,
          );

          await writeEvent('tool_calls', normalizedToolCalls);

          loopMessages = [
            ...loopMessages,
            {
              content: roundContent,
              reasoning: roundReasoning ? { content: roundReasoning } : undefined,
              role: 'assistant',
              tool_calls: rawToolCalls,
            } as any,
          ];

          const toolExecutions: MobileToolExecutionEvent[] = [];

          for (const toolCall of normalizedToolCalls) {
            const execution = await toolExecutionService.executeTool(toolCall, {
              processContentBlocks:
                toolCall.source === 'mcp' ? boundProcessContentBlocks : undefined,
              serverDB: this.serverDB,
              toolManifestMap: toolSet.manifestMap,
              topicId: payload.topicId,
              userId: this.userId,
            });

            const executionContent = serializeToolExecutionContent(execution.content);
            toolExecutions.push(createToolExecutionEvent(toolCall, execution));

            loopMessages.push({
              content: executionContent,
              role: 'tool',
              tool_call_id: toolCall.id,
            } as any);
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

    const [memoryContext, skillMetas] = await Promise.all([
      readMemoryContext({
        conversationConfig,
        explicitMemory: payload.memory,
        serverDB: this.serverDB,
        userId: this.userId,
      }),
      resolveEnabledSkillMetas(pluginIds, this.serverDB, this.userId),
    ]);

    const toolSet = await this.resolveToolSet({
      conversationConfig,
      payload,
      pluginIds,
      skillMetas,
    });

    const messages = await this.buildMessages({
      conversationConfig,
      memoryContext,
      payload,
      skillMetas,
      toolSet,
    });

    const data: MobileChatPayload = {
      ...payload,
      messages,
      ...(toolSet?.tools ? { tools: toolSet.tools } : {}),
    };

    delete (data as any).memory;
    delete (data as any).plugins;
    delete (data as any).sessionId;

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

    const originalMessages = [...(data.messages || [])];
    let toolLoopSucceeded = false;
    let toolExecutionsForResponse: MobileToolExecutionEvent[] = [];

    if (toolSet?.tools?.length) {
      try {
        const { boundProcessContentBlocks, toolExecutionService } =
          this.createToolExecutionService();

        let loopMessages = [...(data.messages || [])];
        let toolsWereCalled = false;
        const loopToolExecutions: MobileToolExecutionEvent[] = [];

        for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
          console.info(
            `[webapi/chat] tool-loop round ${round + 1}: ${loopMessages.length} messages, ${data.tools?.length ?? 0} tools`,
          );

          const response = await this.modelRuntime.chat(
            {
              ...data,
              apiMode: 'chatCompletion',
              messages: loopMessages,
              responseMode: 'json',
              stream: false,
            } as any,
            runtimeOptions,
          );

          const result = await readChatCompletionResult(response);
          const choice = result?.choices?.[0];
          const assistantMessage = choice?.message;

          if (!assistantMessage?.tool_calls?.length) {
            console.info(
              `[webapi/chat] round ${round + 1}: no tool_calls (finish_reason=${choice?.finish_reason}), content preview: "${(assistantMessage?.content || '').slice(0, 150)}"`,
            );
            if (round === 0 && !choice) {
              console.warn(
                `[webapi/chat] round 1: unexpected response shape, keys=${Object.keys(result || {}).join(',')}`,
              );
            }
            break;
          }

          toolsWereCalled = true;
          const normalizedToolCalls = normalizeToolCalls(
            assistantMessage.tool_calls,
            toolSet.manifestMap,
            toolSet.sourceMap,
          );

          console.info(
            `[webapi/chat] round ${round + 1}: model called ${normalizedToolCalls.length} tools: ${normalizedToolCalls.map((toolCall) => toolCall.apiName).join(', ')}`,
          );

          loopMessages = [
            ...loopMessages,
            {
              content: assistantMessage.content || '',
              reasoning: { content: (assistantMessage as any).reasoning_content || ' ' },
              role: 'assistant',
              tool_calls: assistantMessage.tool_calls,
            } as any,
          ];

          for (const toolCall of normalizedToolCalls) {
            console.info(
              `[webapi/chat] executing tool: ${toolCall.identifier}:${toolCall.apiName}`,
            );

            const execution = await toolExecutionService.executeTool(toolCall, {
              processContentBlocks:
                toolCall.source === 'mcp' ? boundProcessContentBlocks : undefined,
              serverDB: this.serverDB,
              toolManifestMap: toolSet.manifestMap,
              topicId: payload.topicId,
              userId: this.userId,
            });

            const content =
              typeof execution.content === 'string'
                ? execution.content
                : JSON.stringify(execution.content);

            console.info(
              `[webapi/chat] tool ${toolCall.identifier}:${toolCall.apiName} result: ${content.slice(0, 200)}${content.length > 200 ? '...' : ''}`,
            );

            loopToolExecutions.push(createToolExecutionEvent(toolCall, execution));

            loopMessages.push({
              content,
              role: 'tool',
              tool_call_id: toolCall.id,
            } as any);
          }
        }

        if (toolsWereCalled) {
          data.messages = loopMessages;
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

    if (toolSet?.tools?.length && toolLoopSucceeded) {
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

    if (!toolLoopSucceeded && toolSet?.tools?.length) {
      return this.streamToolLoopFallback({
        payload: data,
        runtimeOptions,
        toolSet,
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
}
