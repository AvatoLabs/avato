import {
  type RecentTopic,
  type RecentTopicGroup,
  type RecentTopicGroupMember,
} from '@lobechat/types';
import { cleanObject } from '@lobechat/utils';
import { TRPCError } from '@trpc/server';
import { eq, inArray } from 'drizzle-orm';
import { after } from 'next/server';
import { z } from 'zod';

import { SpaceModel } from '@/database/models/space';
import { TopicModel } from '@/database/models/topic';
import { TopicShareModel } from '@/database/models/topicShare';
import { AgentMigrationRepo } from '@/database/repositories/agentMigration';
import { TopicImporterRepo } from '@/database/repositories/topicImporter';
import { agents, chatGroups, chatGroupsAgents } from '@/database/schemas';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import { SpaceMemoryTopicIngestionService } from '@/server/services/spaceMemory/topicIngestion';
import { TopicTitleService } from '@/server/services/topicTitle';
import { type BatchTaskResult } from '@/types/service';

import {
  batchResolveAgentIdFromSessions,
  resolveAgentIdFromSession,
  resolveContext,
} from './_helpers/resolveContext';
import { basicContextSchema } from './_schema/context';

const topicProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;

  return opts.next({
    ctx: {
      agentMigrationRepo: new AgentMigrationRepo(ctx.serverDB, ctx.userId),
      spaceModel: new SpaceModel(ctx.serverDB, ctx.userId),
      topicImporterRepo: new TopicImporterRepo(ctx.serverDB, ctx.userId),
      topicModel: new TopicModel(ctx.serverDB, ctx.userId),
      topicShareModel: new TopicShareModel(ctx.serverDB, ctx.userId),
    },
  });
});

const AGENT_MIGRATION_DEDUP_TTL_MS = 5 * 60 * 1000;
const MAX_AGENT_MIGRATION_KEYS = 2000;
const recentAgentMigrationRuns = new Map<string, number>();

const shouldScheduleAgentMigration = (key: string): boolean => {
  const now = Date.now();
  const lastRun = recentAgentMigrationRuns.get(key);
  if (lastRun && now - lastRun < AGENT_MIGRATION_DEDUP_TTL_MS) return false;

  recentAgentMigrationRuns.set(key, now);

  if (recentAgentMigrationRuns.size > MAX_AGENT_MIGRATION_KEYS) {
    for (const [cacheKey, ts] of recentAgentMigrationRuns) {
      if (now - ts > AGENT_MIGRATION_DEDUP_TTL_MS) {
        recentAgentMigrationRuns.delete(cacheKey);
      }
    }

    while (recentAgentMigrationRuns.size > MAX_AGENT_MIGRATION_KEYS) {
      const oldestKey = recentAgentMigrationRuns.keys().next().value;
      if (!oldestKey) break;
      recentAgentMigrationRuns.delete(oldestKey);
    }
  }

  return true;
};

const assertAccessibleSpace = async (
  ctx: {
    spaceModel: SpaceModel;
  },
  spaceId?: string | null,
) => {
  if (!spaceId) return;

  const space = await ctx.spaceModel.findAccessibleSpaceById(spaceId);
  if (!space?.id) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'SPACE_ACCESS_DENIED' });
  }
};

