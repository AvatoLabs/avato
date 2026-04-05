import type {
  FileAssetClassification,
  FileAssetMetadata,
  FileAssetReviewStatus,
  FileAssetUsagePolicy,
} from '@lobechat/types';
import { index, jsonb, pgTable, text } from 'drizzle-orm/pg-core';

import { timestamps, timestamptz } from './_helpers';
import { spaces } from './content';
import { files } from './file';
import { users } from './user';

export const fileAssets = pgTable(
  'file_assets',
  {
    fileId: text('file_id')
      .references(() => files.id, { onDelete: 'cascade' })
      .primaryKey(),
    spaceId: text('space_id')
      .references(() => spaces.id, { onDelete: 'cascade' })
      .notNull(),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    classification: text('classification')
      .$type<FileAssetClassification>()
      .notNull()
      .default('general'),
    reviewStatus: text('review_status').$type<FileAssetReviewStatus>().notNull().default('draft'),
    usagePolicy: text('usage_policy').$type<FileAssetUsagePolicy>().notNull().default('internal'),
    rightsOwner: text('rights_owner'),
    reviewedBy: text('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    reviewedAt: timestamptz('reviewed_at'),
    metadata: jsonb('metadata').$type<FileAssetMetadata>(),
    ...timestamps,
  },
  (t) => [
    index('file_assets_space_id_idx').on(t.spaceId),
    index('file_assets_created_by_idx').on(t.createdBy),
    index('file_assets_classification_idx').on(t.classification),
    index('file_assets_review_status_idx').on(t.reviewStatus),
    index('file_assets_usage_policy_idx').on(t.usagePolicy),
  ],
);

export type NewFileAsset = typeof fileAssets.$inferInsert;
export type FileAssetRow = typeof fileAssets.$inferSelect;
