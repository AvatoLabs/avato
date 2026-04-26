import { and, eq, inArray, isNull, or } from 'drizzle-orm';

import { agentsSourceSets, chatGroupsAgents, sourceSets, topics } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';

/**
 * Resolve a single space id for sandbox/code-interpreter exports so `createFileRecord` can
 * register `space_blobs` in the same Space as the topic's source sets (dedup / consistency).
 *
 * - If the topic's agent(s) have exactly one distinct non-null source-set `spaceId` among enabled links,
 *   returns that id.
 * - If multiple spaces appear (ambiguous), returns `undefined` (caller falls back to personal space).
 * - Group topics: unions source-set spaces from all enabled group agents.
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

  const sourceSetRows = await db
    .select({ spaceId: sourceSets.spaceId })
    .from(agentsSourceSets)
    .innerJoin(sourceSets, eq(agentsSourceSets.sourceSetId, sourceSets.id))
    .where(
      and(
        inArray(agentsSourceSets.agentId, agentIds),
        eq(agentsSourceSets.userId, userId),
        or(isNull(agentsSourceSets.enabled), eq(agentsSourceSets.enabled, true)),
      ),
    );

  const spaceIds = new Set(
    sourceSetRows
      .map((r) => r.spaceId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0),
  );
  if (spaceIds.size !== 1) return undefined;
  return [...spaceIds][0];
}
