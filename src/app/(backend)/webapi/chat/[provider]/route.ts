import { builtinSkills } from '@lobechat/builtin-skills';
import { SkillsIdentifier, SkillsManifest } from '@lobechat/builtin-tool-skills';
import { WebBrowsingExecutionRuntime } from '@lobechat/builtin-tool-web-browsing/executionRuntime';
import { builtinTools } from '@lobechat/builtin-tools';
import type { LobeToolManifest, SkillMeta } from '@lobechat/context-engine';
import { type ChatCompletionErrorPayload, type ModelRuntime } from '@lobechat/model-runtime';
import { AGENT_RUNTIME_ERROR_SET } from '@lobechat/model-runtime';
import { skillsPrompts } from '@lobechat/prompts';
import { ChatErrorType } from '@lobechat/types';

import { checkAuth } from '@/app/(backend)/middleware/auth';
import { AgentModel } from '@/database/models/agent';
import { AgentSkillModel } from '@/database/models/agentSkill';
import { PluginModel } from '@/database/models/plugin';
import { SessionModel } from '@/database/models/session';
import { UserMemoryIdentityModel } from '@/database/models/userMemory/identity';
import { type LobeChatDatabase } from '@/database/type';
import { filterBuiltinSkills } from '@/helpers/skillFilters';
import { type ToolCallContent } from '@/libs/mcp';
import { createTraceOptions, initModelRuntimeFromDB } from '@/server/modules/ModelRuntime';
import { FileService } from '@/server/services/file';
import { mcpService } from '@/server/services/mcp';
import { processContentBlocks } from '@/server/services/mcp/contentProcessor';
import { SearchService } from '@/server/services/search';
import { BuiltinToolsExecutor } from '@/server/services/toolExecution/builtin';
import { type ChatStreamPayload } from '@/types/openai/chat';
import { createErrorResponse } from '@/utils/errorResponse';
import { getTracePayload } from '@/utils/trace';

export const maxDuration = 300;

const TOOL_SEPARATOR = '____';
const MAX_TOOL_ROUNDS = 5;

const MEMORY_LIMIT_BY_EFFORT = {
  high: 50,
  low: 12,
  medium: 30,
} as const;

type MobileMemoryEffort = keyof typeof MEMORY_LIMIT_BY_EFFORT;
type MobileChatMessage = NonNullable<MobileChatPayload['messages']>[number];

