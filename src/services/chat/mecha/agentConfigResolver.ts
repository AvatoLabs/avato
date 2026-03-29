import { type BuiltinAgentSlug } from '@lobechat/builtin-agents';
import { BUILTIN_AGENT_SLUGS, getAgentRuntimeConfig } from '@lobechat/builtin-agents';
import { DocsAgentIdentifier } from '@lobechat/builtin-tool-docs-agent';
import { type LobeToolManifest } from '@lobechat/context-engine';
import {
  type ChatCompletionTool,
  type LobeAgentChatConfig,
  type LobeAgentConfig,
  type MessageMapScope,
} from '@lobechat/types';
import debug from 'debug';
import { produce } from 'immer';

import { agentSelectors, chatConfigByIdSelectors } from '@/store/agent/selectors';
import { getAgentStoreState } from '@/store/agent/store';
import { getChatGroupStoreState } from '@/store/agentGroup';
import { agentGroupByIdSelectors, agentGroupSelectors } from '@/store/agentGroup/selectors';

const log = debug('mecha:agentConfigResolver');

/**
 * Set of valid builtin agent slugs for O(1) lookup
 */
const VALID_BUILTIN_SLUGS = new Set<string>(Object.values(BUILTIN_AGENT_SLUGS));

/**
 * Check if a slug is a valid builtin agent slug
 */
const isBuiltinAgentSlug = (slug: string): slug is BuiltinAgentSlug => {
  return VALID_BUILTIN_SLUGS.has(slug);
};

/**
 * Applies params adjustments based on chatConfig settings.
 *
 * This function handles the conditional enabling/disabling of certain params:
 * - max_tokens: Only included if chatConfig.enableMaxTokens is true
 * - reasoning_effort: Only included if chatConfig.enableReasoningEffort is true
 *
 * Uses immer to create a new object without mutating the original.
 */
const applyParamsFromChatConfig = (
  agentConfig: LobeAgentConfig,
  chatConfig: LobeAgentChatConfig,
): LobeAgentConfig => {
  // If params is not defined, return agentConfig as-is
  if (!agentConfig?.params) {
    return agentConfig;
  }

  return produce(agentConfig, (draft) => {
    // Only include max_tokens if enableMaxTokens is true
    draft.params.max_tokens = chatConfig.enableMaxTokens ? draft.params.max_tokens : undefined;

    // Only include reasoning_effort if enableReasoningEffort is true
    draft.params.reasoning_effort = chatConfig.enableReasoningEffort
      ? draft.params.reasoning_effort
      : undefined;
  });
};

/**
 * Runtime context for resolving agent config
 */
export interface AgentConfigResolverContext {
  /** Agent ID to resolve config for */
  agentId: string;

  /**
   * Whether to disable all tools for this agent execution.
   * When true, returns empty plugins array (used for broadcast scenarios).
   */
  disableTools?: boolean;

  // Builtin agent specific context
  /** Document content for docs-agent */
  documentContent?: string;

  /**
   * Group ID for supervisor detection.
   * When provided, used for direct lookup instead of iterating all groups.
   */
  groupId?: string;

  /**
   * Whether this is a sub-task execution.
   * When true, filters out lobe-gtd tools to prevent nested sub-task creation.
   */
  isSubTask?: boolean;

  /** Current model being used (for template variables) */
  model?: string;
  /** Plugins enabled for the agent */
  plugins?: string[];

  /** Current provider */
  provider?: string;

  /** Message map scope (e.g., 'doc', 'main', 'thread') */
  scope?: MessageMapScope;
  /** Target agent config for agent-builder */
  targetAgentConfig?: LobeAgentConfig;
}

/**
 * Resolved agent config with runtime values merged
 */
export interface ResolvedAgentConfig {
  /** The resolved agent config */
  agentConfig: LobeAgentConfig;
  /** The chat config */
  chatConfig: LobeAgentChatConfig;
  /** Enabled manifests for context engineering (populated by internal_createAgentState) */
  enabledManifests?: LobeToolManifest[];
  /** Enabled tool IDs after filtering (populated by internal_createAgentState) */
  enabledToolIds?: string[];
  /** Whether this is a builtin agent */
  isBuiltinAgent: boolean;
  /**
   * Final merged plugins for the agent
   * For builtin agents: runtime plugins (if any) or fallback to agent config plugins
   * For regular agents: agent config plugins
   */
  plugins: string[];
  /** The agent's slug (if builtin) */
  slug?: string;
  /** Pre-generated tools array (populated by internal_createAgentState, undefined means tools disabled) */
  tools?: ChatCompletionTool[];
}

/**
 * Resolves the agent config, merging runtime config for builtin agents
 *
 * For builtin agents (identified by slug), this will:
 * 1. Get the base config from the agent store
 * 2. Get the runtime config from @lobechat/builtin-agents
 * 3. Merge the runtime systemRole into the agent config
 *
 * For regular agents, this simply returns the config from the store.
 */
