import type { ResourceKind, ResourceRole } from '@lobechat/types';
import { TRPCError } from '@trpc/server';
import { and, asc, eq, gt, isNull, ne, or, sql } from 'drizzle-orm';
import { sha256 } from 'js-sha256';

import type {
  NewResourcePermission,
  NewResourceRegistry,
  NewResourceShareLink,
  NewSpaceBlob,
  NewUploadSession,
  UploadSessionItem,
} from '../schemas';
import {
  documents,
  files,
  knowledgeBases,
  resourceAccessEvents,
  resourceAuditLogs,
  resourcePermissions,
  resourceRegistry,
  resourceShareLinks,
  spaceBlobs,
  spaceMembers,
  spaces,
  uploadSessions,
  users,
} from '../schemas';
import type { LobeChatDatabase, Transaction } from '../type';

export class ResourceModel {
  private readonly db: LobeChatDatabase;
  private readonly userId: string;

  constructor(db: LobeChatDatabase, userId: string) {
    this.db = db;
    this.userId = userId;
  }

  private bumpResourceEpoch = async (
    resourceUid: string,
    trx: Transaction | LobeChatDatabase = this.db,
  ) => {
    await trx
      .update(resourceRegistry)
      .set({
        authzEpoch: sql`${resourceRegistry.authzEpoch} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(resourceRegistry.resourceUid, resourceUid));
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
    entries: Array<{ resourceUid?: string | null; spaceId?: string | null }>,
  ) => {
    const uids = new Set<string>();
    const sids = new Set<string>();
    for (const e of entries) {
      if (e.resourceUid) uids.add(e.resourceUid);
      if (e.spaceId) sids.add(e.spaceId);
    }
    for (const uid of uids) {
      await this.bumpResourceEpoch(uid);
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
   * `(spaceId, sha256)` is not returned by `findSpaceBlobByHash` (ready-only). Never downgrades
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

  findSpaceBlobByHash = async (spaceId: string, hash: string) => {
    const [blob] = await this.db
      .select()
      .from(spaceBlobs)
      .where(
        and(
          eq(spaceBlobs.spaceId, spaceId),
          eq(spaceBlobs.sha256, hash),
          eq(spaceBlobs.status, 'ready'),
        ),
      )
      .limit(1);

    return blob;
  };

  createResourceRegistry = async (params: Omit<NewResourceRegistry, 'resourceUid'>) => {
    const [created] = await this.db.insert(resourceRegistry).values(params).returning();
    return created;
  };

  ensureResourceRegistry = async (params: Omit<NewResourceRegistry, 'resourceUid'>) => {
    const [existing] = await this.db
      .select()
      .from(resourceRegistry)
      .where(
        and(eq(resourceRegistry.kind, params.kind), eq(resourceRegistry.localId, params.localId)),
      )
      .limit(1);

    if (existing) return existing;

    return this.createResourceRegistry(params);
  };

  ensureOwnerPermission = async (params: {
    resourceUid: string;
    role?: ResourceRole;
    spaceId: string;
    subjectId?: string;
  }) => {
    const subjectId = params.subjectId || this.userId;
    const [existing] = await this.db
      .select({ id: resourcePermissions.id })
      .from(resourcePermissions)
      .where(
        and(
          eq(resourcePermissions.resourceUid, params.resourceUid),
          eq(resourcePermissions.subjectType, 'user'),
          eq(resourcePermissions.subjectId, subjectId),
        ),
      )
      .limit(1);

    if (existing?.id) return existing;

    const [created] = await this.db
      .insert(resourcePermissions)
      .values({
        canReshare: true,
        createdBy: this.userId,
        inheritsToChildren: true,
        resourceUid: params.resourceUid,
        role: params.role || 'owner',
        spaceId: params.spaceId,
        subjectId,
        subjectType: 'user',
      })
      .returning();

    return created;
  };

  findRegistryByLocalId = async (kind: ResourceKind, localId: string) => {
    const [result] = await this.db
      .select()
      .from(resourceRegistry)
      .where(and(eq(resourceRegistry.kind, kind), eq(resourceRegistry.localId, localId)))
      .limit(1);

    return result;
  };

  findRegistryByUid = async (resourceUid: string) => {
    const [result] = await this.db
      .select()
      .from(resourceRegistry)
      .where(eq(resourceRegistry.resourceUid, resourceUid))
      .limit(1);

    return result;
  };

  getResourceSummary = async (resourceUid: string) => {
    const registry = await this.findRegistryByUid(resourceUid);
    if (!registry) return null;

    if (registry.kind === 'document') {
      const [doc] = await this.db
        .select({
          id: documents.id,
          name: sql<string>`coalesce(${documents.title}, ${documents.filename}, 'Untitled')`,
          parentId: documents.parentId,
        })
        .from(documents)
        .where(and(eq(documents.id, registry.localId), isNull(documents.deletedAt)))
        .limit(1);

      return { ...registry, name: doc?.name || 'Untitled', parentId: doc?.parentId || null };
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

    const [knowledgeBase] = await this.db
      .select({
        id: knowledgeBases.id,
        name: knowledgeBases.name,
      })
      .from(knowledgeBases)
      .where(eq(knowledgeBases.id, registry.localId))
      .limit(1);

    return { ...registry, name: knowledgeBase?.name || 'Untitled', parentId: null };
  };

  listPermissions = async (resourceUid: string) => {
    return this.db
      .select({
        canReshare: resourcePermissions.canReshare,
        createdAt: resourcePermissions.createdAt,
        createdBy: resourcePermissions.createdBy,
        expiresAt: resourcePermissions.expiresAt,
        id: resourcePermissions.id,
        inheritsToChildren: resourcePermissions.inheritsToChildren,
        resourceUid: resourcePermissions.resourceUid,
        role: resourcePermissions.role,
        spaceId: resourcePermissions.spaceId,
        subjectAvatar: users.avatar,
        subjectId: resourcePermissions.subjectId,
        subjectName: users.fullName,
        subjectType: resourcePermissions.subjectType,
        subjectUsername: users.username,
        updatedAt: resourcePermissions.updatedAt,
      })
      .from(resourcePermissions)
      .leftJoin(
        users,
        and(
          eq(resourcePermissions.subjectType, 'user'),
          eq(resourcePermissions.subjectId, users.id),
        ),
      )
      .where(eq(resourcePermissions.resourceUid, resourceUid))
      .orderBy(asc(resourcePermissions.createdAt));
  };

  findPermissionById = async (permissionId: string) => {
    const [permission] = await this.db
      .select()
      .from(resourcePermissions)
      .where(eq(resourcePermissions.id, permissionId))
      .limit(1);

    return permission;
  };

  grantPermission = async (
    params: Omit<NewResourcePermission, 'id'> & { subjectType?: 'space_member' | 'user' },
  ) => {
    const subjectType = params.subjectType || 'user';

    const [existing] = await this.db
      .select({ id: resourcePermissions.id })
      .from(resourcePermissions)
      .where(
        and(
          eq(resourcePermissions.resourceUid, params.resourceUid),
          eq(resourcePermissions.subjectId, params.subjectId),
          eq(resourcePermissions.subjectType, subjectType),
        ),
      )
      .limit(1);

    if (existing?.id) {
      const [updated] = await this.db
        .update(resourcePermissions)
        .set({
          canReshare: params.canReshare,
          expiresAt: params.expiresAt,
          inheritsToChildren: params.inheritsToChildren,
          role: params.role,
          updatedAt: new Date(),
        })
        .where(eq(resourcePermissions.id, existing.id))
        .returning();

      await this.bumpResourceEpoch(params.resourceUid);
      await this.bumpSpaceEpoch(params.spaceId);

      return updated;
    }

    const [created] = await this.db
      .insert(resourcePermissions)
      .values({ ...params, subjectType })
      .returning();

    await this.bumpResourceEpoch(params.resourceUid);
    await this.bumpSpaceEpoch(params.spaceId);

    return created;
  };

  revokePermission = async (permissionId: string) => {
    const [existing] = await this.db
      .select({
        resourceUid: resourcePermissions.resourceUid,
        spaceId: resourcePermissions.spaceId,
      })
      .from(resourcePermissions)
      .where(eq(resourcePermissions.id, permissionId))
      .limit(1);

    if (!existing) return;

    await this.db.delete(resourcePermissions).where(eq(resourcePermissions.id, permissionId));
    await this.bumpResourceEpoch(existing.resourceUid);
    await this.bumpSpaceEpoch(existing.spaceId);
  };

  listDirectPermissionsForUser = async (userId: string = this.userId) => {
    return this.db
      .select({
        expiresAt: resourcePermissions.expiresAt,
        inheritsToChildren: resourcePermissions.inheritsToChildren,
        resourceRole: resourcePermissions.role,
        resourceUid: resourcePermissions.resourceUid,
        spaceId: resourcePermissions.spaceId,
      })
      .from(resourcePermissions)
      .where(
        and(
          eq(resourcePermissions.subjectType, 'user'),
          eq(resourcePermissions.subjectId, userId),
          or(isNull(resourcePermissions.expiresAt), gt(resourcePermissions.expiresAt, new Date())),
        ),
      );
  };

  listSharedWithMe = async () => {
    // Query permissions explicitly excluding self-created ones.
    // When a user creates a resource, ensureOwnerPermission inserts a row with
    // createdBy = userId. When someone else shares with the user, createdBy = sharer's id.
    const shared = await this.db
      .select({
        expiresAt: resourcePermissions.expiresAt,
        resourceUid: resourcePermissions.resourceUid,
        spaceId: resourcePermissions.spaceId,
      })
      .from(resourcePermissions)
      .where(
        and(
          eq(resourcePermissions.subjectType, 'user'),
          eq(resourcePermissions.subjectId, this.userId),
          ne(resourcePermissions.createdBy, this.userId),
          or(isNull(resourcePermissions.expiresAt), gt(resourcePermissions.expiresAt, new Date())),
        ),
      );

    return Promise.all(shared.map((permission) => this.getResourceSummary(permission.resourceUid)));
  };

  createShareLink = async (
    params: Omit<NewResourceShareLink, 'id' | 'tokenHash'> & { rawToken: string },
  ) => {
    const [created] = await this.db
      .insert(resourceShareLinks)
      .values({
        ...params,
        tokenHash: sha256(params.rawToken),
      })
      .returning();

    await this.bumpResourceEpoch(params.resourceUid);
    await this.bumpSpaceEpoch(params.spaceId);

    return created;
  };

  findShareLinkById = async (shareLinkId: string) => {
    const [link] = await this.db
      .select()
      .from(resourceShareLinks)
      .where(eq(resourceShareLinks.id, shareLinkId))
      .limit(1);

    return link;
  };

  listShareLinks = async (resourceUid: string) => {
    return this.db
      .select()
      .from(resourceShareLinks)
      .where(eq(resourceShareLinks.resourceUid, resourceUid))
      .orderBy(asc(resourceShareLinks.createdAt));
  };

  disableShareLink = async (shareLinkId: string) => {
    const [link] = await this.db
      .select({
        resourceUid: resourceShareLinks.resourceUid,
        spaceId: resourceShareLinks.spaceId,
      })
      .from(resourceShareLinks)
      .where(eq(resourceShareLinks.id, shareLinkId))
      .limit(1);

    if (!link) return;

    await this.db
      .update(resourceShareLinks)
      .set({
        disabledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(resourceShareLinks.id, shareLinkId));

    await this.bumpResourceEpoch(link.resourceUid);
    await this.bumpSpaceEpoch(link.spaceId);
  };

  resolveShareLinkByToken = async (token: string) => {
    const tokenHash = sha256(token);

    const [link] = await this.db
      .select()
      .from(resourceShareLinks)
      .where(
        and(
          eq(resourceShareLinks.tokenHash, tokenHash),
          isNull(resourceShareLinks.disabledAt),
          gt(resourceShareLinks.expiresAt, new Date()),
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
    resourceUid?: string | null;
    spaceId?: string | null;
  }) => {
    await this.db.insert(resourceAuditLogs).values({
      action: params.action,
      actorId: this.userId,
      after: params.after,
      before: params.before,
      metadata: params.metadata,
      resourceUid: params.resourceUid ?? null,
      spaceId: params.spaceId ?? null,
    });
  };

  createAccessEvent = async (params: {
    accessType: string;
    metadata?: Record<string, any>;
    resourceUid?: string | null;
    shareLinkId?: string | null;
    spaceId?: string | null;
    sourceIp?: string | null;
    userAgent?: string | null;
  }) => {
    const actorId = !this.userId || this.userId === 'anonymous' ? null : this.userId;

    await this.db.insert(resourceAccessEvents).values({
      accessType: params.accessType,
      actorId,
      metadata: params.metadata,
      resourceUid: params.resourceUid ?? null,
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
    params: Omit<NewUploadSession, 'id' | 'createdBy' | 'status'>,
  ): Promise<UploadSessionItem> => {
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
