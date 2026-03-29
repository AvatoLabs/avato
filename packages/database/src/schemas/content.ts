import { isNotNull, sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';

import { idGenerator } from '../utils/idGenerator';
import { createdAt, timestamps, timestamptz } from './_helpers';
import { users } from './user';

export const spaces = pgTable(
  'spaces',
  {
    id: text('id')
      .$defaultFn(() => idGenerator('spaces'))
      .primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    kind: text('kind').$type<'personal' | 'team'>().notNull(),
    personalOwnerId: text('personal_owner_id').references(() => users.id, { onDelete: 'cascade' }),
    createdBy: text('created_by')
      .references(() => users.id, { onDelete: 'set null' })
      .notNull(),
    authzEpoch: integer('authz_epoch').notNull().default(1),
    deletedAt: timestamptz('deleted_at'),
    metadata: jsonb('metadata').$type<Record<string, any>>(),
    ...timestamps,
  },
  (t) => [
    index('spaces_created_by_idx').on(t.createdBy),
    index('spaces_kind_idx').on(t.kind),
    uniqueIndex('spaces_personal_owner_unique')
      .on(t.personalOwnerId)
      .where(isNotNull(t.personalOwnerId)),
  ],
);

export type NewSpace = typeof spaces.$inferInsert;
export type SpaceItem = typeof spaces.$inferSelect;

export const spaceMembers = pgTable(
  'space_members',
  {
    spaceId: text('space_id')
      .references(() => spaces.id, { onDelete: 'cascade' })
      .notNull(),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    role: text('role').$type<'owner' | 'admin' | 'editor' | 'viewer'>().notNull(),
    createdBy: text('created_by')
      .references(() => users.id, { onDelete: 'set null' })
      .notNull(),
    joinedAt: createdAt(),
    updatedAt: timestamptz('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    primaryKey({ columns: [t.spaceId, t.userId] }),
    index('space_members_user_id_idx').on(t.userId),
    index('space_members_role_idx').on(t.role),
    uniqueIndex('space_members_owner_unique')
      .on(t.spaceId)
      .where(sql`${t.role} = 'owner'`),
  ],
);

export type NewSpaceMember = typeof spaceMembers.$inferInsert;
export type SpaceMemberItem = typeof spaceMembers.$inferSelect;

export const contentRegistry = pgTable(
  'content_registry',
  {
    contentUid: text('content_uid')
      .$defaultFn(() => idGenerator('contentRegistry'))
      .primaryKey(),
    kind: text('kind').$type<'document' | 'file' | 'source_set'>().notNull(),
    localId: text('local_id').notNull(),
    spaceId: text('space_id')
      .references(() => spaces.id, { onDelete: 'cascade' })
      .notNull(),
    authzEpoch: integer('authz_epoch').notNull().default(1),
    deletedAt: timestamptz('deleted_at'),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    metadata: jsonb('metadata').$type<Record<string, any>>(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('content_registry_kind_local_id_unique').on(t.kind, t.localId),
    index('content_registry_space_id_idx').on(t.spaceId),
    index('content_registry_created_by_idx').on(t.createdBy),
  ],
);

export type NewContentRegistry = typeof contentRegistry.$inferInsert;
export type ContentRegistryItem = typeof contentRegistry.$inferSelect;

export const spaceBlobs = pgTable(
  'space_blobs',
  {
    id: text('id')
      .$defaultFn(() => idGenerator('spaceBlobs'))
      .primaryKey(),
    spaceId: text('space_id')
      .references(() => spaces.id, { onDelete: 'cascade' })
      .notNull(),
    sha256: varchar('sha256', { length: 64 }).notNull(),
    storageKey: text('storage_key').notNull(),
    status: text('status').$type<'staging' | 'ready' | 'quarantined' | 'deleted'>().notNull(),
    size: integer('size').notNull(),
    fileType: varchar('file_type', { length: 255 }).notNull(),
    etag: text('etag'),
    verifiedAt: timestamptz('verified_at'),
    createdBy: text('created_by')
      .references(() => users.id, { onDelete: 'set null' })
      .notNull(),
    metadata: jsonb('metadata').$type<Record<string, any>>(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('space_blobs_space_sha_unique').on(t.spaceId, t.sha256),
    index('space_blobs_status_idx').on(t.status),
    index('space_blobs_created_by_idx').on(t.createdBy),
  ],
);

export type NewSpaceBlob = typeof spaceBlobs.$inferInsert;
export type SpaceBlobItem = typeof spaceBlobs.$inferSelect;

export const contentPermissions = pgTable(
  'content_permissions',
  {
    id: text('id')
      .$defaultFn(() => idGenerator('contentPermissions'))
      .primaryKey(),
    spaceId: text('space_id')
      .references(() => spaces.id, { onDelete: 'cascade' })
      .notNull(),
    contentUid: text('content_uid')
      .references(() => contentRegistry.contentUid, { onDelete: 'cascade' })
      .notNull(),
    subjectType: text('subject_type').$type<'user' | 'space_member'>().notNull(),
    subjectId: text('subject_id').notNull(),
    role: text('role').$type<'owner' | 'editor' | 'viewer'>().notNull(),
    inheritsToChildren: boolean('inherits_to_children').notNull().default(true),
    canReshare: boolean('can_reshare').notNull().default(false),
    expiresAt: timestamptz('expires_at'),
    createdBy: text('created_by')
      .references(() => users.id, { onDelete: 'set null' })
      .notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('content_permissions_subject_unique').on(t.contentUid, t.subjectType, t.subjectId),
    index('content_permissions_space_id_idx').on(t.spaceId),
    index('content_permissions_subject_lookup_idx').on(t.subjectType, t.subjectId),
  ],
);

export type NewContentPermission = typeof contentPermissions.$inferInsert;
export type ContentPermissionItem = typeof contentPermissions.$inferSelect;

export const contentShareLinks = pgTable(
  'content_share_links',
  {
    id: text('id')
      .$defaultFn(() => idGenerator('contentShareLinks'))
      .primaryKey(),
    spaceId: text('space_id')
      .references(() => spaces.id, { onDelete: 'cascade' })
      .notNull(),
    contentUid: text('content_uid')
      .references(() => contentRegistry.contentUid, { onDelete: 'cascade' })
      .notNull(),
    tokenHash: varchar('token_hash', { length: 128 }).notNull(),
    role: text('role').$type<'viewer'>().notNull().default('viewer'),
    expiresAt: timestamptz('expires_at').notNull(),
    passwordHash: text('password_hash'),
    disabledAt: timestamptz('disabled_at'),
    createdBy: text('created_by')
      .references(() => users.id, { onDelete: 'set null' })
      .notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('content_share_links_token_hash_unique').on(t.tokenHash),
    index('content_share_links_content_uid_idx').on(t.contentUid),
    index('content_share_links_space_id_idx').on(t.spaceId),
  ],
);

export type NewContentShareLink = typeof contentShareLinks.$inferInsert;
export type ContentShareLinkItem = typeof contentShareLinks.$inferSelect;

export const contentAuditLogs = pgTable(
  'content_audit_logs',
  {
    id: text('id')
      .$defaultFn(() => idGenerator('contentAuditLogs'))
      .primaryKey(),
    spaceId: text('space_id').references(() => spaces.id, { onDelete: 'cascade' }),
    contentUid: text('content_uid').references(() => contentRegistry.contentUid, {
      onDelete: 'set null',
    }),
    actorId: text('actor_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    metadata: jsonb('metadata').$type<Record<string, any>>(),
    before: jsonb('before').$type<Record<string, any>>(),
    after: jsonb('after').$type<Record<string, any>>(),
    sourceIp: text('source_ip'),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
  },
  (t) => [
    index('content_audit_logs_space_id_idx').on(t.spaceId),
    index('content_audit_logs_content_uid_idx').on(t.contentUid),
    index('content_audit_logs_actor_id_idx').on(t.actorId),
    index('content_audit_logs_action_idx').on(t.action),
  ],
);

export type NewContentAuditLog = typeof contentAuditLogs.$inferInsert;
export type ContentAuditLogItem = typeof contentAuditLogs.$inferSelect;

export const contentAccessEvents = pgTable(
  'content_access_events',
  {
    id: text('id')
      .$defaultFn(() => idGenerator('contentAccessEvents'))
      .primaryKey(),
    spaceId: text('space_id').references(() => spaces.id, { onDelete: 'cascade' }),
    contentUid: text('content_uid').references(() => contentRegistry.contentUid, {
      onDelete: 'set null',
    }),
    shareLinkId: text('share_link_id').references(() => contentShareLinks.id, {
      onDelete: 'set null',
    }),
    actorId: text('actor_id').references(() => users.id, { onDelete: 'set null' }),
    accessType: text('access_type').notNull(),
    sourceIp: text('source_ip'),
    userAgent: text('user_agent'),
    metadata: jsonb('metadata').$type<Record<string, any>>(),
    createdAt: createdAt(),
  },
  (t) => [
    index('content_access_events_space_id_idx').on(t.spaceId),
    index('content_access_events_content_uid_idx').on(t.contentUid),
    index('content_access_events_actor_id_idx').on(t.actorId),
    index('content_access_events_share_link_id_idx').on(t.shareLinkId),
  ],
);

export type NewContentAccessEvent = typeof contentAccessEvents.$inferInsert;
export type ContentAccessEventItem = typeof contentAccessEvents.$inferSelect;

export const uploadSessions = pgTable(
  'upload_sessions',
  {
    id: text('id')
      .$defaultFn(() => idGenerator('uploadSessions'))
      .primaryKey(),
    spaceId: text('space_id').references(() => spaces.id, { onDelete: 'cascade' }),
    blobId: text('blob_id').references(() => spaceBlobs.id, { onDelete: 'cascade' }),
    storageKey: text('storage_key').notNull(),
    expectedSize: integer('expected_size').notNull(),
    expectedSha256: varchar('expected_sha256', { length: 64 }),
    status: text('status')
      .$type<'pending' | 'completed' | 'expired' | 'cancelled'>()
      .notNull()
      .default('pending'),
    expiresAt: timestamptz('expires_at').notNull(),
    completedAt: timestamptz('completed_at'),
    etag: text('etag'),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    metadata: jsonb('metadata').$type<Record<string, any>>(),
    ...timestamps,
  },
  (t) => [
    index('upload_sessions_space_id_idx').on(t.spaceId),
    index('upload_sessions_blob_id_idx').on(t.blobId),
    index('upload_sessions_expires_at_idx').on(t.expiresAt),
    index('upload_sessions_status_idx').on(t.status),
  ],
);

export type NewUploadSession = typeof uploadSessions.$inferInsert;
export type UploadSessionItem = typeof uploadSessions.$inferSelect;
