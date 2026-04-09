import {
  canManageSpaceMemoryFromContract,
  resolveSpaceMemorySurfaceState,
  type SpaceMemoryAuditBatchBundle,
  spaceMemoryIngestOrigins,
  spaceMemorySections,
  type SpaceMemoryAuditBundle,
  type SpaceMemoryEntryResult,
  type SpaceMemoryEntryPreview,
  type SpaceMemorySection,
  type SpaceMemorySectionResult,
} from '@lobechat/types';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { ContentModel } from '@/database/models/content';
import { SpaceModel } from '@/database/models/space';
import { SpaceMemoryModel } from '@/database/models/spaceMemory';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import { SpaceMemoryIntakeService } from '@/server/services/spaceMemory/intake';
import { SpaceMemoryTopicIngestionService } from '@/server/services/spaceMemory/topicIngestion';

const spaceMemorySectionSchema = z.enum(spaceMemorySections);
const spaceMemoryIngestOriginSchema = z.enum(spaceMemoryIngestOrigins);
const spaceMemoryCandidateDraftSchema = z.object({
  category: z.enum(['general', 'playbook', 'policy']).optional(),
  content: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  sourceRefs: z
    .array(
      z.object({
        id: z.string(),
        kind: z.enum(['document', 'file', 'message', 'source_set', 'topic']),
        title: z.string().optional(),
      }),
    )
    .optional(),
  summary: z.string().nullable().optional(),
  title: z.string().trim().min(1).max(255),
});
const spaceMemoryRecallPolicySchema = z.object({
  expiresAt: z.string().datetime().nullable(),
  lastVerifiedAt: z.string().datetime().nullable(),
  recallEnabled: z.boolean(),
  staleAt: z.string().datetime().nullable(),
});
const recallFilterSchema = z.enum(['active', 'all', 'disabled', 'expired', 'stale']);

const spaceMemoryProcedure = authedProcedure.use(serverDatabase).use(async ({ ctx, next }) => {
  return next({
    ctx: {
      contentModel: new ContentModel(ctx.serverDB, ctx.userId),
      spaceMemoryModel: new SpaceMemoryModel(ctx.serverDB, ctx.userId),
      spaceModel: new SpaceModel(ctx.serverDB, ctx.userId),
    },
  });
});

const requireAccessibleSpace = async (
  ctx: {
    spaceModel: SpaceModel;
  },
  spaceId: string,
) => {
  const space = await ctx.spaceModel.findAccessibleSpaceById(spaceId);
  if (!space?.id) throw new TRPCError({ code: 'NOT_FOUND', message: 'SPACE_NOT_FOUND' });

  return space;
};

const requireReviewableSpaceState = async (
  ctx: {
    spaceModel: SpaceModel;
  },
  spaceId: string,
) => {
  const space = await requireAccessibleSpace(ctx, spaceId);
  const state = resolveSpaceMemorySurfaceState(space);

  if (!state.canReview) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'SPACE_MEMORY_REVIEW_DENIED' });
  }

  return {
    space,
    state,
  };
};

const emptyRecallSummary = {
  active: 0,
  disabled: 0,
  expired: 0,
  stale: 0,
};

const getSectionForCategory = (
  category: SpaceMemoryEntryPreview['category'],
): SpaceMemorySection => {
  switch (category) {
    case 'playbook': {
      return 'playbooks';
    }
    case 'policy': {
      return 'policies';
    }
    default: {
      return 'published';
    }
  }
};

const getSectionForEntry = (entry: SpaceMemoryEntryPreview): SpaceMemorySection => {
  if (entry.kind === 'candidate') return 'inbox';

  return getSectionForCategory(entry.category);
};

const buildAuditPath = (params: {
  entryId: string;
  recallFilter: 'active' | 'all' | 'disabled' | 'expired' | 'stale';
  section: SpaceMemorySection;
  spaceId: string;
}) => {
  const searchParams = new URLSearchParams({ section: params.section });
  if (params.section !== 'inbox' && params.recallFilter !== 'all') {
    searchParams.set('recallFilter', params.recallFilter);
  }

  return `/spaces/${encodeURIComponent(params.spaceId)}/memory/audit/${encodeURIComponent(params.entryId)}?${searchParams.toString()}`;
};

