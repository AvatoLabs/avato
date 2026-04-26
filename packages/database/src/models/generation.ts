import type {
  AsyncTaskError,
  AsyncTaskStatus,
  Generation,
  GenerationAsset,
  ImageGenerationAsset,
  VideoGenerationAsset,
} from '@lobechat/types';
import { FileSource } from '@lobechat/types';
import debug from 'debug';
import { and, eq, inArray } from 'drizzle-orm';

import { serverDBEnv } from '@/config/db';
import { FileService } from '@/server/services/file';
import { resolveRemovableStorageUrls } from '@/server/services/file/removableStorageUrls';

import type { NewFile } from '../schemas';
import type { GenerationItem, GenerationWithAsyncTask, NewGeneration } from '../schemas/generation';
import { generations } from '../schemas/generation';
import { files } from '../schemas/file';
import type { LobeChatDatabase, Transaction } from '../type';
import { FileModel } from './file';
import { resolveStableAppFileProxyUrl } from './utils/stableAppFileProxy';

// Create debug logger
const log = debug('lobe-image:generation-model');
const CANONICAL_SPACE_BLOB_KEY_PATTERN = /^v2\/spaces\/([^/]+)\/blobs\/.+/;

interface GenerationFileRecordInput {
  fileType: string;
  metadata?: NewFile['metadata'];
  name: string;
  sha256: string;
  size: number;
  storageKey: string;
}

export class GenerationModel {
  private db: LobeChatDatabase;
  private userId: string;
  private fileModel: FileModel;
  private fileService: FileService;

  constructor(db: LobeChatDatabase, userId: string) {
    this.db = db;
    this.userId = userId;
    this.fileModel = new FileModel(db, userId);
    this.fileService = new FileService(db, userId);
  }

  async create(value: Omit<NewGeneration, 'userId'>): Promise<GenerationItem> {
    log('Creating generation: %O', {
      generationBatchId: value.generationBatchId,
      userId: this.userId,
    });

    const [result] = await this.db
      .insert(generations)
      .values({ ...value, userId: this.userId })
      .returning();

    log('Generation created successfully: %s', result.id);
    return result;
  }

  async findById(id: string): Promise<GenerationItem | undefined> {
    log('Finding generation by ID: %s for user: %s', id, this.userId);

    const result = await this.db.query.generations.findFirst({
      where: and(eq(generations.id, id), eq(generations.userId, this.userId)),
    });

    log('Generation %s: %s', id, result ? 'found' : 'not found');
    return result;
  }

  async findByIdWithAsyncTask(id: string): Promise<GenerationWithAsyncTask | undefined> {
    log('Finding generation by ID: %s for user: %s', id, this.userId);

    const result = await this.db.query.generations.findFirst({
      where: and(eq(generations.id, id), eq(generations.userId, this.userId)),
      with: {
        asyncTask: true,
      },
    });

    log('Generation %s: %s', id, result ? 'found' : 'not found');
    return result as GenerationWithAsyncTask | undefined;
  }

  async update(id: string, value: Partial<NewGeneration>, trx?: Transaction) {
    log('Updating generation: %s with values: %O', id, {
      asyncTaskId: value.asyncTaskId,
      hasAsset: !!value.asset,
    });

    const executeUpdate = async (tx: Transaction) => {
      return await tx
        .update(generations)
        .set({ ...value, updatedAt: new Date() })
        .where(and(eq(generations.id, id), eq(generations.userId, this.userId)));
    };

    const result = await (trx ? executeUpdate(trx) : this.db.transaction(executeUpdate));

    log('Generation %s updated successfully', id);
    return result;
  }

  async createAssetAndFile(
    id: string,
    asset: GenerationAsset,
    file: GenerationFileRecordInput,
    source: FileSource = FileSource.ImageGeneration,
  ) {
    log('Creating generation asset and file: %s', id);

    const generation = await this.findById(id);
    if (!generation) {
      log('Skipping asset update for inaccessible generation: %s', id);
      return;
    }

    const match = file.storageKey.match(CANONICAL_SPACE_BLOB_KEY_PATTERN);
    if (!match) {
      throw new Error(
        `Generation asset storageKey must be canonical v2/spaces/{spaceId}/blobs/...: ${file.storageKey}`,
      );
    }

    const spaceId = match[1]!;
    const newFile = await this.fileService.createFileRecord({
      fileType: file.fileType,
      metadata: file.metadata,
      name: file.name,
      sha256: file.sha256,
      size: file.size,
      source,
      spaceId,
      storageKey: file.storageKey,
    });

    await this.update(id, {
      asset,
      fileId: newFile.fileId,
    });

    log('Generation %s updated with asset and file %s successfully', id, newFile.fileId);

    return {
      file: {
        id: newFile.fileId,
      },
    };
  }

  async findByAsyncTaskId(asyncTaskId: string) {
    log('Finding generation by asyncTaskId: %s', asyncTaskId);

    return this.db.query.generations.findFirst({
      where: eq(generations.asyncTaskId, asyncTaskId),
    });
  }

