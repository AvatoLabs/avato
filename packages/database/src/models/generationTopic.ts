import type {
  ImageGenerationAsset,
  ImageGenerationTopic,
  VideoGenerationAsset,
} from '@lobechat/types';
import debug from 'debug';
import { and, desc, eq, inArray } from 'drizzle-orm';

import { serverDBEnv } from '@/config/db';
import { FileService } from '@/server/services/file';
import { resolveRemovableStorageUrls } from '@/server/services/file/removableStorageUrls';

import type { GenerationTopicItem } from '../schemas/generation';
import { generationTopics } from '../schemas/generation';
import { files } from '../schemas/file';
import type { LobeChatDatabase } from '../type';
import type { GenerationTopicType } from '../types/generation';
import { FileModel } from './file';
import { resolveStableAppFileProxyUrl } from './utils/stableAppFileProxy';

const log = debug('lobe-image:generation-topic-model');

export class GenerationTopicModel {
  private userId: string;
  private db: LobeChatDatabase;
  private fileService: FileService;
  private fileModel: FileModel;

  constructor(db: LobeChatDatabase, userId: string) {
    this.userId = userId;
    this.db = db;
    this.fileService = new FileService(db, userId);
    this.fileModel = new FileModel(db, userId);
  }

  queryAll = async (type?: GenerationTopicType) => {
    const conditions = [eq(generationTopics.userId, this.userId)];
    if (type) {
      conditions.push(eq(generationTopics.type, type));
    }

    const topics = await this.db
      .select()
      .from(generationTopics)
      .orderBy(desc(generationTopics.updatedAt))
      .where(and(...conditions));

    const stableReadableUrlMap = new Map(
      (await this.fileModel.findByUrls(
        topics
          .map((topic) => topic.coverUrl)
          .filter((coverUrl): coverUrl is string => Boolean(coverUrl)),
      ))
        .map((file) => [file.url, `/f/${file.id}`]),
    );

    return Promise.all(
      topics.map(async (topic) => {
        if (topic.coverUrl) {
          const stableProxyUrl = resolveStableAppFileProxyUrl(topic.coverUrl);

          return {
            ...topic,
            coverUrl:
              stableProxyUrl ??
              stableReadableUrlMap.get(topic.coverUrl) ??
              (await this.fileService.getFullFileUrl(topic.coverUrl)),
          };
        }
        return topic;
      }),
    );
  };

  create = async (title: string, type?: GenerationTopicType) => {
    const [newGenerationTopic] = await this.db
      .insert(generationTopics)
      .values({
        title,
        type: type ?? 'image',
        userId: this.userId,
      })
      .returning();

    return newGenerationTopic;
  };

  findById = async (id: string): Promise<GenerationTopicItem | undefined> => {
    return this.db.query.generationTopics.findFirst({
      where: and(eq(generationTopics.id, id), eq(generationTopics.userId, this.userId)),
    });
  };

  update = async (
    id: string,
    data: Partial<ImageGenerationTopic>,
  ): Promise<GenerationTopicItem | undefined> => {
    const [updatedTopic] = await this.db
      .update(generationTopics)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(generationTopics.id, id), eq(generationTopics.userId, this.userId)))
      .returning();

    return updatedTopic;
  };

  /**
   * Delete a generation topic and return associated file URLs for cleanup
   *
   * This method follows the "database first, files second" deletion principle:
   * 1. First queries the topic with all its batches and generations to collect file URLs
   * 2. Then deletes the database record (cascade delete handles related batches and generations)
   * 3. Returns the deleted topic data and file URLs for cleanup
   *
   * @param id - The topic ID to delete
   * @returns Object containing deleted topic data and file URLs to clean, or undefined if topic not found or access denied
   */
  delete = async (
    id: string,
  ): Promise<{ deletedTopic: GenerationTopicItem; filesToDelete: string[] } | undefined> => {
    // 1. First, get the topic with all its batches and generations to collect file URLs
    const topicWithBatches = await this.db.query.generationTopics.findFirst({
      where: and(eq(generationTopics.id, id), eq(generationTopics.userId, this.userId)),
      with: {
        batches: {
          with: {
            generations: {
              columns: {
                asset: true,
                fileId: true,
              },
            },
          },
        },
      },
    });

    // If topic doesn't exist or doesn't belong to user, return undefined
    if (!topicWithBatches) {
      return undefined;
    }

    const fileIds = Array.from(
      new Set(
        topicWithBatches.batches
          ?.flatMap((batch) =>
            batch.generations.map((generation: { fileId: string | null }) => generation.fileId),
          )
          .filter((fileId): fileId is string => Boolean(fileId)) ?? [],
      ),
    );
    const generatedFileRows =
      fileIds.length > 0
        ? await this.db.query.files.findMany({
            columns: { blobId: true, fileHash: true, url: true },
            where: and(eq(files.userId, this.userId), inArray(files.id, fileIds)),
          })
        : [];

    // 2. Collect auxiliary file URLs that need to be deleted
    const filesToDelete = new Set<string>();
    if (topicWithBatches.coverUrl) {
      filesToDelete.add(topicWithBatches.coverUrl);
    }

    if (topicWithBatches.batches) {
      for (const batch of topicWithBatches.batches) {
        for (const gen of batch.generations) {
          const asset = gen.asset as ImageGenerationAsset | VideoGenerationAsset | null;
          if (!asset) continue;

          if (!gen.fileId && asset.url) {
            filesToDelete.add(asset.url);
          }

          if (asset.thumbnailUrl && asset.thumbnailUrl !== asset.url) {
            filesToDelete.add(asset.thumbnailUrl);
          }

          if (
            'coverUrl' in asset &&
            asset.coverUrl &&
            asset.coverUrl !== asset.url &&
            asset.coverUrl !== asset.thumbnailUrl
          ) {
            filesToDelete.add(asset.coverUrl);
          }
        }
      }
    }

    // 3. Delete the topic record (this will cascade delete all batches and generations)
    const [deletedTopic] = await this.db
      .delete(generationTopics)
      .where(and(eq(generationTopics.id, id), eq(generationTopics.userId, this.userId)))
      .returning();

    if (fileIds.length > 0) {
      const removeGlobalFile = serverDBEnv.REMOVE_GLOBAL_FILE ?? true;

      try {
        await this.fileModel.deleteManyAny(fileIds, removeGlobalFile);

        const removableFileUrls = await resolveRemovableStorageUrls(
          this.fileModel,
          generatedFileRows,
          removeGlobalFile,
        );
        for (const url of removableFileUrls) {
          filesToDelete.add(url);
        }
      } catch (error) {
        log('Failed to delete generation files for topic %s: %O', id, error);
      }
    }

    return {
      deletedTopic,
      filesToDelete: [...filesToDelete],
    };
  };
}
