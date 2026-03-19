import { index, integer, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';

import { idGenerator } from '../utils/idGenerator';
import { timestamps } from './_helpers';
import { users } from './user';

export const tags = pgTable(
  'tags',
  {
    id: text('id')
      .$defaultFn(() => idGenerator('tags'))
      .primaryKey(),
    color: text('color'),
    name: text('name').notNull(),
    sort: integer('sort'),

    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),

    clientId: text('client_id'),
    ...timestamps,
  },
  (table) => ({
    clientIdUnique: uniqueIndex('tags_client_id_user_id_unique').on(table.clientId, table.userId),
    userIdIdx: index('tags_user_id_idx').on(table.userId),
  }),
);

export const insertTagSchema = createInsertSchema(tags);

export type NewTag = typeof tags.$inferInsert;
export type TagItem = typeof tags.$inferSelect;
