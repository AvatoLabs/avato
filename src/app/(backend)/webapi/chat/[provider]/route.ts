import { type ChatCompletionErrorPayload, type ModelRuntime } from '@lobechat/model-runtime';
import { AGENT_RUNTIME_ERROR_SET } from '@lobechat/model-runtime';
import { ChatErrorType } from '@lobechat/types';

import { checkAuth } from '@/app/(backend)/middleware/auth';
import { AgentModel } from '@/database/models/agent';
import { PluginModel } from '@/database/models/plugin';
import { UserMemoryIdentityModel } from '@/database/models/userMemory/identity';
import { type LobeChatDatabase } from '@/database/type';
import { createTraceOptions, initModelRuntimeFromDB } from '@/server/modules/ModelRuntime';
import { mcpService } from '@/server/services/mcp';
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
const resolvePluginTools = async (
  pluginIds: string[],
  serverDB: LobeChatDatabase,
  userId: string,
): Promise<{
  mcpParamsMap: Map<string, { identifier: string; params: McpPluginConfig }>;
  tools: Array<{ function: { description?: string; name: string; parameters: any }; type: string }>;
}> => {
  const tools: Array<{
    function: { description?: string; name: string; parameters: any };
    type: string;
  }> = [];
  const mcpParamsMap = new Map<string, { identifier: string; params: McpPluginConfig }>();

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

      const manifestApi = (plugin.manifest as any)?.api as
        | Array<{ description?: string; name: string; parameters: any }>
        | undefined;

      if (manifestApi?.length) {
        for (const tool of manifestApi) {
          tools.push({
            function: {
              description: tool.description,
              name: `${plugin.identifier}${TOOL_SEPARATOR}${tool.name}`,
              parameters: tool.parameters,
            },
            type: 'function',
          });
        }
        if (mcpConfig) {
          mcpParamsMap.set(plugin.identifier, {
            identifier: plugin.identifier,
            params: mcpConfig,
          });
        }
        console.info(
          `[webapi/chat] loaded ${manifestApi.length} tools from stored manifest for "${pluginId}"`,
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

  return { mcpParamsMap, tools };
};

/**
 * Execute a single tool call against the appropriate MCP server.
 */
const executeMcpToolCall = async (
  toolCallName: string,
  args: string,
  mcpParamsMap: Map<string, { identifier: string; params: McpPluginConfig }>,
): Promise<string> => {
  const separatorIdx = toolCallName.indexOf(TOOL_SEPARATOR);
  if (separatorIdx < 0) return `Error: Unknown tool format "${toolCallName}"`;

  const pluginId = toolCallName.slice(0, separatorIdx);
  const toolName = toolCallName.slice(separatorIdx + TOOL_SEPARATOR.length);

  const entry = mcpParamsMap.get(pluginId);
  if (!entry) return `Error: Plugin "${pluginId}" not found`;

  const clientParams: Record<string, any> = {
    name: entry.identifier,
    type: 'http' as const,
    url: entry.params.url,
  };
  if (entry.params.auth) clientParams.auth = entry.params.auth;
  if (entry.params.headers) clientParams.headers = entry.params.headers;

  try {
    const result = await mcpService.callTool({
      argsStr: args,
      clientParams: clientParams as any,
      toolName,
    });
    return typeof result.content === 'string' ? result.content : JSON.stringify(result.state);
  } catch (e) {
    return `Error executing tool "${toolName}": ${(e as Error).message}`;
  }
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
      // Uses responseMode:'json' to get raw ChatCompletion JSON (same as web's non-streaming path).
      // This avoids SSE parsing issues — the model-runtime returns the provider's JSON directly.
      const originalMessages = [...data.messages];
      let toolLoopSucceeded = false;

      if (mcpTools?.tools.length) {
        try {
          let messages = [...data.messages];
          let toolsWereCalled = false;

          for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
            console.info(
              `[webapi/chat] tool-loop round ${round + 1}: ${messages.length} messages, ${data.tools?.length ?? 0} tools`,
            );

            const resp = await modelRuntime.chat(
              { ...data, messages, responseMode: 'json', stream: false } as any,
              runtimeOptions,
            );

            const result = await resp.json();
            const choice = result?.choices?.[0];
            const assistantMsg = choice?.message;

            if (!assistantMsg?.tool_calls?.length) {
              console.info(
                `[webapi/chat] round ${round + 1}: no tool_calls (finish_reason=${choice?.finish_reason}), content preview: "${(assistantMsg?.content || '').slice(0, 150)}"`,
              );
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
              const content = await executeMcpToolCall(
                tc.function.name,
                tc.function.arguments,
                mcpTools.mcpParamsMap,
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
