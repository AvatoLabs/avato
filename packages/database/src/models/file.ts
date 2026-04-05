import {
  FileAssetClassification,
  FileAssetReviewStatus,
  FileAssetUsagePolicy,
  FilesTabs,
  type QueryFileListParams,
  SortType,
} from '@lobechat/types';
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  like,
  notExists,
  or,
  sql,
  sum,
} from 'drizzle-orm';
import type { PgTransaction } from 'drizzle-orm/pg-core';

import {
  chunks,
  documentChunks,
  documents,
  embeddings,
  fileAssets,
  fileChunks,
  type FileItem,
  files,
  filesToSessions,
  globalFiles,
  type NewFile,
  type NewGlobalFile,
  sourceSetFiles,
} from '../schemas';
import { agentSkills } from '../schemas/agentSkill';
import type { LobeChatDatabase, Transaction } from '../type';

export class FileModel {
  private readonly userId: string;
  private db: LobeChatDatabase;

  constructor(db: LobeChatDatabase, userId: string) {
    this.userId = userId;
    this.db = db;
  }

  /**
   * Get file by ID without userId filter (public access)
   * Use this for scenarios like file proxy where file should be accessible by ID alone
   *
   * @param db - Database instance
   * @param id - File ID
   * @returns File record or undefined
   */
  static async getFileById(db: LobeChatDatabase, id: string): Promise<FileItem | undefined> {
    return db.query.files.findFirst({
      where: eq(files.id, id),
    });
  }

  create = async (
    params: Omit<NewFile, 'id' | 'userId'> & {
      id?: string;
      sourceSetId?: string;
      parentId?: string;
    },
    insertToGlobalFiles?: boolean,
    trx?: Transaction,
  ): Promise<{ id: string }> => {
    const executeInTransaction = async (tx: Transaction): Promise<FileItem> => {
      if (insertToGlobalFiles) {
        await tx
          .insert(globalFiles)
          .values({
            creator: this.userId,
            fileType: params.fileType,
            hashId: params.fileHash!,
            metadata: params.metadata,
            size: params.size,
            url: params.url,
          })
          .onConflictDoNothing();
      }

      const result = (await tx
        .insert(files)
        .values({ ...params, userId: this.userId })
        .returning()) as FileItem[];

      const item = result[0]!;

      if (params.sourceSetId) {
        await tx.insert(sourceSetFiles).values({
          fileId: item.id,
          sourceSetId: params.sourceSetId,
          userId: this.userId,
        });
      }

      return item;
    };

    const result = await (trx
      ? executeInTransaction(trx)
      : this.db.transaction(executeInTransaction));
    return { id: result.id };
  };

  createGlobalFile = async (file: Omit<NewGlobalFile, 'id' | 'userId'>) => {
    return this.db.insert(globalFiles).values(file).onConflictDoNothing().returning();
  };

  checkHash = async (hash: string) => {
    const item = await this.db.query.globalFiles.findFirst({
      where: eq(globalFiles.hashId, hash),
    });
    if (!item) return { isExist: false };

    return {
      fileType: item.fileType,
      isExist: true,
      metadata: item.metadata,
      size: item.size,
      url: item.url,
    };
  };

