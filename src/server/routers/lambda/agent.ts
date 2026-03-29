import { DEFAULT_AGENT_CONFIG, INBOX_SESSION_ID } from '@lobechat/const';
import { type AgentSourceItem } from '@lobechat/types';
import { AgentSourceKind } from '@lobechat/types';
import { merge } from '@lobechat/utils';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { AgentModel } from '@/database/models/agent';
import { ChatGroupModel } from '@/database/models/chatGroup';
import { FileModel } from '@/database/models/file';
import { SessionModel } from '@/database/models/session';
import { SourceSetModel } from '@/database/models/sourceSet';
import { SpaceModel } from '@/database/models/space';
import { UserModel } from '@/database/models/user';
import { insertAgentSchema } from '@/database/schemas';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import { AgentService } from '@/server/services/agent';
import { ContentAuthorizer } from '@/server/services/content';

/** Merge config but omit model/provider when source has none — lets client use its own default. */
function mergeConfigWithoutForcingModelProvider(
  base: typeof DEFAULT_AGENT_CONFIG,
  source: Record<string, unknown>,
): typeof DEFAULT_AGENT_CONFIG {
  const merged = merge({}, base, source) as typeof DEFAULT_AGENT_CONFIG;
  if (source.model === undefined && source.provider === undefined) {
    return { ...merged, model: '', provider: '' };
  }
  return merged;
}

const agentProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;

  return opts.next({
    ctx: {
      agentModel: new AgentModel(ctx.serverDB, ctx.userId),
      agentService: new AgentService(ctx.serverDB, ctx.userId),
      chatGroupModel: new ChatGroupModel(ctx.serverDB, ctx.userId),
      fileModel: new FileModel(ctx.serverDB, ctx.userId),
      sourceSetModel: new SourceSetModel(ctx.serverDB, ctx.userId),
      contentAuthorizer: new ContentAuthorizer(ctx.serverDB, ctx.userId),
      sessionModel: new SessionModel(ctx.serverDB, ctx.userId),
      spaceModel: new SpaceModel(ctx.serverDB, ctx.userId),
    },
  });
});

