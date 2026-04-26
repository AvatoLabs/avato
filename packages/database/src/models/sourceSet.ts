import type { SourceSetItem } from '@lobechat/types';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';

import type { NewSourceSet } from '../schemas';
import { documents, files, sourceSetFiles, sourceSets } from '../schemas';
import type { LobeChatDatabase } from '../type';

export class SourceSetModel {
  private userId: string;
  private db: LobeChatDatabase;

  constructor(db: LobeChatDatabase, userId: string) {
    this.userId = userId;
    this.db = db;
  }

  private chunk<T>(items: T[], size = 200): T[][] {
    if (items.length <= size) return [items];

    const result: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
      result.push(items.slice(i, i + size));
    }
    return result;
  }

  private resolveMembershipTargets = async (
    ids: string[],
    options?: { scopedToUser?: boolean },
  ): Promise<{
    documentIds: string[];
    fileIds: string[];
  }> => {
    interface SourceSetDocumentNode {
      fileId: string | null;
      fileType: string | null;
      id: string;
    }

    const dedupIds = [...new Set(ids)].filter(Boolean);
    const rootDocumentIds = dedupIds.filter((itemId) => itemId.startsWith('docs_'));
    const directFileIds = dedupIds.filter((itemId) => !itemId.startsWith('docs_'));

    const documentWhere = (extraCondition: ReturnType<typeof eq> | ReturnType<typeof inArray>) => {
      const conditions = [extraCondition, isNull(documents.deletedAt)];
      if (options?.scopedToUser) {
        conditions.push(eq(documents.userId, this.userId));
      }

      return and(...conditions);
    };

    const fileWhere = (extraCondition: ReturnType<typeof inArray>) => {
      const conditions = [extraCondition];
      if (options?.scopedToUser) {
        conditions.push(eq(files.userId, this.userId));
      }

      return and(...conditions);
    };

    const rootDocuments: SourceSetDocumentNode[] =
      rootDocumentIds.length === 0
        ? []
        : await this.db
            .select({
              fileId: documents.fileId,
              fileType: documents.fileType,
              id: documents.id,
            })
            .from(documents)
            .where(documentWhere(inArray(documents.id, rootDocumentIds)));

    const allDocuments = new Map(rootDocuments.map((doc) => [doc.id, doc] as const));
    let folderQueue = rootDocuments
      .filter((doc) => doc.fileType === 'custom/folder')
      .map((doc) => doc.id);

    while (folderQueue.length > 0) {
      const nextFolderQueue: string[] = [];

      for (const folderChunk of this.chunk(folderQueue)) {
        const children: SourceSetDocumentNode[] = await this.db
          .select({
            fileId: documents.fileId,
            fileType: documents.fileType,
            id: documents.id,
          })
          .from(documents)
          .where(documentWhere(inArray(documents.parentId, folderChunk)));

        for (const child of children) {
          if (allDocuments.has(child.id)) continue;
          allDocuments.set(child.id, child);

          if (child.fileType === 'custom/folder') {
            nextFolderQueue.push(child.id);
          }
        }
      }

      folderQueue = nextFolderQueue;
    }

    const allDocs = [...allDocuments.values()];
    const folderIds = allDocs
      .filter((doc) => doc.fileType === 'custom/folder')
      .map((doc) => doc.id);

    const fileIds = new Set([
      ...directFileIds,
      ...allDocs.map((doc) => doc.fileId).filter((itemId): itemId is string => Boolean(itemId)),
    ]);

    if (folderIds.length > 0) {
      for (const folderChunk of this.chunk(folderIds)) {
        const childFiles = await this.db
          .select({ id: files.id })
          .from(files)
          .where(fileWhere(inArray(files.parentId, folderChunk)));

        for (const file of childFiles) {
          fileIds.add(file.id);
        }
      }
    }

    return {
      documentIds: allDocs.map((doc) => doc.id),
      fileIds: [...fileIds],
    };
  };

  // create

  create = async (params: Omit<NewSourceSet, 'userId'>) => {
    const [result] = await this.db
      .insert(sourceSets)
      .values({ ...params, userId: this.userId })
      .returning();

    return result;
  };

  addFilesToSourceSetAny = async (id: string, fileIds: string[], spaceId?: string) => {
    const { documentIds, fileIds: resolvedFileIds } = await this.resolveMembershipTargets(fileIds);

    if (documentIds.length > 0) {
      await this.db
        .update(documents)
        .set({ sourceSetId: id })
        .where(and(inArray(documents.id, documentIds), isNull(documents.deletedAt)));
    }

    if (resolvedFileIds.length === 0) {
      return [];
    }

    let resolvedSpaceId = spaceId;
    if (!resolvedSpaceId) {
      const sourceSet = await this.findByIdAny(id);
      resolvedSpaceId = sourceSet?.spaceId || undefined;
    }

    return this.db
      .insert(sourceSetFiles)
      .values(
        resolvedFileIds.map((fileId) => ({
          fileId,
          sourceSetId: id,
          spaceId: resolvedSpaceId,
          userId: this.userId,
        })),
      )
      .returning();
  };

  addFilesToSourceSet = async (id: string, fileIds: string[], spaceId?: string) => {
    const { documentIds, fileIds: resolvedFileIds } = await this.resolveMembershipTargets(fileIds, {
      scopedToUser: true,
    });

    if (documentIds.length > 0) {
      await this.db
        .update(documents)
        .set({ sourceSetId: id })
        .where(
          and(
            inArray(documents.id, documentIds),
            eq(documents.userId, this.userId),
            isNull(documents.deletedAt),
          ),
        );
    }

    // Insert using resolved file IDs
    if (resolvedFileIds.length === 0) {
      return [];
    }

    // Get spaceId from source set if not provided
    let resolvedSpaceId = spaceId;
    if (!resolvedSpaceId) {
      const sourceSet = await this.findById(id);
      resolvedSpaceId = sourceSet?.spaceId || undefined;
    }

    return this.db
      .insert(sourceSetFiles)
      .values(
        resolvedFileIds.map((fileId) => ({
          fileId,
          sourceSetId: id,
          spaceId: resolvedSpaceId,
          userId: this.userId,
        })),
      )
      .returning();
  };

  // delete
  delete = async (id: string) => {
    return this.db
      .delete(sourceSets)
      .where(and(eq(sourceSets.id, id), eq(sourceSets.userId, this.userId)));
  };

  deleteAny = async (id: string) => this.db.delete(sourceSets).where(eq(sourceSets.id, id));

  deleteAll = async () => {
    return this.db.delete(sourceSets).where(eq(sourceSets.userId, this.userId));
  };

  removeFilesFromSourceSetAny = async (sourceSetId: string, ids: string[]) => {
    const { documentIds, fileIds: resolvedFileIds } = await this.resolveMembershipTargets(ids);

    if (documentIds.length > 0) {
      await this.db
        .update(documents)
        .set({ sourceSetId: null })
        .where(
          and(
            inArray(documents.id, documentIds),
            eq(documents.sourceSetId, sourceSetId),
            isNull(documents.deletedAt),
          ),
        );
    }

    if (resolvedFileIds.length === 0) {
      return;
    }

    return this.db
      .delete(sourceSetFiles)
      .where(
        and(
          eq(sourceSetFiles.sourceSetId, sourceSetId),
          inArray(sourceSetFiles.fileId, resolvedFileIds),
        ),
      );
  };

  removeFilesFromSourceSet = async (sourceSetId: string, ids: string[]) => {
    const { documentIds, fileIds: resolvedFileIds } = await this.resolveMembershipTargets(ids, {
      scopedToUser: true,
    });

    if (documentIds.length > 0) {
      await this.db
        .update(documents)
        .set({ sourceSetId: null })
        .where(
          and(
            inArray(documents.id, documentIds),
            eq(documents.userId, this.userId),
            eq(documents.sourceSetId, sourceSetId),
            isNull(documents.deletedAt),
          ),
        );
    }

    // Delete using resolved file IDs
    if (resolvedFileIds.length === 0) {
      return;
    }

    return this.db
      .delete(sourceSetFiles)
      .where(
        and(
          eq(sourceSetFiles.userId, this.userId),
          eq(sourceSetFiles.sourceSetId, sourceSetId),
          inArray(sourceSetFiles.fileId, resolvedFileIds),
        ),
      );
  };
  // query
  query = async (spaceId?: string) => {
    const data = await this.db
      .select({
        avatar: sourceSets.avatar,
        createdAt: sourceSets.createdAt,
        description: sourceSets.description,
        id: sourceSets.id,
        name: sourceSets.name,
        settings: sourceSets.settings,
        spaceId: sourceSets.spaceId,
        type: sourceSets.type,
        updatedAt: sourceSets.updatedAt,
      })
      .from(sourceSets)
      .where(spaceId ? eq(sourceSets.spaceId, spaceId) : eq(sourceSets.userId, this.userId))
      .orderBy(desc(sourceSets.updatedAt));

    return data as SourceSetItem[];
  };

  findByIdAny = async (id: string) => {
    return this.db.query.sourceSets.findFirst({
      where: eq(sourceSets.id, id),
    });
  };

  findById = async (id: string) => {
    return this.db.query.sourceSets.findFirst({
      where: and(eq(sourceSets.id, id), eq(sourceSets.userId, this.userId)),
    });
  };

  // update
  update = async (id: string, value: Partial<SourceSetItem>) =>
    this.db
      .update(sourceSets)
      .set({ ...value, updatedAt: new Date() })
      .where(and(eq(sourceSets.id, id), eq(sourceSets.userId, this.userId)));

  updateAny = async (id: string, value: Partial<SourceSetItem>) =>
    this.db
      .update(sourceSets)
      .set({ ...value, updatedAt: new Date() })
      .where(eq(sourceSets.id, id));

  static findById = async (db: LobeChatDatabase, id: string) =>
    db.query.sourceSets.findFirst({
      where: eq(sourceSets.id, id),
    });
}