  private buildFileListWhereClause = ({
    assetClassification,
    assetReviewStatus,
    assetUsagePolicy,
    category,
    q,
    sortType,
    sorter,
    sourceSetId,
    showFilesInSourceSet,
    spaceId,
  }: QueryFileListParams = {}) => {
    let whereClause = and(
      q ? ilike(files.name, `%${q}%`) : undefined,
      spaceId ? eq(files.spaceId, spaceId) : eq(files.userId, this.userId),
    );
    if (category && category !== FilesTabs.All && category !== FilesTabs.Home) {
      const fileTypePrefix = this.getFileTypePrefix(category as FilesTabs);
      if (Array.isArray(fileTypePrefix)) {
        whereClause = and(
          whereClause,
          or(...fileTypePrefix.map((prefix) => ilike(files.fileType, `${prefix}%`))),
        );
      } else {
        whereClause = and(whereClause, ilike(files.fileType, `${fileTypePrefix}%`));
      }
    }

    let orderByClause = desc(files.createdAt);
    const sortableFields = {
      createdAt: files.createdAt,
      name: files.name,
      size: files.size,
      updatedAt: files.updatedAt,
    } as const;
    type SortableField = keyof typeof sortableFields;

    if (sorter && sortType && sorter in sortableFields) {
      const sortFunction = sortType.toLowerCase() === SortType.Asc ? asc : desc;
      orderByClause = sortFunction(sortableFields[sorter as SortableField]);
    }

    const shouldJoinFileAssets = Boolean(
      assetClassification || assetReviewStatus || assetUsagePolicy,
    );

    if (assetClassification) {
      whereClause =
        assetClassification === FileAssetClassification.General
          ? and(
              whereClause,
              or(eq(fileAssets.classification, assetClassification), isNull(fileAssets.fileId)),
            )
          : and(whereClause, eq(fileAssets.classification, assetClassification));
    }

    if (assetReviewStatus) {
      whereClause =
        assetReviewStatus === FileAssetReviewStatus.Draft
          ? and(
              whereClause,
              or(eq(fileAssets.reviewStatus, assetReviewStatus), isNull(fileAssets.fileId)),
            )
          : and(whereClause, eq(fileAssets.reviewStatus, assetReviewStatus));
    }

    if (assetUsagePolicy) {
      whereClause =
        assetUsagePolicy === FileAssetUsagePolicy.Internal
          ? and(
              whereClause,
              or(eq(fileAssets.usagePolicy, assetUsagePolicy), isNull(fileAssets.fileId)),
            )
          : and(whereClause, eq(fileAssets.usagePolicy, assetUsagePolicy));
    }

    return {
      orderByClause,
      shouldJoinFileAssets,
      showFilesInSourceSet,
      sourceSetId,
      whereClause,
    };
  };

  private applyFileListScope = <T extends { where: (clause: unknown) => unknown }>(
    queryBuilder: T,
    {
      showFilesInSourceSet,
      sourceSetId,
      whereClause,
    }: {
      showFilesInSourceSet?: boolean;
      sourceSetId?: string;
      whereClause: unknown;
    },
  ) => {
    let query: any = queryBuilder;

    if (sourceSetId) {
      query = query.innerJoin(
        sourceSetFiles,
        and(eq(files.id, sourceSetFiles.fileId), eq(sourceSetFiles.sourceSetId, sourceSetId)),
      );
    } else if (!showFilesInSourceSet) {
      const nextWhereClause = and(
        whereClause as any,
        notExists(this.db.select().from(sourceSetFiles).where(eq(sourceSetFiles.fileId, files.id))),
      );

      return query.where(nextWhereClause);
    }

    return query.where(whereClause as any);
  };

  /**
   * Whether this user may read bytes for a global_files row (CAS by hash).
   * Allows: creator, a `files` row owned by this user pointing at the hash, or a skill
   * owned by this user whose zip or embedded resources reference the hash.
   */
  canAccessGlobalFileByHash = async (hash: string): Promise<boolean> => {
    const [globalFile] = await this.db
      .select({ creator: globalFiles.creator })
      .from(globalFiles)
      .where(eq(globalFiles.hashId, hash))
      .limit(1);

    if (!globalFile) return false;
    if (globalFile.creator === this.userId) return true;

    const [ownedFile] = await this.db
      .select({ id: files.id })
      .from(files)
      .where(and(eq(files.fileHash, hash), eq(files.userId, this.userId)))
      .limit(1);

    if (ownedFile) return true;

    const [skillRow] = await this.db
      .select({ id: agentSkills.id })
      .from(agentSkills)
      .where(
        and(
          eq(agentSkills.userId, this.userId),
          or(
            eq(agentSkills.zipFileHash, hash),
            sql`exists (
              select 1 from jsonb_each(${agentSkills.resources}) as _je
              where _je.value->>'fileHash' = ${hash}
            )`,
          ),
        ),
      )
      .limit(1);

    return Boolean(skillRow);
  };

