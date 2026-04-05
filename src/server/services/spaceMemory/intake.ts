import type { LobeChatDatabase } from '@lobechat/database';
import type { SpaceMemoryCandidateDraft, SpaceMemoryIngestOrigin } from '@lobechat/types';
import { canCreateSpaceMemory } from '@lobechat/types';

import { ContentModel } from '@/database/models/content';
import { SpaceModel } from '@/database/models/space';
import { SpaceMemoryModel } from '@/database/models/spaceMemory';

export class SpaceMemoryIntakeService {
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

  ingestCandidates = async (params: {
    drafts: SpaceMemoryCandidateDraft[];
    origin: SpaceMemoryIngestOrigin;
    producer?: string;
    spaceId: string;
    traceId?: string;
  }) => {
    const space = await this.spaceModel.findAccessibleSpaceById(params.spaceId);
    if (!space?.id) {
      throw new Error('SPACE_NOT_FOUND');
    }

    const canCreate = canCreateSpaceMemory(space);

    if (!canCreate) {
      throw new Error('SPACE_MEMORY_CREATE_DENIED');
    }

    const created = await this.spaceMemoryModel.createCandidates(
      params.drafts.map((draft) => ({
        ...draft,
        createdBy: this.userId,
        metadata: draft.metadata
          ? {
              ...draft.metadata,
              intake: {
                origin: params.origin,
                producer: params.producer,
                traceId: params.traceId,
              },
            }
          : {
              intake: {
                origin: params.origin,
                producer: params.producer,
                traceId: params.traceId,
              },
            },
        spaceId: params.spaceId,
      })),
    );

    await Promise.all(
      created.map((entry) =>
        this.contentModel.createAuditLog({
          action: 'space.memory.candidate.create',
          metadata: {
            category: entry.category ?? 'general',
            entryId: entry.id,
            intakeOrigin: params.origin,
            status: entry.status,
            title: entry.title,
          },
          spaceId: params.spaceId,
        }),
      ),
    );

    return created;
  };
}
