import type { LobeChatDatabase } from '@lobechat/database';
import type { MemoryExtractionResult } from '@lobechat/memory-user-memory';
import { resolveSpaceMemorySurfaceState, type SpaceMemoryCandidateDraft } from '@lobechat/types';

import { ContentModel } from '@/database/models/content';
import { SpaceModel } from '@/database/models/space';
import { SpaceMemoryModel } from '@/database/models/spaceMemory';

import { SpaceMemoryAsyncService } from './async';
import { buildSpaceMemoryCandidatesFromUserMemoryExtraction } from './userMemoryCandidate';

const USER_MEMORY_EXTRACTION_PRODUCER = 'user-memory-extractor';

interface UserMemoryExtractionTopicSource {
  id: string;
  spaceId?: string | null;
  title?: string | null;
}

interface IngestTopicExtractionParams {
  extraction: MemoryExtractionResult;
  messageIds?: string[];
  producer?: string;
  topic: UserMemoryExtractionTopicSource;
  traceId?: string;
}

type SpaceMemoryUserMemorySkipReason =
  | 'duplicate'
  | 'empty'
  | 'forbidden'
  | 'not_scoped'
  | 'not_team_space';

export interface SpaceMemoryUserMemoryIngestionResult {
  createdCount?: number;
  reason?: SpaceMemoryUserMemorySkipReason;
  status: 'created' | 'skipped';
}

export interface SpaceMemoryUserMemoryTriggerResult {
  draftCount?: number;
  reason?: SpaceMemoryUserMemorySkipReason;
  status: 'scheduled' | 'skipped';
  triggerId?: string;
}

type PreparedTopicExtractionResult =
  | {
      reason: SpaceMemoryUserMemorySkipReason;
      status: 'skipped';
    }
  | {
      drafts: SpaceMemoryCandidateDraft[];
      producer: string;
      spaceId: string;
      status: 'ready';
      traceId: string;
    };

export class SpaceMemoryUserMemoryIngestionService {
  private readonly contentModel: ContentModel;
  private readonly spaceMemoryModel: SpaceMemoryModel;
  private readonly spaceModel: SpaceModel;
  private readonly userId: string;

  constructor(db: LobeChatDatabase, userId: string) {
    this.contentModel = new ContentModel(db, userId);
    this.spaceMemoryModel = new SpaceMemoryModel(db, userId);
    this.spaceModel = new SpaceModel(db, userId);
    this.userId = userId;
  }

  private prepareTopicExtraction = async ({
    extraction,
    messageIds,
    producer,
    topic,
    traceId,
  }: IngestTopicExtractionParams): Promise<PreparedTopicExtractionResult> => {
    if (!topic.spaceId) return { reason: 'not_scoped', status: 'skipped' };

    const space = await this.spaceModel.findAccessibleSpaceById(topic.spaceId);
    if (!space?.kind || space.kind !== 'team')
      return { reason: 'not_team_space', status: 'skipped' };
    if (!resolveSpaceMemorySurfaceState(space).canCreate) {
      return { reason: 'forbidden', status: 'skipped' };
    }

    const drafts = buildSpaceMemoryCandidatesFromUserMemoryExtraction({
      extraction,
      messageIds,
      topic,
    });

    if (!drafts.length) return { reason: 'empty', status: 'skipped' };

    const dedupedDrafts = [];
    for (const draft of drafts) {
      const existing = draft.summary
        ? await this.spaceMemoryModel.findExistingSourceSummaryEntry({
            category: draft.category,
            sourceRef: { id: topic.id, kind: 'topic' },
            spaceId: topic.spaceId,
            summary: draft.summary,
          })
        : null;

      if (!existing?.id) {
        dedupedDrafts.push(draft);
      }
    }

    if (!dedupedDrafts.length) return { reason: 'duplicate', status: 'skipped' };

    return {
      drafts: dedupedDrafts,
      producer: producer ?? USER_MEMORY_EXTRACTION_PRODUCER,
      spaceId: topic.spaceId,
      status: 'ready' as const,
      traceId: traceId ?? `user-memory:${topic.id}`,
    };
  };

  ingestTopicExtraction = async ({
    extraction,
    messageIds,
    producer,
    topic,
    traceId,
  }: IngestTopicExtractionParams): Promise<SpaceMemoryUserMemoryIngestionResult> => {
    const prepared = await this.prepareTopicExtraction({
      extraction,
      messageIds,
      producer,
      topic,
      traceId,
    });
    if (prepared.status === 'skipped') return prepared;

    const created = await this.spaceMemoryModel.createCandidates(
      prepared.drafts.map((draft) => ({
        ...draft,
        createdBy: this.userId,
        metadata: draft.metadata
          ? {
              ...draft.metadata,
              intake: {
                origin: 'automation',
                producer: prepared.producer,
                traceId: prepared.traceId,
              },
            }
          : {
              intake: {
                origin: 'automation',
                producer: prepared.producer,
                traceId: prepared.traceId,
              },
            },
        spaceId: prepared.spaceId,
      })),
    );

    await Promise.all(
      created.map((entry) =>
        this.contentModel.createAuditLog({
          action: 'space.memory.candidate.create',
          metadata: {
            category: entry.category ?? 'general',
            entryId: entry.id,
            intakeOrigin: 'automation',
            source: 'user_memory_extraction',
            status: entry.status,
            title: entry.title,
          },
          spaceId: prepared.spaceId,
        }),
      ),
    );

    return { createdCount: created.length, status: 'created' };
  };

  triggerTopicExtraction = async ({
    extraction,
    messageIds,
    producer,
    topic,
    traceId,
  }: IngestTopicExtractionParams): Promise<SpaceMemoryUserMemoryTriggerResult> => {
    const prepared = await this.prepareTopicExtraction({
      extraction,
      messageIds,
      producer,
      topic,
      traceId,
    });
    if (prepared.status === 'skipped') return prepared;

    const { triggerId } = await SpaceMemoryAsyncService.enqueueIngest({
      drafts: prepared.drafts,
      origin: 'automation',
      producer: prepared.producer,
      spaceId: prepared.spaceId,
      traceId: prepared.traceId,
      userId: this.userId,
    });

    return { draftCount: prepared.drafts.length, status: 'scheduled', triggerId };
  };
}