  delete = async (id: string, removeGlobalFile: boolean = true, trx?: Transaction) => {
    const executeInTransaction = async (tx: Transaction) => {
      // In pglite environment, non-transactional operations cannot be used within a transaction as it will block
      const file = await this.findById(id, tx);
      if (!file) return;

      const fileHash = file.fileHash ?? null;

      // 2. Delete related chunks
      await this.deleteFileChunks(tx as any, [id]);

      // 3. Delete file record
      await tx.delete(files).where(and(eq(files.id, id), eq(files.userId, this.userId)));

      // Space-scoped user files may omit file_hash (no global_files row)
      if (!fileHash || !removeGlobalFile) {
        return file;
      }

      const result = await tx
        .select({ count: count() })
        .from(files)
        .where(eq(files.fileHash, fileHash));

      const fileCount = result[0].count;

      // delete the file from global file if it is not used by other files
      // if `DISABLE_REMOVE_GLOBAL_FILE` is true, we will not remove the global file
      if (fileCount === 0) {
        await tx.delete(globalFiles).where(eq(globalFiles.hashId, fileHash));

        return file;
      }
    };

    return await (trx ? executeInTransaction(trx) : this.db.transaction(executeInTransaction));
  };

  /**
   * Delete by id only. Caller must enforce authorization first.
   */
  deleteAny = async (id: string, removeGlobalFile: boolean = true, trx?: Transaction) => {
    const executeInTransaction = async (tx: Transaction) => {
      const file = await this.findByIdAny(id, tx);
      if (!file) return;

      const fileHash = file.fileHash ?? null;

      await this.deleteFileChunks(tx as any, [id]);

      await tx.delete(files).where(eq(files.id, id));

      if (!fileHash || !removeGlobalFile) {
        return file;
      }

      const result = await tx
        .select({ count: count() })
        .from(files)
        .where(eq(files.fileHash, fileHash));

      const fileCount = result[0].count;

      if (fileCount === 0) {
        await tx.delete(globalFiles).where(eq(globalFiles.hashId, fileHash));

        return file;
      }
    };

    return await (trx ? executeInTransaction(trx) : this.db.transaction(executeInTransaction));
  };

  deleteGlobalFile = async (hashId: string) => {
    return this.db.delete(globalFiles).where(eq(globalFiles.hashId, hashId));
  };

  countUsage = async () => {
    const result = await this.db
      .select({
        totalSize: sum(files.size),
      })
      .from(files)
      .where(eq(files.userId, this.userId));

    return parseInt(result[0].totalSize!) || 0;
  };

  deleteMany = async (ids: string[], removeGlobalFile: boolean = true) => {
    if (ids.length === 0) return [];

    return await this.db.transaction(async (trx) => {
      // 1. First get the file list to return the deleted files
      const fileList = await trx.query.files.findMany({
        where: and(inArray(files.id, ids), eq(files.userId, this.userId)),
      });

      if (fileList.length === 0) return [];

      // Extract file hashes that need to be checked
      const hashList = fileList.map((file) => file.fileHash!).filter(Boolean);

      // 2. Delete related chunks
      await this.deleteFileChunks(trx as any, ids);

      // 3. Delete file records
      await trx.delete(files).where(and(inArray(files.id, ids), eq(files.userId, this.userId)));

      // If global files don't need to be deleted, return directly
      if (!removeGlobalFile || hashList.length === 0) return fileList;

      // 4. Find hashes that are no longer referenced
      const remainingFiles = await trx
        .select({
          fileHash: files.fileHash,
        })
        .from(files)
        .where(inArray(files.fileHash, hashList));

      // Put still-in-use hashes into a Set for quick lookup
      const usedHashes = new Set(remainingFiles.map((file) => file.fileHash));

      // Find hashes to delete (those no longer used by any file)
      const hashesToDelete = hashList.filter((hash) => !usedHashes.has(hash));

      if (hashesToDelete.length === 0) return fileList;

      // 5. Delete global files that are no longer referenced
      await trx.delete(globalFiles).where(inArray(globalFiles.hashId, hashesToDelete));

      // Return the list of deleted files
      return fileList;
    });
  };