export const topicRouter = router({
  batchCreateTopics: topicProcedure
    .input(
      z.array(
        z
          .object({
            favorite: z.boolean().optional(),
            id: z.string().optional(),
            messages: z.array(z.string()).optional(),
            spaceId: z.string().nullable().optional(),
            tagId: z.string().nullable().optional(),
            title: z.string(),
          })
          .extend(basicContextSchema.shape),
      ),
    )
    .mutation(async ({ input, ctx }): Promise<BatchTaskResult> => {
      await Promise.all(
        [
          ...new Set(
            input.map((item) => item.spaceId).filter((spaceId): spaceId is string => !!spaceId),
          ),
        ].map((spaceId) => assertAccessibleSpace(ctx, spaceId)),
      );

      // Resolve sessionId for each topic
      const resolvedTopics = await Promise.all(
        input.map(async (item) => {
          const { agentId, ...rest } = item;
          const resolved = await resolveContext(
            { agentId, sessionId: rest.sessionId },
            ctx.serverDB,
            ctx.userId,
          );
          return { ...rest, sessionId: resolved.sessionId };
        }),
      );

      const data = await ctx.topicModel.batchCreate(resolvedTopics as any);

      return { added: data.length, ids: [], skips: [], success: true };
    }),

  batchDelete: topicProcedure
    .input(z.object({ ids: z.array(z.string()) }))
    .mutation(async ({ input, ctx }) => {
      return ctx.topicModel.batchDelete(input.ids);
    }),

  batchDeleteByAgentId: topicProcedure
    .input(z.object({ agentId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return ctx.topicModel.batchDeleteByAgentId(input.agentId);
    }),

  batchDeleteBySessionId: topicProcedure
    .input(
      z.object({
        agentId: z.string().optional(),
        id: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const resolved = await resolveContext(
        { agentId: input.agentId, sessionId: input.id },
        ctx.serverDB,
        ctx.userId,
      );

      return ctx.topicModel.batchDeleteBySessionId(resolved.sessionId);
    }),

  cloneTopic: topicProcedure
    .input(z.object({ id: z.string(), newTitle: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const data = await ctx.topicModel.duplicate(input.id, input.newTitle);

      return data.topic.id;
    }),

  countTopics: topicProcedure
    .input(
      z
        .object({
          agentId: z.string().optional(),
          containerId: z.string().nullable().optional(),
          endDate: z.string().optional(),
          range: z.tuple([z.string(), z.string()]).optional(),
          spaceId: z.string().nullable().optional(),
          startDate: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      return ctx.topicModel.count(input);
    }),

  createTopic: topicProcedure
    .input(
      z
        .object({
          favorite: z.boolean().optional(),
          groupId: z.string().nullable().optional(),
          messages: z.array(z.string()).optional(),
          spaceId: z.string().nullable().optional(),
          tagId: z.string().nullable().optional(),
          title: z.string(),
        })
        .extend(basicContextSchema.shape),
    )
    .mutation(async ({ input, ctx }) => {
      await assertAccessibleSpace(ctx, input.spaceId);

      const { agentId, ...rest } = input;
      const resolved = await resolveContext(
        { agentId, sessionId: rest.sessionId },
        ctx.serverDB,
        ctx.userId,
      );

      const data = await ctx.topicModel.create({ ...rest, sessionId: resolved.sessionId });

      if ((rest.messages?.length ?? 0) > 0) {
        after(async () => {
          try {
            const topicTitleService = new TopicTitleService(ctx.serverDB, ctx.userId);
            await topicTitleService.summarizeTopicTitle({ topicId: data.id });
          } catch (error) {
            console.error('[topic.createTopic] auto topic title generation failed:', error);
          }
        });
      }

      return data.id;
    }),

  /**
   * Disable sharing for a topic (deletes share record)
   */
  disableSharing: topicProcedure
    .input(z.object({ topicId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return ctx.topicShareModel.deleteByTopicId(input.topicId);
    }),

  /**
   * Enable sharing for a topic (creates share record)
   */
  enableSharing: topicProcedure
    .input(
      z.object({
        topicId: z.string(),
        visibility: z.enum(['private', 'link']).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return ctx.topicShareModel.create(input.topicId, input.visibility);
    }),

  getAllTopics: topicProcedure.query(async ({ ctx }) => {
    return ctx.topicModel.queryAll();
  }),

  getCronTopicsGroupedByCronJob: topicProcedure
    .input(z.object({ agentId: z.string() }))
    .query(async ({ input, ctx }) => {
      return ctx.topicModel.getCronTopicsGroupedByCronJob(input.agentId);
    }),

  getShareInfo: topicProcedure
    .input(z.object({ topicId: z.string() }))
    .query(async ({ input, ctx }) => {
      return ctx.topicShareModel.getByTopicId(input.topicId);
    }),

  getTopics: topicProcedure
    .input(
      z.object({
        agentId: z.string().nullable().optional(),
        current: z.number().optional(),
        excludeTriggers: z.array(z.string()).optional(),
        groupId: z.string().nullable().optional(),
        isInbox: z.boolean().optional(),
        pageSize: z.number().optional(),
        spaceId: z.string().nullable().optional(),
        sessionId: z.string().nullable().optional(),
        tagId: z.string().nullable().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { sessionId, isInbox, groupId, excludeTriggers, tagId, ...rest } = input;

      // If groupId is provided, query by groupId directly
      if (groupId) {
        const result = await ctx.topicModel.query({ excludeTriggers, groupId, tagId, ...rest });
        return { items: result.items, total: result.total };
      }

      // If sessionId is provided but no agentId, need to reverse lookup agentId
      let effectiveAgentId = rest.agentId;
      if (!effectiveAgentId && sessionId) {
        effectiveAgentId = await resolveAgentIdFromSession(sessionId, ctx.serverDB, ctx.userId);
      }

      const queryParams = effectiveAgentId
        ? {
            ...rest,
            agentId: effectiveAgentId,
            excludeTriggers,
            isInbox,
            tagId,
          }
        : sessionId
          ? {
              ...rest,
              containerId: sessionId,
              excludeTriggers,
              tagId,
            }
          : {
              ...rest,
              excludeTriggers,
              isInbox,
              tagId,
            };

      const result = await ctx.topicModel.query(queryParams);

      // Runtime migration: backfill agentId for ALL legacy topics and messages under this agent
      const runMigration = async () => {
        if (!effectiveAgentId) return;

        // Get the associated sessionId for migration
        const resolved = await resolveContext(
          { agentId: effectiveAgentId },
          ctx.serverDB,
          ctx.userId,
        );

        const migrationParams = isInbox
          ? { agentId: effectiveAgentId, isInbox: true as const, sessionId: resolved.sessionId }
          : resolved.sessionId
            ? { agentId: effectiveAgentId, sessionId: resolved.sessionId }
            : null;

        if (migrationParams) {
          try {
            await ctx.agentMigrationRepo.migrateAgentId(migrationParams);
          } catch (error) {
            console.error('[AgentMigration] Failed to migrate agentId:', error);
          }
        }
      };

      // Use Next.js after() for non-blocking execution and dedupe hot-path scheduling.
      if (effectiveAgentId) {
        const migrationKey = `${ctx.userId}:${effectiveAgentId}:${isInbox ? 'inbox' : 'default'}`;
        if (shouldScheduleAgentMigration(migrationKey)) {
          after(runMigration);
        }
      }

      return { items: result.items, total: result.total };
    }),

  hasTopics: topicProcedure.query(async ({ ctx }) => {
    return (await ctx.topicModel.count()) === 0;
  }),

  generateTopicTitle: topicProcedure
    .input(z.object({ force: z.boolean().optional().default(false), id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const topicTitleService = new TopicTitleService(ctx.serverDB, ctx.userId);
      return topicTitleService.summarizeTopicTitle({
        force: input.force,
        topicId: input.id,
      });
    }),

  importTopic: topicProcedure
    .input(
      z.object({
        agentId: z.string(),
        data: z.string(),
        groupId: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const result = await ctx.topicImporterRepo.importTopic({
        agentId: input.agentId,
        data: input.data,
        groupId: input.groupId,
      });

      return result;
    }),

  rankTopics: topicProcedure.input(z.number().optional()).query(async ({ ctx, input }) => {
    return ctx.topicModel.rank(input);
  }),

  recentTopics: topicProcedure
    .input(
      z
        .object({
          limit: z.number().optional(),
          spaceId: z.string().nullable().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }): Promise<RecentTopic[]> => {
      const recentTopics = await ctx.topicModel.queryRecent(input?.limit ?? 12, input?.spaceId);

      // Separate agent topics and group topics
      const agentTopics = recentTopics.filter((t) => t.type === 'agent');
      const groupTopics = recentTopics.filter((t) => t.type === 'group');

      // Find legacy topics: no agentId but has sessionId
      const legacyTopics = agentTopics.filter(
        (topic) => topic.agentId === null && topic.sessionId !== null,
      );

      // Batch resolve agentId for legacy topics
      const sessionIds = [...new Set(legacyTopics.map((t) => t.sessionId!))];
      const sessionAgentMap = await batchResolveAgentIdFromSessions(
        sessionIds,
        ctx.serverDB,
        ctx.userId,
      );

      // Build agentId map: merge existing agentId with resolved ones
      const topicAgentIdMap = new Map<string, string>();
      for (const topic of agentTopics) {
        if (topic.agentId) {
          topicAgentIdMap.set(topic.id, topic.agentId);
        } else if (topic.sessionId) {
          const resolvedAgentId = sessionAgentMap.get(topic.sessionId);
          if (resolvedAgentId) {
            topicAgentIdMap.set(topic.id, resolvedAgentId);
          }
        }
      }

      // Collect all agentIds to fetch agent info
      const allAgentIds = [...new Set(topicAgentIdMap.values())];

      // Batch query agent info
      const agentInfoMap = new Map<
        string,
        { avatar: string | null; backgroundColor: string | null; id: string; title: string | null }
      >();

      if (allAgentIds.length > 0) {
        const agentInfos = await ctx.serverDB
          .select({
            avatar: agents.avatar,
            backgroundColor: agents.backgroundColor,
            id: agents.id,
            title: agents.title,
          })
          .from(agents)
          .where(inArray(agents.id, allAgentIds));

        for (const agent of agentInfos) {
          agentInfoMap.set(agent.id, agent);
        }
      }

      // Batch query group info with member avatars
      const groupInfoMap = new Map<string, RecentTopicGroup>();
      const allGroupIds = [...new Set(groupTopics.map((t) => t.groupId!).filter(Boolean))];

      if (allGroupIds.length > 0) {
        // Query chat groups
        const chatGroupInfos = await ctx.serverDB
          .select({
            id: chatGroups.id,
            title: chatGroups.title,
          })
          .from(chatGroups)
          .where(inArray(chatGroups.id, allGroupIds));

        // Query group member agents (get avatar info)
        const groupMembersRaw = await ctx.serverDB
          .select({
            agentAvatar: agents.avatar,
            agentBackgroundColor: agents.backgroundColor,
            chatGroupId: chatGroupsAgents.chatGroupId,
            order: chatGroupsAgents.order,
          })
          .from(chatGroupsAgents)
          .leftJoin(agents, eq(chatGroupsAgents.agentId, agents.id))
          .where(inArray(chatGroupsAgents.chatGroupId, allGroupIds));

        // Group members by chatGroupId
        const groupMembersMap = new Map<string, RecentTopicGroupMember[]>();
        for (const member of groupMembersRaw) {
          const members = groupMembersMap.get(member.chatGroupId) || [];
          members.push({
            avatar: member.agentAvatar,
            backgroundColor: member.agentBackgroundColor,
          });
          groupMembersMap.set(member.chatGroupId, members);
        }

        // Build group info map
        for (const group of chatGroupInfos) {
          groupInfoMap.set(group.id, {
            id: group.id,
            members: groupMembersMap.get(group.id) || [],
            title: group.title,
          });
        }
      }

      // Runtime migration: backfill agentId for legacy topics
      const runMigration = async () => {
        for (const [sessionId, agentId] of sessionAgentMap) {
          try {
            await ctx.agentMigrationRepo.migrateAgentId({ agentId, sessionId });
          } catch (error) {
            console.error('[AgentMigration] Failed to migrate agentId for recentTopics:', error);
          }
        }
      };

      // Use Next.js after() for non-blocking execution
      after(runMigration);

      // Assemble final result
      return recentTopics.map((topic) => {
        if (topic.type === 'group' && topic.groupId) {
          const groupInfo = groupInfoMap.get(topic.groupId);
          return {
            agent: null,
            group: groupInfo ?? null,
            id: topic.id,
            sessionId: topic.groupId,
            tagId: topic.tagId,
            title: topic.title,
            type: 'group' as const,
            updatedAt: topic.updatedAt,
          };
        }

        // Agent topic
        const agentId = topicAgentIdMap.get(topic.id);
        const agentInfo = agentId ? agentInfoMap.get(agentId) : null;

        // Always return agent with id if agentId exists (even if avatar/title are null)
        // Frontend needs agent.id to generate links
        const validAgent = agentInfo ? cleanObject(agentInfo) : null;

        return {
          agent: validAgent,
          group: null,
          id: topic.id,
          sessionId: topic.sessionId ?? null,
          tagId: topic.tagId,
          title: topic.title,
          type: 'agent' as const,
          updatedAt: topic.updatedAt,
        };
      });
    }),

  removeAllTopics: topicProcedure.mutation(async ({ ctx }) => {
    return ctx.topicModel.deleteAll();
  }),

  removeTopic: topicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return ctx.topicModel.delete(input.id);
    }),

  searchTopics: topicProcedure
    .input(
      z.object({
        agentId: z.string().optional(),
        groupId: z.string().nullable().optional(),
        keywords: z.string(),
        sessionId: z.string().nullable().optional(),
        spaceId: z.string().nullable().optional(),
        tagId: z.string().nullable().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const resolved = await resolveContext(
        { agentId: input.agentId, sessionId: input.sessionId },
        ctx.serverDB,
        ctx.userId,
      );

      return ctx.topicModel.queryByKeyword(
        input.keywords,
        resolved.sessionId,
        input.spaceId,
        input.tagId,
      );
    }),

  /**
   * Update share visibility
   */
  updateShareVisibility: topicProcedure
    .input(
      z.object({
        topicId: z.string(),
        visibility: z.enum(['private', 'link']),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return ctx.topicShareModel.updateVisibility(input.topicId, input.visibility);
    }),

  updateTopic: topicProcedure
    .input(
      z.object({
        id: z.string(),
        value: z.object({
          agentId: z.string().optional(),
          favorite: z.boolean().optional(),
          historySummary: z.string().optional(),
          messages: z.array(z.string()).optional(),
          metadata: z
            .object({
              model: z.string().optional(),
              provider: z.string().optional(),
            })
            .optional(),
          sessionId: z.string().optional(),
          tagId: z.string().nullable().optional(),
          title: z.string().optional(),
        }),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { agentId, ...restValue } = input.value;

      // If agentId is provided, resolve to sessionId
      let resolvedSessionId = restValue.sessionId;
      if (agentId && !resolvedSessionId) {
        const resolved = await resolveContext({ agentId }, ctx.serverDB, ctx.userId);
        resolvedSessionId = resolved.sessionId ?? undefined;
      }

      const updatedTopics = await ctx.topicModel.update(input.id, {
        ...restValue,
        sessionId: resolvedSessionId,
      });

      if (restValue.historySummary?.trim()) {
        after(async () => {
          try {
            await new SpaceMemoryTopicIngestionService(
              ctx.serverDB,
              ctx.userId,
            ).triggerTopicCandidate({
              producer: 'chat-history-summary',
              topicId: input.id,
              traceId: `topic-history-summary:${input.id}`,
            });
          } catch (error) {
            console.error('[topic.updateTopic] auto space memory ingestion failed:', error);
          }
        });
      }

      return updatedTopics;
    }),

  updateTopicMetadata: topicProcedure
    .input(
      z.object({
        id: z.string(),
        metadata: z.object({
          model: z.string().optional(),
          provider: z.string().optional(),
          workingDirectory: z.string().optional(),
        }),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return ctx.topicModel.updateMetadata(input.id, input.metadata);
    }),
});

export type TopicRouter = typeof topicRouter;
