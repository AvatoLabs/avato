import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { asyncAuthedProcedure, asyncRouter as router } from '@/libs/trpc/async';
import {
  normalizeSpaceMemoryHarnessIngestPayload,
  spaceMemoryHarnessIngestPayloadSchema,
} from '@/server/services/spaceMemory/harness';
import { SpaceMemoryIntakeService } from '@/server/services/spaceMemory/intake';

const sourceRefSchema = z.object({
  id: z.string(),
  kind: z.enum(['document', 'file', 'message', 'source_set', 'topic']),
  title: z.string().optional(),
});

const candidateDraftSchema = z.object({
  category: z.enum(['general', 'playbook', 'policy']).optional(),
  content: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  sourceRefs: z.array(sourceRefSchema).optional(),
  summary: z.string().nullable().optional(),
  title: z.string(),
});

export const spaceMemoryRouter = router({
  ingestCandidates: asyncAuthedProcedure
    .input(
      z.object({
        drafts: z.array(candidateDraftSchema).min(1),
        origin: z.enum(['automation', 'harness', 'manual']),
        producer: z.string().optional(),
        spaceId: z.string(),
        traceId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const created = await new SpaceMemoryIntakeService(
          ctx.serverDB,
          ctx.userId,
        ).ingestCandidates(input);

        return { count: created.length, success: true };
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'UNKNOWN_ERROR';

        if (reason === 'SPACE_NOT_FOUND') {
          throw new TRPCError({ code: 'NOT_FOUND', message: reason });
        }

        if (reason === 'SPACE_MEMORY_CREATE_DENIED') {
          throw new TRPCError({ code: 'FORBIDDEN', message: reason });
        }

        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: reason });
      }
    }),

  ingestHarnessCandidates: asyncAuthedProcedure
    .input(spaceMemoryHarnessIngestPayloadSchema.omit({ userId: true }))
    .mutation(async ({ ctx, input }) => {
      try {
        const normalized = normalizeSpaceMemoryHarnessIngestPayload(input);
        const created = await new SpaceMemoryIntakeService(ctx.serverDB, ctx.userId).ingestCandidates(
          {
            drafts: normalized.drafts,
            origin: 'harness',
            producer: normalized.producer,
            spaceId: normalized.spaceId,
            traceId: normalized.traceId,
          },
        );

        return { count: created.length, success: true };
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'UNKNOWN_ERROR';

        if (reason === 'SPACE_NOT_FOUND') {
          throw new TRPCError({ code: 'NOT_FOUND', message: reason });
        }

        if (reason === 'SPACE_MEMORY_CREATE_DENIED') {
          throw new TRPCError({ code: 'FORBIDDEN', message: reason });
        }

        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: reason });
      }
    }),
});
