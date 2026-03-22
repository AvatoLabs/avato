import { documents } from '@lobechat/database/schemas';
import { nanoid } from '@lobechat/utils';
import { TRPCError } from '@trpc/server';
import bcrypt from 'bcryptjs';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

import { ResourceModel } from '@/database/models/resource';
import { UserModel } from '@/database/models/user';
import { appEnv } from '@/envs/app';
import { authedProcedure, publicProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import { ResourceAuthorizer } from '@/server/services/resource';

const resolveTargetResource = async (
  model: ResourceModel,
  input: { id?: string; kind?: 'document' | 'file' | 'knowledge_base'; resourceUid?: string },
) => {
  if (input.resourceUid) {
    const registry = await model.findRegistryByUid(input.resourceUid);
    if (!registry) throw new TRPCError({ code: 'NOT_FOUND', message: 'RESOURCE_NOT_FOUND' });
    return registry;
  }

  if (!input.kind || !input.id) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'RESOURCE_TARGET_REQUIRED' });
  }

  const registry = await model.findRegistryByLocalId(input.kind, input.id);
  if (!registry) throw new TRPCError({ code: 'NOT_FOUND', message: 'RESOURCE_NOT_FOUND' });
  return registry;
};

const shareProcedure = authedProcedure.use(serverDatabase).use(async ({ ctx, next }) => {
  return next({
    ctx: {
      resourceAuthorizer: new ResourceAuthorizer(ctx.serverDB, ctx.userId),
      resourceModel: new ResourceModel(ctx.serverDB, ctx.userId),
    },
  });
});

const publicShareProcedure = publicProcedure.use(serverDatabase);

