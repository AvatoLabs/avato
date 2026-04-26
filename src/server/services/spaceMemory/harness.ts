import type {
  SpaceMemoryCandidateDraft,
  SpaceMemoryCategory,
  SpaceMemoryHarnessCandidateDraft,
  SpaceMemoryHarnessIngestPayload,
  SpaceMemoryHarnessSourceObjectType,
  SpaceMemorySourceKind,
} from '@lobechat/types';
import { z } from 'zod';

const spaceMemoryHarnessSourceObjectTypes = [
  'chat',
  'doc',
  'document',
  'file',
  'meeting',
  'message',
  'source_set',
  'task',
  'topic',
] as const satisfies readonly SpaceMemoryHarnessSourceObjectType[];

const spaceMemoryHarnessKinds = [
  'context',
  'fact',
  'persona',
  'playbook',
  'policy',
  'preference',
] as const;

const spaceMemoryHarnessDecisions = [
  'ADD',
  'ARCHIVE',
  'IGNORE',
  'MERGE',
  'REVIEW',
  'UPDATE',
] as const;

const spaceMemoryHarnessScopes = ['agent', 'space', 'user'] as const;

const spaceMemoryCategorySchema = z.enum(['general', 'playbook', 'policy']);

export const spaceMemoryHarnessSourceRefSchema = z.object({
  objectId: z.string().trim().min(1).max(255),
  objectType: z.enum(spaceMemoryHarnessSourceObjectTypes),
  snippet: z.string().trim().max(1000).nullable().optional(),
  title: z.string().trim().max(255).nullable().optional(),
  version: z.string().trim().max(255).nullable().optional(),
});

export const spaceMemoryHarnessDecisionDraftSchema = z.object({
  confidence: z.number().min(0).max(1).nullable().optional(),
  decision: z.enum(spaceMemoryHarnessDecisions),
  reason: z.string().trim().min(1).max(1000),
  targetCandidateId: z.string().trim().max(255).nullable().optional(),
  targetEntryId: z.string().trim().max(255).nullable().optional(),
});

export const spaceMemoryHarnessRecallDraftSchema = z.object({
  entryId: z.string().trim().max(255).nullable().optional(),
  reason: z.string().trim().min(1).max(1000),
  relevance: z.number().min(0).max(1),
  slots: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
});

export const spaceMemoryHarnessCandidateDraftSchema = z.object({
  category: spaceMemoryCategorySchema.optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  content: z.string().nullable().optional(),
  decision: spaceMemoryHarnessDecisionDraftSchema.nullable().optional(),
  kind: z.enum(spaceMemoryHarnessKinds).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  normalizedKey: z.string().trim().max(255).nullable().optional(),
  proposedOwnerId: z.string().trim().max(255).nullable().optional(),
  proposedReviewerId: z.string().trim().max(255).nullable().optional(),
  recall: spaceMemoryHarnessRecallDraftSchema.nullable().optional(),
  scope: z.enum(spaceMemoryHarnessScopes).nullable().optional(),
  sourceRefs: z.array(spaceMemoryHarnessSourceRefSchema).min(1).max(20),
  summary: z.string().nullable().optional(),
  title: z.string().trim().min(1).max(255),
});

export const spaceMemoryHarnessIngestPayloadSchema = z.object({
  adapter: z.string().trim().max(120).optional(),
  drafts: z.array(spaceMemoryHarnessCandidateDraftSchema).min(1).max(20),
  producer: z.string().trim().max(120).optional(),
  spaceId: z.string(),
  traceId: z.string().trim().max(120).optional(),
  userId: z.string().optional(),
});

const sourceKindMap: Record<SpaceMemoryHarnessSourceObjectType, SpaceMemorySourceKind | null> = {
  chat: 'message',
  doc: 'document',
  document: 'document',
  file: 'file',
  meeting: null,
  message: 'message',
  source_set: 'source_set',
  task: null,
  topic: 'topic',
};

const mapHarnessKindToCategory = (
  category?: SpaceMemoryCategory,
  kind?: SpaceMemoryHarnessCandidateDraft['kind'],
): SpaceMemoryCategory | undefined => {
  if (category) return category;

  if (kind === 'playbook') return 'playbook';
  if (kind === 'policy') return 'policy';

  return 'general';
};

const normalizeHarnessMetadata = (
  draft: SpaceMemoryHarnessCandidateDraft,
  adapter?: string,
): Record<string, unknown> => ({
  ...(draft.metadata ?? {}),
  harness: {
    adapter: adapter ?? null,
    confidence: draft.confidence ?? null,
    contractVersion: 1,
    decision: draft.decision ?? null,
    kind: draft.kind ?? null,
    normalizedKey: draft.normalizedKey ?? null,
    proposedOwnerId: draft.proposedOwnerId ?? null,
    proposedReviewerId: draft.proposedReviewerId ?? null,
    recall: draft.recall ?? null,
    scope: draft.scope ?? null,
    sourceAttribution: draft.sourceRefs,
  },
});

export const normalizeSpaceMemoryHarnessDraft = (
  draft: SpaceMemoryHarnessCandidateDraft,
  adapter?: string,
): SpaceMemoryCandidateDraft => ({
  category: mapHarnessKindToCategory(draft.category, draft.kind),
  content: draft.content ?? undefined,
  metadata: normalizeHarnessMetadata(draft, adapter),
  sourceRefs: draft.sourceRefs
    .map((ref) => {
      const kind = sourceKindMap[ref.objectType];
      if (!kind) return null;

      return {
        id: ref.objectId,
        kind,
        title: ref.title ?? undefined,
      };
    })
    .filter(Boolean) as NonNullable<SpaceMemoryCandidateDraft['sourceRefs']>,
  summary: draft.summary ?? undefined,
  title: draft.title,
});

export const normalizeSpaceMemoryHarnessIngestPayload = (
  payload: Omit<SpaceMemoryHarnessIngestPayload, 'userId'>,
) => ({
  adapter: payload.adapter,
  drafts: payload.drafts.map((draft) => normalizeSpaceMemoryHarnessDraft(draft, payload.adapter)),
  producer: payload.producer,
  spaceId: payload.spaceId,
  traceId: payload.traceId,
});
