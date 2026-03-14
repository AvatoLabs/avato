import { WebBrowsingExecutionRuntime } from '@lobechat/builtin-tool-web-browsing/executionRuntime';
import { type ChatCompletionErrorPayload, type ModelRuntime } from '@lobechat/model-runtime';
import { AGENT_RUNTIME_ERROR_SET } from '@lobechat/model-runtime';
import { ChatErrorType } from '@lobechat/types';

import { checkAuth } from '@/app/(backend)/middleware/auth';
import { AgentModel } from '@/database/models/agent';
import { PluginModel } from '@/database/models/plugin';
import { UserMemoryIdentityModel } from '@/database/models/userMemory/identity';
import { type LobeChatDatabase } from '@/database/type';
import { type ToolCallContent } from '@/libs/mcp';
import { createTraceOptions, initModelRuntimeFromDB } from '@/server/modules/ModelRuntime';
import { FileService } from '@/server/services/file';
import { mcpService } from '@/server/services/mcp';
import { processContentBlocks } from '@/server/services/mcp/contentProcessor';
import { SearchService } from '@/server/services/search';
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
    const sessionMemory = agent?.chatConfig?.memory;

    if (!sessionMemory) return undefined;

    return {
      effort: normalizeMemoryEffort(
        typeof sessionMemory.effort === 'string' ? sessionMemory.effort : undefined,
      ),
      enabled: sessionMemory.enabled !== false,
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

  try {
    const pluginModel = new PluginModel(serverDB, userId);
    const installedPlugins = await pluginModel.query();

    console.info(
      `[webapi/chat] resolving tools for plugins: ${JSON.stringify(pluginIds)}, installed: ${installedPlugins.map((p) => p.identifier).join(',')}`,
    );

    for (const pluginId of pluginIds) {
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

  return { gatewayMap, mcpParamsMap, tools };
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
  boundProcessContentBlocks?: (blocks: ToolCallContent[]) => Promise<ToolCallContent[]>,
): Promise<string> => {
  const separatorIdx = toolCallName.indexOf(TOOL_SEPARATOR);
  if (separatorIdx < 0) return `Error: Unknown tool format "${toolCallName}"`;

  const pluginId = toolCallName.slice(0, separatorIdx);
  const toolName = toolCallName.slice(separatorIdx + TOOL_SEPARATOR.length);

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
            data.messages = [{ content: memoryContext, role: 'system' }, ...data.messages];
          }
        } catch (error) {
          console.error('[webapi/chat] failed to inject memory context:', error);
        }
      }

      // ============  3. resolve MCP tools from agent config  ============ //
      let mcpTools: Awaited<ReturnType<typeof resolvePluginTools>> | undefined;

      {
        let pluginIds: string[] | undefined;

        if (data.sessionId) {
          try {
            const agentModel = new AgentModel(serverDB, userId);
            const agentConfig = await agentModel.findBySessionId(data.sessionId);
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
            mcpTools = await resolvePluginTools(pluginIds, serverDB, userId);
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
      const originalMessages = [...data.messages];
      let toolLoopSucceeded = false;

      // Build processContentBlocks for image/audio handling (aligned with web's TRPC callTool)
      const fileService = new FileService(serverDB, userId);
      const boundProcessContentBlocks = async (blocks: ToolCallContent[]) => {
        return processContentBlocks(blocks, fileService);
      };

      if (mcpTools?.tools.length) {
        try {
          let messages = [...data.messages];
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
          const lastUserMsg = [...data.messages].reverse().find((m) => m.role === 'user');
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
                ...data.messages,
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
        `[webapi/chat] final streaming call: tools=${data.tools?.length ?? 0}, messages=${data.messages.length}`,
      );

      return await modelRuntime.chat(data, runtimeOptions);
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
