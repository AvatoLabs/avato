import { type AgentSourceItem, AgentSourceKind } from '@lobechat/types';
import debug from 'debug';
import { z } from 'zod';

import { ChatGroupModel } from '@/database/models/chatGroup';
import { FileModel } from '@/database/models/file';
import { MessageModel } from '@/database/models/message';
import { SessionModel } from '@/database/models/session';
import { SessionGroupModel } from '@/database/models/sessionGroup';
import { AgentMigrationRepo } from '@/database/repositories/agentMigration';
import { insertAgentSchema, insertSessionSchema } from '@/database/schemas';
import { type LobeChatDatabase } from '@/database/type';
import { authedProcedure, publicProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import { SystemAgentService } from '@/server/services/systemAgent';
import { AgentChatConfigSchema } from '@/types/agent';
import { LobeMetaDataSchema } from '@/types/meta';
import { type BatchTaskResult } from '@/types/service';
import { type ChatSessionList, type LobeGroupSession } from '@/types/session';

import { resolveContext } from './_helpers/resolveContext';
import { pickLatestTitleContext } from './_helpers/titleContext';
import { conversationContextSchema } from './_schema/context';

const DEFAULT_SESSION_TITLES = [
  '',
  'New Chat',
  'New Conversation',
  'New conversation',
  'New Group Chat',
  '新对话',
  '新對話',
  'Untitled',
];

function isDefaultSessionTitle(title: string | null | undefined) {
  const trimmedTitle = title?.trim() ?? '';

  return !trimmedTitle || DEFAULT_SESSION_TITLES.includes(trimmedTitle);
}

const resolveConversationFileSessionId = async (
  input: z.infer<typeof conversationContextSchema>,
  serverDB: LobeChatDatabase,
  userId: string,
) => {
  if (input.groupId) return input.groupId;

  const { sessionId } = await resolveContext(input, serverDB, userId);
  return sessionId;
};

const sessionProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;

  return opts.next({
    ctx: {
      fileModel: new FileModel(ctx.serverDB, ctx.userId),
      sessionGroupModel: new SessionGroupModel(ctx.serverDB, ctx.userId),
      sessionModel: new SessionModel(ctx.serverDB, ctx.userId),
    },
  });
});

