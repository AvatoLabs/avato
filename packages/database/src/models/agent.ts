import { getAgentPersistConfig } from '@lobechat/builtin-agents';
import { INBOX_SESSION_ID } from '@lobechat/const';
import { and, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import type { PartialDeep } from 'type-fest';

import { merge } from '@/utils/merge';

import type { AgentItem } from '../schemas';
import {
  agents,
  agentsFiles,
  agentsKnowledgeBases,
  agentsToSessions,
  documents,
  files,
  knowledgeBases,
  sessions,
} from '../schemas';
import type { LobeChatDatabase } from '../type';

export class AgentModel {
  private userId: string;
  private db: LobeChatDatabase;

  constructor(db: LobeChatDatabase, userId: string) {
    this.userId = userId;
    this.db = db;
  }

  private normalizeBuiltinInboxAgent = <T extends Partial<AgentItem> | null | undefined>(
    agent: T,
  ): T => {
    if (!agent || agent.slug !== INBOX_SESSION_ID) return agent;

    return {
      ...agent,
      title: 'Avato',
      virtual: true,
    } as T;
  };

  private findCanonicalInboxAgent = async () => {
    const result = await this.db
      .select({ agent: agents })
      .from(sessions)
      .innerJoin(agentsToSessions, eq(sessions.id, agentsToSessions.sessionId))
      .innerJoin(agents, eq(agentsToSessions.agentId, agents.id))
      .where(and(eq(sessions.slug, INBOX_SESSION_ID), eq(sessions.userId, this.userId)))
      .orderBy(desc(sessions.updatedAt), desc(agents.updatedAt))
      .limit(1);

    return result[0]?.agent ?? null;
  };

  private clearConflictingInboxSlugs = async (excludeAgentId: string) => {
    await this.db
      .update(agents)
      .set({ slug: null })
      .where(
        and(
          eq(agents.userId, this.userId),
          eq(agents.slug, INBOX_SESSION_ID),
          sql`${agents.id} <> ${excludeAgentId}`,
        ),
      );
  };

  getAgentConfigById = async (id: string) => {
    const agent = await this.db.query.agents.findFirst({
      where: and(eq(agents.id, id), eq(agents.userId, this.userId)),
    });

    if (!agent) return null;

    return this.enrichAgentWithKnowledge(this.normalizeBuiltinInboxAgent(agent));
  };

  /**
   * Query non-virtual agents with optional keyword filter.
   * Returns minimal agent info (id, title, description, avatar, backgroundColor).
   * Excludes virtual agents (like inbox, supervisors, etc).
   */
  queryAgents = async (params?: { keyword?: string; limit?: number; offset?: number }) => {
    const { keyword, limit = 9999, offset = 0 } = params ?? {};
    const baseConditions = and(eq(agents.userId, this.userId), eq(agents.virtual, false));

    // Add keyword search condition if provided
    const searchCondition = keyword
      ? and(
          baseConditions,
          or(ilike(agents.title, `%${keyword}%`), ilike(agents.description, `%${keyword}%`)),
        )
      : baseConditions;

    return this.db
      .select({
        avatar: agents.avatar,
        backgroundColor: agents.backgroundColor,
        description: agents.description,
        id: agents.id,
        title: agents.title,
      })
      .from(agents)
      .where(searchCondition)
      .orderBy(desc(agents.updatedAt))
      .limit(limit)
      .offset(offset);
  };

  /**
   * Get agent config by ID or slug (single query with OR condition)
   */
  getAgentConfig = async (idOrSlug: string) => {
    const agent = await this.db.query.agents.findFirst({
      where: and(
        eq(agents.userId, this.userId),
        or(eq(agents.id, idOrSlug), eq(agents.slug, idOrSlug)),
      ),
    });

    if (!agent) return null;

    return this.enrichAgentWithKnowledge(this.normalizeBuiltinInboxAgent(agent));
  };

  /**
   * Enrich agent with knowledge base and files data
   */
  private enrichAgentWithKnowledge = async (agent: AgentItem) => {
    const knowledge = await this.getAgentAssignedKnowledge(agent.id);

    // Fetch document content for enabled files
    const enabledFileIds = knowledge.files
      .filter((f) => f.enabled)
      .map((f) => f.id)
      .filter((id) => id !== undefined);
    let files: Array<(typeof knowledge.files)[number] & { content?: string | null }> =
      knowledge.files;

    if (enabledFileIds.length > 0) {
      const documentsData = await this.db.query.documents.findMany({
        where: and(
          eq(documents.userId, this.userId),
          inArray(documents.fileId, enabledFileIds),
          isNull(documents.deletedAt),
        ),
      });

      const documentMap = new Map(documentsData.map((doc) => [doc.fileId, doc.content]));
      files = knowledge.files.map((file) => ({
        ...file,
        content: file.enabled && file.id ? documentMap.get(file.id) : undefined,
      }));
    }

    return { ...agent, ...knowledge, files };
  };

  getAgentAssignedKnowledge = async (id: string) => {
    // Run both queries in parallel for better performance
    // Include userId check to ensure user can only access their own agent's knowledge
    const [knowledgeBaseResult, fileResult] = await Promise.all([
      this.db
        .select({ enabled: agentsKnowledgeBases.enabled, knowledgeBases })
        .from(agentsKnowledgeBases)
        .where(
          and(eq(agentsKnowledgeBases.agentId, id), eq(agentsKnowledgeBases.userId, this.userId)),
        )
        .orderBy(desc(agentsKnowledgeBases.createdAt))
        .leftJoin(knowledgeBases, eq(knowledgeBases.id, agentsKnowledgeBases.knowledgeBaseId)),
      this.db
        .select({ enabled: agentsFiles.enabled, files })
        .from(agentsFiles)
        .where(and(eq(agentsFiles.agentId, id), eq(agentsFiles.userId, this.userId)))
        .orderBy(desc(agentsFiles.createdAt))
        .leftJoin(files, eq(files.id, agentsFiles.fileId)),
    ]);

    return {
      files: fileResult.map((item) => ({
        ...item.files,
        enabled: item.enabled,
      })),
      knowledgeBases: knowledgeBaseResult.map((item) => ({
        ...item.knowledgeBases,
        enabled: item.enabled,
      })),
    };
  };

  /**
   * Find agent by session id
   */
  findBySessionId = async (sessionId: string) => {
    const item = await this.db.query.agentsToSessions.findFirst({
      where: and(
        eq(agentsToSessions.sessionId, sessionId),
        eq(agentsToSessions.userId, this.userId),
      ),
    });

    if (!item) return;

    const agentId = item.agentId;

    return this.getAgentConfigById(agentId);
  };

  createAgentKnowledgeBase = async (
    agentId: string,
    knowledgeBaseId: string,
    enabled: boolean = true,
  ) => {
    const existing = await this.db.query.agentsKnowledgeBases.findFirst({
      where: and(
        eq(agentsKnowledgeBases.agentId, agentId),
        eq(agentsKnowledgeBases.knowledgeBaseId, knowledgeBaseId),
        eq(agentsKnowledgeBases.userId, this.userId),
      ),
    });

    if (existing) {
      await this.db
        .update(agentsKnowledgeBases)
        .set({ enabled })
        .where(
          and(
            eq(agentsKnowledgeBases.agentId, agentId),
            eq(agentsKnowledgeBases.knowledgeBaseId, knowledgeBaseId),
            eq(agentsKnowledgeBases.userId, this.userId),
          ),
        );

      return;
    }

    return this.db.insert(agentsKnowledgeBases).values({
      agentId,
      enabled,
      knowledgeBaseId,
      userId: this.userId,
    });
  };

  deleteAgentKnowledgeBase = async (agentId: string, knowledgeBaseId: string) => {
    return this.db
      .delete(agentsKnowledgeBases)
      .where(
        and(
          eq(agentsKnowledgeBases.agentId, agentId),
          eq(agentsKnowledgeBases.knowledgeBaseId, knowledgeBaseId),
          eq(agentsKnowledgeBases.userId, this.userId),
        ),
      );
  };

  toggleKnowledgeBase = async (agentId: string, knowledgeBaseId: string, enabled?: boolean) => {
    return this.db
      .update(agentsKnowledgeBases)
      .set({ enabled })
      .where(
        and(
          eq(agentsKnowledgeBases.agentId, agentId),
          eq(agentsKnowledgeBases.knowledgeBaseId, knowledgeBaseId),
          eq(agentsKnowledgeBases.userId, this.userId),
        ),
      );
  };

  createAgentFiles = async (agentId: string, fileIds: string[], enabled: boolean = true) => {
    // Exclude the fileIds that already exist in agentsFiles, and then insert them
    const existingFiles = await this.db
      .select({ id: agentsFiles.fileId })
      .from(agentsFiles)
      .where(
        and(
          eq(agentsFiles.agentId, agentId),
          eq(agentsFiles.userId, this.userId),
          inArray(agentsFiles.fileId, fileIds),
        ),
      );

    const existingFilesIds = new Set(existingFiles.map((item) => item.id));
    const existingFileIds = Array.from(existingFilesIds);

    const needToInsertFileIds = fileIds.filter((fileId) => !existingFilesIds.has(fileId));

    if (existingFileIds.length > 0) {
      await this.db
        .update(agentsFiles)
        .set({ enabled })
        .where(
          and(
            eq(agentsFiles.agentId, agentId),
            eq(agentsFiles.userId, this.userId),
            inArray(agentsFiles.fileId, existingFileIds),
          ),
        );
    }

    if (needToInsertFileIds.length === 0) return;

    return this.db
      .insert(agentsFiles)
      .values(
        needToInsertFileIds.map((fileId) => ({ agentId, enabled, fileId, userId: this.userId })),
      );
  };

  deleteAgentFile = async (agentId: string, fileId: string) => {
    return this.db
      .delete(agentsFiles)
      .where(
        and(
          eq(agentsFiles.agentId, agentId),
          eq(agentsFiles.fileId, fileId),
          eq(agentsFiles.userId, this.userId),
        ),
      );
  };

  /**
   * Delete an agent and its associated session.
   * This will cascade delete messages, topics, etc. through the session deletion.
   */
  delete = async (agentId: string) => {
    return this.db.transaction(async (trx) => {
      // 1. Get associated session IDs
      const links = await trx
        .select({ sessionId: agentsToSessions.sessionId })
        .from(agentsToSessions)
        .where(
          and(eq(agentsToSessions.agentId, agentId), eq(agentsToSessions.userId, this.userId)),
        );

      const sessionIds = links.map((link) => link.sessionId);

      // 2. Delete links in agentsToSessions
      await trx
        .delete(agentsToSessions)
        .where(
          and(eq(agentsToSessions.agentId, agentId), eq(agentsToSessions.userId, this.userId)),
        );

      // 3. Delete associated sessions (this will cascade delete messages, topics, etc.)
      if (sessionIds.length > 0) {
        await trx
          .delete(sessions)
          .where(and(inArray(sessions.id, sessionIds), eq(sessions.userId, this.userId)));
      }

      // 4. Delete the agent itself
      return trx.delete(agents).where(and(eq(agents.id, agentId), eq(agents.userId, this.userId)));
    });
  };

  /**
   * Batch delete agents by IDs.
   * This is a simpler delete that only removes the agent records.
   * Use this for virtual agents that don't have associated sessions.
   */
  batchDelete = async (agentIds: string[]) => {
    if (agentIds.length === 0) return;

    return this.db
      .delete(agents)
      .where(and(eq(agents.userId, this.userId), inArray(agents.id, agentIds)));
  };

  toggleFile = async (agentId: string, fileId: string, enabled?: boolean) => {
    return this.db
      .update(agentsFiles)
      .set({ enabled })
      .where(
        and(
          eq(agentsFiles.agentId, agentId),
          eq(agentsFiles.fileId, fileId),
          eq(agentsFiles.userId, this.userId),
        ),
      );
  };

  /**
   * Create an agent record only (without creating a session).
   * This is used for creating virtual agents (e.g., group chat members).
   */
  create = async (config: Partial<AgentItem>): Promise<AgentItem> => {
    const [result] = await this.db
      .insert(agents)
      .values([
        {
          ...config,
          model: typeof config.model === 'string' ? config.model : null,
          userId: this.userId,
        },
      ])
      .returning();

    return result;
  };

  /**
   * Batch create multiple agents (without sessions).
   * Used for creating multiple virtual agents at once (e.g., group chat members).
   */
  batchCreate = async (configs: Partial<AgentItem>[]): Promise<AgentItem[]> => {
    if (configs.length === 0) return [];

    return this.db
      .insert(agents)
      .values(
        configs.map((config) => ({
          ...config,
          model: typeof config.model === 'string' ? config.model : null,
          userId: this.userId,
        })),
      )
      .returning();
  };

  update = async (agentId: string, data: Partial<AgentItem>) => {
    return this.db
      .update(agents)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(agents.id, agentId), eq(agents.userId, this.userId)));
  };

  touchUpdatedAt = async (agentId: string) => {
    return this.update(agentId, {});
  };

  /**
   * Check if an agent with the given marketIdentifier already exists
   * @returns true if exists, false otherwise
   */
  checkByMarketIdentifier = async (marketIdentifier: string): Promise<boolean> => {
    const result = await this.db.query.agents.findFirst({
      where: and(eq(agents.marketIdentifier, marketIdentifier), eq(agents.userId, this.userId)),
    });
    return !!result;
  };

  /**
   * Get an agent by marketIdentifier
   * If multiple agents match, returns the most recently updated one
   * @returns agent id if exists, null otherwise
   */
  getAgentByMarketIdentifier = async (marketIdentifier: string): Promise<string | null> => {
    const result = await this.db.query.agents.findFirst({
      columns: { id: true },
      orderBy: (agents, { desc }) => [desc(agents.updatedAt)],
      where: and(eq(agents.marketIdentifier, marketIdentifier), eq(agents.userId, this.userId)),
    });
    return result?.id ?? null;
  };

  /**
   * Get an agent by the forkedFromIdentifier stored in params
   * @param forkedFromIdentifier - The source agent's market identifier
   * @returns agent id if exists, null otherwise
   */
  getAgentByForkedFromIdentifier = async (forkedFromIdentifier: string): Promise<string | null> => {
    const result = await this.db.query.agents.findFirst({
      columns: { id: true },
      orderBy: (agents, { desc }) => [desc(agents.updatedAt)],
      where: and(
        eq(agents.userId, this.userId),
        sql`${agents.params}->>'forkedFromIdentifier' = ${forkedFromIdentifier}`,
      ),
    });
    return result?.id ?? null;
  };

  updateConfig = async (agentId: string, data: PartialDeep<AgentItem> | undefined | null) => {
    if (!data || Object.keys(data).length === 0) return;

    const agent = await this.db.query.agents.findFirst({
      where: and(eq(agents.id, agentId), eq(agents.userId, this.userId)),
    });

    if (!agent) return;

    const isInboxAgent = agent.slug === INBOX_SESSION_ID;
    const sanitizedData = isInboxAgent
      ? ({
          ...data,
          title: undefined,
          virtual: true,
        } satisfies PartialDeep<AgentItem>)
      : data;

    // First process the params field: undefined means delete, null means disable flag
    const existingParams = agent.params ?? {};
    const updatedParams: Record<string, any> = { ...existingParams };

    if (sanitizedData.params) {
      const incomingParams = sanitizedData.params as Record<string, any>;
      Object.keys(incomingParams).forEach((key) => {
        const incomingValue = incomingParams[key];

        // undefined means explicitly delete this field
        if (incomingValue === undefined) {
          delete updatedParams[key];
          return;
        }

        // All other values (including null) are directly overwritten, null means disable this param on the frontend
        updatedParams[key] = incomingValue;
      });
    }

    // Build data to be merged, excluding params (processed separately)

    const { params: _params, ...restData } = sanitizedData;
    const mergedValue = merge(agent, restData);

    // Apply the processed parameters
    mergedValue.params = Object.keys(updatedParams).length > 0 ? updatedParams : undefined;
    if (isInboxAgent) {
      mergedValue.slug = INBOX_SESSION_ID;
      mergedValue.title = null;
      mergedValue.virtual = true;
    }

    // Final cleanup: ensure no undefined or null values enter the database
    if (mergedValue.params) {
      const params = mergedValue.params as Record<string, any>;
      Object.keys(params).forEach((key) => {
        if (params[key] === undefined) {
          delete params[key];
        }
      });
      if (Object.keys(params).length === 0) {
        mergedValue.params = undefined;
      }
    }

    // Remove timestamp fields to let Drizzle's $onUpdate handle them automatically

    const { updatedAt: _, accessedAt: __, createdAt: ___, ...updateData } = mergedValue;

    return this.db
      .update(agents)
      .set(updateData)
      .where(and(eq(agents.id, agentId), eq(agents.userId, this.userId)));
  };

  /**
   * Update the sessionGroupId for an agent
   */
  updateSessionGroupId = async (agentId: string, sessionGroupId: string | null) => {
    const result = await this.db
      .update(agents)
      .set({ sessionGroupId, updatedAt: new Date() })
      .where(and(eq(agents.id, agentId), eq(agents.userId, this.userId)))
      .returning();

    return result[0];
  };

  /**
   * Duplicate an agent.
   * Returns the new agent ID.
   */
  duplicate = async (agentId: string, newTitle?: string): Promise<{ agentId: string } | null> => {
    // Get the source agent
    const sourceAgent = await this.db.query.agents.findFirst({
      where: and(eq(agents.id, agentId), eq(agents.userId, this.userId)),
    });

    if (!sourceAgent) return null;

    // Create new agent with explicit include fields
    const [newAgent] = await this.db
      .insert(agents)
      .values({
        avatar: sourceAgent.avatar,
        backgroundColor: sourceAgent.backgroundColor,
        chatConfig: sourceAgent.chatConfig,
        description: sourceAgent.description,
        fewShots: sourceAgent.fewShots,
        model: sourceAgent.model,
        openingMessage: sourceAgent.openingMessage,
        openingQuestions: sourceAgent.openingQuestions,
        params: sourceAgent.params,
        pinned: sourceAgent.pinned,
        // Config
        plugins: sourceAgent.plugins,
        provider: sourceAgent.provider,

        // Session group
        sessionGroupId: sourceAgent.sessionGroupId,
        systemRole: sourceAgent.systemRole,

        tags: sourceAgent.tags,
        // Metadata
        title: newTitle || (sourceAgent.title ? `${sourceAgent.title} (Copy)` : 'Copy'),
        tts: sourceAgent.tts,
        // User
        userId: this.userId,
      })
      .returning();

    return { agentId: newAgent.id };
  };

  /**
   * Get a builtin agent by slug, creating it if it doesn't exist.
   * Builtin agents are standalone agents not bound to sessions.
   *
   */
  getBuiltinAgent = async (slug: string): Promise<AgentItem | null> => {
    if (slug === INBOX_SESSION_ID) {
      const canonicalInboxAgent = await this.findCanonicalInboxAgent();

      if (!canonicalInboxAgent) return null;

      await this.clearConflictingInboxSlugs(canonicalInboxAgent.id);

      const [updatedAgent] = await this.db
        .update(agents)
        .set({ slug: INBOX_SESSION_ID, title: null, virtual: true })
        .where(and(eq(agents.id, canonicalInboxAgent.id), eq(agents.userId, this.userId)))
        .returning();

      return this.normalizeBuiltinInboxAgent(updatedAgent);
    }

    // 1. First try to find existing agent by slug
    const existing = await this.db.query.agents.findFirst({
      orderBy: [desc(agents.updatedAt)],
      where: and(eq(agents.slug, slug), eq(agents.userId, this.userId)),
    });

    if (existing) return existing;

    // 3. Check if this is a known builtin agent
    const persistConfig = getAgentPersistConfig(slug);
    if (!persistConfig) return null;

    // 4. Create the builtin agent with persist config
    const result = await this.db
      .insert(agents)
      .values({
        model: persistConfig.model,
        provider: persistConfig.provider,
        slug: persistConfig.slug,
        userId: this.userId,
        virtual: true,
      })
      .returning();

    return this.normalizeBuiltinInboxAgent(result[0]);
  };
}
