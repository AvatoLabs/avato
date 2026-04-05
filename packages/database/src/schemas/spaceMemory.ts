import { boolean, index, jsonb, pgTable, text, varchar } from 'drizzle-orm/pg-core';

import { idGenerator } from '../utils/idGenerator';
import { timestamps, timestamptz, varchar255 } from './_helpers';
import { spaces } from './content';
import { users } from './user';

export const spaceMemoryEntries = pgTable(
  'space_memory_entries',
  {
    id: varchar255('id')
      .$defaultFn(() => idGenerator('memory'))
      .primaryKey(),
    spaceId: text('space_id')
      .references(() => spaces.id, { onDelete: 'cascade' })
      .notNull(),
    createdBy: text('created_by')
      .references(() => users.id, { onDelete: 'set null' })
      .notNull(),
    updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
    reviewedBy: text('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    status: varchar('status', { length: 32 })
      .$type<'candidate' | 'published' | 'archived'>()
      .notNull()
      .default('candidate'),
    category: varchar('category', { length: 32 })
      .$type<'general' | 'playbook' | 'policy'>()
      .notNull()
      .default('general'),
    title: varchar255('title').notNull(),
    summary: text('summary'),
    content: text('content'),
    sourceRefs: jsonb('source_refs').$type<
      {
        id: string;
        kind: 'document' | 'file' | 'message' | 'source_set' | 'topic';
        title?: string;
      }[]
    >(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    recallEnabled: boolean('recall_enabled').notNull().default(true),
    expiresAt: timestamptz('expires_at'),
    staleAt: timestamptz('stale_at'),
    lastVerifiedAt: timestamptz('last_verified_at'),
    publishedAt: timestamptz('published_at'),
    ...timestamps,
  },
  (table) => [
    index('space_memory_entries_space_id_idx').on(table.spaceId),
    index('space_memory_entries_space_status_idx').on(table.spaceId, table.status),
    index('space_memory_entries_space_category_idx').on(table.spaceId, table.category),
    index('space_memory_entries_space_recall_idx').on(
      table.spaceId,
      table.status,
      table.recallEnabled,
    ),
    index('space_memory_entries_expires_at_idx').on(table.expiresAt),
    index('space_memory_entries_stale_at_idx').on(table.staleAt),
    index('space_memory_entries_reviewed_by_idx').on(table.reviewedBy),
  ],
);

export type SpaceMemoryEntryItem = typeof spaceMemoryEntries.$inferSelect;
export type NewSpaceMemoryEntry = typeof spaceMemoryEntries.$inferInsert;
