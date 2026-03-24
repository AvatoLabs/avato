import { SemanticSearchSchema } from '@lobechat/types';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { checkBudgetsUsage } from '@/business/server/trpc-middlewares/lambda';
import { AsyncTaskModel } from '@/database/models/asyncTask';
import { ChunkModel } from '@/database/models/chunk';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { keyVaults, serverDatabase } from '@/libs/trpc/lambda/middleware';
import { ChunkService } from '@/server/services/chunk';
import { ServerRagService } from '@/server/services/rag';
import { AuthorizedResourceResolver, ResourceAuthorizer } from '@/server/services/resource';

const chunkProcedure = authedProcedure
  .use(serverDatabase)
  .use(keyVaults)
  .use(async (opts) => {
    const { ctx } = opts;

    return opts.next({
      ctx: {
        asyncTaskModel: new AsyncTaskModel(ctx.serverDB, ctx.userId),
        chunkModel: new ChunkModel(ctx.serverDB, ctx.userId),
        chunkService: new ChunkService(ctx.serverDB, ctx.userId),
        ragService: new ServerRagService(ctx.serverDB, ctx.userId),
        resolver: new AuthorizedResourceResolver(ctx.serverDB, ctx.userId),
        resourceAuthorizer: new ResourceAuthorizer(ctx.serverDB, ctx.userId),
      },
    });
  });

export const chunkRouter = router({
  createEmbeddingChunksTask: chunkProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.resourceAuthorizer.assertCapability({
        capability: 'preview_content',
        id: input.id,
        kind: 'file',
      });

      const asyncTaskId = await ctx.chunkService.asyncEmbeddingFileChunks(input.id);

      return { id: asyncTaskId, success: true };
    }),

  createParseFileTask: chunkProcedure
    .input(
      z.object({
        id: z.string(),
        skipExist: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.resourceAuthorizer.assertCapability({
        capability: 'preview_content',
        id: input.id,
        kind: 'file',
      });

      const asyncTaskId = await ctx.chunkService.asyncParseFileToChunks(input.id, input.skipExist);

      return { id: asyncTaskId, success: true };
    }),

  getChunksByFileId: chunkProcedure
    .input(
      z.object({
        cursor: z.number().nullish(),
        id: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await ctx.resourceAuthorizer.assertCapability({
        capability: 'preview_content',
        id: input.id,
        kind: 'file',
      });

      return {
        items: await ctx.chunkModel.findByFileId(input.id, input.cursor || 0),
        nextCursor: input.cursor ? input.cursor + 1 : 1,
      };
    }),

  getFileContents: chunkProcedure
    .input(
      z.object({
        fileIds: z.array(z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) => ctx.ragService.getFileContents(input.fileIds)),

  retryParseFileTask: chunkProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.resolver.requireFile(input.id, 'preview_content');

      if (!result) return;

      // 1. delete the previous task if exist
      if (result.chunkTaskId) {
        await ctx.asyncTaskModel.delete(result.chunkTaskId);
      }

      // 2. create a new asyncTask for chunking
      const asyncTaskId = await ctx.chunkService.asyncParseFileToChunks(input.id);

      return { id: asyncTaskId, success: true };
    }),

  semanticSearch: chunkProcedure
    .input(
      z.object({
        fileIds: z.array(z.string()).optional(),
        query: z.string(),
      }),
    )
    .use(checkBudgetsUsage)
    .mutation(async ({ ctx, input }) => ctx.ragService.semanticSearch(input)),

  semanticSearchForChat: chunkProcedure
    .input(SemanticSearchSchema)
    .use(checkBudgetsUsage)
    .mutation(async ({ ctx, input }) => {
      try {
        return await ctx.ragService.semanticSearchForChat(input);
      } catch (e) {
        console.error(e);

        const error = e as any;
        const errorType = error.errorType;

        // Map business error types to appropriate HTTP status codes
        if (errorType === 'InvalidProviderAPIKey') {
          throw new TRPCError({
            code: 'METHOD_NOT_SUPPORTED',
            message: error.message || 'Invalid API key for embedding provider',
          });
        }

        if (errorType === 'ProviderBizError') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message || 'Provider service error',
          });
        }

        // For unknown errors, still return 500 but with proper message
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || errorType || 'Failed to perform semantic search',
        });
      }
    }),
});