export const agentRouter = router({
  /**
   * Check if an agent with the given marketIdentifier already exists
   */
  checkByMarketIdentifier: agentProcedure
    .input(
      z.object({
        marketIdentifier: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      return ctx.agentModel.checkByMarketIdentifier(input.marketIdentifier);
    }),

  /**
   * Create a new agent with session
   * Returns the created agent ID and session ID
   */
  createAgent: agentProcedure
    .input(
      z.object({
        config: insertAgentSchema
          .omit({
            chatConfig: true,
            openingMessage: true,
            openingQuestions: true,
            tags: true,
            tts: true,
          })
          .passthrough()
          .partial()
          .optional(),
        groupId: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const session = await ctx.sessionModel.create({
        config: input.config as any,
        session: { groupId: input.groupId },
        type: 'agent',
      });

      // Get the agent ID from the created session
      const sessionWithAgent = await ctx.sessionModel.findByIdOrSlug(session.id);
      const agentId = sessionWithAgent?.agent?.id;

      return {
        agentId,
        sessionId: session.id,
      };
    }),

  createAgentFiles: agentProcedure
    .input(
      z.object({
        agentId: z.string(),
        enabled: z.boolean().optional(),
        fileIds: z.array(z.string()),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return ctx.agentModel.createAgentFiles(input.agentId, input.fileIds, input.enabled);
    }),

  attachSourceSetToAgent: agentProcedure
    .input(
      z.object({
        agentId: z.string(),
        enabled: z.boolean().optional(),
        sourceSetId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return ctx.agentModel.attachSourceSetToAgent(input.agentId, input.sourceSetId, input.enabled);
    }),

  /**
   * Create an agent without session.
   * Used for Group Agent Builder to create agents for groups.
   * Returns only the agent ID.
   */
  createAgentOnly: agentProcedure
    .input(
      z.object({
        config: z.object({}).passthrough().optional(),
        groupId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Create the agent entity only (no session)
      const agent = await ctx.agentModel.create(input.config ?? {});

      // Add the agent to the group
      await ctx.chatGroupModel.addAgentToGroup(input.groupId, agent.id);

      return { agentId: agent.id };
    }),

  deleteAgentFile: agentProcedure
    .input(
      z.object({
        agentId: z.string(),
        fileId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return ctx.agentModel.deleteAgentFile(input.agentId, input.fileId);
    }),

  detachSourceSetFromAgent: agentProcedure
    .input(
      z.object({
        agentId: z.string(),
        sourceSetId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return ctx.agentModel.detachSourceSetFromAgent(input.agentId, input.sourceSetId);
    }),

  /**
   * Duplicate an agent and its associated session.
   * Returns the new agent ID and session ID.
   */
  duplicateAgent: agentProcedure
    .input(
      z.object({
        agentId: z.string(),
        newTitle: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return ctx.agentModel.duplicate(input.agentId, input.newTitle);
    }),

  /**
   * Get an agent by forkedFromIdentifier stored in params
   * @returns agent id if exists, null otherwise
   */
  getAgentByForkedFromIdentifier: agentProcedure
    .input(
      z.object({
        forkedFromIdentifier: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      return ctx.agentModel.getAgentByForkedFromIdentifier(input.forkedFromIdentifier);
    }),

  /**
   * Get an agent by marketIdentifier
   * @returns agent id if exists, null otherwise
   */
  getAgentByMarketIdentifier: agentProcedure
    .input(
      z.object({
        marketIdentifier: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      return ctx.agentModel.getAgentByMarketIdentifier(input.marketIdentifier);
    }),

  getAgentConfig: agentProcedure
    .input(
      z.object({
        sessionId: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      if (input.sessionId === INBOX_SESSION_ID) {
        const user = await UserModel.findById(ctx.serverDB, ctx.userId);
        if (!user) return DEFAULT_AGENT_CONFIG;

        await ctx.agentService.createInbox();
      }

      // Group chat: sessionId is chat group id (cg_xxx), not in sessions table
      if (input.sessionId.startsWith('cg_')) {
        const group = await ctx.chatGroupModel.findById(input.sessionId);
        if (group) {
          const groupConfig = group.config as Record<string, unknown> | null | undefined;
          return mergeConfigWithoutForcingModelProvider(
            DEFAULT_AGENT_CONFIG,
            groupConfig ?? {},
          ) as typeof DEFAULT_AGENT_CONFIG;
        }
      }

      const session = await ctx.sessionModel.findByIdOrSlug(input.sessionId);

      if (!session) throw new Error(`Session [${input.sessionId}] not found`);
      const sessionId = session.id;

      const agentConfig = await ctx.agentModel.findBySessionId(sessionId);
      if (agentConfig) return agentConfig;

      throw new Error(`Session [${input.sessionId}] has no bound agent`);
    }),

  getAgentConfigById: agentProcedure
    .input(
      z.object({
        agentId: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      return ctx.agentService.getAgentConfigById(input.agentId);
    }),

  /**
   * Get a builtin agent by slug, creating it if it doesn't exist.
   * This is a generic interface for all builtin agents (page-copilot, inbox, etc.)
   */
  getBuiltinAgent: agentProcedure
    .input(
      z.object({
        slug: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      return ctx.agentService.getBuiltinAgent(input.slug);
    }),

  listAvailableSources: agentProcedure
    .input(
      z.object({
        agentId: z.string(),
        spaceId: z.string().nullish(),
      }),
    )
    .query(async ({ ctx, input }): Promise<AgentSourceItem[]> => {
      if (input.spaceId) {
        const space = await ctx.spaceModel.findAccessibleSpaceById(input.spaceId);
        if (!space?.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'SPACE_ACCESS_DENIED' });
        }
      }

      const sourceSets = await ctx.sourceSetModel.query(input.spaceId ?? undefined);
      const visibleSourceSetIds = new Set(
        await ctx.contentAuthorizer.filterVisibleSourceSetIdsForList(
          sourceSets.map((sourceSet) => sourceSet.id),
        ),
      );

      const files = await ctx.fileModel.query({
        spaceId: input.spaceId ?? undefined,
        showFilesInSourceSet: false,
      });
      const visibleFileIds = new Set(
        await ctx.contentAuthorizer.filterVisibleFileIdsForList(files.map((file) => file.id)),
      );

      const sources = await ctx.agentModel.getAgentAssignedSources(input.agentId);
      const enabledFileIds = new Set(
        sources.files.filter((item) => item.enabled).map((item) => item.id),
      );
      const enabledSourceSetIds = new Set(
        sources.sourceSets.filter((item) => item.enabled).map((item) => item.id),
      );

      return [
        ...files
          .filter((file) => visibleFileIds.has(file.id))
          // Filter out all images
          .filter((file) => !file.fileType.startsWith('image'))
          .map((file) => ({
            enabled: enabledFileIds.has(file.id),
            fileType: file.fileType,
            id: file.id,
            name: file.name,
            spaceId: file.spaceId,
            type: AgentSourceKind.File,
          })),
        ...sourceSets
          .filter((sourceSet) => visibleSourceSetIds.has(sourceSet.id))
          .map((sourceSet) => ({
            avatar: sourceSet.avatar,
            description: sourceSet.description,
            enabled: enabledSourceSetIds.has(sourceSet.id),
            id: sourceSet.id,
            name: sourceSet.name,
            spaceId: sourceSet.spaceId,
            type: AgentSourceKind.SourceSet,
          })),
      ];
    }),

  /**
   * Query non-virtual agents with optional keyword filter.
   * Returns agents with minimal info (id, title, description, avatar, backgroundColor).
   * Used by AddGroupMemberModal and group-management tool to search/select agents.
   */
  queryAgents: agentProcedure
    .input(
      z
        .object({
          keyword: z.string().optional(),
          limit: z.number().optional(),
          offset: z.number().optional(),
        })
        .optional(),
    )
    .query(async ({ input, ctx }) => {
      return ctx.agentModel.queryAgents(input);
    }),

  /**
   * Remove an agent and its associated session
   */
  removeAgent: agentProcedure
    .input(z.object({ agentId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return ctx.agentModel.delete(input.agentId);
    }),

  toggleFile: agentProcedure
    .input(
      z.object({
        agentId: z.string(),
        enabled: z.boolean().optional(),
        fileId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return ctx.agentModel.toggleFile(input.agentId, input.fileId, input.enabled);
    }),

  setSourceSetEnabled: agentProcedure
    .input(
      z.object({
        agentId: z.string(),
        enabled: z.boolean().optional(),
        sourceSetId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return ctx.agentModel.setSourceSetEnabled(input.agentId, input.sourceSetId, input.enabled);
    }),

  updateAgentConfig: agentProcedure
    .input(
      z.object({
        agentId: z.string(),
        value: z.object({}).passthrough().partial(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Use AgentService to update and return the updated agent data
      return ctx.agentService.updateAgentConfig(input.agentId, input.value);
    }),

  /**
   * Pin or unpin an agent
   */
  updateAgentPinned: agentProcedure
    .input(
      z.object({
        id: z.string(),
        pinned: z.boolean(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return ctx.agentModel.update(input.id, { pinned: input.pinned });
    }),
});
