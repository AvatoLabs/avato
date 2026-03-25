import { and, eq, gt, lt, or } from 'drizzle-orm';

import type { NewUploadSession, UploadSessionItem } from '../schemas';
import { uploadSessions } from '../schemas';
import type { LobeChatDatabase } from '../type';
import { UserModel } from './user';

export class UploadSessionModel {
  private readonly db: LobeChatDatabase;
  private readonly userId: string;

  constructor(db: LobeChatDatabase, userId: string) {
    this.db = db;
    this.userId = userId;
  }

  /**
   * Create a new upload session
   */
  create = async (
    params: Omit<NewUploadSession, 'id' | 'createdBy' | 'status'>,
  ): Promise<UploadSessionItem> => {
    await UserModel.makeSureUserExist(this.db, this.userId);
    const [session] = await this.db
      .insert(uploadSessions)
      .values({
        ...params,
        createdBy: this.userId,
        status: 'pending',
      })
      .returning();

    return session;
  };

  /**
   * Find an upload session by ID
   */
  findById = async (id: string): Promise<UploadSessionItem | undefined> => {
    const [session] = await this.db
      .select()
      .from(uploadSessions)
      .where(eq(uploadSessions.id, id))
      .limit(1);

    return session;
  };

  /**
   * Find a pending upload session by ID (validates not expired)
   */
  findPendingById = async (id: string): Promise<UploadSessionItem | undefined> => {
    const now = new Date();
    const [session] = await this.db
      .select()
      .from(uploadSessions)
      .where(
        and(
          eq(uploadSessions.id, id),
          eq(uploadSessions.status, 'pending'),
          gt(uploadSessions.expiresAt, now),
        ),
      )
      .limit(1);

    return session;
  };

  /**
   * Mark an upload session as completed
   */
  markCompleted = async (id: string, etag?: string): Promise<UploadSessionItem | undefined> => {
    const now = new Date();
    const [session] = await this.db
      .update(uploadSessions)
      .set({
        completedAt: now,
        etag,
        status: 'completed',
        updatedAt: now,
      })
      .where(and(eq(uploadSessions.id, id), eq(uploadSessions.status, 'pending')))
      .returning();

    return session;
  };

  /**
   * Mark an upload session as expired
   */
  markExpired = async (id: string): Promise<UploadSessionItem | undefined> => {
    const now = new Date();
    const [session] = await this.db
      .update(uploadSessions)
      .set({
        status: 'expired',
        updatedAt: now,
      })
      .where(eq(uploadSessions.id, id))
      .returning();

    return session;
  };

  /**
   * Mark an upload session as cancelled
   */
  markCancelled = async (id: string): Promise<UploadSessionItem | undefined> => {
    const now = new Date();
    const [session] = await this.db
      .update(uploadSessions)
      .set({
        status: 'cancelled',
        updatedAt: now,
      })
      .where(eq(uploadSessions.id, id))
      .returning();

    return session;
  };

  /**
   * Clean up expired upload sessions
   * Returns the number of deleted sessions
   */
  cleanupExpired = async (): Promise<number> => {
    const now = new Date();
    const result = await this.db
      .delete(uploadSessions)
      .where(
        and(
          or(eq(uploadSessions.status, 'pending'), eq(uploadSessions.status, 'expired')),
          lt(uploadSessions.expiresAt, now),
        ),
      )
      .returning({ id: uploadSessions.id });

    return result.length;
  };

  /**
   * Delete an upload session
   */
  delete = async (id: string): Promise<void> => {
    await this.db.delete(uploadSessions).where(eq(uploadSessions.id, id));
  };

  /**
   * Delete all expired sessions for a space
   */
  deleteExpiredBySpaceId = async (spaceId: string): Promise<number> => {
    const now = new Date();
    const result = await this.db
      .delete(uploadSessions)
      .where(and(eq(uploadSessions.spaceId, spaceId), lt(uploadSessions.expiresAt, now)))
      .returning({ id: uploadSessions.id });

    return result.length;
  };
}
