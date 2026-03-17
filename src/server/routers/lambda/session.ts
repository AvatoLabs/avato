import { z } from 'zod';

import { ChatGroupModel } from '@/database/models/chatGroup';
import { MessageModel } from '@/database/models/message';
import { SessionModel } from '@/database/models/session';
import { SessionGroupModel } from '@/database/models/sessionGroup';
import { insertAgentSchema, insertSessionSchema } from '@/database/schemas';
import { authedProcedure, publicProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import { SystemAgentService } from '@/server/services/systemAgent';
import { AgentChatConfigSchema } from '@/types/agent';
import { LobeMetaDataSchema } from '@/types/meta';
import { type BatchTaskResult } from '@/types/service';
import { type ChatSessionList, type LobeGroupSession } from '@/types/session';

const DEFAULT_SESSION_TITLES = [
  '',
  'New Chat',
  'New Conversation',
  'New conversation',
  '新对话',
  '新對話',
  'Untitled',
];

function extractMessageText(content: string | null | undefined): string {
  if (!content || typeof content !== 'string') return '';
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return parsed
        .map((p: { text?: string; content?: string }) => p?.text ?? p?.content ?? '')
        .filter(Boolean)
        .join(' ')
        .trim();
    }
  } catch {
    // Plain text
  }
  return content.trim();
}

function isDefaultSessionTitle(title: string | null | undefined) {
  const trimmedTitle = title?.trim() ?? '';

  return !trimmedTitle || DEFAULT_SESSION_TITLES.includes(trimmedTitle);
}

function pickLatestSessionTitleContext(
  messages: Awaited<ReturnType<MessageModel['queryBySessionId']>>,
): { lastAssistantContent: string; userPrompt: string } | null {
  for (let assistantIndex = messages.length - 1; assistantIndex >= 0; assistantIndex -= 1) {
    const assistantMessage = messages[assistantIndex];
    if (assistantMessage.role !== 'assistant') continue;

    const lastAssistantContent = extractMessageText(assistantMessage.content);
    if (!lastAssistantContent) continue;

    for (let userIndex = assistantIndex - 1; userIndex >= 0; userIndex -= 1) {
      const userMessage = messages[userIndex];
      if (userMessage.role !== 'user') continue;

      const userPrompt = extractMessageText(userMessage.content);
      if (!userPrompt) continue;

      return { lastAssistantContent, userPrompt };
    }
  }

  return null;
}

const sessionProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;

  return opts.next({
    ctx: {
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
        /**
         * When true, creates a session-only chat (virtual agent).
         * Virtual agents are excluded from the sidebar "assistants" list.
         * Use for "new conversation" flows; use agent.createAgent for creating assistants.
         */
        sessionOnly: z.boolean().optional(),
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

      const [{ sessions, sessionGroups }, chatGroups] = await Promise.all([
        sessionModel.queryWithGroups(),
        chatGroupModel.queryWithMemberDetails(),
      ]);

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

  generateSessionTitle: sessionProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { sessionId } = input;
      const session = await ctx.sessionModel.findByIdOrSlug(sessionId);
      if (!session) return null;

      const effectiveTitle = (session as any).title ?? (session as any).agent?.title ?? '';
      if (!isDefaultSessionTitle(effectiveTitle)) {
        return effectiveTitle;
      }

      const messageModel = new MessageModel(ctx.serverDB, ctx.userId);
      const messages = await messageModel.queryBySessionId(sessionId);
      const titleContext = pickLatestSessionTitleContext(messages);
      if (!titleContext) return null;

      const systemAgent = new SystemAgentService(ctx.serverDB, ctx.userId);
      const title = await systemAgent.generateTopicTitle(titleContext);
      if (!title) return null;

      const sess = session as { type?: string; agent?: unknown };
      if (sess.type === 'group') {
        await ctx.sessionModel.update(sessionId, { title });
      } else {
        await ctx.sessionModel.updateConfig(sessionId, { title });
      }
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
      return ctx.sessionModel.updateConfig(input.id, input.value);
    }),
});

export type SessionRouter = typeof sessionRouter;
