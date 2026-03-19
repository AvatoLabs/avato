import { z } from 'zod';

import { TagModel } from '@/database/models/tag';
import { insertTagSchema } from '@/database/schemas';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import { type TagItem } from '@/types/tag';

const tagProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;

  return opts.next({
    ctx: {
      tagModel: new TagModel(ctx.serverDB, ctx.userId),
    },
  });
});

export const tagRouter = router({
  createTag: tagProcedure
    .input(
      z.object({
        color: z.string().nullable().optional(),
        name: z.string(),
        sort: z.number().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const data = await ctx.tagModel.create({
        color: input.color,
        name: input.name,
        sort: input.sort,
      });

      return data?.id;
    }),

  getTags: tagProcedure.query(async ({ ctx }): Promise<TagItem[]> => {
    return ctx.tagModel.query() as any;
  }),

  removeAllTags: tagProcedure.mutation(async ({ ctx }) => {
    return ctx.tagModel.deleteAll();
  }),

  removeTag: tagProcedure.input(z.object({ id: z.string() })).mutation(async ({ input, ctx }) => {
    return ctx.tagModel.delete(input.id);
  }),

  updateTag: tagProcedure
    .input(
      z.object({
        id: z.string(),
        value: insertTagSchema
          .pick({
            color: true,
            name: true,
            sort: true,
          })
          .partial(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return ctx.tagModel.update(input.id, input.value);
    }),

  updateTagOrder: tagProcedure
    .input(z.object({ sortMap: z.array(z.object({ id: z.string(), sort: z.number() })) }))
    .mutation(async ({ input, ctx }) => {
      return ctx.tagModel.updateOrder(input.sortMap);
    }),
});

export type TagRouter = typeof tagRouter;
