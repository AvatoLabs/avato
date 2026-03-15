import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { authedProcedure, router } from '@/libs/trpc/lambda';
import { FileS3 } from '@/server/modules/S3';

export const uploadRouter = router({
  createS3PreSignedUrl: authedProcedure
    .input(z.object({ pathname: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const s3 = new FileS3();

        return await s3.createPreSignedUrl(input.pathname);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'File storage is not configured';

        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message,
        });
      }
    }),
});

export type FileRouter = typeof uploadRouter;
