import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { ContentModel } from '@/database/models/content';
import { SourceSetModel } from '@/database/models/sourceSet';
import { SpaceModel } from '@/database/models/space';
import { insertSourceSetsSchema } from '@/database/schemas';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import { AuthorizedResourceResolver, ContentAuthorizer } from '@/server/services/content';
import { getCanonicalContentKind } from '@/types/content';
import { type SourceSetItem } from '@/types/sourceSet';

const sourceSetProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;

  return opts.next({
    ctx: {
      sourceSetModel: new SourceSetModel(ctx.serverDB, ctx.userId),
      resolver: new AuthorizedResourceResolver(ctx.serverDB, ctx.userId),
      contentAuthorizer: new ContentAuthorizer(ctx.serverDB, ctx.userId),
      contentModel: new ContentModel(ctx.serverDB, ctx.userId),
      spaceModel: new SpaceModel(ctx.serverDB, ctx.userId),
    },
  });
});

const assertSourceItemsReadable = async (authorizer: ContentAuthorizer, ids: string[]) => {
  const checks = ids.map((id) =>
    authorizer.assertCapability({
      capability: 'preview_content',
      id,
      kind: getCanonicalContentKind({ id, sourceType: 'file' }),
    }),
  );

  await Promise.all(checks);
};

export const sourceSetRouter = router({
  addFilesToSourceSet: sourceSetProcedure
    .input(z.object({ ids: z.array(z.string()), sourceSetId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.resolver.requireSourceSet(input.sourceSetId, 'create_child');
      await assertSourceItemsReadable(ctx.contentAuthorizer, input.ids);

      try {
        return await ctx.sourceSetModel.addFilesToSourceSetAny(input.sourceSetId, input.ids);
      } catch (e: any) {
        const pgErrorCode = e?.cause?.cause?.code || e?.cause?.code || e?.code;
        if (pgErrorCode === '23505') {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'FILE_ALREADY_IN_SOURCE_SET',
          });
        }
        throw e;
      }
    }),

  createSourceSet: sourceSetProcedure
    .input(
      z.object({
        avatar: z.string().optional(),
        description: z.string().optional(),
        name: z.string(),
        spaceId: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      let spaceId: string;
      if (input.spaceId) {
        const space = await ctx.spaceModel.findAccessibleSpaceById(input.spaceId);
        if (!space?.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'SPACE_ACCESS_DENIED' });
        }
        if (space.membershipRole === 'viewer') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'SPACE_WRITE_DENIED' });
        }
        spaceId = space.id;
      } else {
        spaceId = (await ctx.spaceModel.getOrCreatePersonalSpace()).id;
      }

      const data = await ctx.sourceSetModel.create({
        avatar: input.avatar,
        description: input.description,
        name: input.name,
        spaceId,
      });

      if (!data?.id) return data?.id;

      const registry = await ctx.contentModel.ensureContentRegistry({
        createdBy: ctx.userId,
        kind: 'source_set',
        localId: data.id,
        spaceId,
      });

      await ctx.sourceSetModel.updateAny(data.id, {
        contentUid: registry.contentUid,
        spaceId,
      } as any);

      await ctx.contentModel.ensureOwnerPermission({
        contentUid: registry.contentUid,
        spaceId,
      });

      return data?.id;
    }),

  getSourceSetById: sourceSetProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }): Promise<SourceSetItem | undefined> => {
      await ctx.resolver.requireSourceSet(input.id, 'read_metadata');
      return ctx.serverDB.query.sourceSets.findFirst({
        where: (table, { eq }) => eq(table.id, input.id),
      }) as Promise<SourceSetItem | undefined>;
    }),

  getSourceSets: sourceSetProcedure
    .input(
      z
        .object({
          spaceId: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }): Promise<SourceSetItem[]> => {
      if (input?.spaceId) {
        const space = await ctx.spaceModel.findAccessibleSpaceById(input.spaceId);
        if (!space?.id) throw new TRPCError({ code: 'NOT_FOUND', message: 'SPACE_NOT_FOUND' });
      }

      const sourceSets = await ctx.sourceSetModel.query(input?.spaceId);
      const visibleSourceSetIds = new Set(
        await ctx.contentAuthorizer.filterVisibleSourceSetIdsForList(
          sourceSets.map((sourceSet) => sourceSet.id),
        ),
      );

      return sourceSets.filter((sourceSet) => visibleSourceSetIds.has(sourceSet.id));
    }),

  deleteAllSourceSets: sourceSetProcedure.mutation(async ({ ctx }) => {
    return ctx.sourceSetModel.deleteAll();
  }),

  removeFilesFromSourceSet: sourceSetProcedure
    .input(z.object({ ids: z.array(z.string()), sourceSetId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.resolver.requireSourceSet(input.sourceSetId, 'create_child');
      await assertSourceItemsReadable(ctx.contentAuthorizer, input.ids);
      return ctx.sourceSetModel.removeFilesFromSourceSetAny(input.sourceSetId, input.ids);
    }),

  deleteSourceSet: sourceSetProcedure
    .input(z.object({ id: z.string(), removeFiles: z.boolean().optional() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.resolver.requireSourceSet(input.id, 'delete');
      return ctx.sourceSetModel.deleteAny(input.id);
    }),

  updateSourceSet: sourceSetProcedure
    .input(
      z.object({
        id: z.string(),
        value: insertSourceSetsSchema.partial(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await ctx.resolver.requireSourceSet(input.id, 'move');
      return ctx.sourceSetModel.updateAny(input.id, input.value);
    }),
});
