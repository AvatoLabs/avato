import type {
  FileAssetClassification,
  FileAssetMetadata,
  FileAssetReviewStatus,
  FileAssetUsagePolicy,
} from '@lobechat/types';
import { normalizeFileAssetMetadata } from '@lobechat/types';
import { eq, inArray } from 'drizzle-orm';

import { fileAssets } from '../schemas';
import type { LobeChatDatabase } from '../type';

export class FileAssetModel {
  private readonly db: LobeChatDatabase;

  constructor(db: LobeChatDatabase) {
    this.db = db;
  }

  private isMissingFileAssetSchemaError = (error: unknown) => {
    if (!error || typeof error !== 'object') return false;

    const databaseError = error as { code?: string; message?: string };
    const message = databaseError.message ?? '';

    return (
      databaseError.code === '42P01' ||
      databaseError.code === '42703' ||
      message.includes('file_assets')
    );
  };

  findByFileId = async (fileId: string) => {
    try {
      const [item] = await this.db
        .select()
        .from(fileAssets)
        .where(eq(fileAssets.fileId, fileId))
        .limit(1);

      return item ? { ...item, metadata: normalizeFileAssetMetadata(item.metadata) } : undefined;
    } catch (error) {
      if (this.isMissingFileAssetSchemaError(error)) return undefined;
      throw error;
    }
  };

  findByFileIds = async (fileIds: string[]) => {
    const dedupIds = [...new Set(fileIds)].filter(Boolean);
    if (dedupIds.length === 0) return [];

    try {
      const items = await this.db
        .select()
        .from(fileAssets)
        .where(inArray(fileAssets.fileId, dedupIds));

      return items.map((item) => ({
        ...item,
        metadata: normalizeFileAssetMetadata(item.metadata),
      }));
    } catch (error) {
      if (this.isMissingFileAssetSchemaError(error)) return [];
      throw error;
    }
  };

  upsert = async (params: {
    classification?: FileAssetClassification;
    createdBy: string;
    fileId: string;
    metadata?: FileAssetMetadata | null;
    reviewedAt?: Date | null;
    reviewedBy?: string | null;
    reviewStatus?: FileAssetReviewStatus;
    rightsOwner?: string | null;
    spaceId: string;
    usagePolicy?: FileAssetUsagePolicy;
  }) => {
    const normalizedMetadata =
      params.metadata === undefined ? undefined : normalizeFileAssetMetadata(params.metadata);

    const updateSet = {
      ...(params.classification !== undefined ? { classification: params.classification } : {}),
      ...(params.metadata !== undefined ? { metadata: normalizedMetadata } : {}),
      ...(params.reviewedAt !== undefined ? { reviewedAt: params.reviewedAt } : {}),
      ...(params.reviewedBy !== undefined ? { reviewedBy: params.reviewedBy } : {}),
      ...(params.reviewStatus !== undefined ? { reviewStatus: params.reviewStatus } : {}),
      ...(params.rightsOwner !== undefined ? { rightsOwner: params.rightsOwner } : {}),
      ...(params.usagePolicy !== undefined ? { usagePolicy: params.usagePolicy } : {}),
      updatedAt: new Date(),
    };

    const [item] = await this.db
      .insert(fileAssets)
      .values({
        classification: params.classification ?? 'general',
        createdBy: params.createdBy,
        fileId: params.fileId,
        metadata: normalizedMetadata ?? undefined,
        reviewedAt: params.reviewedAt ?? null,
        reviewedBy: params.reviewedBy ?? null,
        reviewStatus: params.reviewStatus ?? 'draft',
        rightsOwner: params.rightsOwner ?? null,
        spaceId: params.spaceId,
        usagePolicy: params.usagePolicy ?? 'internal',
      })
      .onConflictDoUpdate({
        set: updateSet,
        target: fileAssets.fileId,
      })
      .returning();

    return {
      ...item,
      metadata: normalizeFileAssetMetadata(item.metadata),
    };
  };
}
