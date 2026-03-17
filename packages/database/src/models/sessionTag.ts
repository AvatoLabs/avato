import { and, asc, desc, eq } from 'drizzle-orm';

import type { NewSessionTag, SessionTagItem } from '../schemas';
import { sessionTags } from '../schemas';
import type { LobeChatDatabase } from '../type';
import { idGenerator } from '../utils/idGenerator';

export class SessionTagModel {
  private userId: string;
  private db: LobeChatDatabase;

  constructor(db: LobeChatDatabase, userId: string) {
    this.userId = userId;
    this.db = db;
  }

  create = async (params: Omit<NewSessionTag, 'userId'>) => {
    const [result] = await this.db
      .insert(sessionTags)
      .values({ ...params, id: this.genId(), userId: this.userId })
      .returning();

    return result;
  };

  delete = async (id: string) => {
    return this.db
      .delete(sessionTags)
      .where(and(eq(sessionTags.id, id), eq(sessionTags.userId, this.userId)));
  };

  deleteAll = async () => {
    return this.db.delete(sessionTags).where(eq(sessionTags.userId, this.userId));
  };

  query = async () => {
    return this.db.query.sessionTags.findMany({
      orderBy: [asc(sessionTags.sort), desc(sessionTags.createdAt)],
      where: eq(sessionTags.userId, this.userId),
    });
  };

  findById = async (id: string) => {
    return this.db.query.sessionTags.findFirst({
      where: and(eq(sessionTags.id, id), eq(sessionTags.userId, this.userId)),
    });
  };

  update = async (id: string, value: Partial<SessionTagItem>) => {
    return this.db
      .update(sessionTags)
      .set({ ...value, updatedAt: new Date() })
      .where(and(eq(sessionTags.id, id), eq(sessionTags.userId, this.userId)));
  };

  updateOrder = async (sortMap: { id: string; sort: number }[]) => {
    await this.db.transaction(async (tx) => {
      const updates = sortMap.map(({ id, sort }) => {
        return tx
          .update(sessionTags)
          .set({ sort, updatedAt: new Date() })
          .where(and(eq(sessionTags.id, id), eq(sessionTags.userId, this.userId)));
      });

      await Promise.all(updates);
    });
  };

  private genId = () => idGenerator('sessionTags');
}
