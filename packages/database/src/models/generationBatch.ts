import type {
  Generation,
  GenerationBatch,
  GenerationConfig,
  ImageGenerationAsset,
  VideoGenerationAsset,
} from '@lobechat/types';
import debug from 'debug';
import { and, eq, inArray } from 'drizzle-orm';

import { serverDBEnv } from '@/config/db';
import { FileService } from '@/server/services/file';
import { resolveRemovableStorageUrls } from '@/server/services/file/removableStorageUrls';

import type {
  GenerationBatchItem,
  GenerationBatchWithGenerations,
  NewGenerationBatch,
} from '../schemas/generation';
import { generationBatches } from '../schemas/generation';
import { files } from '../schemas/file';
import type { LobeChatDatabase } from '../type';
import { FileModel } from './file';
import { GenerationModel } from './generation';
import { resolveStableAppFileProxyUrl } from './utils/stableAppFileProxy';

const log = debug('lobe-image:generation-batch-model');

export class GenerationBatchModel {
  private db: LobeChatDatabase;
  private userId: string;
  private fileService: FileService;
  private fileModel: FileModel;
  private generationModel: GenerationModel;

  constructor(db: LobeChatDatabase, userId: string) {
    this.db = db;
    this.userId = userId;
    this.fileService = new FileService(db, userId);
    this.fileModel = new FileModel(db, userId);
    this.generationModel = new GenerationModel(db, userId);
  }

  private buildStableReadableUrlMap = async (urls: string[]) => {
    const files = await this.fileModel.findByUrls(urls);

    return new Map(files.map((file) => [file.url, `/f/${file.id}`]));
  };

  private resolveConfigFileUrl = async (
    url: string,
    stableReadableUrlMap: Map<string, string>,
  ) =>
    resolveStableAppFileProxyUrl(url) ??
    stableReadableUrlMap.get(url) ??
    this.fileService.getFullFileUrl(url);

  async create(value: NewGenerationBatch): Promise<GenerationBatchItem> {
    log('Creating generation batch: %O', {
      topicId: value.generationTopicId,
      userId: this.userId,
    });

    const [result] = await this.db
      .insert(generationBatches)
      .values({ ...value, userId: this.userId })
      .returning();

    log('Generation batch created successfully: %s', result.id);
    return result;
  }

  async findById(id: string): Promise<GenerationBatchItem | undefined> {
    log('Finding generation batch by ID: %s for user: %s', id, this.userId);

    const result = await this.db.query.generationBatches.findFirst({
      where: and(eq(generationBatches.id, id), eq(generationBatches.userId, this.userId)),
    });

    log('Generation batch %s: %s', id, result ? 'found' : 'not found');
    return result;
  }

  async findByTopicId(topicId: string): Promise<GenerationBatchItem[]> {
    log('Finding generation batches by topic ID: %s for user: %s', topicId, this.userId);

    const results = await this.db.query.generationBatches.findMany({
      orderBy: (table, { desc }) => [desc(table.createdAt)],
      where: and(
        eq(generationBatches.generationTopicId, topicId),
        eq(generationBatches.userId, this.userId),
      ),
    });

    log('Found %d generation batches for topic %s', results.length, topicId);
    return results;
  }

  /**
   * Find batches with their associated generations using relations
   */
  async findByTopicIdWithGenerations(topicId: string): Promise<GenerationBatchWithGenerations[]> {
    log(
      'Finding generation batches with generations for topic ID: %s for user: %s',
      topicId,
      this.userId,
    );

    const results = await this.db.query.generationBatches.findMany({
      orderBy: (table, { asc }) => [asc(table.createdAt)],
      where: and(
        eq(generationBatches.generationTopicId, topicId),
        eq(generationBatches.userId, this.userId),
      ),
      with: {
        generations: {
          orderBy: (table, { asc }) => [asc(table.createdAt), asc(table.id)],
          with: {
            asyncTask: true,
          },
        },
      },
    });

    log('Found %d generation batches with generations for topic %s', results.length, topicId);
    return results as GenerationBatchWithGenerations[];
  }

