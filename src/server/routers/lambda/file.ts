import {
  FileAssetClassification,
  FileAssetRenditionKind,
  FileAssetReviewStatus,
  FileAssetUsagePolicy,
} from '@lobechat/types';
import { getMimeType } from '@lobechat/utils';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { businessFileUploadCheck } from '@/business/server/lambda-routers/file';
import { checkFileStorageUsage } from '@/business/server/trpc-middlewares/lambda';
import { serverDBEnv } from '@/config/db';
import { AsyncTaskModel } from '@/database/models/asyncTask';
import { ChunkModel } from '@/database/models/chunk';
import { ContentModel } from '@/database/models/content';
import { DocumentModel } from '@/database/models/document';
import { FileModel } from '@/database/models/file';
import { FileAssetModel } from '@/database/models/fileAsset';
import { SpaceModel } from '@/database/models/space';
import { KnowledgeRepo } from '@/database/repositories/knowledge';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import {
  AuthorizedResourceResolver,
  ContentAuthorizer,
  TreeGuard,
} from '@/server/services/content';
import { resolveFileAssetCapabilities } from '@/server/services/content/fileAssetPolicy';
import { FileService } from '@/server/services/file';
import { resolveRemovableStorageUrls } from '@/server/services/file/removableStorageUrls';
import { isStorageObjectMissingError } from '@/server/services/file/storageErrors';
import { AsyncTaskStatus, AsyncTaskType } from '@/types/asyncTask';
import { type FileGovernanceSummary, type FileListItem } from '@/types/files';
import { QueryFileListSchema, UploadFileSchema } from '@/types/files';

/**
 * Same-origin file proxy path for the web/desktop SPA.
 * Resolves against the current page origin so dev (Vite + `/f` proxy) and production both work.
 * Mobile prepends API base when `url` starts with `/` (see `resolveRemoteFileUrl`).
 */
const getFileProxyUrl = (fileId: string): string => `/f/${fileId}`;

const normalizeFileType = (fileType?: string | null, name?: string | null): string => {
  if (!fileType || fileType.toLowerCase().includes('octet-stream')) {
    const inferred = getMimeType(name || '');
    if (inferred && inferred !== 'application/octet-stream') return inferred;
  }

  return fileType || 'application/octet-stream';
};

const fileAssetMetadataSchema = z
  .object({
    custom: z.record(z.string(), z.unknown()).optional(),
    license: z.string().trim().optional(),
    renditions: z
      .array(
        z.union([
          z.nativeEnum(FileAssetRenditionKind),
          z.object({
            kind: z.nativeEnum(FileAssetRenditionKind),
            label: z.string().trim().optional(),
          }),
        ]),
      )
      .optional(),
    tags: z.array(z.string().trim()).optional(),
    version: z
      .object({
        label: z.string().trim().optional(),
        variantOf: z.string().trim().optional(),
      })
      .nullable()
      .optional(),
  })
  .catchall(z.unknown())
  .nullable()
  .optional();

const fileProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;

  return opts.next({
    ctx: {
      asyncTaskModel: new AsyncTaskModel(ctx.serverDB, ctx.userId),
      chunkModel: new ChunkModel(ctx.serverDB, ctx.userId),
      documentModel: new DocumentModel(ctx.serverDB, ctx.userId),
      fileModel: new FileModel(ctx.serverDB, ctx.userId),
      fileAssetModel: new FileAssetModel(ctx.serverDB),
      fileService: new FileService(ctx.serverDB, ctx.userId),
      knowledgeRepo: new KnowledgeRepo(ctx.serverDB, ctx.userId),
      resolver: new AuthorizedResourceResolver(ctx.serverDB, ctx.userId),
      contentAuthorizer: new ContentAuthorizer(ctx.serverDB, ctx.userId),
      contentModel: new ContentModel(ctx.serverDB, ctx.userId),
      spaceModel: new SpaceModel(ctx.serverDB, ctx.userId),
      treeGuard: new TreeGuard(ctx.serverDB, ctx.userId),
    },
  });
});

const resolveWriteSpaceId = async (
  ctx: {
    resolver: AuthorizedResourceResolver;
    spaceModel: SpaceModel;
  },
  params: {
    sourceSetId?: string;
    parentId?: string | null;
    spaceId?: string;
  },
) => {
  if (params.sourceSetId) {
    const sourceSet = await ctx.resolver.requireSourceSet(params.sourceSetId, 'create_child');
    return sourceSet.spaceId || (await ctx.spaceModel.getOrCreatePersonalSpace()).id;
  }

  if (params.parentId) {
    const parent = await ctx.resolver.requireDocument(params.parentId, 'create_child');
    return parent.spaceId || (await ctx.spaceModel.getOrCreatePersonalSpace()).id;
  }

  if (params.spaceId) {
    const space = await ctx.spaceModel.findAccessibleSpaceById(params.spaceId);
    if (!space?.id) throw new TRPCError({ code: 'FORBIDDEN', message: 'SPACE_ACCESS_DENIED' });

    if (space.membershipRole === 'viewer') {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'SPACE_WRITE_DENIED' });
    }

    return space.id;
  }

  const personalSpace = await ctx.spaceModel.getOrCreatePersonalSpace();
  return personalSpace.id;
};

