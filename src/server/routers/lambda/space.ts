import type { SpaceRole } from '@lobechat/types';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { ResourceModel } from '@/database/models/resource';
import { SpaceModel } from '@/database/models/space';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';

const MANAGEABLE_ROLES = new Set<SpaceRole>(['admin', 'owner']);

const spaceProcedure = authedProcedure.use(serverDatabase).use(async ({ ctx, next }) => {
  return next({
    ctx: {
      resourceModel: new ResourceModel(ctx.serverDB, ctx.userId),
      spaceModel: new SpaceModel(ctx.serverDB, ctx.userId),
    },
  });
});

const assertManageRole = async (
  ctx: {
    spaceModel: SpaceModel;
  },
  spaceId: string,
) => {
  const space = await ctx.spaceModel.findAccessibleSpaceById(spaceId);
  if (!space?.id) throw new TRPCError({ code: 'NOT_FOUND', message: 'SPACE_NOT_FOUND' });
  if (!MANAGEABLE_ROLES.has(space.membershipRole as SpaceRole)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'SPACE_MANAGE_DENIED' });
  }

  return space;
};

const assertOwnerRole = async (
  ctx: {
    spaceModel: SpaceModel;
  },
  spaceId: string,
) => {
  const space = await ctx.spaceModel.findAccessibleSpaceById(spaceId);
  if (!space?.id) throw new TRPCError({ code: 'NOT_FOUND', message: 'SPACE_NOT_FOUND' });
  if (space.membershipRole !== 'owner') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'SPACE_OWNER_REQUIRED' });
  }

  return space;
};

export const spaceRouter = router({
  addSpaceMemberByUsername: spaceProcedure
    .input(
      z.object({
        role: z.enum(['owner', 'admin', 'editor', 'viewer']).exclude(['owner']),
        spaceId: z.string(),
        username: z.string().trim().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertManageRole(ctx, input.spaceId);
      const user = await ctx.spaceModel.addMemberByUsername(
        input.spaceId,
        input.username,
        input.role,
      );

      await ctx.resourceModel.createAuditLog({
        action: 'space.member.add',
        metadata: { role: input.role, targetUserId: user.id, username: input.username },
        spaceId: input.spaceId,
      });

      return user;
    }),

  createTeamSpace: spaceProcedure
    .input(
      z.object({
        description: z.string().optional(),
        name: z.string().trim().min(1).max(120),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const space = await ctx.spaceModel.createTeamSpace(input);

      await ctx.resourceModel.createAuditLog({
        action: 'space.create',
        metadata: { kind: 'team', name: input.name },
        spaceId: space.id,
      });

      return space;
    }),

  deleteSpace: spaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertOwnerRole(ctx, input.id);
      await ctx.spaceModel.deleteSpace(input.id);

      await ctx.resourceModel.createAuditLog({
        action: 'space.delete',
        metadata: { spaceId: input.id },
        spaceId: input.id,
      });

      return { success: true };
    }),

  getSpace: spaceProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const space = await ctx.spaceModel.findAccessibleSpaceById(input.id);
    if (!space?.id) throw new TRPCError({ code: 'NOT_FOUND', message: 'SPACE_NOT_FOUND' });
    return space;
  }),

  listSpaceMembers: spaceProcedure
    .input(z.object({ spaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertManageRole(ctx, input.spaceId);
      return ctx.spaceModel.listMembers(input.spaceId);
    }),

  listSpaces: spaceProcedure.query(async ({ ctx }) => {
    await ctx.spaceModel.getOrCreatePersonalSpace();
    return ctx.spaceModel.listSpaces();
  }),

  removeSpaceMember: spaceProcedure
    .input(
      z.object({
        spaceId: z.string(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertManageRole(ctx, input.spaceId);
      await ctx.spaceModel.removeMember(input.spaceId, input.userId);

      await ctx.resourceModel.createAuditLog({
        action: 'space.member.remove',
        metadata: { targetUserId: input.userId },
        spaceId: input.spaceId,
      });

      return { success: true };
    }),

  transferSpaceOwnership: spaceProcedure
    .input(
      z.object({
        spaceId: z.string(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertOwnerRole(ctx, input.spaceId);
      await ctx.spaceModel.transferOwnership(input.spaceId, input.userId);

      await ctx.resourceModel.createAuditLog({
        action: 'space.owner.transfer',
        metadata: { targetUserId: input.userId },
        spaceId: input.spaceId,
      });

      return { success: true };
    }),

  updateSpace: spaceProcedure
    .input(
      z.object({
        id: z.string(),
        value: z.object({
          description: z.string().nullable().optional(),
          name: z.string().trim().min(1).max(120).optional(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertManageRole(ctx, input.id);
      return ctx.spaceModel.updateSpace(input.id, input.value);
    }),

  updateSpaceMemberRole: spaceProcedure
    .input(
      z.object({
        role: z.enum(['admin', 'editor', 'viewer']),
        spaceId: z.string(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertManageRole(ctx, input.spaceId);
      await ctx.spaceModel.updateMemberRole(input.spaceId, input.userId, input.role);

      await ctx.resourceModel.createAuditLog({
        action: 'space.member.role.update',
        metadata: { role: input.role, targetUserId: input.userId },
        spaceId: input.spaceId,
      });

      return { success: true };
    }),
});

export type SpaceRouter = typeof spaceRouter;