  async queryGenerationBatchesByTopicIdWithGenerations(
    topicId: string,
  ): Promise<(GenerationBatch & { generations: Generation[] })[]> {
    log('Fetching generation batches for topic ID: %s for user: %s', topicId, this.userId);

    const batchesWithGenerations = await this.findByTopicIdWithGenerations(topicId);
    if (batchesWithGenerations.length === 0) {
      log('No batches found for topic: %s', topicId);
      return [];
    }

    const configUrls = batchesWithGenerations.flatMap((batch) => {
      const config = batch.config as GenerationConfig;

      return [
        config.imageUrl,
        config.endImageUrl,
        ...(Array.isArray(config.imageUrls) ? config.imageUrls : []),
      ].filter((url): url is string => Boolean(url));
    });

    const stableReadableUrlMap = await this.buildStableReadableUrlMap(configUrls);

    // Transform the database result to match our frontend types
    const result: GenerationBatch[] = await Promise.all(
      batchesWithGenerations.map(async (batch) => {
        const [generations, config] = await Promise.all([
          // Transform generations
          Promise.all(
            batch.generations.map((gen) => this.generationModel.transformGeneration(gen)),
          ),
          // Transform config
          (async () => {
            const config = batch.config as GenerationConfig;

            // Handle single imageUrl
            if (config.imageUrl) {
              config.imageUrl = await this.resolveConfigFileUrl(
                config.imageUrl,
                stableReadableUrlMap,
              );
            }

            // Handle endImageUrl (video start/end frame)
            if (config.endImageUrl) {
              config.endImageUrl = await this.resolveConfigFileUrl(
                config.endImageUrl,
                stableReadableUrlMap,
              );
            }

            // Handle imageUrls array
            if (Array.isArray(config.imageUrls)) {
              config.imageUrls = await Promise.all(
                config.imageUrls.map((url) =>
                  this.resolveConfigFileUrl(url, stableReadableUrlMap),
                ),
              );
            }
            return config;
          })(),
        ]);

        return {
          config,
          createdAt: batch.createdAt,
          generations,
          height: batch.height,
          id: batch.id,
          model: batch.model,
          prompt: batch.prompt,
          provider: batch.provider,
          width: batch.width,
        };
      }),
    );

    log('Feed construction complete for topic: %s, returning %d batches', topicId, result.length);
    return result;
  }

  /**
   * Delete a generation batch and return associated file URLs for cleanup
   *
   * This method follows the "database first, files second" deletion principle:
   * 1. First queries the batch with its generations to collect asset file URLs
   * 2. Then deletes the database record (cascade delete handles related generations)
   * 3. Returns the deleted batch data and file URLs for cleanup
   *
   * @param id - The batch ID to delete
   * @returns Object containing deleted batch data and file URLs to clean, or undefined if batch not found or access denied
   */
  async delete(
    id: string,
  ): Promise<{ deletedBatch: GenerationBatchItem; filesToDelete: string[] } | undefined> {
    log('Deleting generation batch: %s for user: %s', id, this.userId);

    // 1. First, get generations with their assets to collect file URLs for cleanup
    const batchWithGenerations = await this.db.query.generationBatches.findFirst({
      where: and(eq(generationBatches.id, id), eq(generationBatches.userId, this.userId)),
      with: {
        generations: {
          columns: {
            asset: true,
            fileId: true,
          },
        },
      },
    });

    // If batch doesn't exist or doesn't belong to user, return undefined
    if (!batchWithGenerations) {
      return undefined;
    }

    const fileIds = Array.from(
      new Set(
        batchWithGenerations.generations
          ?.map((generation) => generation.fileId)
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

    // 2. Collect auxiliary asset URLs that do not have dedicated file rows
    const filesToDelete = new Set<string>();
    if (batchWithGenerations.generations) {
      for (const gen of batchWithGenerations.generations) {
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

    // 3. Delete the batch record (this will cascade delete all associated generations)
    const [deletedBatch] = await this.db
      .delete(generationBatches)
      .where(and(eq(generationBatches.id, id), eq(generationBatches.userId, this.userId)))
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
        log('Failed to delete generation files for batch %s: %O', id, error);
      }
    }

    log(
      'Generation batch %s deleted successfully with %d files to clean',
      id,
      filesToDelete.size,
    );

    return {
      deletedBatch,
      filesToDelete: [...filesToDelete],
    };
  }
}