const assertCanWriteFileAsset = async (
  ctx: {
    resolver: AuthorizedResourceResolver;
    spaceModel: SpaceModel;
  },
  fileId: string,
) => {
  const item = await ctx.resolver.requireFile(fileId, 'read_metadata');
  const targetSpaceId = item.spaceId || (await ctx.spaceModel.getOrCreatePersonalSpace()).id;
  const space = await ctx.spaceModel.findAccessibleSpaceById(targetSpaceId);
  const capabilities = resolveFileAssetCapabilities(space?.membershipRole);

  if (!space?.id) throw new TRPCError({ code: 'FORBIDDEN', message: 'SPACE_ACCESS_DENIED' });
  if (!capabilities.canEditGovernance && !capabilities.canApprove && !capabilities.canArchive) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'FILE_ASSET_WRITE_DENIED' });
  }

  return { capabilities, file: item, spaceId: space.id };
};

const resolveParentDocumentId = async (
  ctx: {
    documentModel: DocumentModel;
    resolver: AuthorizedResourceResolver;
    spaceModel: SpaceModel;
  },
  params: {
    sourceSetId?: string;
    parentId?: string | null;
    spaceId?: string;
  },
) => {
  if (!params.parentId) return params.parentId;

  let scopedSpaceId = params.spaceId;
  if (!scopedSpaceId && params.sourceSetId) {
    const sourceSet = await ctx.resolver.requireSourceSet(params.sourceSetId, 'create_child');
    scopedSpaceId = sourceSet.spaceId || (await ctx.spaceModel.getOrCreatePersonalSpace()).id;
  }

  if (scopedSpaceId) {
    const scopedFolder = await ctx.documentModel.findBySlugInSpace(params.parentId, scopedSpaceId);
    if (scopedFolder) return scopedFolder.id;
  }

  const docBySlug = await ctx.documentModel.findBySlug(params.parentId);
  return docBySlug?.id || params.parentId;
};

const restoreDeletedFiles = async (
  ctx: {
    fileModel: FileModel;
    contentAuthorizer: ContentAuthorizer;
    contentModel: ContentModel;
  },
  ids: string[],
) => {
  const dedupIds = [...new Set(ids)].filter(Boolean);
  if (dedupIds.length === 0) return [];

  for (const id of dedupIds) {
    await ctx.contentAuthorizer.assertCapability({
      capability: 'delete',
      id,
      kind: 'file',
    });
  }

  const fileRows = (await Promise.all(dedupIds.map((id) => ctx.fileModel.findByIdAny(id)))).filter(
    (item): item is NonNullable<typeof item> => Boolean(item?.deletedAt),
  );

  if (fileRows.length === 0) return [];

  await Promise.all(fileRows.map((item) => ctx.fileModel.updateAny(item.id, { deletedAt: null })));

  await ctx.contentModel.invalidateAuthzEpochsAfterRemoval(
    fileRows.map((item) => ({ contentUid: item.contentUid, spaceId: item.spaceId })),
  );

  const restored = await Promise.all(fileRows.map((item) => ctx.fileModel.findByIdAny(item.id)));

  return restored.filter(Boolean);
};

const buildFileAssetMap = async (ctx: { fileAssetModel: FileAssetModel }, fileIds: string[]) => {
  const assetRows = await ctx.fileAssetModel.findByFileIds(fileIds);

  return new Map(
    assetRows.map((item) => {
      const renditions = item.metadata?.renditions ?? [];
      const primaryRendition = renditions[0];

      return [
        item.fileId,
        {
          assetClassification: item.classification,
          assetPrimaryRenditionKind: primaryRendition?.kind ?? null,
          assetPrimaryRenditionLabel: primaryRendition?.label ?? null,
          assetReviewStatus: item.reviewStatus,
          assetRenditionCount: renditions.length || null,
          assetUsagePolicy: item.usagePolicy,
          assetVersionLabel: item.metadata?.version?.label ?? null,
        },
      ];
    }),
  );
};

const buildFileGovernanceSummaryGroup = <T extends string>(
  rows: Array<{
    assetClassification?: FileAssetClassification | null;
    assetReviewStatus?: FileAssetReviewStatus | null;
    assetUsagePolicy?: FileAssetUsagePolicy | null;
  }>,
  values: readonly T[],
  resolveValue: (row: (typeof rows)[number]) => T,
) => {
  const counts = Object.fromEntries(values.map((value) => [value, 0])) as Partial<
    Record<T, number>
  >;

  for (const row of rows) {
    const value = resolveValue(row);
    counts[value] = (counts[value] ?? 0) + 1;
  }

  return {
    counts,
    total: rows.length,
  };
};