  async delete(
    id: string,
    trx?: Transaction,
  ): Promise<{ deletedGeneration: GenerationItem; filesToDelete: string[] } | undefined> {
    log('Deleting generation: %s for user: %s', id, this.userId);

    const generation = await this.db.query.generations.findFirst({
      columns: {
        asset: true,
        fileId: true,
      },
      where: and(eq(generations.id, id), eq(generations.userId, this.userId)),
    });
    if (!generation) return undefined;

    const generatedFileRows =
      generation.fileId === null
        ? []
        : await this.db.query.files.findMany({
            columns: { blobId: true, fileHash: true, url: true },
            where: and(eq(files.userId, this.userId), inArray(files.id, [generation.fileId])),
          });

    const filesToDelete = new Set<string>();
    const asset = generation.asset as ImageGenerationAsset | VideoGenerationAsset | null;
    if (asset) {
      if (!generation.fileId && asset.url) {
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

    const executeDelete = async (tx: Transaction) =>
      await tx
        .delete(generations)
        .where(and(eq(generations.id, id), eq(generations.userId, this.userId)))
        .returning();

    const result = await (trx ? executeDelete(trx) : this.db.transaction(executeDelete));
    const deletedGeneration = result[0];
    if (!deletedGeneration) return undefined;

    if (generation.fileId) {
      const removeGlobalFile = serverDBEnv.REMOVE_GLOBAL_FILE ?? true;

      try {
        await this.fileModel.deleteManyAny([generation.fileId], removeGlobalFile);

        const removableFileUrls = await resolveRemovableStorageUrls(
          this.fileModel,
          generatedFileRows,
          removeGlobalFile,
        );
        for (const url of removableFileUrls) {
          filesToDelete.add(url);
        }
      } catch (error) {
        log('Failed to delete generation file for generation %s: %O', id, error);
      }
    }

    log('Generation %s deleted successfully', id);
    return { deletedGeneration, filesToDelete: [...filesToDelete] };
  }

  /**
   * Find generation by ID and transform it to frontend type
   * This method uses findByIdWithAsyncTask and applies transformation
   */
  async findByIdAndTransform(id: string): Promise<Generation | null> {
    log('Finding and transforming generation: %s', id);

    const generation = await this.findByIdWithAsyncTask(id);
    if (!generation) {
      log('Generation %s not found', id);
      return null;
    }

    return await this.transformGeneration(generation);
  }

  /**
   * Transform a GenerationItem (database type) to Generation (frontend type)
   * This method processes asset URLs and async task information
   */
  async transformGeneration(generation: GenerationWithAsyncTask): Promise<Generation> {
    // Process asset URLs if they exist, following the same logic as in generationBatch.ts
    const asset = generation.asset as ImageGenerationAsset | VideoGenerationAsset | null;
    if (asset) {
      const assetUrls = [
        asset.url,
        asset.thumbnailUrl,
        'coverUrl' in asset ? asset.coverUrl : undefined,
      ].filter(Boolean) as string[];
      const stableReadableUrlMap = new Map(
        (await this.fileModel.findByUrls(assetUrls)).map((file) => [file.url, `/f/${file.id}`]),
      );
      const urlPromises: Promise<string>[] = [];
      const assignResolvedUrl: Array<(value: string) => void> = [];

      if (asset.url) {
        const stableProxyUrl = resolveStableAppFileProxyUrl(asset.url);

        if (stableProxyUrl) {
          asset.url = stableProxyUrl;
        } else if (generation.fileId) {
          asset.url = `/f/${generation.fileId}`;
        } else if (stableReadableUrlMap.has(asset.url)) {
          asset.url = stableReadableUrlMap.get(asset.url)!;
        } else {
          urlPromises.push(this.fileService.getFullFileUrl(asset.url));
          assignResolvedUrl.push((value) => {
            asset.url = value;
          });
        }
      }

      if (asset.thumbnailUrl) {
        const stableProxyUrl = resolveStableAppFileProxyUrl(asset.thumbnailUrl);

        if (stableProxyUrl) {
          asset.thumbnailUrl = stableProxyUrl;
        } else if (stableReadableUrlMap.has(asset.thumbnailUrl)) {
          asset.thumbnailUrl = stableReadableUrlMap.get(asset.thumbnailUrl)!;
        } else {
          urlPromises.push(this.fileService.getFullFileUrl(asset.thumbnailUrl));
          assignResolvedUrl.push((value) => {
            asset.thumbnailUrl = value;
          });
        }
      }

      const videoAsset = asset as VideoGenerationAsset;
      if (videoAsset.coverUrl) {
        const stableProxyUrl = resolveStableAppFileProxyUrl(videoAsset.coverUrl);

        if (stableProxyUrl) {
          videoAsset.coverUrl = stableProxyUrl;
        } else if (stableReadableUrlMap.has(videoAsset.coverUrl)) {
          videoAsset.coverUrl = stableReadableUrlMap.get(videoAsset.coverUrl)!;
        } else {
          urlPromises.push(this.fileService.getFullFileUrl(videoAsset.coverUrl));
          assignResolvedUrl.push((value) => {
            videoAsset.coverUrl = value;
          });
        }
      }

      if (urlPromises.length > 0) {
        const urls = await Promise.all(urlPromises);
        urls.forEach((value, index) => {
          assignResolvedUrl[index]?.(value);
        });
      }
    }

    // Build the Generation object following the same structure as in generationBatch.ts
    const result: Generation = {
      asset,
      asyncTaskId: generation.asyncTaskId || null,
      createdAt: generation.createdAt,
      fileId: generation.fileId || null,
      id: generation.id,
      seed: generation.seed,
      task: {
        error: generation.asyncTask?.error
          ? (generation.asyncTask.error as AsyncTaskError)
          : undefined,
        id: generation.asyncTaskId || '',
        status: (generation.asyncTask?.status as AsyncTaskStatus) || 'pending',
      },
    };
    return result;
  }
}
