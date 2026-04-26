import { type SidebarAgentItem, type SidebarGroup } from '@/database/repositories/home';
import { type HomeStore } from '@/store/home/store';

const isGroupChatSession = (item: SidebarAgentItem): boolean => item.type === 'group';

/**
 * Get all pinned agents
 */
const pinnedAgents = (s: HomeStore): SidebarAgentItem[] => s.pinnedAgents;

/**
 * Pinned single-agent sessions only (群组会话 are listed under 群组 section).
 */
const pinnedAgentsOnly = (s: HomeStore): SidebarAgentItem[] =>
  s.pinnedAgents.filter((i) => !isGroupChatSession(i));

/**
 * Pinned 群组会话 — shown in 群组 sidebar block.
 */
const pinnedGroupSessions = (s: HomeStore): SidebarAgentItem[] =>
  s.pinnedAgents.filter(isGroupChatSession);

/**
 * Get all agent groups (folders)
 */
const agentGroups = (s: HomeStore): SidebarGroup[] => s.agentGroups;

/**
 * Get all ungrouped agents
 */
const ungroupedAgents = (s: HomeStore): SidebarAgentItem[] => s.ungroupedAgents;

/**
 * Ungrouped single-agent sessions only (excludes 群组会话).
 */
const ungroupedAgentsOnly = (s: HomeStore): SidebarAgentItem[] =>
  s.ungroupedAgents.filter((i) => !isGroupChatSession(i));

/**
 * Ungrouped 群组会话 — shown in 群组 sidebar block.
 */
const ungroupedGroupSessions = (s: HomeStore): SidebarAgentItem[] =>
  s.ungroupedAgents.filter(isGroupChatSession);

/**
 * Limit ungrouped agents for sidebar display based on page size
 */
const ungroupedAgentsLimited =
  (pageSize: number) =>
  (s: HomeStore): SidebarAgentItem[] =>
    s.ungroupedAgents.slice(0, pageSize);

/**
 * Limit ungrouped **agent** sessions (excludes group chats) for 智能体 section.
 */
const ungroupedAgentsOnlyLimited =
  (pageSize: number) =>
  (s: HomeStore): SidebarAgentItem[] =>
    ungroupedAgentsOnly(s).slice(0, pageSize);

/**
 * Get ungrouped agents count
 */
const ungroupedAgentsCount = (s: HomeStore): number => s.ungroupedAgents.length;

/** Count of ungrouped single-agent sessions (for 「更多」 pagination in 智能体 section). */
const ungroupedAgentsOnlyCount = (s: HomeStore): number => ungroupedAgentsOnly(s).length;

/**
 * Check if agent list is initialized
 */
const isAgentListInit = (s: HomeStore): boolean => s.isAgentListInit;

/**
 * Get all agents (pinned + grouped + ungrouped)
 */
const allAgents = (s: HomeStore): SidebarAgentItem[] => {
  const groupedAgents = s.agentGroups.flatMap((g) => g.items);
  return [...s.pinnedAgents, ...groupedAgents, ...s.ungroupedAgents];
};

/**
 * Get agent by id
 */
const getAgentById =
  (id: string) =>
  (s: HomeStore): SidebarAgentItem | undefined => {
    return allAgents(s).find((a) => a.id === id);
  };

/**
 * Check if there are any custom agents (non-empty list)
 */
const hasCustomAgents = (s: HomeStore): boolean => {
  return allAgents(s).length > 0;
};

/**
 * Get total agent count
 */
const agentCount = (s: HomeStore): number => {
  return allAgents(s).length;
};

export const homeAgentListSelectors = {
  agentCount,
  agentGroups,
  allAgents,
  getAgentById,
  hasCustomAgents,
  isAgentListInit,
  pinnedAgents,
  pinnedAgentsOnly,
  pinnedGroupSessions,
  ungroupedAgents,
  ungroupedAgentsOnly,
  ungroupedAgentsOnlyCount,
  ungroupedAgentsOnlyLimited,
  ungroupedAgentsCount,
  ungroupedAgentsLimited,
  ungroupedGroupSessions,
};
