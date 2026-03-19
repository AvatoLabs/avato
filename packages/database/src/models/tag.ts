import { and, asc, desc, eq } from 'drizzle-orm';

import type { NewTag, TagItem } from '../schemas';
import { tags } from '../schemas';
import type { LobeChatDatabase } from '../type';
import { idGenerator } from '../utils/idGenerator';

export class TagModel {
  private userId: string;
  private db: LobeChatDatabase;

  constructor(db: LobeChatDatabase, userId: string) {
    this.userId = userId;
    this.db = db;
  }

  create = async (params: Omit<NewTag, 'userId'>) => {
    const [result] = await this.db
      .insert(tags)
      .values({ ...params, id: this.genId(), userId: this.userId })
      .returning();

    return result;
  };

  delete = async (id: string) => {
    return this.db.delete(tags).where(and(eq(tags.id, id), eq(tags.userId, this.userId)));
  };

  deleteAll = async () => {
    return this.db.delete(tags).where(eq(tags.userId, this.userId));
  };

  query = async () => {
    return this.db.query.tags.findMany({
      orderBy: [asc(tags.sort), desc(tags.createdAt)],
      where: eq(tags.userId, this.userId),
    });
  };

  findById = async (id: string) => {
    return this.db.query.tags.findFirst({
      where: and(eq(tags.id, id), eq(tags.userId, this.userId)),
    });
  };

  update = async (id: string, value: Partial<TagItem>) => {
    return this.db
      .update(tags)
      .set({ ...value, updatedAt: new Date() })
      .where(and(eq(tags.id, id), eq(tags.userId, this.userId)));
  };

  updateOrder = async (sortMap: { id: string; sort: number }[]) => {
    await this.db.transaction(async (tx) => {
      const updates = sortMap.map(({ id, sort }) => {
        return tx
          .update(tags)
          .set({ sort, updatedAt: new Date() })
          .where(and(eq(tags.id, id), eq(tags.userId, this.userId)));
      });

      await Promise.all(updates);
    });
  };

  private genId = () => idGenerator('tags');
}
