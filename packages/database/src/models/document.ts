import { and, count, desc, eq, inArray, isNotNull, isNull } from 'drizzle-orm';

import type { DocumentItem, NewDocument } from '../schemas';
import { documents } from '../schemas';
import type { LobeChatDatabase } from '../type';

export interface QueryDocumentParams {
  current?: number;
  fileTypes?: string[];
  knowledgeBaseId?: string;
  pageSize?: number;
  sourceTypes?: string[];
  /** When true, only soft-deleted rows for this user (recycle bin). */
  trash?: boolean;
}

export class DocumentModel {
  private userId: string;
  private db: LobeChatDatabase;

  /** Active rows only (not in trash). */
  private static readonly notDeleted = isNull(documents.deletedAt);

  constructor(db: LobeChatDatabase, userId: string) {
    this.userId = userId;
    this.db = db;
  }

  create = async (params: Omit<NewDocument, 'userId'>): Promise<DocumentItem> => {
    const result = (await this.db
      .insert(documents)
      .values({ ...params, userId: this.userId })
      .returning()) as DocumentItem[];

    return result[0]!;
  };

  delete = async (id: string) => {
    const now = new Date();
    return this.db
      .update(documents)
      .set({ deletedAt: now, updatedAt: now })
      .where(
        and(
          eq(documents.id, id),
          eq(documents.userId, this.userId),
          DocumentModel.notDeleted,
        ),
      );
  };

  /** Soft-delete by ids only. Caller must enforce authorization first. */
  deleteManyAny = async (ids: string[]) => {
    if (ids.length === 0) return;

    const now = new Date();
    const CHUNK = 200;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      await this.db
        .update(documents)
        .set({ deletedAt: now, updatedAt: now })
        .where(and(inArray(documents.id, chunk), DocumentModel.notDeleted));
    }
  };

  deleteAll = async () => {
    const now = new Date();
    return this.db
      .update(documents)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(documents.userId, this.userId), DocumentModel.notDeleted));
  };

  query = async ({
    current = 0,
    pageSize = 9999,
    fileTypes,
    knowledgeBaseId,
    sourceTypes,
    trash,
  }: QueryDocumentParams = {}): Promise<{
    items: DocumentItem[];
    total: number;
  }> => {
    const offset = current * pageSize;
    const conditions = [
      eq(documents.userId, this.userId),
      trash ? isNotNull(documents.deletedAt) : DocumentModel.notDeleted,
    ];

    if (fileTypes?.length) {
      conditions.push(inArray(documents.fileType, fileTypes));
    }

    if (sourceTypes?.length) {
      conditions.push(inArray(documents.sourceType, sourceTypes as ('file' | 'web' | 'api')[]));
    }

    if (knowledgeBaseId) {
      conditions.push(eq(documents.knowledgeBaseId, knowledgeBaseId));
    }

    const whereCondition = and(...conditions);

    // Fetch items and total count in parallel
    // Optimize: Exclude large JSONB fields (content, pages, editorData) for better performance
    const [rawItems, totalResult] = await Promise.all([
      this.db
        .select({
          accessedAt: documents.accessedAt,
          clientId: documents.clientId,
          createdAt: documents.createdAt,
          fileId: documents.fileId,
          fileType: documents.fileType,
          filename: documents.filename,
          id: documents.id,
          metadata: documents.metadata,
          parentId: documents.parentId,
          slug: documents.slug,
          source: documents.source,
          sourceType: documents.sourceType,
          title: documents.title,
          totalCharCount: documents.totalCharCount,
          totalLineCount: documents.totalLineCount,
          updatedAt: documents.updatedAt,
          userId: documents.userId,
          // Exclude large fields: content, pages, editorData
        })
        .from(documents)
        .where(whereCondition)
        .orderBy(desc(trash ? documents.deletedAt : documents.updatedAt))
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ count: count(documents.id) })
        .from(documents)
        .where(whereCondition),
    ]);

    // Map to DocumentItem type with excluded fields as null
    const items = rawItems.map((item) => ({
      ...item,
      content: null,
      editorData: null,
      pages: null,
    })) as DocumentItem[];

    return { items, total: totalResult[0].count };
  };

  findById = async (id: string): Promise<DocumentItem | undefined> => {
    return this.db.query.documents.findFirst({
      where: and(
        eq(documents.userId, this.userId),
        eq(documents.id, id),
        DocumentModel.notDeleted,
      ),
    });
  };

  /** By primary key only. Caller must enforce authorization first. Excludes soft-deleted. */
  findByIdAny = async (id: string): Promise<DocumentItem | undefined> => {
    return this.db.query.documents.findFirst({
      where: and(eq(documents.id, id), DocumentModel.notDeleted),
    });
  };

  findByFileId = async (fileId: string) => {
    return this.db.query.documents.findFirst({
      where: and(
        eq(documents.userId, this.userId),
        eq(documents.fileId, fileId),
        DocumentModel.notDeleted,
      ),
    });
  };

  findBySlug = async (slug: string): Promise<DocumentItem | undefined> => {
    return this.db.query.documents.findFirst({
      where: and(
        eq(documents.userId, this.userId),
        eq(documents.slug, slug),
        DocumentModel.notDeleted,
      ),
    });
  };

  /**
   * All rows with this slug (unique per space). Caller must filter by authorization.
   */
  findManyBySlug = async (slug: string): Promise<DocumentItem[]> => {
    return this.db.query.documents.findMany({
      where: and(eq(documents.slug, slug), DocumentModel.notDeleted),
    });
  };

  update = async (id: string, value: Partial<DocumentItem>) => {
    return this.db
      .update(documents)
      .set({ ...value, updatedAt: new Date() })
      .where(
        and(
          eq(documents.userId, this.userId),
          eq(documents.id, id),
          DocumentModel.notDeleted,
        ),
      );
  };

  /** Update by id only. Caller must enforce authorization first. */
  updateAny = async (id: string, value: Partial<DocumentItem>) => {
    return this.db
      .update(documents)
      .set({ ...value, updatedAt: new Date() })
      .where(and(eq(documents.id, id), DocumentModel.notDeleted));
  };
}