export const resourceShareRouter = router({
  createResourceShareLink: shareProcedure
    .input(
      z.object({
        expiresInDays: z.union([z.literal(1), z.literal(7), z.literal(30)]).default(7),
        id: z.string().optional(),
        kind: z.enum(['document', 'file', 'knowledge_base']).optional(),
        password: z.string().min(1).optional(),
        resourceUid: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const registry = await resolveTargetResource(ctx.resourceModel, input);
      await ctx.resourceAuthorizer.assertCapability({
        capability: 'share_link',
        resourceUid: registry.resourceUid,
      });
      await ctx.resourceAuthorizer.assertCanDelegateSharing(registry.resourceUid);

      const rawToken = nanoid();
      const passwordHash = input.password ? await bcrypt.hash(input.password, 10) : undefined;
      const expiresAt = new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000);

      const link = await ctx.resourceModel.createShareLink({
        createdBy: ctx.userId,
        expiresAt,
        passwordHash,
        rawToken,
        resourceUid: registry.resourceUid,
        spaceId: registry.spaceId,
      });

      await ctx.resourceModel.createAuditLog({
        action: 'resource.share_link.create',
        metadata: { expiresAt: expiresAt.toISOString(), shareLinkId: link.id },
        resourceUid: registry.resourceUid,
        spaceId: registry.spaceId,
      });

      return {
        expiresAt,
        fileShareDownloadUrl:
          registry.kind === 'file'
            ? `${appEnv.APP_URL}/share/f/${rawToken}`
            : undefined,
        id: link.id,
        shareUrl: `${appEnv.APP_URL}/share/r/${rawToken}`,
      };
    }),

  disableResourceShareLink: shareProcedure
    .input(z.object({ shareLinkId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const link = await ctx.resourceModel.findShareLinkById(input.shareLinkId);
      if (!link) throw new TRPCError({ code: 'NOT_FOUND', message: 'SHARE_NOT_FOUND' });

      await ctx.resourceAuthorizer.assertCapability({
        capability: 'share_link',
        resourceUid: link.resourceUid,
      });
      await ctx.resourceAuthorizer.assertCanDelegateSharing(link.resourceUid);

      await ctx.resourceModel.disableShareLink(input.shareLinkId);

      await ctx.resourceModel.createAuditLog({
        action: 'resource.share_link.disable',
        metadata: { shareLinkId: input.shareLinkId },
        resourceUid: link.resourceUid,
        spaceId: link.spaceId,
      });

      return { success: true };
    }),

  explainAccess: shareProcedure
    .input(
      z.object({
        id: z.string().optional(),
        kind: z.enum(['document', 'file', 'knowledge_base']).optional(),
        resourceUid: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.resourceAuthorizer.explainAccess(input);
    }),

  getSharedResourceByToken: publicShareProcedure
    .input(
      z.object({
        password: z.string().optional(),
        token: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const resourceModel = new ResourceModel(ctx.serverDB, 'anonymous');
      const link = await resourceModel.resolveShareLinkByToken(input.token);
      if (!link) throw new TRPCError({ code: 'NOT_FOUND', message: 'SHARE_NOT_FOUND' });

      if (link.passwordHash) {
        if (!input.password) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'SHARE_PASSWORD_REQUIRED' });
        }

        const isValid = await bcrypt.compare(input.password, link.passwordHash);
        if (!isValid) throw new TRPCError({ code: 'NOT_FOUND', message: 'SHARE_NOT_FOUND' });
      }

      const summary = await resourceModel.getResourceSummary(link.resourceUid);
      if (!summary) throw new TRPCError({ code: 'NOT_FOUND', message: 'SHARE_NOT_FOUND' });

      if (summary.kind === 'document') {
        const document = await ctx.serverDB.query.documents.findFirst({
          where: and(eq(documents.id, summary.localId), isNull(documents.deletedAt)),
        });

        return {
          ...summary,
          content: document?.content || '',
          expiresAt: link.expiresAt,
          fileType: document?.fileType || 'custom/document',
          metadata: document?.metadata || null,
          role: 'viewer' as const,
          title: document?.title || document?.filename || summary.name,
        };
      }

      if (summary.kind === 'knowledge_base') {
        const knowledgeBase = await ctx.serverDB.query.knowledgeBases.findFirst({
          where: (table, { eq }) => eq(table.id, summary.localId),
        });

        return {
          ...summary,
          avatar: knowledgeBase?.avatar || null,
          description: knowledgeBase?.description || null,
          expiresAt: link.expiresAt,
          role: 'viewer' as const,
        };
      }

      return {
        ...summary,
        expiresAt: link.expiresAt,
        fileType: 'application/octet-stream',
        role: 'viewer' as const,
      };
    }),

  grantResourcePermission: shareProcedure
    .input(
      z.object({
        canReshare: z.boolean().default(false),
        expiresAt: z.coerce.date().optional(),
        id: z.string().optional(),
        inheritsToChildren: z.boolean().default(true),
        kind: z.enum(['document', 'file', 'knowledge_base']).optional(),
        resourceUid: z.string().optional(),
        role: z.enum(['owner', 'editor', 'viewer']),
        username: z.string().trim().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const registry = await resolveTargetResource(ctx.resourceModel, input);
      await ctx.resourceAuthorizer.assertCanDelegateSharing(registry.resourceUid);

      const user = await UserModel.findByUsername(ctx.serverDB, input.username);
      if (!user?.id) throw new TRPCError({ code: 'NOT_FOUND', message: 'USER_NOT_FOUND' });

      const permission = await ctx.resourceModel.grantPermission({
        canReshare: input.canReshare,
        createdBy: ctx.userId,
        expiresAt: input.expiresAt,
        inheritsToChildren: input.inheritsToChildren,
        resourceUid: registry.resourceUid,
        role: input.role,
        spaceId: registry.spaceId,
        subjectId: user.id,
        subjectType: 'user',
      });

      await ctx.resourceModel.createAuditLog({
        action: 'resource.permission.grant',
        metadata: { role: input.role, targetUserId: user.id, username: input.username },
        resourceUid: registry.resourceUid,
        spaceId: registry.spaceId,
      });

      return permission;
    }),

  listResourcePermissions: shareProcedure
    .input(
      z.object({
        id: z.string().optional(),
        kind: z.enum(['document', 'file', 'knowledge_base']).optional(),
        resourceUid: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const registry = await resolveTargetResource(ctx.resourceModel, input);
      await ctx.resourceAuthorizer.assertCapability({
        capability: 'share_member',
        resourceUid: registry.resourceUid,
      });

      return ctx.resourceModel.listPermissions(registry.resourceUid);
    }),

  listResourceShareLinks: shareProcedure
    .input(
      z.object({
        id: z.string().optional(),
        kind: z.enum(['document', 'file', 'knowledge_base']).optional(),
        resourceUid: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const registry = await resolveTargetResource(ctx.resourceModel, input);
      await ctx.resourceAuthorizer.assertCapability({
        capability: 'share_link',
        resourceUid: registry.resourceUid,
      });

      return ctx.resourceModel.listShareLinks(registry.resourceUid);
    }),

  listSharedWithMe: shareProcedure.query(async ({ ctx }) => {
    const items = await ctx.resourceModel.listSharedWithMe();
    return items.filter(Boolean);
  }),

  revokeResourcePermission: shareProcedure
    .input(z.object({ permissionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const permission = await ctx.resourceModel.findPermissionById(input.permissionId);
      if (!permission)
        throw new TRPCError({ code: 'NOT_FOUND', message: 'RESOURCE_PERMISSION_NOT_FOUND' });

      await ctx.resourceAuthorizer.assertCapability({
        capability: 'share_member',
        resourceUid: permission.resourceUid,
      });
      await ctx.resourceAuthorizer.assertCanDelegateSharing(permission.resourceUid);

      await ctx.resourceModel.revokePermission(input.permissionId);

      await ctx.resourceModel.createAuditLog({
        action: 'resource.permission.revoke',
        metadata: { permissionId: input.permissionId, targetUserId: permission.subjectId },
        resourceUid: permission.resourceUid,
        spaceId: permission.spaceId,
      });

      return { success: true };
    }),
});

export type ResourceShareRouter = typeof resourceShareRouter;