const assertAccessibleKnowledgeSpace = async (
  ctx: {
    documentModel: DocumentModel;
    resolver: AuthorizedResourceResolver;
    spaceModel: SpaceModel;
  },
  input: {
    parentId?: string | null;
    sourceSetId?: string;
    spaceId?: string;
  },
) => {
  if (!input.spaceId) return;

  const space = await ctx.spaceModel.findAccessibleSpaceById(input.spaceId);
  if (space?.id) return;

  let scopedSpaceId: string | null | undefined;

  if (input.sourceSetId) {
    const sourceSet = await ctx.resolver.requireSourceSet(input.sourceSetId, 'read_content');
    scopedSpaceId = sourceSet.spaceId;
  } else if (input.parentId) {
    const resolvedParentId = await resolveParentDocumentId(ctx, {
      parentId: input.parentId,
      spaceId: input.spaceId,
    });
    const folder = await ctx.resolver.requireDocument(resolvedParentId!, 'read_content');
    scopedSpaceId = folder.spaceId;
  }

  if (!scopedSpaceId || scopedSpaceId !== input.spaceId) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'SPACE_ACCESS_DENIED' });
  }
};

export const fileRouter = router({
  checkFileHash: fileProcedure
    .use(checkFileStorageUsage)
    .input(
      z.object({
        hash: z.string(),
        spaceId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const spaceId = await resolveWriteSpaceId(ctx, { spaceId: input.spaceId });
      const blob = await ctx.contentModel.findSpaceBlobByHash(spaceId, input.hash);

      if (!blob) return { isExist: false };

      try {
        await ctx.fileService.getFileMetadata(blob.storageKey);
      } catch (error) {
        if (isStorageObjectMissingError(error)) return { isExist: false };
        throw error;
      }

      return {
        fileType: blob.fileType,
        isExist: true,
        metadata: blob.metadata,
        size: blob.size,
        url: blob.storageKey,
      };
    }),

  createFile: fileProcedure
    .use(checkFileStorageUsage)
    .input(
      UploadFileSchema.omit({ url: true }).extend({
        parentId: z.string().optional(),
        spaceId: z.string().optional(),
        url: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const resolvedParentId = await resolveParentDocumentId(ctx, input);

      const spaceId = await resolveWriteSpaceId(ctx, {
        sourceSetId: input.sourceSetId,
        parentId: resolvedParentId,
        spaceId: input.spaceId,
      });

      await ctx.treeGuard.assertParentAssignment({
        currentSpaceId: spaceId,
        parentId: resolvedParentId,
      });

      let actualSize = input.size;
      let actualFileType = input.fileType;
      try {
        const { contentLength, contentType } = await ctx.fileService.getFileMetadata(input.url);
        if (contentLength >= 1) {
          actualSize = contentLength;
        }
        if (contentType && contentType !== 'application/octet-stream') {
          actualFileType = contentType;
        }
      } catch {
        // If metadata fetch fails, use original size from input
      }

      if (!actualFileType || actualFileType === 'application/octet-stream') {
        const inferredType = getMimeType(input.name);
        if (inferredType && inferredType !== 'application/octet-stream') {
          actualFileType = inferredType;
        }
      }

      await businessFileUploadCheck({
        actualSize,
        clientIp: ctx.clientIp ?? undefined,
        inputSize: input.size,
        url: input.url,
        userId: ctx.userId,
      });

      if (actualSize < 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'File size cannot be negative' });
      }

      if (!input.hash) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'FILE_HASH_REQUIRED' });
      }

      const blob = await ctx.contentModel.upsertSpaceBlob({
        createdBy: ctx.userId,
        etag: undefined,
        fileType: actualFileType,
        metadata: input.metadata,
        sha256: input.hash,
        size: actualSize,
        spaceId,
        status: 'ready',
        storageKey: input.url,
        verifiedAt: new Date(),
      });

      const existingFile =
        input.sourceSetId || input.spaceId || resolvedParentId
          ? await ctx.fileModel.findExistingByBlobAndContext({
              blobId: blob.id,
              fileType: actualFileType,
              sourceSetId: input.sourceSetId,
              name: input.name,
              parentId: resolvedParentId,
              source: input.source,
              spaceId,
            })
          : undefined;

      if (existingFile) {
        return { id: existingFile.id, url: getFileProxyUrl(existingFile.id) };
      }

      // User uploads are space-scoped via space_blobs; do not insert into global_files or set
      // files.file_hash (FK to global_files) to avoid cross-user existence leaks.
      const { id } = await ctx.fileModel.create(
        {
          blobId: blob.id,
          fileHash: null,
          fileType: actualFileType,
          sourceSetId: input.sourceSetId,
          metadata: input.metadata,
          name: input.name,
          parentId: resolvedParentId,
          size: actualSize,
          spaceId,
          url: input.url,
        },
        false,
      );

      const registry = await ctx.contentModel.ensureContentRegistry({
        createdBy: ctx.userId,
        kind: 'file',
        localId: id,
        spaceId,
      });

      await ctx.fileModel.update(id, {
        blobId: blob.id,
        contentUid: registry.contentUid,
        spaceId,
      } as any);

      await ctx.contentModel.ensureOwnerPermission({
        contentUid: registry.contentUid,
        spaceId,
      });

      return { id, url: getFileProxyUrl(id) };
    }),
  findById: fileProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await ctx.contentAuthorizer.assertCapability({
        capability: 'read_metadata',
        id: input.id,
        kind: 'file',
      });

      const item = await ctx.resolver.requireFile(input.id, 'read_metadata');
      if (!item) throw new TRPCError({ code: 'BAD_REQUEST', message: 'File not found' });

      return {
        chunkTaskId: item.chunkTaskId,
        clientId: item.clientId,
        createdAt: item.createdAt,
        embeddingTaskId: item.embeddingTaskId,
        fileHash: item.fileHash,
        fileType: normalizeFileType(item.fileType, item.name),
        id: item.id,
        metadata: item.metadata,
        name: item.name,
        parentId: item.parentId,
        size: item.size,
        source: item.source,
        updatedAt: item.updatedAt,
        url: getFileProxyUrl(item.id),
        userId: item.userId,
      };
    }),

  getFileItemById: fileProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .query(async ({ ctx, input }): Promise<FileListItem | undefined> => {
      const item = await ctx.resolver.requireFile(input.id, 'read_metadata');

      if (!item) throw new TRPCError({ code: 'NOT_FOUND', message: 'File not found' });

      let embeddingTask = null;
      if (item.embeddingTaskId) {
        embeddingTask = await ctx.asyncTaskModel.findById(item.embeddingTaskId);
      }
      let chunkingTask = null;
      if (item.chunkTaskId) {
        chunkingTask = await ctx.asyncTaskModel.findById(item.chunkTaskId);
      }

      const chunkCount = await ctx.chunkModel.countByFileId(input.id);

      return {
        chunkCount,
        chunkingError: chunkingTask?.error,
        chunkingStatus: chunkingTask?.status as AsyncTaskStatus,
        createdAt: item.createdAt,
        embeddingError: embeddingTask?.error,
        embeddingStatus: embeddingTask?.status as AsyncTaskStatus,
        fileType: normalizeFileType(item.fileType, item.name),
        finishEmbedding: embeddingTask?.status === AsyncTaskStatus.Success,
        id: item.id,
        metadata: item.metadata as Record<string, any> | null | undefined,
        name: item.name,
        parentId: item.parentId,
        size: item.size,
        sourceSetId: item.sourceSetId,
        sourceType: 'file' as const,
        spaceId: item.spaceId,
        updatedAt: item.updatedAt,
        url: getFileProxyUrl(item.id),
      };
    }),

  getFileAssetById: fileProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await ctx.contentAuthorizer.assertCapability({
        capability: 'read_metadata',
        id: input.id,
        kind: 'file',
      });

      const file = await ctx.resolver.requireFile(input.id, 'read_metadata');
      const targetSpaceId = file.spaceId || (await ctx.spaceModel.getOrCreatePersonalSpace()).id;
      const space = await ctx.spaceModel.findAccessibleSpaceById(targetSpaceId);

      if (!space?.id) throw new TRPCError({ code: 'FORBIDDEN', message: 'SPACE_ACCESS_DENIED' });

      return {
        capabilities: resolveFileAssetCapabilities(space.membershipRole),
        item: (await ctx.fileAssetModel.findByFileId(input.id)) ?? null,
      };
    }),

  getFiles: fileProcedure.input(QueryFileListSchema).query(async ({ ctx, input }) => {
    const fileList = await ctx.fileModel.query(input);

    const visibleIdSet = new Set(
      await ctx.contentAuthorizer.filterVisibleFileIdsForList(fileList.map((item) => item.id)),
    );
    const visibleList = fileList.filter((item) => visibleIdSet.has(item.id));
    const fileAssetMap = await buildFileAssetMap(
      ctx,
      visibleList.map((item) => item.id),
    );

    const fileIds = visibleList.map((item) => item.id);
    const chunks = await ctx.chunkModel.countByFileIds(fileIds);

    const chunkTaskIds = visibleList
      .map((result) => result.chunkTaskId)
      .filter(Boolean) as string[];

    const chunkTasks = await ctx.asyncTaskModel.findByIds(chunkTaskIds, AsyncTaskType.Chunking);

    const embeddingTaskIds = visibleList
      .map((result) => result.embeddingTaskId)
      .filter(Boolean) as string[];
    const embeddingTasks = await ctx.asyncTaskModel.findByIds(
      embeddingTaskIds,
      AsyncTaskType.Embedding,
    );

    const resultFiles = [] as any[];
    for (const { chunkTaskId, embeddingTaskId, ...item } of visibleList as any[]) {
      const chunkTask = chunkTaskId ? chunkTasks.find((task) => task.id === chunkTaskId) : null;
      const embeddingTask = embeddingTaskId
        ? embeddingTasks.find((task) => task.id === embeddingTaskId)
        : null;

      const fileItem = {
        ...fileAssetMap.get(item.id),
        ...item,
        chunkCount: chunks.find((chunk) => chunk.id === item.id)?.count ?? null,
        chunkingError: chunkTask?.error ?? null,
        chunkingStatus: chunkTask?.status as AsyncTaskStatus,
        embeddingError: embeddingTask?.error ?? null,
        embeddingStatus: embeddingTask?.status as AsyncTaskStatus,
        fileType: normalizeFileType(item.fileType, item.name),
        finishEmbedding: embeddingTask?.status === AsyncTaskStatus.Success,
        sourceType: 'file' as const,
        url: getFileProxyUrl(item.id),
      } as FileListItem;
      resultFiles.push(fileItem);
    }

    return resultFiles;
  }),

  getKnowledgeItems: fileProcedure.input(QueryFileListSchema).query(async ({ ctx, input }) => {
    await assertAccessibleKnowledgeSpace(ctx, input);

    // Request one more item than limit to check if there are more items
    const limit = input.limit ?? 50;
    const knowledgeItems = await ctx.knowledgeRepo.query({
      ...input,
      limit: limit + 1,
    });

    // Check if there are more items
    const hasMore = knowledgeItems.length > limit;

    // Take only the requested number of items
    const itemsToProcess = hasMore ? knowledgeItems.slice(0, limit) : knowledgeItems;

    // Filter out folders from Documents category when in Inbox (no sourceSetId)
    const filteredItems =
      !input.sourceSetId && !input.trash
        ? itemsToProcess.filter(
            (item) => !(item.sourceType === 'document' && item.fileType === 'custom/folder'),
          )
        : itemsToProcess;

    const fileIdsInList = filteredItems
      .filter((item) => item.sourceType === 'file')
      .map((item: any) => item.fileId || item.id);
    const docIdsInList = filteredItems
      .filter((item) => item.sourceType === 'document')
      .map((item) => item.id);
    const [visibleFileIdList, visibleDocIdList] = await Promise.all([
      ctx.contentAuthorizer.filterVisibleFileIdsForList(fileIdsInList),
      ctx.contentAuthorizer.filterVisibleDocumentIdsForList(docIdsInList, {
        documentIncludeDeleted: input.trash,
      }),
    ]);
    const visibleFiles = new Set(visibleFileIdList);
    const visibleDocs = new Set(visibleDocIdList);
    const aclFiltered = filteredItems.filter((item) => {
      if (item.sourceType === 'file') return visibleFiles.has((item as any).fileId || item.id);
      if (item.sourceType === 'document') return visibleDocs.has(item.id);

      return true;
    });

    const fileIds = aclFiltered
      .filter((item) => item.sourceType === 'file')
      .map((item: any) => item.fileId || item.id);
    const fileAssetMap = await buildFileAssetMap(ctx, fileIds);

    const attachableFileIds = input.attachableOnly
      ? new Set(
          await ctx.fileModel.getConversationAttachableFileIds(
            aclFiltered
              .filter((item) => item.sourceType === 'file')
              .map((item: any) => item.fileId || item.id),
          ),
        )
      : null;

    const scopedItems = aclFiltered.filter((item) => {
      if (!input.attachableOnly) return true;
      if (item.sourceType === 'document') return item.fileType === 'custom/folder';
      if (item.sourceType === 'file')
        return attachableFileIds?.has((item as any).fileId || item.id) ?? false;

      return false;
    });

    // Process files (add chunk info and async task status)
    const fileItems = scopedItems.filter((item) => item.sourceType === 'file');
    const scopedFileIds = fileItems.map((item: any) => item.fileId || item.id);
    const chunks = await ctx.chunkModel.countByFileIds(scopedFileIds);

    const chunkTaskIds = fileItems.map((item) => item.chunkTaskId).filter(Boolean) as string[];
    const chunkTasks = await ctx.asyncTaskModel.findByIds(chunkTaskIds, AsyncTaskType.Chunking);

    const embeddingTaskIds = fileItems
      .map((item) => item.embeddingTaskId)
      .filter(Boolean) as string[];
    const embeddingTasks = await ctx.asyncTaskModel.findByIds(
      embeddingTaskIds,
      AsyncTaskType.Embedding,
    );

    // Combine all items with their metadata
    const resultItems = [] as any[];
    for (const item of scopedItems) {
      if (item.sourceType === 'file') {
        const chunkTask = item.chunkTaskId
          ? chunkTasks.find((task) => task.id === item.chunkTaskId)
          : null;
        const embeddingTask = item.embeddingTaskId
          ? embeddingTasks.find((task) => task.id === item.embeddingTaskId)
          : null;

        resultItems.push({
          ...fileAssetMap.get((item as any).fileId || item.id),
          ...item,
          attachable: input.attachableOnly
            ? Boolean(attachableFileIds?.has((item as any).fileId || item.id))
            : undefined,
          chunkCount:
            chunks.find((chunk) => chunk.id === ((item as any).fileId || item.id))?.count ?? null,
          chunkingError: chunkTask?.error ?? null,
          chunkingStatus: chunkTask?.status as AsyncTaskStatus,
          editorData: null,
          embeddingError: embeddingTask?.error ?? null,
          embeddingStatus: embeddingTask?.status as AsyncTaskStatus,
          fileId: (item as any).fileId ?? null,
          fileType: normalizeFileType(item.fileType, item.name),
          finishEmbedding: embeddingTask?.status === AsyncTaskStatus.Success,
          url: getFileProxyUrl((item as any).fileId || item.id),
        } as FileListItem);
      } else {
        // Document item - no chunk processing needed, includes editorData
        const documentItem = {
          ...item,
          attachable: item.fileType !== 'custom/folder',
          chunkCount: null,
          chunkingError: null,
          chunkingStatus: null,
          embeddingError: null,
          embeddingStatus: null,
          fileId: (item as any).fileId ?? null,
          finishEmbedding: false,
        } as FileListItem;
        resultItems.push(documentItem);
      }
    }

    return {
      hasMore,
      items: resultItems,
    };
  }),

  getKnowledgeGovernanceSummary: fileProcedure
    .input(QueryFileListSchema)
    .query(async ({ ctx, input }): Promise<FileGovernanceSummary> => {
      await assertAccessibleKnowledgeSpace(ctx, input);

      const [classificationRows, reviewStatusRows, usagePolicyRows] = await Promise.all([
        ctx.fileModel.queryGovernanceRows({
          ...input,
          assetClassification: undefined,
        }),
        ctx.fileModel.queryGovernanceRows({
          ...input,
          assetReviewStatus: undefined,
        }),
        ctx.fileModel.queryGovernanceRows({
          ...input,
          assetUsagePolicy: undefined,
        }),
      ]);

      const [visibleClassificationRows, visibleReviewStatusRows, visibleUsagePolicyRows] =
        await Promise.all(
          [classificationRows, reviewStatusRows, usagePolicyRows].map(async (rows) => {
            const visibleIds = new Set(
              await ctx.contentAuthorizer.filterVisibleFileIdsForList(rows.map((item) => item.id)),
            );

            return rows.filter((item) => visibleIds.has(item.id));
          }),
        );

      return {
        classification: buildFileGovernanceSummaryGroup(
          visibleClassificationRows,
          Object.values(FileAssetClassification),
          (row) => row.assetClassification ?? FileAssetClassification.General,
        ),
        reviewStatus: buildFileGovernanceSummaryGroup(
          visibleReviewStatusRows,
          Object.values(FileAssetReviewStatus),
          (row) => row.assetReviewStatus ?? FileAssetReviewStatus.Draft,
        ),
        usagePolicy: buildFileGovernanceSummaryGroup(
          visibleUsagePolicyRows,
          Object.values(FileAssetUsagePolicy),
          (row) => row.assetUsagePolicy ?? FileAssetUsagePolicy.Internal,
        ),
      };
    }),

  recentFiles: fileProcedure
    .input(z.object({ limit: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 12;
      // Query extra rows so ACL filtering can still fill `limit` visible files
      const allItems = await ctx.knowledgeRepo.queryRecent(limit * 5);
      const fileCandidates = allItems.filter(
        (item) => item.sourceType === 'file' && item.fileType !== 'custom/document',
      );
      const visibleFileIds = new Set(
        await ctx.contentAuthorizer.filterVisibleFileIdsForList(
          fileCandidates.map((item) => item.fileId || item.id),
        ),
      );
      const fileItems = fileCandidates
        .filter((item) => visibleFileIds.has(item.fileId || item.id))
        .slice(0, limit);

      if (fileItems.length === 0) return [];

      // Get file IDs for batch processing
      const fileIds = fileItems.map((item) => item.fileId || item.id);
      const fileAssetMap = await buildFileAssetMap(ctx, fileIds);
      const chunksArray = await ctx.chunkModel.countByFileIds(fileIds);
      const chunks: Record<string, number> = {};
      for (const item of chunksArray) {
        if (item.id) chunks[item.id] = item.count;
      }

      const chunkTaskIds = fileItems.map((item) => item.chunkTaskId).filter(Boolean) as string[];
      const embeddingTaskIds = fileItems
        .map((item) => item.embeddingTaskId)
        .filter(Boolean) as string[];

      const [chunkTasks, embeddingTasks] = await Promise.all([
        chunkTaskIds.length > 0
          ? ctx.asyncTaskModel.findByIds(chunkTaskIds, AsyncTaskType.Chunking)
          : Promise.resolve([]),
        embeddingTaskIds.length > 0
          ? ctx.asyncTaskModel.findByIds(embeddingTaskIds, AsyncTaskType.Embedding)
          : Promise.resolve([]),
      ]);

      // Build result with task status
      const resultFiles: FileListItem[] = [];
      for (const item of fileItems) {
        const actualFileId = item.fileId || item.id;
        const chunkTask = item.chunkTaskId
          ? chunkTasks.find((task) => task.id === item.chunkTaskId)
          : null;
        const embeddingTask = item.embeddingTaskId
          ? embeddingTasks.find((task) => task.id === item.embeddingTaskId)
          : null;

        resultFiles.push({
          ...fileAssetMap.get(actualFileId),
          ...item,
          chunkCount: chunks[actualFileId] ?? 0,
          chunkingError: chunkTask?.error ?? null,
          chunkingStatus: chunkTask?.status as AsyncTaskStatus,
          embeddingError: embeddingTask?.error ?? null,
          embeddingStatus: embeddingTask?.status as AsyncTaskStatus,
          fileId: actualFileId,
          fileType: normalizeFileType(item.fileType, item.name),
          finishEmbedding: embeddingTask?.status === AsyncTaskStatus.Success,
          id: actualFileId,
          sourceType: 'file' as const,
          url: getFileProxyUrl(actualFileId),
        } as FileListItem);
      }

      return resultFiles;
    }),

  recentPages: fileProcedure
    .input(z.object({ limit: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 12;
      const allItems = await ctx.knowledgeRepo.queryRecent(limit * 5);
      const pageCandidates = allItems.filter(
        (item) => item.sourceType === 'document' && item.fileType !== 'custom/folder',
      );
      const visibleDocIds = new Set(
        await ctx.contentAuthorizer.filterVisibleDocumentIdsForList(
          pageCandidates.map((item) => item.id),
        ),
      );

      return pageCandidates.filter((item) => visibleDocIds.has(item.id)).slice(0, limit);
    }),

  removeAllFiles: fileProcedure.mutation(async ({ ctx }) => {
    const personalSpace = await ctx.spaceModel.getOrCreatePersonalSpace();
    const role = await ctx.contentModel.getSpaceMemberRole(personalSpace.id);
    if (!role || role === 'viewer') {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'CLEAR_FILES_DENIED' });
    }

    const cleared = await ctx.fileModel.clear(serverDBEnv.REMOVE_GLOBAL_FILE, {
      includeUnscoped: true,
      spaceId: personalSpace.id,
    });
    await ctx.contentModel.invalidateAuthzEpochsAfterRemoval(
      cleared.map((file) => ({ contentUid: file.contentUid, spaceId: file.spaceId })),
    );

    const removableUrls = await resolveRemovableStorageUrls(
      ctx.fileModel,
      cleared,
      serverDBEnv.REMOVE_GLOBAL_FILE,
    );

    if (removableUrls.length === 1) {
      await ctx.fileService.deleteFile(removableUrls[0]!);
    } else if (removableUrls.length > 1) {
      await ctx.fileService.deleteFiles(removableUrls);
    }

    return cleared;
  }),

  removeFile: fileProcedure
    .input(z.object({ id: z.string(), trash: z.boolean().optional() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.contentAuthorizer.assertCapability({
        capability: 'delete',
        id: input.id,
        kind: 'file',
      });

      // Default to soft delete (trash=true)
      const shouldSoftDelete = input.trash !== false;

      if (shouldSoftDelete) {
        // Soft delete: just set deletedAt
        const file = await ctx.fileModel.softDeleteAny(input.id);
        if (!file) return;

        await ctx.contentModel.invalidateAuthzEpochsAfterRemoval([
          { contentUid: file.contentUid, spaceId: file.spaceId },
        ]);
      } else {
        // Hard delete: remove from database and S3
        const existingFile = await ctx.fileModel.findByIdAny(input.id);
        if (!existingFile) return;

        await ctx.fileModel.deleteAny(input.id, serverDBEnv.REMOVE_GLOBAL_FILE);

        await ctx.contentModel.invalidateAuthzEpochsAfterRemoval([
          { contentUid: existingFile.contentUid, spaceId: existingFile.spaceId },
        ]);

        const removableUrls = await resolveRemovableStorageUrls(
          ctx.fileModel,
          [existingFile],
          serverDBEnv.REMOVE_GLOBAL_FILE,
        );

        if (removableUrls.length > 0) {
          await ctx.fileService.deleteFile(removableUrls[0]!);
        }
      }
    }),

  removeFileAsyncTask: fileProcedure
    .input(
      z.object({
        id: z.string(),
        type: z.enum(['embedding', 'chunk']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.contentAuthorizer.assertCapability({
        capability: 'delete',
        id: input.id,
        kind: 'file',
      });

      const file = await ctx.fileModel.findByIdAny(input.id);

      if (!file) return;

      const taskId = input.type === 'embedding' ? file.embeddingTaskId : file.chunkTaskId;

      if (!taskId) return;

      await ctx.asyncTaskModel.delete(taskId);
    }),

  removeFiles: fileProcedure
    .input(z.object({ ids: z.array(z.string()), trash: z.boolean().optional() }))
    .mutation(async ({ input, ctx }) => {
      for (const fid of input.ids) {
        await ctx.contentAuthorizer.assertCapability({
          capability: 'delete',
          id: fid,
          kind: 'file',
        });
      }

      // Default to soft delete (trash=true)
      const shouldSoftDelete = input.trash !== false;

      if (shouldSoftDelete) {
        // Soft delete: just set deletedAt
        await ctx.fileModel.softDeleteManyAny(input.ids);
        // Note: soft delete doesn't need to invalidate authz epochs immediately
        // as the files are still in the database (just marked as deleted)
      } else {
        // Hard delete: remove from database and S3
        const existingFiles = (
          await Promise.all(input.ids.map((id) => ctx.fileModel.findByIdAny(id)))
        ).filter(Boolean);

        if (existingFiles.length === 0) return;

        await ctx.fileModel.deleteManyAny(input.ids, serverDBEnv.REMOVE_GLOBAL_FILE);

        await ctx.contentModel.invalidateAuthzEpochsAfterRemoval(
          existingFiles.map((f) => ({ contentUid: f.contentUid, spaceId: f.spaceId })),
        );

        const removableUrls = await resolveRemovableStorageUrls(
          ctx.fileModel,
          existingFiles,
          serverDBEnv.REMOVE_GLOBAL_FILE,
        );

        if (removableUrls.length > 0) {
          await ctx.fileService.deleteFiles(removableUrls);
        }
      }
    }),

  restoreFile: fileProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [restored] = await restoreDeletedFiles(ctx, [input.id]);

      if (!restored) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'FILE_NOT_FOUND' });
      }

      return restored;
    }),

  restoreFiles: fileProcedure
    .input(z.object({ ids: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      return restoreDeletedFiles(ctx, input.ids);
    }),

  updateFile: fileProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        parentId: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, name, parentId } = input;

      const updates: Record<string, unknown> = {};
      let currentFile: Awaited<ReturnType<typeof ctx.resolver.requireFile>> | undefined;

      if (name !== undefined) {
        updates.name = name;
      }

      if (parentId !== undefined) {
        currentFile = await ctx.resolver.requireFile(id, 'move');
        const resolvedParentId = await resolveParentDocumentId(ctx, {
          parentId,
          spaceId: currentFile.spaceId,
        });
        updates.parentId = resolvedParentId;
      }

      if (Object.keys(updates).length === 0) {
        return { success: true };
      }

      await ctx.contentAuthorizer.assertCapability({
        capability: 'move',
        id,
        kind: 'file',
      });

      if (parentId !== undefined) {
        await ctx.treeGuard.assertParentAssignment({
          currentSpaceId: currentFile?.spaceId,
          parentId: updates.parentId as string | null | undefined,
        });
      }

      await ctx.fileModel.updateAny(id, updates);

      if (parentId !== undefined) {
        const row = await ctx.fileModel.findByIdAny(id);
        await ctx.contentModel.invalidateAuthzEpochsAfterRemoval([
          { contentUid: row?.contentUid, spaceId: row?.spaceId },
        ]);
      }

      return { success: true };
    }),

  updateFileAssetGovernance: fileProcedure
    .input(
      z.object({
        id: z.string(),
        metadata: fileAssetMetadataSchema,
        rightsOwner: z.string().nullable().optional(),
        classification: z.nativeEnum(FileAssetClassification).optional(),
        usagePolicy: z.nativeEnum(FileAssetUsagePolicy).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { capabilities, spaceId } = await assertCanWriteFileAsset(ctx, input.id);
      if (!capabilities.canEditGovernance) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'FILE_ASSET_GOVERNANCE_DENIED' });
      }

      const item = await ctx.fileAssetModel.upsert({
        createdBy: ctx.userId,
        fileId: input.id,
        classification: input.classification,
        metadata: input.metadata ?? undefined,
        rightsOwner: input.rightsOwner ?? null,
        spaceId,
        usagePolicy: input.usagePolicy,
      });

      return { capabilities, item };
    }),

  approveFileAsset: fileProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { capabilities, spaceId } = await assertCanWriteFileAsset(ctx, input.id);
      if (!capabilities.canApprove) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'FILE_ASSET_APPROVE_DENIED' });
      }

      const item = await ctx.fileAssetModel.upsert({
        createdBy: ctx.userId,
        fileId: input.id,
        reviewedAt: new Date(),
        reviewedBy: ctx.userId,
        reviewStatus: FileAssetReviewStatus.Approved,
        spaceId,
      });

      return { capabilities, item };
    }),

  archiveFileAsset: fileProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { capabilities, spaceId } = await assertCanWriteFileAsset(ctx, input.id);
      if (!capabilities.canArchive) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'FILE_ASSET_ARCHIVE_DENIED' });
      }

      const item = await ctx.fileAssetModel.upsert({
        createdBy: ctx.userId,
        fileId: input.id,
        reviewedAt: new Date(),
        reviewedBy: ctx.userId,
        reviewStatus: FileAssetReviewStatus.Archived,
        spaceId,
      });

      return { capabilities, item };
    }),
});

export type FileRouter = typeof fileRouter;