export const sessionRouter = router({
  batchCreateSessions: sessionProcedure
    .input(
      z.array(
        z
          .object({
            config: z.object({}).passthrough(),
            group: z.string().optional(),
            id: z.string(),
            meta: LobeMetaDataSchema,
            pinned: z.boolean().optional(),
            type: z.string(),
          })
          .partial(),
      ),
    )
    .mutation(async ({ input, ctx }): Promise<BatchTaskResult> => {
      const data = await ctx.sessionModel.batchCreate(
        input.map((item) => ({
          ...item,
          ...item.meta,
        })) as any,
      );

      return { added: data.rowCount as number, ids: [], skips: [], success: true };
    }),

  cloneSession: sessionProcedure
    .input(z.object({ id: z.string(), newTitle: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const data = await ctx.sessionModel.duplicate(input.id, input.newTitle);

      return data?.id;
    }),

  countSessions: sessionProcedure
    .input(
      z
        .object({
          endDate: z.string().optional(),
          range: z.tuple([z.string(), z.string()]).optional(),
          startDate: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      return ctx.sessionModel.count(input);
    }),

  createSession: sessionProcedure
    .input(
      z.object({
        config: insertAgentSchema
          .omit({
            chatConfig: true,
            openingMessage: true,
            openingQuestions: true,
            plugins: true,
            tags: true,
            tts: true,
          })
          .passthrough()
          .partial(),
        session: insertSessionSchema.omit({ createdAt: true, updatedAt: true }).partial(),
        slug: z.string().optional(),
        type: z.enum(['agent', 'group']),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const data = await ctx.sessionModel.create(input as any);

      return data.id;
    }),

  getGroupedSessions: publicProcedure
    .use(serverDatabase)
    .query(async ({ ctx }): Promise<ChatSessionList> => {
      const userId = ctx.userId;
      if (!userId) return { sessionGroups: [], sessions: [] };

      const sessionModel = new SessionModel(ctx.serverDB, userId);
      const chatGroupModel = new ChatGroupModel(ctx.serverDB, userId);
      const agentMigrationRepo = new AgentMigrationRepo(ctx.serverDB, userId);
      const chatGroupsPromise = chatGroupModel.queryWithMemberDetails();

      let { sessions, sessionGroups } = await sessionModel.queryWithGroups();

      const orphanAgentSessionIds = sessions
        .filter(
          (session) =>
            session.type === 'agent' && !(session as { config?: { id?: string } }).config?.id,
        )
        .map((session) => session.id);

      if (orphanAgentSessionIds.length > 0) {
        const migrated =
          await agentMigrationRepo.migrateSessionOnlyAgentBindings(orphanAgentSessionIds);
        if (migrated > 0) {
          const refreshed = await sessionModel.queryWithGroups();
          sessions = refreshed.sessions;
          sessionGroups = refreshed.sessionGroups;
        }
      }

      const chatGroups = await chatGroupsPromise;

      const groupSessions: LobeGroupSession[] = chatGroups.map((group) => {
        const { title, description, avatar, backgroundColor, groupId, ...rest } = group;
        return {
          ...rest,
          group: groupId, // Map groupId to group for consistent API
          meta: { avatar, backgroundColor, description, title },
          type: 'group',
        };
      });

      const allSessions = [...sessions, ...groupSessions].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );

      return { sessionGroups, sessions: allSessions };
    }),

  getConversationFileContents: sessionProcedure
    .input(conversationContextSchema)
    .query(async ({ ctx, input }) => {
      const sessionId = await resolveConversationFileSessionId(input, ctx.serverDB, ctx.userId);

      if (!sessionId) return [];

      return ctx.fileModel.getSessionAssignedFileContents(sessionId);
    }),

  getConversationFiles: sessionProcedure
    .input(conversationContextSchema)
    .query(async ({ ctx, input }): Promise<AgentSourceItem[]> => {
      const sessionId = await resolveConversationFileSessionId(input, ctx.serverDB, ctx.userId);

      if (!sessionId) return [];

      const [allFiles, assignedFiles] = await Promise.all([
        ctx.fileModel.getConversationAvailableFiles(),
        ctx.fileModel.getSessionAssignedFiles(sessionId),
      ]);

      const attachedFileIds = new Set(assignedFiles.map((file) => file.id));

      return allFiles
        .filter((file) => !file.fileType.startsWith('image'))
        .map((file) => ({
          enabled: attachedFileIds.has(file.id),
          fileType: file.fileType,
          id: file.id,
          name: file.name,
          type: AgentSourceKind.File,
        }))
        .sort(
          (a, b) =>
            Number(Boolean(b.enabled)) - Number(Boolean(a.enabled)) || a.name.localeCompare(b.name),
        );
    }),

  generateSessionTitle: sessionProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const log = debug('lobe:session:generateSessionTitle');
      const { sessionId } = input;
      const session = await ctx.sessionModel.findByIdOrSlug(sessionId);
      const messageModel = new MessageModel(ctx.serverDB, ctx.userId);
      const systemAgent = new SystemAgentService(ctx.serverDB, ctx.userId);

      if (!session) {
        if (!sessionId.startsWith('cg_')) {
          log('session not found, not a group id, return null');
          return null;
        }

        const chatGroupModel = new ChatGroupModel(ctx.serverDB, ctx.userId);
        const group = await chatGroupModel.findById(sessionId);
        if (!group) {
          log('group not found for cg_ id, return null');
          return null;
        }

        if (!isDefaultSessionTitle(group.title)) {
          log('group already has custom title, return as-is:', group.title);
          return group.title;
        }

        const messages = await messageModel.query({ groupId: sessionId });
        const titleContext = pickLatestTitleContext(messages);
        if (!titleContext) {
          log('no titleContext (no user+assistant pair) for group, return null');
          return null;
        }

        const title = await systemAgent.generateTopicTitle(titleContext);
        if (!title) {
          log('LLM returned empty title for group');
          return null;
        }

        await chatGroupModel.update(sessionId, { title });
        log('group title updated:', title);
        return title;
      }

      const effectiveTitle = (session as any).title ?? (session as any).agent?.title ?? '';
      if (!isDefaultSessionTitle(effectiveTitle)) {
        log('session already has custom title, return as-is:', effectiveTitle);
        return effectiveTitle;
      }

      const messages = await messageModel.queryBySessionId(sessionId);
      const titleContext = pickLatestTitleContext(messages);
      if (!titleContext) {
        log('no titleContext (no user+assistant pair) for session, return null');
        return null;
      }

      const title = await systemAgent.generateTopicTitle(titleContext);
      if (!title) {
        log('LLM returned empty title for session');
        return null;
      }

      const sess = session as { type?: string; agent?: unknown };
      if (sess.type === 'group') {
        await ctx.sessionModel.update(sessionId, { title });
      } else {
        if (!sess.agent) {
          await new AgentMigrationRepo(ctx.serverDB, ctx.userId).migrateSessionOnlyAgentBindings([
            sessionId,
          ]);
        }
        await ctx.sessionModel.updateConfig(sessionId, { title });
      }
      log('session title updated:', title);
      return title;
    }),

  getSessions: sessionProcedure
    .input(
      z.object({
        current: z.number().optional(),
        pageSize: z.number().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { current, pageSize } = input;

      return ctx.sessionModel.query({ current, pageSize });
    }),

  createConversationFiles: sessionProcedure
    .input(
      conversationContextSchema.extend({
        fileIds: z.array(z.string()),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const sessionId = await resolveConversationFileSessionId(input, ctx.serverDB, ctx.userId);

      if (!sessionId) return;

      return ctx.fileModel.createSessionFiles(sessionId, input.fileIds);
    }),

  deleteConversationFile: sessionProcedure
    .input(
      conversationContextSchema.extend({
        fileId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const sessionId = await resolveConversationFileSessionId(input, ctx.serverDB, ctx.userId);

      if (!sessionId) return;

      return ctx.fileModel.deleteSessionFile(sessionId, input.fileId);
    }),

  toggleConversationFile: sessionProcedure
    .input(
      conversationContextSchema.extend({
        enabled: z.boolean().optional(),
        fileId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const sessionId = await resolveConversationFileSessionId(input, ctx.serverDB, ctx.userId);

      if (!sessionId) return;

      return ctx.fileModel.toggleSessionFile(sessionId, input.fileId, input.enabled);
    }),

  rankSessions: sessionProcedure.input(z.number().optional()).query(async ({ ctx, input }) => {
    return ctx.sessionModel.rank(input);
  }),

  removeAllSessions: sessionProcedure.mutation(async ({ ctx }) => {
    return ctx.sessionModel.deleteAll();
  }),

  removeSession: sessionProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return ctx.sessionModel.delete(input.id);
    }),

  searchSessions: sessionProcedure
    .input(z.object({ keywords: z.string() }))
    .query(async ({ input, ctx }) => {
      return ctx.sessionModel.queryByKeyword(input.keywords);
    }),

  updateSession: sessionProcedure
    .input(
      z.object({
        id: z.string(),
        value: insertSessionSchema.partial(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return ctx.sessionModel.update(input.id, input.value as any);
    }),
  updateSessionChatConfig: sessionProcedure
    .input(
      z.object({
        id: z.string(),
        value: AgentChatConfigSchema.partial(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await new AgentMigrationRepo(ctx.serverDB, ctx.userId).migrateSessionOnlyAgentBindings([
        input.id,
      ]);
      return ctx.sessionModel.updateConfig(input.id, {
        chatConfig: input.value,
      });
    }),
  updateSessionConfig: sessionProcedure
    .input(
      z.object({
        id: z.string(),
        value: z.object({}).passthrough().partial(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await new AgentMigrationRepo(ctx.serverDB, ctx.userId).migrateSessionOnlyAgentBindings([
        input.id,
      ]);
      return ctx.sessionModel.updateConfig(input.id, input.value);
    }),
});

export type SessionRouter = typeof sessionRouter;
