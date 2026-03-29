import { documents } from '@lobechat/database/schemas';
import { nanoid } from '@lobechat/utils';
import { TRPCError } from '@trpc/server';
import bcrypt from 'bcryptjs';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

import { ContentModel } from '@/database/models/content';
import { UserModel } from '@/database/models/user';
import { appEnv } from '@/envs/app';
import { authedProcedure, publicProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import { ContentAuthorizer } from '@/server/services/content';

const resolveTargetContent = async (
  model: ContentModel,
  input: { id?: string; kind?: 'document' | 'file' | 'source_set'; contentUid?: string },
) => {
  if (input.contentUid) {
    const registry = await model.findContentRegistryByUid(input.contentUid);
    if (!registry) throw new TRPCError({ code: 'NOT_FOUND', message: 'RESOURCE_NOT_FOUND' });
    return registry;
  }

  if (!input.kind || !input.id) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'RESOURCE_TARGET_REQUIRED' });
  }

  const registry = await model.findContentRegistryByLocalId(input.kind, input.id);
  if (!registry) throw new TRPCError({ code: 'NOT_FOUND', message: 'RESOURCE_NOT_FOUND' });
  return registry;
};

const shareProcedure = authedProcedure.use(serverDatabase).use(async ({ ctx, next }) => {
  return next({
    ctx: {
      contentAuthorizer: new ContentAuthorizer(ctx.serverDB, ctx.userId),
      contentModel: new ContentModel(ctx.serverDB, ctx.userId),
    },
  });
});

const publicShareProcedure = publicProcedure.use(serverDatabase);

