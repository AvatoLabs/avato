import {
  AsyncTaskError,
  AsyncTaskErrorType,
  AsyncTaskStatus,
  AsyncTaskType,
  CreateUserMemoryIdentitySchema,
  MemorySourceType,
  UpdateUserMemoryIdentitySchema,
  type UserMemoryExtractionMetadata,
} from '@lobechat/types';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { AsyncTaskModel, initUserMemoryExtractionMetadata } from '@/database/models/asyncTask';
import { TopicModel } from '@/database/models/topic';
import {
  UserMemoryActivityModel,
  UserMemoryContextModel,
  UserMemoryExperienceModel,
  UserMemoryIdentityModel,
  UserMemoryModel,
  UserMemoryPreferenceModel,
} from '@/database/models/userMemory';
import { UserPersonaModel } from '@/database/models/userMemory/persona';
import { appEnv } from '@/envs/app';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import { parseMemoryExtractionConfig } from '@/server/globalConfig/parseMemoryExtractionConfig';
import {
  buildMemoryExtractionPayloadInput,
  MemoryExtractionTriggerService,
  normalizeMemoryExtractionPayload,
} from '@/server/services/memory/userMemory/extract';

const userMemoryProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;

  return opts.next({
    ctx: {
      activityModel: new UserMemoryActivityModel(ctx.serverDB, ctx.userId),
      asyncTaskModel: new AsyncTaskModel(ctx.serverDB, ctx.userId),
      contextModel: new UserMemoryContextModel(ctx.serverDB, ctx.userId),
      experienceModel: new UserMemoryExperienceModel(ctx.serverDB, ctx.userId),
      identityModel: new UserMemoryIdentityModel(ctx.serverDB, ctx.userId),
      personaModel: new UserPersonaModel(ctx.serverDB, ctx.userId),
      preferenceModel: new UserMemoryPreferenceModel(ctx.serverDB, ctx.userId),
      topicModel: new TopicModel(ctx.serverDB, ctx.userId),
      userMemoryModel: new UserMemoryModel(ctx.serverDB, ctx.userId),
    },
  });
});

const userMemoryExtractionInputSchema = z.object({
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
});

const userMemoryExtractionTaskInputSchema = z
  .object({
    taskId: z.string().uuid().optional(),
  })
  .optional();

// NOTICE(@nekomeowww): Memory extraction time scales with topic count. We estimate
// an average of ~5 minutes per topic to derive a dynamic timeout budget.
const USER_MEMORY_EXTRACTION_TIMEOUT_PER_TOPIC_MS = 5 * 60 * 1000;

const getUserMemoryExtractionTimeoutMs = (metadata: UserMemoryExtractionMetadata) => {
  const totalTopics = metadata.progress.totalTopics;

  if (!Number.isFinite(totalTopics) || !totalTopics || totalTopics <= 0) return null;

  return totalTopics * USER_MEMORY_EXTRACTION_TIMEOUT_PER_TOPIC_MS;
};

const getUserMemoryExtractionLastActiveAtMs = (task: {
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
}) => {
  const createdAtMs = task.createdAt ? new Date(task.createdAt).getTime() : Number.NaN;
  const updatedAtMs = task.updatedAt ? new Date(task.updatedAt).getTime() : Number.NaN;

  if (Number.isFinite(updatedAtMs)) {
    return Number.isFinite(createdAtMs) ? Math.max(createdAtMs, updatedAtMs) : updatedAtMs;
  }

  return createdAtMs;
};

