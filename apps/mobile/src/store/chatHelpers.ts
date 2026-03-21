import { DEFAULT_AGENT_CONFIG } from '../constants/defaultModel';
import type { ChatRequestOptions, ToolExecutionItem } from '../lib/api';
import { agentApi, configApi, userApi } from '../lib/api';
import { isGroupSessionLike } from '../lib/session';
import type { ChatToolPayload, MobileChatConfig } from '../types';
import { useModelStore } from './model';
import { useSessionStore } from './session';
import { getUserMemorySettings } from './user';

/** Parse targetId for DM from message content: first <mention id="X" /> where X !== 'ALL_MEMBERS' */
export function parseTargetIdFromMentions(text: string): string | null {
  const re = /<mention\s[^>]*id="([^"]+)"[^>]*\/>/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    const id = match[1];
    if (id && id !== 'ALL_MEMBERS') return id;
  }

  return null;
}

export const toolExecutionsToPayloads = (executions: ToolExecutionItem[]): ChatToolPayload[] =>
  executions.map((exec) => ({
    apiName: exec.apiName,
    arguments: exec.arguments,
    id: exec.id,
    identifier: exec.identifier,
    intervention: exec.intervention ?? { status: 'approved' },
    pluginState: exec.state,
    result_content: exec.result,
    result_msg_id: exec.id,
    source: exec.identifier.startsWith('lobe-') ? 'builtin' : ('plugin' as const),
    type: 'function',
  }));

export const mergeToolPayloads = (
  previous: ChatToolPayload[] | undefined,
  incoming: ChatToolPayload[] | undefined,
): ChatToolPayload[] | undefined => {
  if (!previous?.length) return incoming?.length ? incoming : undefined;
  if (!incoming?.length) return previous;

  const merged = new Map<string, ChatToolPayload>();
  const order: string[] = [];

  const ensureKey = (tool: ChatToolPayload) => tool.id || `${tool.identifier}:${tool.apiName}`;

  for (const tool of previous) {
    const key = ensureKey(tool);
    order.push(key);
    merged.set(key, tool);
  }

  for (const tool of incoming) {
    const key = ensureKey(tool);
    if (!merged.has(key)) {
      order.push(key);
      merged.set(key, tool);
      continue;
    }

    const existing = merged.get(key)!;
    const next = {
      ...existing,
      ...tool,
      intervention:
        tool.result_content !== undefined || tool.result_msg_id
          ? (tool.intervention ?? { status: 'approved' })
          : (tool.intervention ?? existing.intervention),
      pluginState: tool.pluginState ?? existing.pluginState,
      result_content:
        tool.result_content !== undefined ? tool.result_content : existing.result_content,
      result_msg_id: tool.result_msg_id ?? existing.result_msg_id,
    } satisfies ChatToolPayload;

    merged.set(key, next);
  }

  return order.map((key) => merged.get(key)!).filter(Boolean);
};

export const mergeResolvedToolPayloads = (
  tools: ChatToolPayload[] | undefined,
  executions: ToolExecutionItem[] | undefined,
) => mergeToolPayloads(tools, executions ? toolExecutionsToPayloads(executions) : undefined);

export const resolveProviderByModel = (modelId?: string): string | undefined => {
  if (!modelId) return undefined;

  for (const provider of useModelStore.getState().providers) {
    if (provider.children.some((child) => child.id === modelId)) {
      return provider.id;
    }
  }

  return undefined;
};

/**
 * Resolves per-session chat options with Agent Config as single source of truth:
 *   1. Backend agent config (primary) — model, provider, params, chatConfig.memory, chatConfig.searchMode
 *   2. Session meta fallback (model/provider, chatConfig)
 */
export async function getSessionChatOptions(sessionId: string): Promise<ChatRequestOptions> {
  const opts: ChatRequestOptions = {};
  const session = useSessionStore.getState().sessions.find((item) => item.id === sessionId);

  // 1. Session meta first (user's explicit selection in ModelPicker overrides backend)
  if (session?.model && session?.provider) {
    opts.model = session.model;
    opts.provider = session.provider;
  }

  // 2. Backend agent config (when session meta missing model/provider)
  if ((!opts.model || !opts.provider) && !isGroupSessionLike(sessionId, session?.type)) {
    try {
      const config = await agentApi.getConfigBySession(sessionId);
      if (config) {
        if (!opts.model && config.model) opts.model = config.model;
        if (!opts.provider && config.provider) opts.provider = config.provider;
        if (config.params?.temperature != null) opts.temperature = config.params.temperature;
        if (config.params?.top_p != null) opts.top_p = config.params.top_p;
        if (config.params?.frequency_penalty != null)
          opts.frequency_penalty = config.params.frequency_penalty;
        if (config.params?.presence_penalty != null)
          opts.presence_penalty = config.params.presence_penalty;
        if (config.params?.max_tokens != null) opts.max_tokens = config.params.max_tokens;
        if (config.systemRole) opts.systemPrompt = config.systemRole;
        const chatConfig = config.chatConfig as MobileChatConfig | undefined;
        if (chatConfig?.memory) {
          const effort = chatConfig.memory.effort;
          opts.memory = {
            effort:
              effort === 'low' || effort === 'medium' || effort === 'high' ? effort : 'medium',
            enabled: chatConfig.memory.enabled !== false,
          };
        }
        if (chatConfig?.searchMode) {
          opts.enabledSearch = chatConfig.searchMode !== 'off';
        }
      }
    } catch {
      /* network error — fall through to session meta */
    }
  }

  // 2. Session meta fallback (when agent config missing or incomplete)
  if (session) {
    if (!opts.model && session.model) opts.model = session.model;
    if (!opts.provider && session.provider) opts.provider = session.provider;
    const sessionChatConfig = session.chatConfig as MobileChatConfig | undefined;
    if (!opts.memory && sessionChatConfig?.memory) {
      const effort = sessionChatConfig.memory.effort;
      opts.memory = {
        effort: effort === 'low' || effort === 'medium' || effort === 'high' ? effort : 'medium',
        enabled: sessionChatConfig.memory.enabled !== false,
      };
    }
    if (opts.enabledSearch === undefined && sessionChatConfig?.searchMode) {
      opts.enabledSearch = sessionChatConfig.searchMode !== 'off';
    }
  }

  // 3. Default agent fallback (align with Web: DEFAULT -> server -> user)
  if (!opts.model || !opts.provider) {
    try {
      const [serverDefault, userState] = await Promise.all([
        configApi.getDefaultAgentConfig().catch((): { model?: string; provider?: string } => ({})),
        userApi.getState(),
      ]);
      const userConfig = userState?.settings?.defaultAgent?.config || {};
      const serverCfg = serverDefault as { model?: string; provider?: string };

      if (!opts.model) {
        opts.model = userConfig.model || serverCfg.model || DEFAULT_AGENT_CONFIG.model;
      }
      if (!opts.provider) {
        opts.provider = userConfig.provider || serverCfg.provider || DEFAULT_AGENT_CONFIG.provider;
      }
    } catch {
      if (!opts.model) opts.model = DEFAULT_AGENT_CONFIG.model;
      if (!opts.provider) opts.provider = DEFAULT_AGENT_CONFIG.provider;
    }
  }

  if (opts.model && !opts.provider) {
    opts.provider = resolveProviderByModel(opts.model);
  }

  if (!opts.memory) {
    try {
      const memorySettings = await getUserMemorySettings();

      opts.memory = {
        effort: memorySettings.effort,
        enabled: memorySettings.enabled,
      };
    } catch {
      /* best-effort */
    }
  }

  return opts;
}
