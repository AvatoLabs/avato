import type { ContentKind, ContentRole } from '@lobechat/types';
import { TRPCError } from '@trpc/server';
import { and, asc, desc, eq, gt, inArray, isNull, or, sql } from 'drizzle-orm';
import { sha256 } from 'js-sha256';

import type {
  NewContentPermission,
  NewContentRegistry,
  NewContentShareLink,
  NewSpaceBlob,
  NewUploadSession,
  UploadSessionItem,
} from '../schemas';
import {
  contentAccessEvents,
  contentAuditLogs,
  contentPermissions,
  contentRegistry,
  contentShareLinks,
  documents,
  files,
  sourceSets,
  spaceBlobs,
  spaceMembers,
  spaces,
  uploadSessions,
  users,
} from '../schemas';
import type { LobeChatDatabase, Transaction } from '../type';

export class ContentModel {
  private readonly db: LobeChatDatabase;
  private readonly userId: string;

  constructor(db: LobeChatDatabase, userId: string) {
    this.db = db;
    this.userId = userId;
  }

  private bumpContentEpoch = async (
    contentUid: string,
    trx: Transaction | LobeChatDatabase = this.db,
  ) => {
    await trx
      .update(contentRegistry)
      .set({
        authzEpoch: sql`${contentRegistry.authzEpoch} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(contentRegistry.contentUid, contentUid));
  };

  private bumpSpaceEpoch = async (
    spaceId: string,
    trx: Transaction | LobeChatDatabase = this.db,
  ) => {
    await trx
      .update(spaces)
      .set({
        authzEpoch: sql`${spaces.authzEpoch} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(spaces.id, spaceId));
  };

  /**
   * After physical delete (or similar), bump registry + space epochs so authz caches drop stale grants.
   */
  invalidateAuthzEpochsAfterRemoval = async (
    entries: Array<{ contentUid?: string | null; spaceId?: string | null }>,
  ) => {
    const uids = new Set<string>();
    const sids = new Set<string>();
    for (const e of entries) {
      if (e.contentUid) uids.add(e.contentUid);
      if (e.spaceId) sids.add(e.spaceId);
    }
    for (const uid of uids) {
      await this.bumpContentEpoch(uid);
    }
    for (const sid of sids) {
      await this.bumpSpaceEpoch(sid);
    }
  };

  upsertSpaceBlob = async (params: Omit<NewSpaceBlob, 'id'>) => {
    const resolvedVerifiedAt =
      params.status === 'quarantined'
        ? null
        : params.verifiedAt !== undefined && params.verifiedAt !== null
          ? params.verifiedAt
          : new Date();

    const [existing] = await this.db
      .select()
      .from(spaceBlobs)
      .where(and(eq(spaceBlobs.spaceId, params.spaceId), eq(spaceBlobs.sha256, params.sha256)))
      .limit(1);

    if (existing) {
      await this.db
        .update(spaceBlobs)
        .set({
          etag: params.etag,
          fileType: params.fileType,
          metadata: params.metadata,
          size: params.size,
          status: params.status,
          storageKey: params.storageKey,
          updatedAt: new Date(),
          verifiedAt: resolvedVerifiedAt,
        })
        .where(eq(spaceBlobs.id, existing.id));

      return {
        ...existing,
        etag: params.etag,
        fileType: params.fileType,
        metadata: params.metadata,
        size: params.size,
        status: params.status,
        storageKey: params.storageKey,
        verifiedAt: resolvedVerifiedAt,
      };
    }

    const [created] = await this.db
      .insert(spaceBlobs)
      .values({ ...params, verifiedAt: resolvedVerifiedAt })
      .returning();
    return created;
  };

  /**
   * After upload verification fails, persist `space_blobs.status = 'quarantined'` so the same
   * `(spaceId, sha256)` is not returned by `findReadySpaceBlobBySha256` (ready-only). Never downgrades
   * an existing `ready` row.
   */
  quarantineSpaceBlobAfterFailedVerify = async (params: {
    actualSize?: number;
    createdBy: string;
    extraMetadata?: Record<string, unknown>;
    fileType: string;
    reason: 'object_not_found' | 'size_mismatch';
    sha256: string;
    size: number;
    spaceId: string;
    storageKey: string;
  }) => {
    const { sha256, spaceId } = params;
    if (!sha256 || sha256 === 'unknown' || sha256.length < 32) return;

    const [existing] = await this.db
      .select()
      .from(spaceBlobs)
      .where(and(eq(spaceBlobs.spaceId, spaceId), eq(spaceBlobs.sha256, sha256)))
      .limit(1);

    if (existing?.status === 'ready') return;

    await this.upsertSpaceBlob({
      createdBy: params.createdBy,
      etag: null,
      fileType: params.fileType,
      metadata: {
        ...params.extraMetadata,
        actualSize: params.actualSize,
        quarantineReason: params.reason,
      },
      sha256,
      size: params.size,
      spaceId,
      status: 'quarantined',
      storageKey: params.storageKey,
    });
  };

  findReadySpaceBlobBySha256 = async (spaceId: string, sha256: string) => {
    const [blob] = await this.db
      .select()
      .from(spaceBlobs)
      .where(
        and(
          eq(spaceBlobs.spaceId, spaceId),
          eq(spaceBlobs.sha256, sha256),
          eq(spaceBlobs.status, 'ready'),
        ),
      )
      .limit(1);

    return blob;
  };

  findAccessibleSpaceBlobByStorageKey = async (
    storageKey: string,
    userId: string = this.userId,
  ) => {
    const [blob] = await this.db
      .select({
        id: spaceBlobs.id,
        spaceId: spaceBlobs.spaceId,
        status: spaceBlobs.status,
        storageKey: spaceBlobs.storageKey,
      })
      .from(spaceBlobs)
      .innerJoin(spaces, eq(spaceBlobs.spaceId, spaces.id))
      .innerJoin(spaceMembers, eq(spaceBlobs.spaceId, spaceMembers.spaceId))
      .where(
        and(
          eq(spaceBlobs.storageKey, storageKey),
          eq(spaceBlobs.status, 'ready'),
          eq(spaceMembers.userId, userId),
          isNull(spaces.deletedAt),
        ),
      )
      .limit(1);

    return blob;
  };

  createContentRegistry = async (params: Omit<NewContentRegistry, 'contentUid'>) => {
    const [created] = await this.db.insert(contentRegistry).values(params).returning();
    return created;
  };

  ensureContentRegistry = async (params: Omit<NewContentRegistry, 'contentUid'>) => {
    const [existing] = await this.db
      .select()
      .from(contentRegistry)
      .where(
        and(eq(contentRegistry.kind, params.kind), eq(contentRegistry.localId, params.localId)),
      )
      .limit(1);

    if (existing) return existing;

    return this.createContentRegistry(params);
  };

  ensureOwnerPermission = async (params: {
    contentUid: string;
    role?: ContentRole;
    spaceId: string;
    subjectId?: string;
  }) => {
    const subjectId = params.subjectId || this.userId;
    const [existing] = await this.db
      .select({ id: contentPermissions.id })
      .from(contentPermissions)
      .where(
        and(
          eq(contentPermissions.contentUid, params.contentUid),
          eq(contentPermissions.subjectType, 'user'),
          eq(contentPermissions.subjectId, subjectId),
        ),
      )
      .limit(1);

    if (existing?.id) return existing;

    const [created] = await this.db
      .insert(contentPermissions)
      .values({
        canReshare: true,
        createdBy: this.userId,
        inheritsToChildren: true,
        contentUid: params.contentUid,
        role: params.role || 'owner',
        spaceId: params.spaceId,
        subjectId,
        subjectType: 'user',
      })
      .returning();

    return created;
  };

  findContentRegistryByLocalId = async (kind: ContentKind, localId: string) => {
    const [result] = await this.db
      .select()
      .from(contentRegistry)
      .where(and(eq(contentRegistry.kind, kind), eq(contentRegistry.localId, localId)))
      .limit(1);

    return result;
  };

  findContentRegistryByUid = async (contentUid: string) => {
    const [result] = await this.db
      .select()
      .from(contentRegistry)
      .where(eq(contentRegistry.contentUid, contentUid))
      .limit(1);

    return result;
  };

  getContentSummary = async (contentUid: string) => {
    const registry = await this.findContentRegistryByUid(contentUid);
    if (!registry) return null;

    if (registry.kind === 'document') {
      const [doc] = await this.db
        .select({
          id: documents.id,
          fileType: documents.fileType,
          metadata: documents.metadata,
          name: sql<string>`coalesce(${documents.title}, ${documents.filename}, 'Untitled')`,
          parentId: documents.parentId,
        })
        .from(documents)
        .where(and(eq(documents.id, registry.localId), isNull(documents.deletedAt)))
        .limit(1);

      return {
        ...registry,
        fileType: doc?.fileType || null,
        metadata: doc?.metadata || null,
        name: doc?.name || 'Untitled',
        parentId: doc?.parentId || null,
      };
    }

    if (registry.kind === 'file') {
      const [file] = await this.db
        .select({
          id: files.id,
          name: files.name,
          parentId: files.parentId,
        })
        .from(files)
        .where(eq(files.id, registry.localId))
        .limit(1);

      return { ...registry, name: file?.name || 'Untitled', parentId: file?.parentId || null };
    }

    const [sourceSet] = await this.db
      .select({
        id: sourceSets.id,
        name: sourceSets.name,
      })
      .from(sourceSets)
      .where(eq(sourceSets.id, registry.localId))
      .limit(1);

    return { ...registry, name: sourceSet?.name || 'Untitled', parentId: null };
  };

  listPermissions = async (contentUid: string) => {
    return this.db
      .select({
        canReshare: contentPermissions.canReshare,
        createdAt: contentPermissions.createdAt,
        createdBy: contentPermissions.createdBy,
        expiresAt: contentPermissions.expiresAt,
        id: contentPermissions.id,
        inheritsToChildren: contentPermissions.inheritsToChildren,
        contentUid: contentPermissions.contentUid,
        role: contentPermissions.role,
        spaceId: contentPermissions.spaceId,
        subjectAvatar: users.avatar,
        subjectId: contentPermissions.subjectId,
        subjectName: users.fullName,
        subjectType: contentPermissions.subjectType,
        subjectUsername: users.username,
        updatedAt: contentPermissions.updatedAt,
      })
      .from(contentPermissions)
      .leftJoin(
        users,
        and(eq(contentPermissions.subjectType, 'user'), eq(contentPermissions.subjectId, users.id)),
      )
      .where(eq(contentPermissions.contentUid, contentUid))
      .orderBy(asc(contentPermissions.createdAt));
  };

  findPermissionById = async (permissionId: string) => {
    const [permission] = await this.db
      .select()
      .from(contentPermissions)
      .where(eq(contentPermissions.id, permissionId))
      .limit(1);

    return permission;
  };

  grantPermission = async (
    params: Omit<NewContentPermission, 'id'> & { subjectType?: 'space_member' | 'user' },
  ) => {
    const subjectType = params.subjectType || 'user';

    const [existing] = await this.db
      .select({ id: contentPermissions.id })
      .from(contentPermissions)
      .where(
        and(
          eq(contentPermissions.contentUid, params.contentUid),
          eq(contentPermissions.subjectId, params.subjectId),
          eq(contentPermissions.subjectType, subjectType),
        ),
      )
      .limit(1);

    if (existing?.id) {
      const [updated] = await this.db
        .update(contentPermissions)
        .set({
          canReshare: params.canReshare,
          expiresAt: params.expiresAt,
          inheritsToChildren: params.inheritsToChildren,
          role: params.role,
          updatedAt: new Date(),
        })
        .where(eq(contentPermissions.id, existing.id))
        .returning();

      await this.bumpContentEpoch(params.contentUid);
      await this.bumpSpaceEpoch(params.spaceId);

      return updated;
    }

    const [created] = await this.db
      .insert(contentPermissions)
      .values({ ...params, subjectType })
      .returning();

    await this.bumpContentEpoch(params.contentUid);
    await this.bumpSpaceEpoch(params.spaceId);

    return created;
  };

  revokePermission = async (permissionId: string) => {
    const [existing] = await this.db
      .select({
        contentUid: contentPermissions.contentUid,
        spaceId: contentPermissions.spaceId,
      })
      .from(contentPermissions)
      .where(eq(contentPermissions.id, permissionId))
      .limit(1);

    if (!existing) return;

    await this.db.delete(contentPermissions).where(eq(contentPermissions.id, permissionId));
    await this.bumpContentEpoch(existing.contentUid);
    await this.bumpSpaceEpoch(existing.spaceId);
  };

  listDirectPermissionsForUser = async (userId: string = this.userId) => {
    return this.db
      .select({
        expiresAt: contentPermissions.expiresAt,
        inheritsToChildren: contentPermissions.inheritsToChildren,
        contentRole: contentPermissions.role,
        contentUid: contentPermissions.contentUid,
        spaceId: contentPermissions.spaceId,
      })
      .from(contentPermissions)
      .where(
        and(
          eq(contentPermissions.subjectType, 'user'),
          eq(contentPermissions.subjectId, userId),
          or(isNull(contentPermissions.expiresAt), gt(contentPermissions.expiresAt, new Date())),
        ),
      );
  };

  listSharedWithMe = async () => {
    const shared = await this.listDirectPermissionsForUser();
    const rows = await Promise.all(
      shared.map(async (permission) => {
        const summary = await this.getContentSummary(permission.contentUid);
        if (!summary || summary.createdBy === this.userId) return null;
        return {
          ...summary,
          sharedExpiresAt: permission.expiresAt,
          sharedInheritsToChildren: permission.inheritsToChildren,
          sharedRole: permission.contentRole,
        };
      }),
    );
    return rows.filter((row): row is NonNullable<(typeof rows)[number]> => row != null);
  };

  createShareLink = async (
    params: Omit<NewContentShareLink, 'id' | 'tokenHash'> & { rawToken: string },
  ) => {
    const [created] = await this.db
      .insert(contentShareLinks)
      .values({
        ...params,
        tokenHash: sha256(params.rawToken),
      })
      .returning();

    await this.bumpContentEpoch(params.contentUid);
    await this.bumpSpaceEpoch(params.spaceId);

    return created;
  };

  findShareLinkById = async (shareLinkId: string) => {
    const [link] = await this.db
      .select()
      .from(contentShareLinks)
      .where(eq(contentShareLinks.id, shareLinkId))
      .limit(1);

    return link;
  };

  listShareLinks = async (contentUid: string) => {
    return this.db
      .select()
      .from(contentShareLinks)
      .where(eq(contentShareLinks.contentUid, contentUid))
      .orderBy(asc(contentShareLinks.createdAt));
  };

  disableShareLink = async (shareLinkId: string) => {
    const [link] = await this.db
      .select({
        contentUid: contentShareLinks.contentUid,
        spaceId: contentShareLinks.spaceId,
      })
      .from(contentShareLinks)
      .where(eq(contentShareLinks.id, shareLinkId))
      .limit(1);

    if (!link) return;

    await this.db
      .update(contentShareLinks)
      .set({
        disabledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(contentShareLinks.id, shareLinkId));

    await this.bumpContentEpoch(link.contentUid);
    await this.bumpSpaceEpoch(link.spaceId);
  };

  resolveShareLinkByToken = async (token: string) => {
    const tokenHash = sha256(token);

    const [link] = await this.db
      .select()
      .from(contentShareLinks)
      .where(
        and(
          eq(contentShareLinks.tokenHash, tokenHash),
          isNull(contentShareLinks.disabledAt),
          gt(contentShareLinks.expiresAt, new Date()),
        ),
      )
      .limit(1);

    return link;
  };

  createAuditLog = async (params: {
    action: string;
    after?: Record<string, any>;
    before?: Record<string, any>;
    metadata?: Record<string, any>;
    contentUid?: string | null;
    spaceId?: string | null;
  }) => {
    await this.db.insert(contentAuditLogs).values({
      action: params.action,
      actorId: this.userId,
      after: params.after,
      before: params.before,
      metadata: params.metadata,
      contentUid: params.contentUid ?? null,
      spaceId: params.spaceId ?? null,
    });
  };

  findLatestAuditLog = async (params: { actions?: string[]; contentUid: string }) => {
    const filters = [eq(contentAuditLogs.contentUid, params.contentUid)];

    if (params.actions && params.actions.length > 0) {
      filters.push(inArray(contentAuditLogs.action, params.actions));
    }

    const [item] = await this.db
      .select({
        action: contentAuditLogs.action,
        after: contentAuditLogs.after,
        actorDisplayName: sql<
          string | null
        >`coalesce(${users.fullName}, ${users.username}, ${users.email}, ${users.id})`,
        actorId: contentAuditLogs.actorId,
        before: contentAuditLogs.before,
        createdAt: contentAuditLogs.createdAt,
        metadata: contentAuditLogs.metadata,
      })
      .from(contentAuditLogs)
      .leftJoin(users, eq(contentAuditLogs.actorId, users.id))
      .where(and(...filters))
      .orderBy(desc(contentAuditLogs.createdAt))
      .limit(1);

    return item;
  };

  listAuditLogs = async (params: { actions?: string[]; contentUid: string; limit?: number }) => {
    const filters = [eq(contentAuditLogs.contentUid, params.contentUid)];

    if (params.actions && params.actions.length > 0) {
      filters.push(inArray(contentAuditLogs.action, params.actions));
    }

    return this.db
      .select({
        action: contentAuditLogs.action,
        after: contentAuditLogs.after,
        actorDisplayName: sql<
          string | null
        >`coalesce(${users.fullName}, ${users.username}, ${users.email}, ${users.id})`,
        actorId: contentAuditLogs.actorId,
        before: contentAuditLogs.before,
        createdAt: contentAuditLogs.createdAt,
        metadata: contentAuditLogs.metadata,
      })
      .from(contentAuditLogs)
      .leftJoin(users, eq(contentAuditLogs.actorId, users.id))
      .where(and(...filters))
      .orderBy(desc(contentAuditLogs.createdAt))
      .limit(params.limit ?? 10);
  };

  findLatestAuditLogsByContentUids = async (params: {
    actions?: string[];
    contentUids: string[];
  }) => {
    if (params.contentUids.length === 0) return [];

    const filters = [inArray(contentAuditLogs.contentUid, params.contentUids)];

    if (params.actions && params.actions.length > 0) {
      filters.push(inArray(contentAuditLogs.action, params.actions));
    }

    const rows = await this.db
      .select({
        action: contentAuditLogs.action,
        actorDisplayName: sql<
          string | null
        >`coalesce(${users.fullName}, ${users.username}, ${users.email}, ${users.id})`,
        actorId: contentAuditLogs.actorId,
        contentUid: contentAuditLogs.contentUid,
        createdAt: contentAuditLogs.createdAt,
        metadata: contentAuditLogs.metadata,
      })
      .from(contentAuditLogs)
      .leftJoin(users, eq(contentAuditLogs.actorId, users.id))
      .where(and(...filters))
      .orderBy(desc(contentAuditLogs.createdAt));

    const latestByContentUid = new Map<string, (typeof rows)[number]>();

    for (const row of rows) {
      if (!row.contentUid || latestByContentUid.has(row.contentUid)) continue;
      latestByContentUid.set(row.contentUid, row);
    }

    return [...latestByContentUid.values()];
  };

  createAccessEvent = async (params: {
    accessType: string;
    metadata?: Record<string, any>;
    contentUid?: string | null;
    shareLinkId?: string | null;
    spaceId?: string | null;
    sourceIp?: string | null;
    userAgent?: string | null;
  }) => {
    const actorId = !this.userId || this.userId === 'anonymous' ? null : this.userId;

    await this.db.insert(contentAccessEvents).values({
      accessType: params.accessType,
      actorId,
      metadata: params.metadata,
      contentUid: params.contentUid ?? null,
      shareLinkId: params.shareLinkId ?? null,
      spaceId: params.spaceId ?? null,
      sourceIp: params.sourceIp ?? null,
      userAgent: params.userAgent ?? null,
    });
  };

  getSpaceMemberRole = async (spaceId: string, userId: string = this.userId) => {
    const [membership] = await this.db
      .select({ role: spaceMembers.role })
      .from(spaceMembers)
      .where(and(eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.userId, userId)))
      .limit(1);

    return membership?.role;
  };

  assertSpaceMember = async (spaceId: string, userId: string = this.userId) => {
    const role = await this.getSpaceMemberRole(spaceId, userId);
    if (!role) throw new TRPCError({ code: 'FORBIDDEN', message: 'SPACE_ACCESS_DENIED' });
    return role;
  };

  // ==================== Upload Session Methods ====================

  /**
   * Create an upload session
   */
  createUploadSession = async (
    params: Omit<NewUploadSession, 'id' | 'createdBy' | 'status'> & { id?: string },
  ): Promise<UploadSessionItem> => {
    const { id: explicitId, ...rest } = params;
    const [session] = await this.db
      .insert(uploadSessions)
      .values({
        ...rest,
        ...(explicitId ? { id: explicitId } : {}),
        createdBy: this.userId,
        status: 'pending',
      })
      .returning();

    return session;
  };

  /**
   * Find an upload session by ID
   */
  findUploadSessionById = async (id: string): Promise<UploadSessionItem | undefined> => {
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
  findPendingUploadSessionById = async (id: string): Promise<UploadSessionItem | undefined> => {
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
   * Complete an upload session
   */
  completeUploadSession = async (
    id: string,
    etag?: string,
  ): Promise<UploadSessionItem | undefined> => {
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
  expireUploadSession = async (id: string): Promise<UploadSessionItem | undefined> => {
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
}