export const resolveAgentConfig = (ctx: AgentConfigResolverContext): ResolvedAgentConfig => {
  const { agentId, model, documentContent, plugins, targetAgentConfig, isSubTask, disableTools } =
    ctx;

  log(
    'resolveAgentConfig called with agentId: %s, scope: %s, isSubTask: %s, disableTools: %s',
    agentId,
    ctx.scope,
    isSubTask,
    disableTools,
  );

  // Helper to apply plugin filters:
  // 1. If disableTools is true, return empty array (for broadcast scenarios)
  // 2. If isSubTask is true, filter out lobe-gtd to prevent nested sub-task creation
  const applyPluginFilters = (pluginIds: string[]) => {
    if (disableTools) {
      log('disableTools is true, returning empty plugins');
      return [];
    }
    return isSubTask ? pluginIds.filter((id) => id !== 'lobe-gtd') : pluginIds;
  };

  const agentStoreState = getAgentStoreState();

  // Get base config from store
  const agentConfig = agentSelectors.getAgentConfigById(agentId)(agentStoreState);
  const chatConfig = chatConfigByIdSelectors.getChatConfigById(agentId)(agentStoreState);

  // Base plugins from agent config
  const basePlugins = agentConfig?.plugins ?? [];

  // Check if this is a builtin agent
  // Priority: supervisor check (when in group scope) > agent store slug
  let slug: string | undefined;

  // IMPORTANT: When in group scope with groupId, check if this agent is the group's supervisor FIRST
  // This takes priority because supervisor needs special group-supervisor behavior,
  // even if the agent has its own slug
  if (ctx.groupId && ctx.scope === 'group') {
    const groupStoreState = getChatGroupStoreState();
    const group = agentGroupByIdSelectors.groupById(ctx.groupId)(groupStoreState);

    log(
      'checking supervisor FIRST (scope=group): groupId=%s, group=%O, agentId=%s',
      ctx.groupId,
      group
        ? {
            groupId: group.id,
            supervisorAgentId: group.supervisorAgentId,
            title: group.title,
          }
        : null,
      agentId,
    );

    // Check if this agent is the supervisor of the specified group
    if (group?.supervisorAgentId === agentId) {
      slug = BUILTIN_AGENT_SLUGS.groupSupervisor;
      log(
        'agentId %s identified as group supervisor for group %s, assigned slug: %s',
        agentId,
        ctx.groupId,
        slug,
      );
    }
  }

  // If not identified as supervisor, check agent store for slug
  if (!slug) {
    const storeSlug = agentSelectors.getAgentSlugById(agentId)(agentStoreState) ?? undefined;
    log('slug from agentStore: %s (agentId: %s)', storeSlug, agentId);

    // Only use the slug if it's a valid builtin agent slug
    // Regular agents may have random slugs that should be ignored
    if (storeSlug && isBuiltinAgentSlug(storeSlug)) {
      slug = storeSlug;
    } else if (storeSlug) {
      log('slug %s is not a valid builtin agent slug, treating as regular agent', storeSlug);
    }
  }

  if (!slug) {
    log('agentId %s is not a builtin agent (no valid builtin slug found)', agentId);
    // Regular agent - use provided plugins if available, fallback to agent's plugins
    const finalPlugins = plugins && plugins.length > 0 ? plugins : basePlugins;

    // Apply params adjustments based on chatConfig
    let finalAgentConfig = applyParamsFromChatConfig(agentConfig, chatConfig);
    let finalChatConfig = chatConfig;

    // === Doc Editor Auto-Injection ===
    // When a custom agent is used in the doc editor (scope === 'doc'),
    // automatically inject Docs Agent tools and system role.
    if (ctx.scope === 'doc') {
      // 1. Inject Docs Agent tool if not already present.
      const docsAgentPlugins = finalPlugins.includes(DocsAgentIdentifier)
        ? finalPlugins
        : [DocsAgentIdentifier, ...finalPlugins];

      // 2. Get the Docs Agent system prompt from the builtin agent runtime.
      const docsAgentRuntime = getAgentRuntimeConfig(BUILTIN_AGENT_SLUGS.docsAgent, {});
      const docsAgentSystemRole = docsAgentRuntime?.systemRole || '';

      // 3. Merge system roles: custom agent role + Docs Agent role.
      const mergedSystemRole = docsAgentSystemRole
        ? agentConfig.systemRole
          ? `${agentConfig.systemRole}\n\n${docsAgentSystemRole}`
          : docsAgentSystemRole
        : agentConfig.systemRole || '';

      finalAgentConfig = {
        ...finalAgentConfig,
        systemRole: mergedSystemRole,
      };

      // 4. Apply chatConfig overrides (same as the builtin docs copilot).
      finalChatConfig = {
        ...chatConfig,
        enableHistoryCount: false, // Disable history truncation for full document context
      };

      return {
        agentConfig: finalAgentConfig,
        chatConfig: finalChatConfig,
        isBuiltinAgent: false,
        plugins: applyPluginFilters(docsAgentPlugins),
      };
    }

    // Not in doc scope - return standard config.
    return {
      agentConfig: finalAgentConfig,
      chatConfig: finalChatConfig,
      isBuiltinAgent: false,
      plugins: applyPluginFilters(finalPlugins),
    };
  }

  // Build groupSupervisorContext if this is a group-supervisor agent
  // Use groupId for direct lookup instead of reverse lookup by supervisorAgentId
  let groupSupervisorContext;
  if (slug === BUILTIN_AGENT_SLUGS.groupSupervisor && ctx.groupId) {
    log('building groupSupervisorContext for agentId: %s, groupId: %s', agentId, ctx.groupId);
    const groupStoreState = getChatGroupStoreState();
    // Direct lookup using groupId
    const group = agentGroupByIdSelectors.groupById(ctx.groupId)(groupStoreState);

    log(
      'groupById result for %s: %o',
      ctx.groupId,
      group
        ? {
            agentsCount: group.agents?.length,
            groupId: group.id,
            supervisorAgentId: group.supervisorAgentId,
            title: group.title,
          }
        : null,
    );

    if (group) {
      const groupMembers = agentGroupSelectors.getGroupMembers(group.id)(groupStoreState);
      log(
        'groupMembers for groupId %s: %o',
        group.id,
        groupMembers.map((m) => ({ id: m.id, isSupervisor: m.isSupervisor, title: m.title })),
      );

      groupSupervisorContext = {
        availableAgents: groupMembers.map((agent) => ({ id: agent.id, title: agent.title })),
        groupId: group.id,
        groupTitle: group.title || 'Group Chat',
        systemPrompt: agentConfig.systemRole,
      };
      log('groupSupervisorContext built: %o', {
        availableAgentsCount: groupSupervisorContext.availableAgents.length,
        groupId: groupSupervisorContext.groupId,
        groupTitle: groupSupervisorContext.groupTitle,
        hasSystemPrompt: !!groupSupervisorContext.systemPrompt,
      });
    } else {
      log('WARNING: group not found for groupId: %s', ctx.groupId);
    }
  }

  // Builtin agent - merge runtime config
  // Use basePlugins as fallback when ctx.plugins is not provided
  // This ensures builtin agents (e.g., INBOX) receive user-configured plugins for merging
  const runtimeConfig = getAgentRuntimeConfig(slug, {
    documentContent,
    groupSupervisorContext,
    model,
    plugins: plugins || basePlugins,
    targetAgentConfig,
  });

  // Merge runtime systemRole into agent config
  let resolvedSystemRole = runtimeConfig?.systemRole ?? agentConfig.systemRole;

  // Merge plugins: runtime plugins take priority, fallback to base plugins
  let finalPlugins =
    runtimeConfig?.plugins && runtimeConfig.plugins.length > 0
      ? runtimeConfig.plugins
      : basePlugins;

  // Merge chatConfig: runtime chatConfig overrides base chatConfig
  let resolvedChatConfig: LobeAgentChatConfig = {
    ...chatConfig,
    ...runtimeConfig?.chatConfig,
  };

  // === Doc Editor Auto-Injection for Builtin Agents ===
  // When a builtin agent other than Docs Agent itself is used in the doc editor,
  // inject Docs Agent tools and system role.
  if (ctx.scope === 'doc' && slug !== BUILTIN_AGENT_SLUGS.docsAgent) {
    // 1. Inject Docs Agent tool if not already present.
    if (!finalPlugins.includes(DocsAgentIdentifier)) {
      finalPlugins = [DocsAgentIdentifier, ...finalPlugins];
    }

    // 2. Get the Docs Agent system prompt.
    const docsAgentRuntime = getAgentRuntimeConfig(BUILTIN_AGENT_SLUGS.docsAgent, {});
    const docsAgentSystemRole = docsAgentRuntime?.systemRole || '';

    // 3. Merge system roles: builtin agent role + Docs Agent role.
    if (docsAgentSystemRole) {
      resolvedSystemRole = resolvedSystemRole
        ? `${resolvedSystemRole}\n\n${docsAgentSystemRole}`
        : docsAgentSystemRole;
    }

    // 4. Apply chatConfig overrides
    resolvedChatConfig = {
      ...resolvedChatConfig,
      enableHistoryCount: false,
    };
  }

  // Merge runtime systemRole into agent config
  const resolvedAgentConfig: LobeAgentConfig = {
    ...agentConfig,
    systemRole: resolvedSystemRole,
  };

  // Apply params adjustments based on chatConfig
  const finalAgentConfig = applyParamsFromChatConfig(resolvedAgentConfig, resolvedChatConfig);

  log('resolveAgentConfig completed for agentId: %s, result: %o', agentId, {
    isBuiltinAgent: true,
    pluginsCount: finalPlugins.length,
    slug,
  });

  return {
    agentConfig: finalAgentConfig,
    chatConfig: resolvedChatConfig,
    isBuiltinAgent: true,
    plugins: applyPluginFilters(finalPlugins),
    slug,
  };
};

/**
 * Get the target agent ID, falling back to active agent if not provided
 */
export const getTargetAgentId = (agentId?: string): string => {
  const agentStoreState = getAgentStoreState();
  return agentId || agentStoreState.activeAgentId || '';
};