const createAuditBundle = (params: {
  entry: SpaceMemoryEntryPreview;
  exportedAt: string;
  recallFilter: 'active' | 'all' | 'disabled' | 'expired' | 'stale';
  space: {
    id: string;
    kind?: string | null;
    membershipRole?: string | null;
    name?: string | null;
  };
  spaceId: string;
}): SpaceMemoryAuditBundle => {
  const section = getSectionForEntry(params.entry);
  const recallFilter = section === 'inbox' ? 'all' : params.recallFilter;

  return {
    auditPath: buildAuditPath({
      entryId: params.entry.id,
      recallFilter,
      section,
      spaceId: params.spaceId,
    }),
    detailView: 'audit',
    entry: params.entry,
    exportedAt: params.exportedAt,
    recallFilter,
    section,
    space: {
      id: params.space.id,
      kind: params.space.kind,
      membershipRole: params.space.membershipRole,
      name: params.space.name,
    },
  };
};

const sanitizeSummaryForViewer = <
  T extends {
    contract?: Parameters<typeof canManageSpaceMemoryFromContract>[0];
    sections: Record<SpaceMemorySection, { count: number; recall: typeof emptyRecallSummary }>;
  },
>(
  summary: T,
) => {
  if (canManageSpaceMemoryFromContract(summary.contract)) return summary;

  const visibleSections = new Set(summary.contract?.sections ?? spaceMemorySections);

  return {
    ...summary,
    sections: Object.fromEntries(
      spaceMemorySections.map((section) => [
        section,
        {
          ...summary.sections[section],
          count: visibleSections.has(section) ? summary.sections[section].count : 0,
          recall: emptyRecallSummary,
        },
      ]),
    ) as T['sections'],
  };
};

const sanitizeEntryForViewer = (entry: SpaceMemoryEntryPreview, canReview: boolean) => {
  if (canReview) return entry;

  return {
    ...entry,
    actor: undefined,
    history: undefined,
    intake: undefined,
    recall: undefined,
    reviewHint: undefined,
  } satisfies SpaceMemoryEntryPreview;
};

const sortViewerEntries = (entries: SpaceMemoryEntryPreview[]) =>
  [...entries].sort((left, right) => {
    const leftTime = Date.parse(left.publishedAt ?? left.updatedAt);
    const rightTime = Date.parse(right.publishedAt ?? right.updatedAt);

    return rightTime - leftTime;
  });

const requireExportableAuditEntry = (params: {
  canReview: boolean;
  entry: SpaceMemoryEntryPreview | null;
}) => {
  const { canReview, entry } = params;

  if (!entry) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'SPACE_MEMORY_ENTRY_NOT_FOUND' });
  }

  if (entry.kind === 'candidate') {
    if (!canReview) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'SPACE_MEMORY_REVIEW_DENIED' });
    }

    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'SPACE_MEMORY_AUDIT_EXPORT_UNAVAILABLE',
    });
  }

  return entry;
};