export const userMemoryRouter = router({
  // ============ Identity CRUD ============
  createIdentity: userMemoryProcedure
    .input(CreateUserMemoryIdentitySchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.userMemoryModel.addIdentityEntry({
        base: {
          summary: input.summary,
          title: input.title,
        },
        identity: {
          description: input.description,
          episodicDate: input.episodicDate,
          relationship: input.relationship,
          role: input.role,
          tags: input.extractedLabels,
          type: input.type,
        },
      });
    }),

  // ============ Activity CRUD ============
  deleteActivity: userMemoryProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.activityModel.delete(input.id);
    }),

  // ============ Context CRUD ============
  deleteContext: userMemoryProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.contextModel.delete(input.id);
    }),

  // ============ Experience CRUD ============
  deleteExperience: userMemoryProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.experienceModel.delete(input.id);
    }),

  deleteIdentity: userMemoryProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.userMemoryModel.removeIdentityEntry(input.id);
    }),

  // ============ Preference CRUD ============
  deletePreference: userMemoryProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.preferenceModel.delete(input.id);
    }),

  getActivities: userMemoryProcedure.query(async ({ ctx }) => {
    return ctx.userMemoryModel.searchActivities({});
  }),

  getContexts: userMemoryProcedure.query(async ({ ctx }) => {
    return ctx.userMemoryModel.searchContexts({});
  }),

  getExperiences: userMemoryProcedure.query(async ({ ctx }) => {
    return ctx.userMemoryModel.searchExperiences({});
  }),

  getIdentities: userMemoryProcedure.query(async ({ ctx }) => {
    const rows = await ctx.userMemoryModel.getAllIdentitiesWithMemory();

    return rows.map(({ identity, memory }) => ({
      capturedAt: identity.capturedAt ?? memory.capturedAt,
      createdAt: identity.createdAt ?? memory.createdAt,
      description: identity.description,
      episodicDate: identity.episodicDate,
      id: identity.id,
      memoryCategory: memory.memoryCategory,
      memoryLayer: memory.memoryLayer,
      memoryType: memory.memoryType,
      relationship: identity.relationship,
      role: identity.role,
      status: memory.status,
      summary: memory.summary ?? identity.description,
      tags: identity.tags ?? memory.tags,
      title: memory.title,
      type: identity.type,
      updatedAt: identity.updatedAt ?? memory.updatedAt,
      userId: identity.userId ?? memory.userId,
      userMemoryId: identity.userMemoryId,
    }));
  }),

  getMemoryExtractionTask: userMemoryProcedure
    .input(userMemoryExtractionTaskInputSchema)
    .query(async ({ ctx, input }) => {
      const task = input?.taskId
        ? await ctx.asyncTaskModel.findById(input.taskId)
        : await ctx.asyncTaskModel.findActiveByType(
            AsyncTaskType.UserMemoryExtractionWithChatTopic,
          );

      if (!task || task.userId !== ctx.userId) return null;

      const metadata = initUserMemoryExtractionMetadata(
        task.metadata as UserMemoryExtractionMetadata | undefined,
      );

      const timeoutMs = getUserMemoryExtractionTimeoutMs(metadata);
      const taskLastActiveAt = getUserMemoryExtractionLastActiveAtMs(task);
      const isActiveTask =
        task.status === AsyncTaskStatus.Pending || task.status === AsyncTaskStatus.Processing;

      if (
        isActiveTask &&
        timeoutMs !== null &&
        Number.isFinite(taskLastActiveAt) &&
        Date.now() - taskLastActiveAt > timeoutMs
      ) {
        const timeoutMinutes = Math.ceil(timeoutMs / (60 * 1000));
        const timeoutError = new AsyncTaskError(
          AsyncTaskErrorType.Timeout,
          `User memory extraction timed out after ${timeoutMinutes} minutes for ${metadata.progress.totalTopics} topics (estimated at 5 minutes per topic). Please retry.`,
        );

        await ctx.asyncTaskModel.update(task.id, {
          error: timeoutError,
          status: AsyncTaskStatus.Error,
        });

        return {
          error: timeoutError,
          id: task.id,
          metadata,
          status: AsyncTaskStatus.Error,
        };
      }

      return {
        error: task.error,
        id: task.id,
        metadata,
        status: task.status as AsyncTaskStatus,
      };
    }),

  // ============ Persona ============
  getPersona: userMemoryProcedure.query(async ({ ctx }) => {
    const latest = await ctx.personaModel.getLatestPersonaDocument();

    if (!latest) return null;

    return {
      content: latest.persona ?? '',
      summary: latest.tagline ?? '',
    };
  }),

  getPreferences: userMemoryProcedure.query(async ({ ctx }) => {
    return ctx.userMemoryModel.searchPreferences({});
  }),

  requestMemoryFromChatTopic: userMemoryProcedure
    .input(userMemoryExtractionInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.fromDate && input.toDate && input.fromDate > input.toDate) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '`fromDate` cannot be later than `toDate`',
        });
      }

      const existingTask = await ctx.asyncTaskModel.findActiveByType(
        AsyncTaskType.UserMemoryExtractionWithChatTopic,
      );
      if (existingTask) {
        return {
          deduped: true,
          id: existingTask.id,
          metadata: existingTask.metadata as UserMemoryExtractionMetadata,
          status: existingTask.status as AsyncTaskStatus,
        };
      }

      const totalTopics = await ctx.topicModel.countTopicsForMemoryExtractor({
        endDate: input.toDate,
        ignoreExtracted: false,
        startDate: input.fromDate,
      });
      const metadata = initUserMemoryExtractionMetadata({
        progress: {
          completedTopics: 0,
          totalTopics,
        },
        range: {
          from: input.fromDate?.toISOString(),
          to: input.toDate?.toISOString(),
        },
        source: 'chat_topic',
      });

      const { webhook } = parseMemoryExtractionConfig();
      const baseUrl = webhook.baseUrl || appEnv.INTERNAL_APP_URL || appEnv.APP_URL;

      if (totalTopics > 0 && !baseUrl) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message:
            'Memory extraction requires APP_URL or MEMORY_USER_MEMORY_WEBHOOK_BASE_URL to be configured',
        });
      }

      const initialStatus = totalTopics === 0 ? AsyncTaskStatus.Success : AsyncTaskStatus.Pending;
      const taskId = await ctx.asyncTaskModel.create({
        metadata,
        status: initialStatus,
        type: AsyncTaskType.UserMemoryExtractionWithChatTopic,
      });

      if (totalTopics === 0) {
        return {
          deduped: false,
          id: taskId,
          metadata: metadata as UserMemoryExtractionMetadata,
          status: initialStatus as AsyncTaskStatus,
        };
      }

      const { triggerExtraHeaders } = parseMemoryExtractionConfig();

      try {
        await MemoryExtractionTriggerService.triggerProcessUsers(
          buildMemoryExtractionPayloadInput(
            normalizeMemoryExtractionPayload({
              asyncTaskId: taskId,
              baseUrl,
              forceAll: false,
              forceTopics: false,
              fromDate: input.fromDate,
              sources: [MemorySourceType.ChatTopic],
              toDate: input.toDate,
              userIds: [ctx.userId],
              userInitiated: true,
            }),
          ),
          { extraHeaders: triggerExtraHeaders },
        );
      } catch (error) {
        const causeMessage = error instanceof Error ? error.message : String(error);
        await ctx.asyncTaskModel.update(taskId, {
          error: new AsyncTaskError(
            AsyncTaskErrorType.TaskTriggerError,
            'Failed to schedule memory extraction task',
          ),
          status: AsyncTaskStatus.Error,
        });
        throw new TRPCError({
          cause: error,
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to trigger user memory extraction: ${causeMessage}`,
        });
      }

      return {
        deduped: false,
        id: taskId,
        metadata: metadata as UserMemoryExtractionMetadata,
        status: AsyncTaskStatus.Pending,
      };
    }),

  updateActivity: userMemoryProcedure
    .input(
      z.object({
        data: z.object({
          narrative: z.string().optional(),
          notes: z.string().optional(),
          status: z.string().optional(),
        }),
        id: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.activityModel.update(input.id, input.data);
    }),

  updateContext: userMemoryProcedure
    .input(
      z.object({
        data: z.object({
          currentStatus: z.string().optional(),
          description: z.string().optional(),
          title: z.string().optional(),
        }),
        id: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.contextModel.update(input.id, input.data);
    }),

  updateExperience: userMemoryProcedure
    .input(
      z.object({
        data: z.object({
          action: z.string().optional(),
          keyLearning: z.string().optional(),
          reasoning: z.string().optional(),
          situation: z.string().optional(),
        }),
        id: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.experienceModel.update(input.id, input.data);
    }),

  updateIdentity: userMemoryProcedure
    .input(
      z.object({
        data: UpdateUserMemoryIdentitySchema,
        id: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const base =
        input.data.summary !== undefined || input.data.title !== undefined
          ? {
              summary: input.data.summary,
              title: input.data.title,
            }
          : undefined;

      return ctx.userMemoryModel.updateIdentityEntry({
        base,
        identity: {
          description: input.data.description,
          episodicDate: input.data.episodicDate,
          relationship: input.data.relationship,
          role: input.data.role,
          tags: input.data.extractedLabels,
          type: input.data.type,
        },
        identityId: input.id,
      });
    }),

  updatePreference: userMemoryProcedure
    .input(
      z.object({
        data: z.object({
          conclusionDirectives: z.string().optional(),
          suggestions: z.string().optional(),
        }),
        id: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.preferenceModel.update(input.id, input.data);
    }),
});

export type UserMemoryRouter = typeof userMemoryRouter;
