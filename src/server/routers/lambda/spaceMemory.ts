import { spaceMemorySections, type SpaceRole } from '@lobechat/types';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { ContentModel } from '@/database/models/content';
import { SpaceModel } from '@/database/models/space';
import { SpaceMemoryModel } from '@/database/models/spaceMemory';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';

const SPACE_MEMORY_CREATE_ROLES = new Set<SpaceRole>(['admin', 'editor', 'owner']);
const SPACE_MEMORY_REVIEW_ROLES = new Set<SpaceRole>(['admin', 'editor', 'owner']);
const spaceMemorySectionSchema = z.enum(spaceMemorySections);

const spaceMemoryProcedure = authedProcedure.use(serverDatabase).use(async ({ ctx, next }) => {
  return next({
    ctx: {
      contentModel: new ContentModel(ctx.serverDB, ctx.userId),
      spaceMemoryModel: new SpaceMemoryModel(ctx.serverDB, ctx.userId),
      spaceModel: new SpaceModel(ctx.serverDB, ctx.userId),
    },
  });
});

const requireAccessibleSpace = async (
  ctx: {
    spaceModel: SpaceModel;
  },
  spaceId: string,
) => {
  const space = await ctx.spaceModel.findAccessibleSpaceById(spaceId);
  if (!space?.id) throw new TRPCError({ code: 'NOT_FOUND', message: 'SPACE_NOT_FOUND' });

  return space;
};

const getSpaceMemoryCapabilities = (space: {
  kind?: string | null;
  membershipRole?: string | null;
}) => {
  const membershipRole = space.membershipRole as SpaceRole;
  const isTeamSpace = space.kind === 'team';

  return {
    canCreate: isTeamSpace && SPACE_MEMORY_CREATE_ROLES.has(membershipRole),
    canReview: isTeamSpace && SPACE_MEMORY_REVIEW_ROLES.has(membershipRole),
  };
};

export const spaceMemoryRouter = router({
  createCandidate: spaceMemoryProcedure
    .input(
      z.object({
        category: z.enum(['general', 'playbook', 'policy']).optional(),
        content: z.string().nullable().optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
        sourceRefs: z
          .array(
            z.object({
              id: z.string(),
              kind: z.enum(['document', 'file', 'message', 'source_set', 'topic']),
              title: z.string().optional(),
            }),
          )
          .optional(),
        spaceId: z.string(),
        summary: z.string().nullable().optional(),
        title: z.string().trim().min(1).max(255),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const space = await requireAccessibleSpace(ctx, input.spaceId);
      const { canCreate } = getSpaceMemoryCapabilities(space);

      if (!canCreate) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'SPACE_MEMORY_CREATE_DENIED' });
      }

      const created = await ctx.spaceMemoryModel.createCandidate({
        ...input,
        createdBy: ctx.userId,
      });

      await ctx.contentModel.createAuditLog({
        action: 'space.memory.candidate.create',
        metadata: {
          category: created.category ?? input.category ?? 'general',
          entryId: created.id,
          status: created.status,
          title: created.title,
        },
        spaceId: input.spaceId,
      });

      return created;
    }),

  getSummary: spaceMemoryProcedure
    .input(z.object({ spaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const space = await requireAccessibleSpace(ctx, input.spaceId);
      const { canCreate, canReview } = getSpaceMemoryCapabilities(space);

      return ctx.spaceMemoryModel.getSummary({
        canCreate,
        canPublish: canReview,
        canReview,
        id: space.id,
        kind: space.kind,
        membershipRole: space.membershipRole,
        name: space.name,
      });
    }),

  listEntries: spaceMemoryProcedure
    .input(
      z.object({
        section: spaceMemorySectionSchema,
        spaceId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const space = await requireAccessibleSpace(ctx, input.spaceId);
      const { canReview } = getSpaceMemoryCapabilities(space);

      if (input.section === 'inbox' && !canReview) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'SPACE_MEMORY_REVIEW_DENIED' });
      }

      return ctx.spaceMemoryModel.listEntries(input);
    }),

  publishEntry: spaceMemoryProcedure
    .input(
      z.object({
        id: z.string(),
        spaceId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const space = await requireAccessibleSpace(ctx, input.spaceId);
      const { canReview } = getSpaceMemoryCapabilities(space);

      if (!canReview) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'SPACE_MEMORY_REVIEW_DENIED' });
      }

      const published = await ctx.spaceMemoryModel.publishEntry({
        id: input.id,
        reviewedBy: ctx.userId,
        spaceId: input.spaceId,
      });

      if (!published) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'SPACE_MEMORY_ENTRY_NOT_FOUND' });
      }

      await ctx.contentModel.createAuditLog({
        action: 'space.memory.publish',
        metadata: {
          entryId: input.id,
          reviewedBy: ctx.userId,
          status: published?.status,
        },
        spaceId: input.spaceId,
      });

      return published;
    }),
});

export type SpaceMemoryRouter = typeof spaceMemoryRouter;