export const spaceMemoryRouter = router({
  createCandidate: spaceMemoryProcedure
    .input(spaceMemoryCandidateDraftSchema.extend({ spaceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const intakeService = new SpaceMemoryIntakeService(ctx.serverDB, ctx.userId);
      let created;
      try {
        [created] = await intakeService.ingestCandidates({
          drafts: [
            {
              category: input.category,
              content: input.content,
              metadata: input.metadata,
              sourceRefs: input.sourceRefs,
              summary: input.summary,
              title: input.title,
            },
          ],
          origin: 'manual',
          spaceId: input.spaceId,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message === 'SPACE_NOT_FOUND') {
          throw new TRPCError({ code: 'NOT_FOUND', message });
        }
        if (message === 'SPACE_MEMORY_CREATE_DENIED') {
          throw new TRPCError({ code: 'FORBIDDEN', message });
        }
        throw error;
      }

      return created;
    }),

  ingestCandidates: spaceMemoryProcedure
    .input(
      z.object({
        drafts: z.array(spaceMemoryCandidateDraftSchema).min(1).max(20),
        origin: spaceMemoryIngestOriginSchema.default('automation'),
        producer: z.string().trim().max(120).optional(),
        spaceId: z.string(),
        traceId: z.string().trim().max(120).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const intakeService = new SpaceMemoryIntakeService(ctx.serverDB, ctx.userId);
      try {
        return await intakeService.ingestCandidates({
          drafts: input.drafts,
          origin: input.origin,
          producer: input.producer,
          spaceId: input.spaceId,
          traceId: input.traceId,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message === 'SPACE_NOT_FOUND') {
          throw new TRPCError({ code: 'NOT_FOUND', message });
        }
        if (message === 'SPACE_MEMORY_CREATE_DENIED') {
          throw new TRPCError({ code: 'FORBIDDEN', message });
        }
        throw error;
      }
    }),

  getSummary: spaceMemoryProcedure
    .input(z.object({ spaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const space = await requireAccessibleSpace(ctx, input.spaceId);
      const { contract, surface } = resolveSpaceMemorySurfaceState(space);

      return sanitizeSummaryForViewer({
        ...(await ctx.spaceMemoryModel.getSummary({
          contract,
          id: space.id,
          kind: space.kind,
          membershipRole: space.membershipRole,
          name: space.name,
          surface,
        })),
        contract,
      });
    }),

  getEntry: spaceMemoryProcedure
    .input(
      z.object({
        id: z.string(),
        spaceId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const space = await requireAccessibleSpace(ctx, input.spaceId);
      const { canReview, contract, surface } = resolveSpaceMemorySurfaceState(space);
      const entry = await ctx.spaceMemoryModel.getEntry(input);

      if (!entry) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'SPACE_MEMORY_ENTRY_NOT_FOUND' });
      }

      if (entry.kind === 'candidate' && !contract.canViewInbox) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'SPACE_MEMORY_REVIEW_DENIED' });
      }

      return {
        contract,
        entry: sanitizeEntryForViewer(entry, canReview),
        surface,
      } satisfies SpaceMemoryEntryResult;
    }),

  exportAuditBundle: spaceMemoryProcedure
    .input(
      z.object({
        id: z.string(),
        recallFilter: recallFilterSchema.default('all'),
        spaceId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const {
        space,
        state: { canReview },
      } = await requireReviewableSpaceState(ctx, input.spaceId);

      const entry = requireExportableAuditEntry({
        canReview,
        entry: await ctx.spaceMemoryModel.getEntry({
          id: input.id,
          spaceId: input.spaceId,
        }),
      });
      const exportedAt = new Date().toISOString();

      return createAuditBundle({
        entry,
        exportedAt,
        recallFilter: input.recallFilter,
        space,
        spaceId: input.spaceId,
      });
    }),

  exportAuditBundles: spaceMemoryProcedure
    .input(
      z.object({
        ids: z.array(z.string()).min(1).max(50),
        recallFilter: recallFilterSchema.default('all'),
        spaceId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const {
        space,
        state: { canReview },
      } = await requireReviewableSpaceState(ctx, input.spaceId);

      const exportedAt = new Date().toISOString();
      const entries = await ctx.spaceMemoryModel.getEntriesByIds({
        ids: input.ids,
        spaceId: input.spaceId,
      });
      const entryMap = new Map(entries.map((entry) => [entry.id, entry]));

      const items = input.ids.map((id) =>
        createAuditBundle({
          entry: requireExportableAuditEntry({
            canReview,
            entry: entryMap.get(id) ?? null,
          }),
          exportedAt,
          recallFilter: input.recallFilter,
          space,
          spaceId: input.spaceId,
        }),
      );

      const bundle: SpaceMemoryAuditBatchBundle = {
        count: items.length,
        exportedAt,
        items,
        recallFilter: input.recallFilter,
        space: {
          id: space.id,
          kind: space.kind,
          membershipRole: space.membershipRole,
          name: space.name,
        },
      };

      return bundle;
    }),

  ingestTopicCandidate: spaceMemoryProcedure
    .input(
      z.object({
        producer: z.string().trim().max(120).optional(),
        topicId: z.string(),
        traceId: z.string().trim().max(120).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await new SpaceMemoryTopicIngestionService(
        ctx.serverDB,
        ctx.userId,
      ).ingestTopicCandidate(input);

      if (result.status === 'created') return result.entry;

      switch (result.reason) {
        case 'not_found': {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'TOPIC_NOT_FOUND' });
        }
        case 'not_scoped': {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'SPACE_MEMORY_TOPIC_NOT_SCOPED',
          });
        }
        case 'forbidden': {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'SPACE_MEMORY_CREATE_DENIED' });
        }
        case 'duplicate': {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'SPACE_MEMORY_TOPIC_ALREADY_INGESTED',
          });
        }
        case 'empty': {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'SPACE_MEMORY_TOPIC_EMPTY',
          });
        }
        default: {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'SPACE_MEMORY_TOPIC_UNAVAILABLE',
          });
        }
      }
    }),

  listEntries: spaceMemoryProcedure
    .input(
      z.object({
        recallFilter: recallFilterSchema.default('all'),
        section: spaceMemorySectionSchema,
        spaceId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const space = await requireAccessibleSpace(ctx, input.spaceId);
      const { canReview, contract, surface } = resolveSpaceMemorySurfaceState(space);

      if (input.section === 'inbox' && !contract.canViewInbox) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'SPACE_MEMORY_REVIEW_DENIED' });
      }

      const result = await ctx.spaceMemoryModel.listEntries({
        ...input,
        recallFilter: input.section === 'inbox' ? 'all' : input.recallFilter,
      });

      if (canReview) {
        return {
          contract,
          ...result,
          surface,
        } satisfies SpaceMemorySectionResult;
      }

      return {
        contract,
        ...result,
        items: sortViewerEntries(
          result.items.map((entry) => sanitizeEntryForViewer(entry, canReview)),
        ),
        surface,
      } satisfies SpaceMemorySectionResult;
    }),

  rejectEntry: spaceMemoryProcedure
    .input(
      z.object({
        id: z.string(),
        spaceId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireReviewableSpaceState(ctx, input.spaceId);

      const archived = await ctx.spaceMemoryModel.archiveEntry({
        id: input.id,
        reviewedBy: ctx.userId,
        spaceId: input.spaceId,
      });

      if (!archived) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'SPACE_MEMORY_ENTRY_NOT_FOUND' });
      }

      await ctx.contentModel.createAuditLog({
        action: 'space.memory.reject',
        metadata: {
          entryId: input.id,
          reviewedBy: ctx.userId,
          status: archived?.status,
        },
        spaceId: input.spaceId,
      });

      return archived;
    }),

  rejectEntries: spaceMemoryProcedure
    .input(
      z.object({
        ids: z.array(z.string()).min(1).max(50),
        spaceId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireReviewableSpaceState(ctx, input.spaceId);

      const archived = await ctx.spaceMemoryModel.archiveEntries({
        ids: input.ids,
        reviewedBy: ctx.userId,
        spaceId: input.spaceId,
      });
      const succeeded = archived.filter((item) => item.status === 'archived');
      const failed = archived.filter((item) => item.status === 'skipped');

      await ctx.contentModel.createAuditLog({
        action: 'space.memory.reject.batch',
        metadata: {
          count: succeeded.length,
          entryIds: succeeded.map((item) => item.id),
          failures: failed.map((item) => ({
            id: item.id,
            reason: item.reason,
          })),
          reviewedBy: ctx.userId,
          status: 'archived',
        },
        spaceId: input.spaceId,
      });

      return archived;
    }),

  mergeEntry: spaceMemoryProcedure
    .input(
      z.object({
        candidateId: z.string(),
        merge: z
          .object({
            appendSources: z.boolean().optional(),
            applyContent: z.boolean().optional(),
            applySummary: z.boolean().optional(),
            applyTitle: z.boolean().optional(),
          })
          .optional(),
        spaceId: z.string(),
        targetEntryId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireReviewableSpaceState(ctx, input.spaceId);

      const merged = await ctx.spaceMemoryModel.mergeCandidateIntoPublishedEntry({
        candidateId: input.candidateId,
        merge: input.merge,
        reviewedBy: ctx.userId,
        spaceId: input.spaceId,
        targetEntryId: input.targetEntryId,
      });

      if (!merged) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'SPACE_MEMORY_ENTRY_NOT_FOUND' });
      }

      await ctx.contentModel.createAuditLog({
        action: 'space.memory.merge',
        metadata: {
          candidateId: input.candidateId,
          merge: input.merge,
          reviewedBy: ctx.userId,
          targetEntryId: input.targetEntryId,
        },
        spaceId: input.spaceId,
      });

      return merged;
    }),

  publishEntry: spaceMemoryProcedure
    .input(
      z.object({
        id: z.string(),
        spaceId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireReviewableSpaceState(ctx, input.spaceId);

      const published = await ctx.spaceMemoryModel.publishEntry({
        id: input.id,
        reviewedBy: ctx.userId,
        spaceId: input.spaceId,
      });

      if (!published) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'SPACE_MEMORY_ENTRY_NOT_FOUND' });
      }

      await ctx.contentModel.createAuditLog({
        action: 'space.memory.publish',
        metadata: {
          entryId: input.id,
          reviewedBy: ctx.userId,
          status: published?.status,
        },
        spaceId: input.spaceId,
      });

      return published;
    }),

  publishEntries: spaceMemoryProcedure
    .input(
      z.object({
        ids: z.array(z.string()).min(1).max(50),
        spaceId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireReviewableSpaceState(ctx, input.spaceId);

      const published = await ctx.spaceMemoryModel.publishEntries({
        ids: input.ids,
        reviewedBy: ctx.userId,
        spaceId: input.spaceId,
      });
      const succeeded = published.filter((item) => item.status === 'published');
      const failed = published.filter((item) => item.status === 'skipped');

      await ctx.contentModel.createAuditLog({
        action: 'space.memory.publish.batch',
        metadata: {
          count: succeeded.length,
          entryIds: succeeded.map((item) => item.id),
          failures: failed.map((item) => ({
            id: item.id,
            reason: item.reason,
          })),
          reviewedBy: ctx.userId,
          status: 'published',
        },
        spaceId: input.spaceId,
      });

      return published;
    }),

  markEntriesStale: spaceMemoryProcedure
    .input(
      z.object({
        ids: z.array(z.string()).min(1).max(50),
        spaceId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireReviewableSpaceState(ctx, input.spaceId);

      const marked = await ctx.spaceMemoryModel.markPublishedEntriesStale({
        ids: input.ids,
        reviewedBy: ctx.userId,
        spaceId: input.spaceId,
      });
      const succeeded = marked.filter((item) => item.status === 'stale');
      const failed = marked.filter((item) => item.status === 'skipped');

      await ctx.contentModel.createAuditLog({
        action: 'space.memory.stale.batch',
        metadata: {
          count: succeeded.length,
          entryIds: succeeded.map((item) => item.id),
          failures: failed.map((item) => ({
            id: item.id,
            reason: item.reason,
          })),
          reviewedBy: ctx.userId,
          status: 'stale',
        },
        spaceId: input.spaceId,
      });

      return marked;
    }),

  revalidateEntries: spaceMemoryProcedure
    .input(
      z.object({
        ids: z.array(z.string()).min(1).max(50),
        spaceId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireReviewableSpaceState(ctx, input.spaceId);

      const revalidated = await ctx.spaceMemoryModel.revalidatePublishedEntries({
        ids: input.ids,
        reviewedBy: ctx.userId,
        spaceId: input.spaceId,
      });
      const succeeded = revalidated.filter((item) => item.status === 'revalidated');
      const failed = revalidated.filter((item) => item.status === 'skipped');

      await ctx.contentModel.createAuditLog({
        action: 'space.memory.revalidate.batch',
        metadata: {
          count: succeeded.length,
          entryIds: succeeded.map((item) => item.id),
          failures: failed.map((item) => ({
            id: item.id,
            reason: item.reason,
          })),
          reviewedBy: ctx.userId,
          status: 'revalidated',
        },
        spaceId: input.spaceId,
      });

      return revalidated;
    }),

  updateRecallPolicy: spaceMemoryProcedure
    .input(
      spaceMemoryRecallPolicySchema.extend({
        id: z.string(),
        spaceId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireReviewableSpaceState(ctx, input.spaceId);

      const updated = await ctx.spaceMemoryModel.updatePublishedRecallPolicy({
        expiresAt: input.expiresAt,
        id: input.id,
        lastVerifiedAt: input.lastVerifiedAt,
        recallEnabled: input.recallEnabled,
        staleAt: input.staleAt,
        reviewedBy: ctx.userId,
        spaceId: input.spaceId,
      });

      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'SPACE_MEMORY_ENTRY_NOT_FOUND' });
      }

      await ctx.contentModel.createAuditLog({
        action: 'space.memory.recall_policy.update',
        metadata: {
          entryId: updated.id,
          expiresAt: input.expiresAt,
          lastVerifiedAt: input.lastVerifiedAt,
          recallEnabled: input.recallEnabled,
          staleAt: input.staleAt,
        },
        spaceId: input.spaceId,
      });

      return updated;
    }),
});

export type SpaceMemoryRouter = typeof spaceMemoryRouter;