const normalizeMemoryEffort = (effort?: string): MobileMemoryEffort => {
  if (effort === 'low' || effort === 'medium' || effort === 'high') return effort;
  return 'medium';
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

const injectSystemContext = (
  messages: MobileChatPayload['messages'],
  prompt?: string,
): MobileChatPayload['messages'] => {
  if (!prompt?.trim()) return messages;

  const normalizedMessages = [...(messages || [])];
  const existingSystemMessage = normalizedMessages.find(
    (message): message is MobileChatMessage => message.role === 'system',
  );

  if (existingSystemMessage && typeof existingSystemMessage.content === 'string') {
    existingSystemMessage.content = [existingSystemMessage.content, prompt]
      .filter(Boolean)
      .join('\n\n');
    return normalizedMessages;
  }

  normalizedMessages.unshift({
    content: prompt,
    role: 'system',
  } as MobileChatMessage);

  return normalizedMessages;
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

interface MobileMemoryPayload {
  effort?: MobileMemoryEffort;
  enabled?: boolean;
}

interface MobileChatPayload extends ChatStreamPayload {
  memory?: MobileMemoryPayload;
  plugins?: string[];
  sessionId?: string;
  topicId?: string;
}

interface McpPluginConfig {
  auth?: { token?: string; type: string };
  headers?: Record<string, string>;
  type: string;
  url: string;
}

const resolveEffectiveMemoryPayload = async (params: {
  explicitMemory?: MobileMemoryPayload;
  serverDB: LobeChatDatabase;
  sessionId?: string;
  userId: string;
}): Promise<MobileMemoryPayload | undefined> => {
  if (params.explicitMemory) return params.explicitMemory;
  if (!params.sessionId) return undefined;

  try {
    const agentModel = new AgentModel(params.serverDB, params.userId);
    const agent = await agentModel.findBySessionId(params.sessionId);
    let memorySource: { effort?: string; enabled?: boolean } | undefined =
      agent?.chatConfig?.memory;
    if (!memorySource) {
      const sessionModel = new SessionModel(params.serverDB, params.userId);
      const session = await sessionModel.findByIdOrSlug(params.sessionId);
      const sessionConfig = (session as { config?: { chatConfig?: { memory?: unknown } } })?.config;
      memorySource = sessionConfig?.chatConfig?.memory as
        | { effort?: string; enabled?: boolean }
        | undefined;
    }

    if (!memorySource) return undefined;

    return {
      effort: normalizeMemoryEffort(memorySource.effort),
      enabled: memorySource.enabled !== false,
    };
  } catch (error) {
    console.error('[webapi/chat] failed to resolve memory config from session:', error);
    return undefined;
  }
};

/**
 * Resolve MCP plugins into OpenAI-compatible tool definitions.
 * Prefers reading tool definitions from the stored manifest (populated at install time).
 * Falls back to fetching from MCP server at runtime if manifest has no tools.
 */
interface GatewayToolEntry {
  identifier: string;
  url: string;
}

const resolvePluginTools = async (
  pluginIds: string[],
  serverDB: LobeChatDatabase,
  userId: string,
): Promise<{
  builtinManifestMap: Map<string, LobeToolManifest>;
  gatewayMap: Map<string, GatewayToolEntry>;
  mcpParamsMap: Map<string, { identifier: string; params: McpPluginConfig }>;
  tools: Array<{ function: { description?: string; name: string; parameters: any }; type: string }>;
}> => {
  const tools: Array<{
    function: { description?: string; name: string; parameters: any };
    type: string;
  }> = [];
  const mcpParamsMap = new Map<string, { identifier: string; params: McpPluginConfig }>();
  const gatewayMap = new Map<string, GatewayToolEntry>();
  const builtinManifestMap = new Map<string, LobeToolManifest>();
  const builtinManifestRegistry = new Map(
    builtinTools.map((tool) => [tool.identifier, tool.manifest as LobeToolManifest]),
  );

  try {
    const pluginModel = new PluginModel(serverDB, userId);
    const installedPlugins = await pluginModel.query();

    console.info(
      `[webapi/chat] resolving tools for plugins: ${JSON.stringify(pluginIds)}, installed: ${installedPlugins.map((p) => p.identifier).join(',')}`,
    );

    for (const pluginId of pluginIds) {
      const builtinManifest = builtinManifestRegistry.get(pluginId);
      if (builtinManifest?.api?.length) {
        for (const tool of builtinManifest.api) {
          const toolKey = `${pluginId}${TOOL_SEPARATOR}${tool.name}`;
          tools.push({
            function: {
              description: tool.description,
              name: toolKey,
              parameters: tool.parameters,
            },
            type: 'function',
          });
        }

        builtinManifestMap.set(pluginId, builtinManifest);
        console.info(
          `[webapi/chat] loaded ${builtinManifest.api.length} builtin tools for "${pluginId}"`,
        );
        continue;
      }

      const plugin = installedPlugins.find((p) => p.identifier === pluginId);
      if (!plugin) {
        console.warn(`[webapi/chat] plugin "${pluginId}" not found in installed plugins`);
        continue;
      }

      const mcpConfig = plugin.customParams?.mcp as McpPluginConfig | undefined;

      let manifestApi = (plugin.manifest as any)?.api as
        | Array<{ description?: string; name: string; parameters: any; url?: string }>
        | undefined;

      // If manifest is empty, try refetching from customParams.manifestUrl
      if (!manifestApi?.length) {
        const manifestUrl = (plugin.customParams as any)?.manifestUrl as string | undefined;
        if (manifestUrl) {
          try {
            console.info(`[webapi/chat] refetching manifest for "${pluginId}" from ${manifestUrl}`);
            const res = await fetch(manifestUrl, { signal: AbortSignal.timeout(5000) });
            if (res.ok) {
              const freshManifest = await res.json();
              manifestApi = freshManifest?.api;
              if (manifestApi?.length) {
                // Persist the recovered manifest so future requests don't need to refetch
                await pluginModel.update(pluginId, { manifest: freshManifest });
                console.info(
                  `[webapi/chat] recovered ${manifestApi.length} tools from manifestUrl for "${pluginId}"`,
                );
              }
            }
          } catch (e) {
            console.warn(`[webapi/chat] failed to refetch manifest for "${pluginId}":`, e);
          }
        }
      }

      if (manifestApi?.length) {
        for (const tool of manifestApi) {
          const toolKey = `${plugin.identifier}${TOOL_SEPARATOR}${tool.name}`;
          tools.push({
            function: {
              description: tool.description,
              name: toolKey,
              parameters: tool.parameters,
            },
            type: 'function',
          });
          // If the tool has a gateway URL, record it for HTTP execution
          if (tool.url) {
            gatewayMap.set(toolKey, { identifier: plugin.identifier, url: tool.url });
          }
        }
        if (mcpConfig) {
          mcpParamsMap.set(plugin.identifier, {
            identifier: plugin.identifier,
            params: mcpConfig,
          });
        }
        console.info(
          `[webapi/chat] loaded ${manifestApi.length} tools from manifest for "${pluginId}" (gateway=${gatewayMap.size > 0})`,
        );
        continue;
      }

      if (!mcpConfig || mcpConfig.type !== 'http' || !mcpConfig.url) {
        console.warn(
          `[webapi/chat] plugin "${pluginId}" has no manifest tools and no valid MCP config`,
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

        for (const tool of mcpTools) {
          tools.push({
            function: {
              description: tool.description,
              name: `${plugin.identifier}${TOOL_SEPARATOR}${tool.name}`,
              parameters: tool.parameters,
            },
            type: 'function',
          });
        }

        mcpParamsMap.set(plugin.identifier, {
          identifier: plugin.identifier,
          params: mcpConfig,
        });
        console.info(
          `[webapi/chat] fetched ${mcpTools.length} tools from MCP server for "${pluginId}"`,
        );
      } catch (e) {
        console.error(`[webapi/chat] failed to list tools for ${plugin.identifier}:`, e);
      }
    }
  } catch (e) {
    console.error('[webapi/chat] failed to resolve plugin tools:', e);
  }

  return { builtinManifestMap, gatewayMap, mcpParamsMap, tools };
};

/**
 * Execute a single tool call against gateway HTTP or MCP server.
 * Aligned with web version's TRPC tools.mcp.callTool:
 * - Supports processContentBlocks for image/audio handling
 * - Retries on NoValidSessionId (stale Streamable HTTP sessions)
 */
const executeToolCall = async (
  toolCallName: string,
  args: string,
  mcpParamsMap: Map<string, { identifier: string; params: McpPluginConfig }>,
  gatewayMap: Map<string, GatewayToolEntry>,
  builtinManifestMap: Map<string, LobeToolManifest>,
  builtinToolsExecutor: BuiltinToolsExecutor | undefined,
  builtinContext: { serverDB: LobeChatDatabase; topicId?: string; userId: string },
  boundProcessContentBlocks?: (blocks: ToolCallContent[]) => Promise<ToolCallContent[]>,
): Promise<string> => {
  const separatorIdx = toolCallName.indexOf(TOOL_SEPARATOR);
  if (separatorIdx < 0) return `Error: Unknown tool format "${toolCallName}"`;

  const pluginId = toolCallName.slice(0, separatorIdx);
  const toolName = toolCallName.slice(separatorIdx + TOOL_SEPARATOR.length);

  // Builtin tool execution (e.g. lobe-skills)
  if (builtinManifestMap.has(pluginId)) {
    if (!builtinToolsExecutor) {
      return `Error: Builtin executor unavailable for "${pluginId}"`;
    }

    try {
      const builtinResult = await builtinToolsExecutor.execute(
        {
          apiName: toolName,
          arguments: args,
          id: `${pluginId}_${toolName}_${Date.now()}`,
          identifier: pluginId,
          source: 'builtin',
          type: 'builtin',
        },
        {
          serverDB: builtinContext.serverDB,
          toolManifestMap: { [pluginId]: builtinManifestMap.get(pluginId)! },
          topicId: builtinContext.topicId,
          userId: builtinContext.userId,
        },
      );

      if (!builtinResult.success) {
        return `Error executing builtin tool "${toolName}": ${builtinResult.content}`;
      }

      return typeof builtinResult.content === 'string'
        ? builtinResult.content
        : JSON.stringify(builtinResult.content);
    } catch (e) {
      return `Error executing builtin tool "${toolName}": ${(e as Error).message}`;
    }
  }

  // Gateway plugin execution (HTTP POST to tool URL)
  const gateway = gatewayMap.get(toolCallName);
  if (gateway) {
    try {
      const parsedArgs = args ? JSON.parse(args) : {};
      const res = await fetch(gateway.url, {
        body: JSON.stringify(parsedArgs),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
        signal: AbortSignal.timeout(30_000),
      });
      const text = await res.text();
      if (!res.ok) return `Error: Gateway call to "${toolName}" returned ${res.status}: ${text}`;
      return text;
    } catch (e) {
      return `Error executing gateway tool "${toolName}": ${(e as Error).message}`;
    }
  }

  // MCP execution
  const entry = mcpParamsMap.get(pluginId);
  if (!entry) return `Error: Plugin "${pluginId}" not found in MCP or gateway maps`;

  const clientParams: Record<string, any> = {
    name: entry.identifier,
    type: 'http' as const,
    url: entry.params.url,
  };
  if (entry.params.auth) clientParams.auth = entry.params.auth;
  if (entry.params.headers) clientParams.headers = entry.params.headers;

  const MAX_MCP_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_MCP_RETRIES; attempt++) {
    try {
      const result = await mcpService.callTool({
        argsStr: args,
        clientParams: clientParams as any,
        processContentBlocks: boundProcessContentBlocks,
        toolName,
      });
      return typeof result.content === 'string' ? result.content : JSON.stringify(result.state);
    } catch (e) {
      const errMsg = (e as Error).message;
      if (errMsg.includes('NoValidSessionId') && attempt < MAX_MCP_RETRIES) {
        console.warn(
          `[webapi/chat] MCP tool "${toolName}" failed with NoValidSessionId (attempt ${attempt}/${MAX_MCP_RETRIES}), retrying...`,
        );
        continue;
      }
      console.error(`[webapi/chat] MCP tool "${toolName}" failed:`, errMsg);
      return `Error executing tool "${toolName}": ${errMsg}`;
    }
  }
  return `Error executing tool "${toolName}": max retries exceeded`;
};

export const POST = checkAuth(
  async (req: Request, { params, userId, serverDB, createRuntime, jwtPayload }) => {
    const provider = (await params)!.provider!;

    try {
      // ============  1. init chat model   ============ //
      let modelRuntime: ModelRuntime;
      if (createRuntime) {
        modelRuntime = createRuntime(jwtPayload);
      } else {
        modelRuntime = await initModelRuntimeFromDB(serverDB, userId, provider);
      }

      // ============  2. create chat completion   ============ //

      const data = (await req.json()) as MobileChatPayload;
      const effectiveMemory = await resolveEffectiveMemoryPayload({
        explicitMemory: data.memory,
        serverDB,
        sessionId: data.sessionId,
        userId,
      });

      // Inject user memories
      if (effectiveMemory && effectiveMemory.enabled !== false) {
        try {
          const effort = normalizeMemoryEffort(effectiveMemory.effort);
          const limit = MEMORY_LIMIT_BY_EFFORT[effort];
          const memoryModel = new UserMemoryIdentityModel(serverDB, userId);
          const memories = await memoryModel.queryForInjection(limit);
          const memoryContext = buildMemoryContext(memories);

          if (memoryContext) {
            data.messages = [{ content: memoryContext, role: 'system' }, ...(data.messages || [])];
          }
        } catch (error) {
          console.error('[webapi/chat] failed to inject memory context:', error);
        }
      }

      // ============  3. resolve MCP tools from agent config  ============ //
      let mcpTools: Awaited<ReturnType<typeof resolvePluginTools>> | undefined;

      {
        let pluginIds: string[] | undefined;
        let enabledSkills: SkillMeta[] = [];

        if (data.sessionId) {
          try {
            const agentModel = new AgentModel(serverDB, userId);
            let agentConfig = await agentModel.findBySessionId(data.sessionId);
            if (!agentConfig) {
              const sessionModel = new SessionModel(serverDB, userId);
              const session = await sessionModel.findByIdOrSlug(data.sessionId);
              agentConfig = (session as { config?: { plugins?: string[] } })
                ?.config as typeof agentConfig;
            }
            pluginIds = agentConfig?.plugins as string[] | undefined;

            console.info(
              `[webapi/chat] session=${data.sessionId} agentId=${agentConfig?.id} agentPlugins=${JSON.stringify(pluginIds)}`,
            );
          } catch (error) {
            console.error('[webapi/chat] failed to read agent config:', error);
          }
        }

        if (!pluginIds?.length && data.plugins?.length) {
          pluginIds = data.plugins;
          console.info(
            `[webapi/chat] using plugins from request payload: ${JSON.stringify(pluginIds)}`,
          );
        }

        if (pluginIds?.length) {
          try {
            enabledSkills = await resolveEnabledSkillMetas(pluginIds, serverDB, userId);

            if (enabledSkills.length > 0) {
              const skillContext = [skillsPrompts(enabledSkills), SkillsManifest.systemRole]
                .filter(Boolean)
                .join('\n\n');

              data.messages = injectSystemContext(data.messages, skillContext);

              console.info(
                `[webapi/chat] injected skill context for ${enabledSkills.length} skills: ${enabledSkills.map((skill) => skill.identifier).join(', ')}`,
              );
            }

            const toolIds = enabledSkills.length
              ? [...new Set([...pluginIds, SkillsIdentifier])]
              : pluginIds;

            mcpTools = await resolvePluginTools(toolIds, serverDB, userId);
            if (mcpTools.tools.length > 0) {
              data.tools = mcpTools.tools as any;
              console.info(
                `[webapi/chat] injected ${mcpTools.tools.length} tools: ${mcpTools.tools.map((t) => t.function.name).join(', ')}`,
              );
            } else {
              console.warn(
                '[webapi/chat] plugin IDs found but no tools resolved — check manifest/MCP server',
              );
            }
          } catch (error) {
            console.error('[webapi/chat] failed to resolve plugin tools:', error);
          }
        }
      }

      // Clean up mobile-only fields before sending to model runtime
      delete (data as any).memory;
      delete (data as any).sessionId;
      delete (data as any).topicId;
      delete (data as any).plugins;

      const tracePayload = getTracePayload(req);
      let traceOptions = {};
      if (tracePayload?.enabled) {
        traceOptions = createTraceOptions(data, { provider, trace: tracePayload });
      }

      const runtimeOptions = {
        user: userId,
        ...traceOptions,
        signal: req.signal,
      };

      // ============  4. tool calling loop   ============ //
      // Uses responseMode:'json' to get raw ChatCompletion JSON.
      // Forces apiMode:'chatCompletion' to ensure consistent response format —
      // Responses API returns a different structure (output[] vs choices[].message)
      // that would break tool_calls detection. This aligns with the web client
      // which also explicitly sets apiMode.
      const originalMessages = [...(data.messages || [])];
      let toolLoopSucceeded = false;

      if (mcpTools?.tools.length) {
        try {
          // Build processContentBlocks for image/audio handling (aligned with web's TRPC callTool)
          const fileService = new FileService(serverDB, userId);
          const boundProcessContentBlocks = async (blocks: ToolCallContent[]) => {
            return processContentBlocks(blocks, fileService);
          };
          const builtinToolsExecutor =
            mcpTools.builtinManifestMap.size > 0
              ? new BuiltinToolsExecutor(serverDB, userId)
              : undefined;

          let messages = [...(data.messages || [])];
          let toolsWereCalled = false;

          for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
            console.info(
              `[webapi/chat] tool-loop round ${round + 1}: ${messages.length} messages, ${data.tools?.length ?? 0} tools`,
            );

            const resp = await modelRuntime.chat(
              {
                ...data,
                apiMode: 'chatCompletion',
                messages,
                responseMode: 'json',
                stream: false,
              } as any,
              runtimeOptions,
            );

            const result = await resp.json();
            const choice = result?.choices?.[0];
            const assistantMsg = choice?.message;

            if (!assistantMsg?.tool_calls?.length) {
              console.info(
                `[webapi/chat] round ${round + 1}: no tool_calls (finish_reason=${choice?.finish_reason}), content preview: "${(assistantMsg?.content || '').slice(0, 150)}"`,
              );
              // Log full response shape for debugging when tools were expected but not called
              if (round === 0 && !choice) {
                console.warn(
                  `[webapi/chat] round 1: unexpected response shape, keys=${Object.keys(result || {}).join(',')}`,
                );
              }
              break;
            }

            toolsWereCalled = true;
            console.info(
              `[webapi/chat] round ${round + 1}: model called ${assistantMsg.tool_calls.length} tools: ${assistantMsg.tool_calls.map((tc: any) => tc.function.name).join(', ')}`,
            );

            // Use LobeChat's internal `reasoning` format so that provider-specific
            // normalizers (e.g. Moonshot's normalizeMessagesForOpenAI) can correctly
            // convert it to `reasoning_content`. Setting `reasoning_content` directly
            // gets overwritten because the normalizer destructures `reasoning`, not
            // `reasoning_content`.
            const apiReasoning = (assistantMsg as any).reasoning_content;
            console.info(
              `[webapi/chat] round ${round + 1}: reasoning_content present=${!!apiReasoning}, length=${apiReasoning?.length ?? 0}`,
            );
            const toolCallMsg: Record<string, unknown> = {
              content: assistantMsg.content || '',
              reasoning: { content: apiReasoning || ' ' },
              role: 'assistant',
              tool_calls: assistantMsg.tool_calls,
            };

            messages = [...messages, toolCallMsg as any];

            for (const tc of assistantMsg.tool_calls) {
              console.info(`[webapi/chat] executing tool: ${tc.function.name}`);
              const content = await executeToolCall(
                tc.function.name,
                tc.function.arguments,
                mcpTools.mcpParamsMap,
                mcpTools.gatewayMap,
                mcpTools.builtinManifestMap,
                builtinToolsExecutor,
                { serverDB, topicId: data.topicId, userId },
                boundProcessContentBlocks,
              );
              console.info(
                `[webapi/chat] tool ${tc.function.name} result: ${content.slice(0, 200)}${content.length > 200 ? '...' : ''}`,
              );
              messages.push({
                content,
                role: 'tool',
                tool_call_id: tc.id,
              } as any);
            }

            data.messages = messages;
          }

          if (toolsWereCalled) {
            data.messages = messages;
            toolLoopSucceeded = true;
          }
        } catch (e) {
          console.error(
            '[webapi/chat] tool calling loop error, falling back to original messages:',
            e,
          );
          data.messages = originalMessages;
        }
      }

      // Always remove tools before the final streaming call — the non-streaming
      // tool loop already gave the model a chance to call tools. Keeping tools in
      // the streaming call causes the model to emit tool_calls that the mobile
      // client cannot handle.
      if (mcpTools?.tools.length) {
        delete data.tools;
      }

      // ============  5. handle search (application builtin web search)  ============ //
      // For providers without builtin search (most providers like VLLM, OpenAI, etc.),
      // we perform a real web search using the application's SearchService, inject the
      // results into the conversation context, then let the model answer with real data.
      // This mirrors the Web client's `useApplicationBuiltinSearchTool` path.
      if (data.enabledSearch) {
        try {
          const lastUserMsg = [...(data.messages || [])].reverse().find((m) => m.role === 'user');
          const searchQuery =
            typeof lastUserMsg?.content === 'string'
              ? lastUserMsg.content
              : Array.isArray(lastUserMsg?.content)
                ? (lastUserMsg.content as any[])
                    .filter((b: any) => b.type === 'text')
                    .map((b: any) => b.text)
                    .join(' ')
                : '';

          if (searchQuery) {
            console.info(`[webapi/chat] builtin web search: query="${searchQuery.slice(0, 80)}"`);

            const webSearchRuntime = new WebBrowsingExecutionRuntime({
              searchService: new SearchService(),
            });
            const searchResult = await webSearchRuntime.search({ query: searchQuery });

            if (searchResult.success && searchResult.content) {
              console.info(
                `[webapi/chat] builtin web search succeeded: ${searchResult.content.length} chars`,
              );

              data.messages = [
                ...(data.messages || []),
                {
                  content: `<web_search_results>\n${searchResult.content}\n</web_search_results>\n\nPlease answer the user's question based on the above search results. Cite sources when possible.`,
                  role: 'system',
                } as any,
              ];
            } else {
              console.warn('[webapi/chat] builtin web search returned no results');
            }
          }
        } catch (e) {
          console.error('[webapi/chat] builtin web search failed:', e);
        }

        delete (data as any).enabledSearch;
      }

      console.info(
        `[webapi/chat] final streaming call: tools=${data.tools?.length ?? 0}, messages=${data.messages?.length ?? 0}`,
      );

      const streamResponse = await modelRuntime.chat(data, runtimeOptions);

      if (!toolLoopSucceeded || !streamResponse.body) return streamResponse;

      const toolExecutions: Array<{
        apiName: string;
        arguments: string;
        id: string;
        identifier: string;
        result: string;
      }> = [];

      for (const msg of data.messages || []) {
        if ((msg as any).role !== 'assistant' || !(msg as any).tool_calls?.length) continue;
        for (const tc of (msg as any).tool_calls) {
          const fullName: string = tc.function?.name || '';
          const sepIdx = fullName.indexOf(TOOL_SEPARATOR);
          const identifier = sepIdx >= 0 ? fullName.slice(0, sepIdx) : fullName;
          const apiName = sepIdx >= 0 ? fullName.slice(sepIdx + TOOL_SEPARATOR.length) : fullName;

          const resultMsg = (data.messages || []).find(
            (m: any) => m.role === 'tool' && m.tool_call_id === tc.id,
          );

          toolExecutions.push({
            apiName,
            arguments: tc.function?.arguments || '{}',
            id: tc.id,
            identifier,
            result: (resultMsg as any)?.content || '',
          });
        }
      }

      if (toolExecutions.length === 0) return streamResponse;

      const toolEventChunk = `event: tool_executions\ndata: ${JSON.stringify(toolExecutions)}\n\n`;
      const encoder = new TextEncoder();
      const toolChunkBytes = encoder.encode(toolEventChunk);

      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();

      (async () => {
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
    } catch (e) {
      const {
        errorType = ChatErrorType.InternalServerError,
        error: errorContent,
        ...res
      } = e as ChatCompletionErrorPayload;

      const error = errorContent || e;

      const logMethod = AGENT_RUNTIME_ERROR_SET.has(errorType as string) ? 'warn' : 'error';
      // eslint-disable-next-line no-console
      console[logMethod](`Route: [${provider}] ${errorType}:`, error);

      return createErrorResponse(errorType, { error, ...res, provider });
    }
  },
);