  /**
   * Batch delete by ids only (no `userId` filter). Caller must enforce authorization first.
   */
  deleteManyAny = async (ids: string[], removeGlobalFile: boolean = true) => {
    if (ids.length === 0) return [];

    return await this.db.transaction(async (trx) => {
      const fileList = await trx.query.files.findMany({
        where: inArray(files.id, ids),
      });

      if (fileList.length === 0) return [];

      const hashList = fileList.map((file) => file.fileHash!).filter(Boolean);

      await this.deleteFileChunks(trx as any, ids);

      await trx.delete(files).where(inArray(files.id, ids));

      if (!removeGlobalFile || hashList.length === 0) return fileList;

      const remainingFiles = await trx
        .select({
          fileHash: files.fileHash,
        })
        .from(files)
        .where(inArray(files.fileHash, hashList));

      const usedHashes = new Set(remainingFiles.map((file) => file.fileHash));

      const hashesToDelete = hashList.filter((hash) => !usedHashes.has(hash));

      if (hashesToDelete.length === 0) return fileList;

      await trx.delete(globalFiles).where(inArray(globalFiles.hashId, hashesToDelete));

      return fileList;
    });
  };

  /**
   * Soft delete by id only. Caller must enforce authorization first.
   */
  softDeleteAny = async (id: string) => {
    const file = await this.findByIdAny(id);
    if (!file) return;

    const now = new Date();
    await this.db.update(files).set({ deletedAt: now, updatedAt: now }).where(eq(files.id, id));

    return file;
  };

  /**
   * Batch soft delete by ids only. Caller must enforce authorization first.
   */
  softDeleteManyAny = async (ids: string[]) => {
    if (ids.length === 0) return [];

    const now = new Date();
    const CHUNK = 200;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      await this.db
        .update(files)
        .set({ deletedAt: now, updatedAt: now })
        .where(inArray(files.id, chunk));
    }

