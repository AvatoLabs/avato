import type { LobeChatDatabase } from '@lobechat/database';
import { resolveSpaceMemorySurfaceState } from '@lobechat/types';

import { ContentModel } from '@/database/models/content';
import { MessageModel } from '@/database/models/message';
import { SpaceModel } from '@/database/models/space';
import { SpaceMemoryModel } from '@/database/models/spaceMemory';
import { TopicModel } from '@/database/models/topic';

import { SpaceMemoryAsyncService } from './async';
import { buildTopicSpaceMemoryCandidateDraft } from './topicCandidate';

const SPACE_MEMORY_TOPIC_PRODUCER = 'topic-summary-extractor';

interface IngestTopicCandidateParams {
  producer?: string;
  topicId: string;
  traceId?: string;
}

export interface SpaceMemoryTopicIngestionResult {
  entry?: Awaited<ReturnType<SpaceMemoryModel['createCandidate']>> | null;
  reason?: 'duplicate' | 'forbidden' | 'not_found' | 'not_scoped' | 'not_team_space' | 'empty';
  status: 'created' | 'skipped';
}

export interface SpaceMemoryTopicTriggerResult {
  draftCount?: number;
  reason?: 'duplicate' | 'forbidden' | 'not_found' | 'not_scoped' | 'not_team_space' | 'empty';
  status: 'scheduled' | 'skipped';
  triggerId?: string;
}

export class SpaceMemoryTopicIngestionService {
  private readonly contentModel: ContentModel;
  private readonly messageModel: MessageModel;
  private readonly spaceMemoryModel: SpaceMemoryModel;
  private readonly spaceModel: SpaceModel;
  private readonly topicModel: TopicModel;
  private readonly userId: string;

  constructor(db: LobeChatDatabase, userId: string) {
    this.contentModel = new ContentModel(db, userId);
    this.messageModel = new MessageModel(db, userId);
    this.spaceMemoryModel = new SpaceMemoryModel(db, userId);
    this.spaceModel = new SpaceModel(db, userId);
    this.topicModel = new TopicModel(db, userId);
    this.userId = userId;
  }

  private prepareTopicCandidate = async ({
    producer,
    topicId,
    traceId,
  }: IngestTopicCandidateParams) => {
    const normalizedProducer = producer ?? SPACE_MEMORY_TOPIC_PRODUCER;
    const normalizedTraceId = traceId ?? `topic:${topicId}`;

    const topic = await this.topicModel.findById(topicId);
    if (!topic) return { reason: 'not_found' as const, status: 'skipped' as const };
    if (!topic.spaceId) return { reason: 'not_scoped' as const, status: 'skipped' as const };

    const space = await this.spaceModel.findAccessibleSpaceById(topic.spaceId);
    if (!space?.kind || space.kind !== 'team')
      return { reason: 'not_team_space' as const, status: 'skipped' as const };
    if (!resolveSpaceMemorySurfaceState(space).canCreate) {
      return { reason: 'forbidden' as const, status: 'skipped' as const };
    }

    const messages = await this.messageModel.query({ pageSize: 1000, topicId: topic.id });
    const draft = buildTopicSpaceMemoryCandidateDraft({ messages, topic });
    if (!draft?.summary) return { reason: 'empty' as const, status: 'skipped' as const };

    const existing = await this.spaceMemoryModel.findExistingTopicSummaryEntry({
      spaceId: topic.spaceId,
      summary: draft.summary,
      topicId: topic.id,
    });

    if (existing?.id) return { reason: 'duplicate' as const, status: 'skipped' as const };

    return {
      draft,
      producer: normalizedProducer,
      spaceId: topic.spaceId,
      status: 'ready' as const,
      traceId: normalizedTraceId,
    };
  };

  ingestTopicCandidate = async ({
    producer,
    topicId,
    traceId,
  }: IngestTopicCandidateParams): Promise<SpaceMemoryTopicIngestionResult> => {
    const prepared = await this.prepareTopicCandidate({ producer, topicId, traceId });
    if (prepared.status === 'skipped') return prepared;

    const [created] = await this.spaceMemoryModel.createCandidates([
      {
        ...prepared.draft,
        createdBy: this.userId,
        metadata: {
          intake: {
            origin: 'automation',
            producer: prepared.producer,
            traceId: prepared.traceId,
          },
        },
        spaceId: prepared.spaceId,
      },
    ]);

    await this.contentModel.createAuditLog({
      action: 'space.memory.candidate.create',
      metadata: {
        category: created.category ?? 'general',
        entryId: created.id,
        intakeOrigin: 'automation',
        status: created.status,
        title: created.title,
      },
      spaceId: prepared.spaceId,
    });

    return { entry: created, status: 'created' };
  };

  triggerTopicCandidate = async ({
    producer,
    topicId,
    traceId,
  }: IngestTopicCandidateParams): Promise<SpaceMemoryTopicTriggerResult> => {
    const prepared = await this.prepareTopicCandidate({ producer, topicId, traceId });
    if (prepared.status === 'skipped') return prepared;

    const { triggerId } = await SpaceMemoryAsyncService.enqueueIngest({
      drafts: [prepared.draft],
      origin: 'automation',
      producer: prepared.producer,
      spaceId: prepared.spaceId,
      traceId: prepared.traceId,
      userId: this.userId,
    });

    return { draftCount: 1, status: 'scheduled', triggerId };
  };
}
