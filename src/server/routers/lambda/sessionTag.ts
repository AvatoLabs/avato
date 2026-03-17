import { z } from 'zod';

import { SessionTagModel } from '@/database/models/sessionTag';
import { insertSessionTagSchema } from '@/database/schemas';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import { type SessionTagItem } from '@/types/session';

const sessionTagProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;

  return opts.next({
    ctx: {
      sessionTagModel: new SessionTagModel(ctx.serverDB, ctx.userId),
    },
  });
});

export const sessionTagRouter = router({
  createSessionTag: sessionTagProcedure
    .input(
      z.object({
        color: z.string().nullable().optional(),
        name: z.string(),
        sort: z.number().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const data = await ctx.sessionTagModel.create({
        color: input.color,
        name: input.name,
        sort: input.sort,
      });

      return data?.id;
    }),

  getSessionTags: sessionTagProcedure.query(async ({ ctx }): Promise<SessionTagItem[]> => {
    return ctx.sessionTagModel.query() as any;
  }),

  removeAllSessionTags: sessionTagProcedure.mutation(async ({ ctx }) => {
    return ctx.sessionTagModel.deleteAll();
  }),

  removeSessionTag: sessionTagProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return ctx.sessionTagModel.delete(input.id);
    }),

  updateSessionTag: sessionTagProcedure
    .input(
      z.object({
        id: z.string(),
        value: insertSessionTagSchema
          .pick({
            color: true,
            name: true,
            sort: true,
          })
          .partial(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return ctx.sessionTagModel.update(input.id, input.value);
    }),

  updateSessionTagOrder: sessionTagProcedure
    .input(
      z.object({
        sortMap: z.array(
          z.object({
            id: z.string(),
            sort: z.number(),
          }),
        ),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return ctx.sessionTagModel.updateOrder(input.sortMap);
    }),
});

export type SessionTagRouter = typeof sessionTagRouter;