export const contentShareRouter = router({
  createContentShareLink: shareProcedure
    .input(
      z.object({
        expiresInDays: z.union([z.literal(1), z.literal(7), z.literal(30)]).default(7),
        id: z.string().optional(),
        kind: z.enum(['document', 'file', 'source_set']).optional(),
        password: z.string().min(1).optional(),
        contentUid: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const registry = await resolveTargetContent(ctx.contentModel, input);
      await ctx.contentAuthorizer.assertCapability({
        capability: 'share_link',
        contentUid: registry.contentUid,
      });
      await ctx.contentAuthorizer.assertCanDelegateSharing(registry.contentUid);

      const rawToken = nanoid();
      const passwordHash = input.password ? await bcrypt.hash(input.password, 10) : undefined;
      const expiresAt = new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000);

      const link = await ctx.contentModel.createShareLink({
        createdBy: ctx.userId,
        expiresAt,
        passwordHash,
        rawToken,
        contentUid: registry.contentUid,
        spaceId: registry.spaceId,
      });

      await ctx.contentModel.createAuditLog({
        action: 'content.share_link.create',
        metadata: { expiresAt: expiresAt.toISOString(), shareLinkId: link.id },
        contentUid: registry.contentUid,
        spaceId: registry.spaceId,
      });

      return {
        expiresAt,
        fileShareDownloadUrl:
          registry.kind === 'file' ? `${appEnv.APP_URL}/share/f/${rawToken}` : undefined,
        id: link.id,
        shareUrl: `${appEnv.APP_URL}/share/r/${rawToken}`,
      };
    }),

  disableContentShareLink: shareProcedure
    .input(z.object({ shareLinkId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const link = await ctx.contentModel.findShareLinkById(input.shareLinkId);
      if (!link) throw new TRPCError({ code: 'NOT_FOUND', message: 'SHARE_NOT_FOUND' });

      await ctx.contentAuthorizer.assertCapability({
        capability: 'share_link',
        contentUid: link.contentUid,
      });
      await ctx.contentAuthorizer.assertCanDelegateSharing(link.contentUid);

      await ctx.contentModel.disableShareLink(input.shareLinkId);

      await ctx.contentModel.createAuditLog({
        action: 'content.share_link.disable',
        metadata: { shareLinkId: input.shareLinkId },
        contentUid: link.contentUid,
        spaceId: link.spaceId,
      });

      return { success: true };
    }),

  explainContentAccess: shareProcedure
    .input(
      z.object({
        id: z.string().optional(),
        kind: z.enum(['document', 'file', 'source_set']).optional(),
        contentUid: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.contentAuthorizer.explainAccess(input);
    }),

  getSharedContentByToken: publicShareProcedure
    .input(
      z.object({
        password: z.string().optional(),
        token: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const contentModel = new ContentModel(ctx.serverDB, 'anonymous');
      const link = await contentModel.resolveShareLinkByToken(input.token);
      if (!link) throw new TRPCError({ code: 'NOT_FOUND', message: 'SHARE_NOT_FOUND' });

      if (link.passwordHash) {
        if (!input.password) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'SHARE_PASSWORD_REQUIRED' });
        }

        const isValid = await bcrypt.compare(input.password, link.passwordHash);
        if (!isValid) throw new TRPCError({ code: 'NOT_FOUND', message: 'SHARE_NOT_FOUND' });
      }

      const summary = await contentModel.getContentSummary(link.contentUid);
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

      if (summary.kind === 'source_set') {
        const sourceSet = await ctx.serverDB.query.sourceSets.findFirst({
          where: (table, { eq }) => eq(table.id, summary.localId),
        });

        return {
          ...summary,
          avatar: sourceSet?.avatar || null,
          description: sourceSet?.description || null,
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

  grantContentPermission: shareProcedure
    .input(
      z.object({
        canReshare: z.boolean().default(false),
        expiresAt: z.coerce.date().optional(),
        id: z.string().optional(),
        inheritsToChildren: z.boolean().default(true),
        kind: z.enum(['document', 'file', 'source_set']).optional(),
        contentUid: z.string().optional(),
        role: z.enum(['owner', 'editor', 'viewer']),
        username: z.string().trim().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const registry = await resolveTargetContent(ctx.contentModel, input);
      await ctx.contentAuthorizer.assertCanDelegateSharing(registry.contentUid);

      const user = await UserModel.findByUsername(ctx.serverDB, input.username);
      if (!user?.id) throw new TRPCError({ code: 'NOT_FOUND', message: 'USER_NOT_FOUND' });

      const permission = await ctx.contentModel.grantPermission({
        canReshare: input.canReshare,
        createdBy: ctx.userId,
        expiresAt: input.expiresAt,
        inheritsToChildren: input.inheritsToChildren,
        contentUid: registry.contentUid,
        role: input.role,
        spaceId: registry.spaceId,
        subjectId: user.id,
        subjectType: 'user',
      });

      await ctx.contentModel.createAuditLog({
        action: 'content.permission.grant',
        metadata: { role: input.role, targetUserId: user.id, username: input.username },
        contentUid: registry.contentUid,
        spaceId: registry.spaceId,
      });

      return permission;
    }),

  listContentPermissions: shareProcedure
    .input(
      z.object({
        id: z.string().optional(),
        kind: z.enum(['document', 'file', 'source_set']).optional(),
        contentUid: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const registry = await resolveTargetContent(ctx.contentModel, input);
      await ctx.contentAuthorizer.assertCapability({
        capability: 'share_member',
        contentUid: registry.contentUid,
      });

      return ctx.contentModel.listPermissions(registry.contentUid);
    }),

  listContentShareLinks: shareProcedure
    .input(
      z.object({
        id: z.string().optional(),
        kind: z.enum(['document', 'file', 'source_set']).optional(),
        contentUid: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const registry = await resolveTargetContent(ctx.contentModel, input);
      await ctx.contentAuthorizer.assertCapability({
        capability: 'share_link',
        contentUid: registry.contentUid,
      });

      const links = await ctx.contentModel.listShareLinks(registry.contentUid);
      return links.map(({ passwordHash: _passwordHash, tokenHash: _tokenHash, ...rest }) => rest);
    }),

  listSharedWithMe: shareProcedure.query(async ({ ctx }) => {
    const items = await ctx.contentModel.listSharedWithMe();
    return items.filter(Boolean);
  }),

  revokeContentPermission: shareProcedure
    .input(z.object({ permissionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const permission = await ctx.contentModel.findPermissionById(input.permissionId);
      if (!permission)
        throw new TRPCError({ code: 'NOT_FOUND', message: 'RESOURCE_PERMISSION_NOT_FOUND' });

      await ctx.contentAuthorizer.assertCapability({
        capability: 'share_member',
        contentUid: permission.contentUid,
      });
      await ctx.contentAuthorizer.assertCanDelegateSharing(permission.contentUid);

      await ctx.contentModel.revokePermission(input.permissionId);

      await ctx.contentModel.createAuditLog({
        action: 'content.permission.revoke',
        metadata: { permissionId: input.permissionId, targetUserId: permission.subjectId },
        contentUid: permission.contentUid,
        spaceId: permission.spaceId,
      });

      return { success: true };
    }),
});

export type ContentShareRouter = typeof contentShareRouter;
