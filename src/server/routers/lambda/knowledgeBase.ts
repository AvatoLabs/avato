import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { KnowledgeBaseModel } from '@/database/models/knowledgeBase';
import { ResourceModel } from '@/database/models/resource';
import { SpaceModel } from '@/database/models/space';
import { insertKnowledgeBasesSchema } from '@/database/schemas';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import { AuthorizedResourceResolver } from '@/server/services/resource';
import { type KnowledgeBaseItem } from '@/types/knowledgeBase';

const knowledgeBaseProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;

  return opts.next({
    ctx: {
      knowledgeBaseModel: new KnowledgeBaseModel(ctx.serverDB, ctx.userId),
      resolver: new AuthorizedResourceResolver(ctx.serverDB, ctx.userId),
      resourceModel: new ResourceModel(ctx.serverDB, ctx.userId),
      spaceModel: new SpaceModel(ctx.serverDB, ctx.userId),
    },
  });
});

export const knowledgeBaseRouter = router({
  addFilesToKnowledgeBase: knowledgeBaseProcedure
    .input(z.object({ ids: z.array(z.string()), knowledgeBaseId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.resolver.requireKnowledgeBase(input.knowledgeBaseId, 'create_child');

      try {
        return await ctx.knowledgeBaseModel.addFilesToKnowledgeBase(
          input.knowledgeBaseId,
          input.ids,
        );
      } catch (e: any) {
        // Check for PostgreSQL unique constraint violation (code 23505)
        const pgErrorCode = e?.cause?.cause?.code || e?.cause?.code || e?.code;
        if (pgErrorCode === '23505') {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'FILE_ALREADY_IN_KNOWLEDGE_BASE',
          });
        }
        throw e;
      }
    }),

  createKnowledgeBase: knowledgeBaseProcedure
    .input(
      z.object({
        avatar: z.string().optional(),
        description: z.string().optional(),
        name: z.string(),
        spaceId: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const spaceId = input.spaceId
        ? (await ctx.spaceModel.findAccessibleSpaceById(input.spaceId))?.id ||
          (await ctx.spaceModel.getOrCreatePersonalSpace()).id
        : (await ctx.spaceModel.getOrCreatePersonalSpace()).id;

      const data = await ctx.knowledgeBaseModel.create({
        avatar: input.avatar,
        description: input.description,
        name: input.name,
        spaceId,
      });

      if (!data?.id) return data?.id;

      const registry = await ctx.resourceModel.ensureResourceRegistry({
        createdBy: ctx.userId,
        kind: 'knowledge_base',
        localId: data.id,
        spaceId,
      });

      await ctx.knowledgeBaseModel.update(data.id, {
        resourceUid: registry.resourceUid,
        spaceId,
      } as any);

      await ctx.resourceModel.ensureOwnerPermission({
        resourceUid: registry.resourceUid,
        spaceId,
      });

      return data?.id;
    }),

  getKnowledgeBaseById: knowledgeBaseProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }): Promise<KnowledgeBaseItem | undefined> => {
      await ctx.resolver.requireKnowledgeBase(input.id, 'read_metadata');
      return ctx.serverDB.query.knowledgeBases.findFirst({
        where: (table, { eq }) => eq(table.id, input.id),
      }) as Promise<KnowledgeBaseItem | undefined>;
    }),

  getKnowledgeBases: knowledgeBaseProcedure
    .input(
      z
        .object({
          spaceId: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }): Promise<KnowledgeBaseItem[]> => {
      if (input?.spaceId) {
        const space = await ctx.spaceModel.findAccessibleSpaceById(input.spaceId);
        if (!space?.id) throw new TRPCError({ code: 'NOT_FOUND', message: 'SPACE_NOT_FOUND' });
      }

      return ctx.knowledgeBaseModel.query(input?.spaceId);
    }),

  removeAllKnowledgeBases: knowledgeBaseProcedure.mutation(async ({ ctx }) => {
    return ctx.knowledgeBaseModel.deleteAll();
  }),

  removeFilesFromKnowledgeBase: knowledgeBaseProcedure
    .input(z.object({ ids: z.array(z.string()), knowledgeBaseId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.resolver.requireKnowledgeBase(input.knowledgeBaseId, 'create_child');
      return ctx.knowledgeBaseModel.removeFilesFromKnowledgeBase(input.knowledgeBaseId, input.ids);
    }),

  removeKnowledgeBase: knowledgeBaseProcedure
    .input(z.object({ id: z.string(), removeFiles: z.boolean().optional() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.resolver.requireKnowledgeBase(input.id, 'delete');
      return ctx.knowledgeBaseModel.delete(input.id);
    }),

  updateKnowledgeBase: knowledgeBaseProcedure
    .input(
      z.object({
        id: z.string(),
        value: insertKnowledgeBasesSchema.partial(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await ctx.resolver.requireKnowledgeBase(input.id, 'move');
      return ctx.knowledgeBaseModel.update(input.id, input.value);
    }),
});
