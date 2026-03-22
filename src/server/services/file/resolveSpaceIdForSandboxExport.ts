import { and, eq, inArray, isNull, or } from 'drizzle-orm';

import {
  agentsKnowledgeBases,
  chatGroupsAgents,
  knowledgeBases,
  topics,
} from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';

/**
 * Resolve a single space id for sandbox/code-interpreter exports so `createFileRecord` can
 * register `space_blobs` in the same Space as the topic's knowledge bases (dedup / consistency).
 *
 * - If the topic's agent(s) have exactly one distinct non-null KB `spaceId` among enabled KB links,
 *   returns that id.
 * - If multiple spaces appear (ambiguous), returns `undefined` (caller falls back to personal space).
 * - Group topics: unions KB spaces from all enabled group agents.
 */
export async function resolveSpaceIdForSandboxExport(
  db: LobeChatDatabase,
  userId: string,
  topicId: string,
): Promise<string | undefined> {
  const topic = await db.query.topics.findFirst({
    where: and(eq(topics.id, topicId), eq(topics.userId, userId)),
  });
  if (!topic) return undefined;

  let agentIds: string[] = [];
  if (topic.agentId) {
    agentIds = [topic.agentId];
  } else if (topic.groupId) {
    const rows = await db
      .select({ agentId: chatGroupsAgents.agentId })
      .from(chatGroupsAgents)
      .where(
        and(
          eq(chatGroupsAgents.chatGroupId, topic.groupId),
          eq(chatGroupsAgents.userId, userId),
          or(isNull(chatGroupsAgents.enabled), eq(chatGroupsAgents.enabled, true)),
        ),
      );
    agentIds = [...new Set(rows.map((r) => r.agentId))];
  }

  if (agentIds.length === 0) return undefined;

  const kbRows = await db
    .select({ spaceId: knowledgeBases.spaceId })
    .from(agentsKnowledgeBases)
    .innerJoin(knowledgeBases, eq(agentsKnowledgeBases.knowledgeBaseId, knowledgeBases.id))
    .where(
      and(
        inArray(agentsKnowledgeBases.agentId, agentIds),
        eq(agentsKnowledgeBases.userId, userId),
        or(isNull(agentsKnowledgeBases.enabled), eq(agentsKnowledgeBases.enabled, true)),
      ),
    );

  const spaceIds = new Set(
    kbRows
      .map((r) => r.spaceId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0),
  );
  if (spaceIds.size !== 1) return undefined;
  return [...spaceIds][0];
}