    return ids;
  };

  clear = async (
    removeGlobalFile: boolean = true,
    options?: { includeUnscoped?: boolean; spaceId?: string },
  ) => {
    return this.db.transaction(async (trx) => {
      const scopedWhereClause = and(
        eq(files.userId, this.userId),
        options?.spaceId
          ? or(
              eq(files.spaceId, options.spaceId),
              options.includeUnscoped ? isNull(files.spaceId) : undefined,
            )
          : undefined,
      );
      const fileList = await trx.query.files.findMany({
        where: scopedWhereClause,
      });

      if (fileList.length === 0) return [];

      const fileIds = fileList.map((file) => file.id);
      const hashList = Array.from(new Set(fileList.map((file) => file.fileHash!).filter(Boolean)));

      await this.deleteFileChunks(trx as any, fileIds);
      await trx.delete(files).where(scopedWhereClause);

      if (!removeGlobalFile || hashList.length === 0) return fileList;

      const remainingFiles = await trx
        .select({
          fileHash: files.fileHash,
        })
        .from(files)
        .where(inArray(files.fileHash, hashList));

      const usedHashes = new Set(remainingFiles.map((file) => file.fileHash));
      const hashesToDelete = hashList.filter((hash) => !usedHashes.has(hash));

      if (hashesToDelete.length > 0) {
        await trx.delete(globalFiles).where(inArray(globalFiles.hashId, hashesToDelete));
      }

      return fileList;
    });
  };

  clearFileChunks = async (fileIds: string[]) => {
    if (fileIds.length === 0) return [];

    return this.db.transaction(async (trx) => this.deleteFileChunks(trx as any, fileIds));
  };

  findExistingByBlobAndContext = async ({
    blobId,
    fileType,
    sourceSetId,
    name,
    parentId,
    source,
    spaceId,
  }: {
    blobId: string;
    fileType: string;
    sourceSetId?: string;
    name: string;
    parentId?: string | null;
    source?: string | null;
    spaceId?: string | null;
  }) => {
    const baseWhere = and(
      eq(files.userId, this.userId),
      eq(files.blobId, blobId),
      eq(files.fileType, fileType),
      eq(files.name, name),
      sql`${files.parentId} is not distinct from ${parentId ?? null}`,
      sql`${files.source} is not distinct from ${source ?? null}`,
      sql`${files.spaceId} is not distinct from ${spaceId ?? null}`,
      sql`${files.deletedAt} is null`,
    );

    if (sourceSetId) {
      const [result] = await this.db
        .select({ file: files })
        .from(files)
        .innerJoin(
          sourceSetFiles,
          and(eq(files.id, sourceSetFiles.fileId), eq(sourceSetFiles.sourceSetId, sourceSetId)),
        )
        .where(baseWhere)
        .limit(1);

      return result?.file;
    }

    const [result] = await this.db
      .select()
      .from(files)
      .where(
        and(
          baseWhere,
          notExists(
            this.db
              .select({ fileId: sourceSetFiles.fileId })
              .from(sourceSetFiles)
              .where(eq(sourceSetFiles.fileId, files.id)),
          ),
        ),
      )
      .limit(1);

    return result;
  };

  query = async ({
    assetClassification,
    assetReviewStatus,
    assetUsagePolicy,
    category,
    q,
    sortType,
    sorter,
    sourceSetId,
    showFilesInSourceSet,
    spaceId,
  }: QueryFileListParams = {}) => {
    const {
      orderByClause,
      shouldJoinFileAssets,
      showFilesInSourceSet: scopedShowFilesInSourceSet,
      sourceSetId: scopedSourceSetId,
      whereClause,
    } = this.buildFileListWhereClause({
      assetClassification,
      assetReviewStatus,
      assetUsagePolicy,
      category,
      q,
      sortType,
      sorter,
      sourceSetId,
      showFilesInSourceSet,
      spaceId,
    });

    let query = this.db
      .select({
        chunkTaskId: files.chunkTaskId,
        createdAt: files.createdAt,
        embeddingTaskId: files.embeddingTaskId,
        fileType: files.fileType,
        id: files.id,
        name: files.name,
        size: files.size,
        spaceId: files.spaceId,
        updatedAt: files.updatedAt,
        url: files.url,
      })
      .from(files);

    if (shouldJoinFileAssets) {
      query = query.leftJoin(fileAssets, eq(files.id, fileAssets.fileId));
    }

    return this.applyFileListScope(query, {
      showFilesInSourceSet: scopedShowFilesInSourceSet,
      sourceSetId: scopedSourceSetId,
      whereClause,
    }).orderBy(orderByClause);
  };

  queryGovernanceRows = async (params: QueryFileListParams = {}) => {
    const { showFilesInSourceSet, sourceSetId, whereClause } =
      this.buildFileListWhereClause(params);

    const query = this.db
      .select({
        assetClassification: fileAssets.classification,
        assetReviewStatus: fileAssets.reviewStatus,
        assetUsagePolicy: fileAssets.usagePolicy,
        id: files.id,
      })
      .from(files)
      .leftJoin(fileAssets, eq(files.id, fileAssets.fileId));

    return this.applyFileListScope(query, {
      showFilesInSourceSet,
      sourceSetId,
      whereClause,
    });
  };

  findByIds = async (ids: string[]) => {
    return this.db.query.files.findMany({
      where: and(inArray(files.id, ids), eq(files.userId, this.userId)),
    });
  };

  getConversationAttachableFileIds = async (fileIds: string[]) => {
    if (fileIds.length === 0) return [];

    const validFiles = await this.findByIds(fileIds);
    const candidateFileIds = validFiles
      .filter((file) => !file.fileType.startsWith('image'))
      .map((file) => file.id);

    if (candidateFileIds.length === 0) return [];

    const rows = await this.db
      .select({ fileId: documents.fileId })
      .from(documents)
      .where(
        and(
          eq(documents.userId, this.userId),
          inArray(documents.fileId, candidateFileIds),
          isNull(documents.deletedAt),
          sql`${documents.content} is not null`,
          sql`${documents.content} <> ''`,
        ),
      );

    return Array.from(
      new Set(rows.map((row) => row.fileId).filter((id): id is string => Boolean(id))),
    );
  };

  getConversationAvailableFiles = async () => {
    const allFiles = await this.query({ showFilesInSourceSet: true });
    const candidateFiles = allFiles.filter((file) => !file.fileType.startsWith('image'));

    if (candidateFiles.length === 0) return [];

    const attachableIds = new Set(
      await this.getConversationAttachableFileIds(candidateFiles.map((file) => file.id)),
    );

    return candidateFiles.filter((file) => attachableIds.has(file.id));
  };

  createSessionFiles = async (sessionId: string, fileIds: string[]) => {
    if (fileIds.length === 0) return;

    const validFileIds = await this.getConversationAttachableFileIds(fileIds);

    if (validFileIds.length === 0) return;

    const existingFiles = await this.db
      .select({ id: filesToSessions.fileId })
      .from(filesToSessions)
      .where(
        and(
          eq(filesToSessions.sessionId, sessionId),
          eq(filesToSessions.userId, this.userId),
          inArray(filesToSessions.fileId, validFileIds),
        ),
      );

    const existingFileIds = new Set(existingFiles.map((item) => item.id));
    const needToInsertFileIds = validFileIds.filter((fileId) => !existingFileIds.has(fileId));

    if (needToInsertFileIds.length === 0) return;

    return this.db.insert(filesToSessions).values(
      needToInsertFileIds.map((fileId) => ({
        fileId,
        sessionId,
        userId: this.userId,
      })),
    );
  };

  deleteSessionFile = async (sessionId: string, fileId: string) => {
    return this.db
      .delete(filesToSessions)
      .where(
        and(
          eq(filesToSessions.sessionId, sessionId),
          eq(filesToSessions.fileId, fileId),
          eq(filesToSessions.userId, this.userId),
        ),
      );
  };

  getSessionAssignedFiles = async (sessionId: string) => {
    const result = await this.db
      .select({ file: files })
      .from(filesToSessions)
      .leftJoin(files, eq(files.id, filesToSessions.fileId))
      .where(and(eq(filesToSessions.sessionId, sessionId), eq(filesToSessions.userId, this.userId)))
      .orderBy(desc(files.updatedAt));

    return result.map((item) => item.file).filter((item): item is FileItem => Boolean(item));
  };

  getSessionAssignedFileContents = async (sessionId: string) => {
    const assignedFiles = await this.getSessionAssignedFiles(sessionId);

    const validFiles = assignedFiles.filter((file) => !file.fileType.startsWith('image'));
    if (validFiles.length === 0) return [];

    const fileIds = validFiles.map((file) => file.id);
    const documentsData = await this.db.query.documents.findMany({
      where: and(
        eq(documents.userId, this.userId),
        inArray(documents.fileId, fileIds),
        isNull(documents.deletedAt),
      ),
    });

    const documentMap = new Map(documentsData.map((doc) => [doc.fileId, doc.content]));

    return validFiles
      .map((file) => ({
        content: documentMap.get(file.id),
        fileId: file.id,
        filename: file.name,
      }))
      .filter(
        (
          item,
        ): item is {
          content: string;
          fileId: string;
          filename: string;
        } => Boolean(item.content),
      );
  };

  toggleSessionFile = async (sessionId: string, fileId: string, enabled: boolean = true) => {
    if (!enabled) {
      await this.deleteSessionFile(sessionId, fileId);
      return;
    }

    await this.createSessionFiles(sessionId, [fileId]);
  };

  findById = async (id: string, trx?: Transaction) => {
    const database = trx || this.db;
    return database.query.files.findFirst({
      where: and(eq(files.id, id), eq(files.userId, this.userId)),
    });
  };

  /**
   * By primary key only (no `userId` filter). Caller must enforce authorization first.
   */
  findByIdAny = async (id: string, trx?: Transaction) => {
    const database = trx || this.db;
    return database.query.files.findFirst({
      where: eq(files.id, id),
    });
  };

  countFilesByHash = async (hash: string) => {
    const result = await this.db
      .select({
        count: count(),
      })
      .from(files)
      .where(and(eq(files.fileHash, hash)));

    return result[0].count;
  };

  update = async (id: string, value: Partial<FileItem>) =>
    this.db
      .update(files)
      .set({ ...value, updatedAt: new Date() })
      .where(and(eq(files.id, id), eq(files.userId, this.userId)));

  /** Update by id only. Caller must enforce authorization first. */
  updateAny = async (id: string, value: Partial<FileItem>) =>
    this.db
      .update(files)
      .set({ ...value, updatedAt: new Date() })
      .where(eq(files.id, id));

  /**
   * get the corresponding file type prefix according to FilesTabs
   */
  private getFileTypePrefix = (category: FilesTabs): string | string[] => {
    switch (category) {
      case FilesTabs.Audios: {
        return 'audio';
      }
      case FilesTabs.Documents: {
        return ['application', 'custom', 'text'];
      }
      case FilesTabs.Images: {
        return 'image';
      }
      case FilesTabs.Videos: {
        return 'video';
      }
      case FilesTabs.Websites: {
        return 'text/html';
      }
      default: {
        return '';
      }
    }
  };

  findByNames = async (fileNames: string[]) =>
    this.db.query.files.findMany({
      where: and(
        or(...fileNames.map((name) => like(files.name, `${name}%`))),
        eq(files.userId, this.userId),
      ),
    });

  // Abstract common method for deleting chunks
  private deleteFileChunks = async (trx: PgTransaction<any>, fileIds: string[]) => {
    if (fileIds.length === 0) return;

    // Get all chunk IDs related to the files to be deleted (knowledge base protection logic removed)
    const relatedChunks = await trx
      .select({ chunkId: fileChunks.chunkId })
      .from(fileChunks)
      .where(inArray(fileChunks.fileId, fileIds));

    const chunkIds = relatedChunks.map((c) => c.chunkId).filter(Boolean) as string[];

    if (chunkIds.length === 0) return;

    // Batch processing configuration
    const BATCH_SIZE = 1000;
    const MAX_CONCURRENT_BATCHES = 3;

    // Process in batches concurrently
    for (let i = 0; i < chunkIds.length; i += BATCH_SIZE * MAX_CONCURRENT_BATCHES) {
      const batchPromises = [];

      // Create multiple parallel batches
      for (let j = 0; j < MAX_CONCURRENT_BATCHES; j++) {
        const startIdx = i + j * BATCH_SIZE;
        if (startIdx >= chunkIds.length) break;

        const batchChunkIds = chunkIds.slice(startIdx, startIdx + BATCH_SIZE);
        if (batchChunkIds.length === 0) continue;

        // Process each batch in the correct deletion order, failures do not block the flow
        const batchPromise = (async () => {
          // 1. Delete embeddings (top-level, has foreign key dependencies)
          try {
            await trx.delete(embeddings).where(inArray(embeddings.chunkId, batchChunkIds));
          } catch (e) {
            // Silent handling, does not block deletion process
            console.warn('Failed to delete embeddings:', e);
          }

          // 2. Delete documentChunks association (if exists)
          try {
            await trx.delete(documentChunks).where(inArray(documentChunks.chunkId, batchChunkIds));
          } catch (e) {
            // Silent handling, does not block deletion process
            console.warn('Failed to delete documentChunks:', e);
          }

          // 3. Delete chunks (core data)
          try {
            await trx.delete(chunks).where(inArray(chunks.id, batchChunkIds));
          } catch (e) {
            // Silent handling, does not block deletion process
            console.warn('Failed to delete chunks:', e);
          }
        })();

        batchPromises.push(batchPromise);
      }

      // Wait for all tasks in the current batch to complete
      await Promise.all(batchPromises);
    }

    // 4. Finally delete fileChunks association table records
    try {
      await trx.delete(fileChunks).where(inArray(fileChunks.fileId, fileIds));
    } catch (e) {
      // Silent handling, does not block deletion process
      console.warn('Failed to delete fileChunks:', e);
    }

    return chunkIds;
  };
}
