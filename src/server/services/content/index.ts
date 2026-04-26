import { type LobeChatDatabase } from '@lobechat/database';
import {
  contentPermissions,
  contentRegistry,
  documents,
  files,
  sourceSets,
  spaces,
} from '@lobechat/database/schemas';
import type { ContentKind, ContentRole, ExplainAccessResult } from '@lobechat/types';
import { TRPCError } from '@trpc/server';
import { and, eq, gt, inArray, isNull, or } from 'drizzle-orm';

import { ContentModel } from '@/database/models/content';
import {
  contentGrantAllowsDelegatingSharing,
  RESOURCE_ROLE_CAPABILITIES,
  resourceRoleHasCapability,
  shareViewerAllowsCapability,
  spaceRoleHasCapability,
} from '@/server/services/content/capabilityPolicy';

export type ContentCapability =
  | 'create_child'
  | 'delete'
  | 'download_blob'
  | 'manage_members'
  | 'move'
  | 'preview_content'
  | 'read_content'
  | 'read_metadata'
  | 'share_link'
  | 'share_member';

interface ResolvedContent {
  authzEpoch: number;
  contentUid: string;
  inheritMode?: 'explicit_only' | 'inherit' | null;
  kind: ContentKind;
  localId: string;
  parentId: string | null;
  spaceAuthzEpoch: number;
  spaceId: string;
}

interface AccessMatch {
  authzEpoch: number;
  canAccess: boolean;
  contentRole?: ContentRole;
  contentUid: string;
  matchedBy?: ExplainAccessResult['matchedBy'];
  reason?: string;
  spaceId: string;
}

export class ContentAuthorizer {
  private readonly db: LobeChatDatabase;
  private readonly contentModel: ContentModel;
  private readonly userId: string;

  constructor(db: LobeChatDatabase, userId: string) {
    this.db = db;
    this.userId = userId;
    this.contentModel = new ContentModel(db, userId);
  }

  private resolveByKind = async (
    kind: ContentKind,
    localId: string,
    options?: { documentIncludeDeleted?: boolean },
  ): Promise<ResolvedContent | null> => {
    const [registryRow] = await this.db
      .select({
        authzEpoch: contentRegistry.authzEpoch,
        kind: contentRegistry.kind,
        localId: contentRegistry.localId,
        contentUid: contentRegistry.contentUid,
        spaceAuthzEpoch: spaces.authzEpoch,
        spaceId: contentRegistry.spaceId,
      })
      .from(contentRegistry)
      .innerJoin(spaces, eq(contentRegistry.spaceId, spaces.id))
      .where(and(eq(contentRegistry.kind, kind), eq(contentRegistry.localId, localId)))
      .limit(1);

    if (!registryRow) return null;

    if (kind === 'document') {
      const docWhere = options?.documentIncludeDeleted
        ? eq(documents.id, localId)
        : and(eq(documents.id, localId), isNull(documents.deletedAt));
      const [doc] = await this.db
        .select({
          inheritMode: documents.inheritMode,
          parentId: documents.parentId,
        })
        .from(documents)
        .where(docWhere)
        .limit(1);

      return {
        ...registryRow,
        inheritMode: doc?.inheritMode ?? null,
        parentId: doc?.parentId ?? null,
      };
    }

    if (kind === 'file') {
      const [file] = await this.db
        .select({
          parentId: files.parentId,
        })
        .from(files)
        .where(eq(files.id, localId))
        .limit(1);

      return {
        ...registryRow,
        inheritMode: null,
        parentId: file?.parentId ?? null,
      };
    }

    return {
      ...registryRow,
      inheritMode: null,
      parentId: null,
    };
  };

  private resolveByUid = async (contentUid: string): Promise<ResolvedContent | null> => {
    const [registryRow] = await this.db
      .select({
        kind: contentRegistry.kind,
        localId: contentRegistry.localId,
      })
      .from(contentRegistry)
      .where(eq(contentRegistry.contentUid, contentUid))
      .limit(1);

    if (!registryRow) return null;

    return this.resolveByKind(registryRow.kind as ContentKind, registryRow.localId);
  };

  private getParentChain = async (resource: ResolvedContent) => {
    const chain: ResolvedContent[] = [];

    let currentParentId = resource.parentId;

    while (currentParentId) {
      const parent = await this.resolveByKind('document', currentParentId);
      if (!parent) break;

      chain.push(parent);

      if (parent.inheritMode === 'explicit_only') break;

      currentParentId = parent.parentId;
    }

    return chain;
  };

  private getDirectPermissionForUser = async (contentUid: string) => {
    const [permission] = await this.db
      .select({
        canReshare: contentPermissions.canReshare,
        expiresAt: contentPermissions.expiresAt,
        role: contentPermissions.role,
      })
      .from(contentPermissions)
      .where(
        and(
          eq(contentPermissions.contentUid, contentUid),
          eq(contentPermissions.subjectType, 'user'),
          eq(contentPermissions.subjectId, this.userId),
          or(isNull(contentPermissions.expiresAt), gt(contentPermissions.expiresAt, new Date())),
        ),
      )
      .limit(1);

    return permission;
  };

  /** First inherited row on the parent chain that grants `share_member` (if any). */
  private resolveInheritedShareDelegatingGrant = async (resource: ResolvedContent) => {
    const parentChain = await this.getParentChain(resource);
    if (parentChain.length === 0) return null;

    const parentUids = parentChain.map((item) => item.contentUid);
    const inheritedPermissions = await this.db
      .select({
        canReshare: contentPermissions.canReshare,
        contentUid: contentPermissions.contentUid,
        role: contentPermissions.role,
      })
      .from(contentPermissions)
      .where(
        and(
          inArray(contentPermissions.contentUid, parentUids),
          eq(contentPermissions.subjectType, 'user'),
          eq(contentPermissions.subjectId, this.userId),
          eq(contentPermissions.inheritsToChildren, true),
          or(isNull(contentPermissions.expiresAt), gt(contentPermissions.expiresAt, new Date())),
        ),
      );

    return (
      inheritedPermissions.find(
        (item: { canReshare: boolean; contentUid: string; role: ContentRole }) =>
          resourceRoleHasCapability(item.role, 'share_member'),
      ) ?? null
    );
  };

  private getShareLinkAccess = async (
    resource: ResolvedContent,
    shareToken?: string | null,
  ): Promise<AccessMatch | null> => {
    if (!shareToken) return null;

    const link = await this.contentModel.resolveShareLinkByToken(shareToken);
    if (!link || link.contentUid !== resource.contentUid) return null;

    if (!shareViewerAllowsCapability('read_content')) return null;

    return {
      authzEpoch: Math.max(resource.authzEpoch, resource.spaceAuthzEpoch),
      canAccess: true,
      matchedBy: 'share_link',
      contentRole: 'viewer',
      contentUid: resource.contentUid,
      spaceId: link.spaceId,
    };
  };

  private getSpaceRole = async (spaceId: string) => {
    return this.contentModel.getSpaceMemberRole(spaceId, this.userId);
  };

  private getBestPermission = async (
    resource: ResolvedContent,
    capability: ContentCapability,
  ): Promise<AccessMatch | null> => {
    const spaceRole = await this.getSpaceRole(resource.spaceId);
    if (spaceRole && spaceRoleHasCapability(spaceRole, capability)) {
      return {
        authzEpoch: Math.max(resource.authzEpoch, resource.spaceAuthzEpoch),
        canAccess: true,
        matchedBy: 'space_member',
        reason: `space:${spaceRole}`,
        contentRole: spaceRole === 'viewer' ? 'viewer' : 'owner',
        contentUid: resource.contentUid,
        spaceId: resource.spaceId,
      };
    }

    const directPermission = await this.getDirectPermissionForUser(resource.contentUid);
    if (directPermission && resourceRoleHasCapability(directPermission.role, capability)) {
      return {
        authzEpoch: Math.max(resource.authzEpoch, resource.spaceAuthzEpoch),
        canAccess: true,
        matchedBy: 'direct',
        reason: `direct:${directPermission.role}`,
        contentRole: directPermission.role,
        contentUid: resource.contentUid,
        spaceId: resource.spaceId,
      };
    }

    const parentChain = await this.getParentChain(resource);
    if (parentChain.length === 0) return null;

    const parentUids = parentChain.map((item) => item.contentUid);
    const inheritedPermissions = await this.db
      .select({
        canReshare: contentPermissions.canReshare,
        inheritsToChildren: contentPermissions.inheritsToChildren,
        contentUid: contentPermissions.contentUid,
        role: contentPermissions.role,
      })
      .from(contentPermissions)
      .where(
        and(
          inArray(contentPermissions.contentUid, parentUids),
          eq(contentPermissions.subjectType, 'user'),
          eq(contentPermissions.subjectId, this.userId),
          eq(contentPermissions.inheritsToChildren, true),
          or(isNull(contentPermissions.expiresAt), gt(contentPermissions.expiresAt, new Date())),
        ),
      );

    const inherited = inheritedPermissions.find(
      (item: {
        canReshare: boolean;
        inheritsToChildren: boolean;
        contentUid: string;
        role: ContentRole;
      }) => resourceRoleHasCapability(item.role, capability),
    );

    if (!inherited) return null;

    return {
      authzEpoch: Math.max(resource.authzEpoch, resource.spaceAuthzEpoch),
      canAccess: true,
      matchedBy: 'inherited',
      reason: `inherited:${inherited.role}`,
      contentRole: inherited.role,
      contentUid: resource.contentUid,
      spaceId: resource.spaceId,
    };
  };

  getAccessMatch = async (params: {
    capability: ContentCapability;
    documentIncludeDeleted?: boolean;
    kind?: ContentKind;
    contentUid?: string;
    shareToken?: string | null;
    id?: string;
  }): Promise<AccessMatch | null> => {
    const resource = params.contentUid
      ? await this.resolveByUid(params.contentUid)
      : params.kind && params.id
        ? await this.resolveByKind(params.kind, params.id, {
            documentIncludeDeleted: params.documentIncludeDeleted,
          })
        : null;

    if (!resource) return null;

    const shareLinkAccess = await this.getShareLinkAccess(resource, params.shareToken);
    if (shareLinkAccess && shareViewerAllowsCapability(params.capability)) {
      return shareLinkAccess;
    }

    return this.getBestPermission(resource, params.capability);
  };

  assertCapability = async (params: {
    capability: ContentCapability;
    documentIncludeDeleted?: boolean;
    kind?: ContentKind;
    contentUid?: string;
    shareToken?: string | null;
    id?: string;
  }) => {
    const access = await this.getAccessMatch(params);

    if (!access?.canAccess) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'RESOURCE_ACCESS_DENIED' });
    }

    return access;
  };

  /**
   * Member grants and share-link CRUD: space owner/admin always allowed; space **editor** (membership
   * only) must additionally have resource-level `owner` or `editor + canReshare` (direct or inherited);
   * direct or inherited **editor** must have `canReshare` on the granting row.
   */
  assertCanDelegateSharing = async (contentUid: string) => {
    const resource = await this.resolveByUid(contentUid);
    if (!resource) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'RESOURCE_NOT_FOUND' });
    }

    const access = await this.getBestPermission(resource, 'share_member');
    if (!access?.canAccess) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'RESOURCE_ACCESS_DENIED' });
    }

    const spaceRole = await this.getSpaceRole(resource.spaceId);
    if (spaceRole === 'owner' || spaceRole === 'admin') {
      return;
    }

    if (access.matchedBy === 'space_member') {
      // Owner/admin already returned. Only space `editor` can match share_member here (viewer lacks it).
      if (spaceRole !== 'editor') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'RESOURCE_ACCESS_DENIED' });
      }

      const direct = await this.getDirectPermissionForUser(resource.contentUid);
      if (direct && contentGrantAllowsDelegatingSharing(direct.role, direct)) return;

      const inheritedSpace = await this.resolveInheritedShareDelegatingGrant(resource);
      if (
        inheritedSpace &&
        contentGrantAllowsDelegatingSharing(inheritedSpace.role, inheritedSpace)
      ) {
        return;
      }

      throw new TRPCError({ code: 'FORBIDDEN', message: 'RESOURCE_RESHARE_DENIED' });
    }

    if (access.matchedBy === 'direct') {
      const direct = await this.getDirectPermissionForUser(resource.contentUid);
      if (!direct) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'RESOURCE_ACCESS_DENIED' });
      }
      if (contentGrantAllowsDelegatingSharing(direct.role, direct)) {
        return;
      }
      if (direct.role === 'editor') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'RESOURCE_RESHARE_DENIED' });
      }
      throw new TRPCError({ code: 'FORBIDDEN', message: 'RESOURCE_ACCESS_DENIED' });
    }

    if (access.matchedBy === 'inherited') {
      const inherited = await this.resolveInheritedShareDelegatingGrant(resource);

      if (!inherited) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'RESOURCE_ACCESS_DENIED' });
      }
      if (contentGrantAllowsDelegatingSharing(inherited.role, inherited)) {
        return;
      }
      if (inherited.role === 'editor') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'RESOURCE_RESHARE_DENIED' });
      }
      throw new TRPCError({ code: 'FORBIDDEN', message: 'RESOURCE_ACCESS_DENIED' });
    }

    throw new TRPCError({ code: 'FORBIDDEN', message: 'RESOURCE_ACCESS_DENIED' });
  };

  explainAccess = async (params: {
    kind?: ContentKind;
    contentUid?: string;
    id?: string;
  }): Promise<ExplainAccessResult> => {
    const resource = params.contentUid
      ? await this.resolveByUid(params.contentUid)
      : params.kind && params.id
        ? await this.resolveByKind(params.kind, params.id)
        : null;

    if (!resource) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'RESOURCE_NOT_FOUND' });
    }

    const access =
      (await this.getBestPermission(resource, 'read_metadata')) ||
      ({
        authzEpoch: Math.max(resource.authzEpoch, resource.spaceAuthzEpoch),
        canAccess: false,
        reason: 'no_matching_grant',
        contentUid: resource.contentUid,
        spaceId: resource.spaceId,
      } satisfies AccessMatch);

    return {
      authzEpoch: access.authzEpoch,
      canAccess: access.canAccess,
      matchedBy: access.matchedBy,
      reason: access.reason,
      contentUid: resource.contentUid,
      spaceId: resource.spaceId,
    };
  };

  filterReadableFileIds = async (fileIds: string[]) => {
    if (fileIds.length === 0) return [];

    const matches = await Promise.all(
      fileIds.map((fileId) =>
        this.getAccessMatch({
          capability: 'preview_content',
          id: fileId,
          kind: 'file',
        }),
      ),
    );

    return fileIds.filter((_, i) => matches[i]?.canAccess);
  };

  filterDownloadableFileIdsForList = async (fileIds: string[]) => {
    const accessById = await this.getDownloadableFileAccessByIdForList(fileIds);

    return fileIds.filter((fileId) => Boolean(accessById[fileId]));
  };

  getDownloadableFileAccessByIdForList = async (fileIds: string[]) => {
    if (fileIds.length === 0) return {};

    const matches = await Promise.all(
      fileIds.map((fileId) =>
        this.getAccessMatch({
          capability: 'download_blob',
          id: fileId,
          kind: 'file',
        }),
      ),
    );

    return fileIds.reduce<
      Record<string, { contentUid: string; matchedBy?: string; spaceId: string }>
    >((acc, fileId, index) => {
      const match = matches[index];

      if (match?.canAccess) {
        acc[fileId] = {
          contentUid: match.contentUid,
          matchedBy: match.matchedBy,
          spaceId: match.spaceId,
        };
      }

      return acc;
    }, {});
  };

  /** List endpoints: only include files the caller may see at metadata level. */
  filterVisibleFileIdsForList = async (fileIds: string[]) => {
    if (fileIds.length === 0) return [];

    const matches = await Promise.all(
      fileIds.map((fileId) =>
        this.getAccessMatch({
          capability: 'read_metadata',
          id: fileId,
          kind: 'file',
        }),
      ),
    );

    return fileIds.filter((_, i) => matches[i]?.canAccess);
  };

  filterVisibleDocumentIdsForList = async (
    documentIds: string[],
    options?: { documentIncludeDeleted?: boolean },
  ) => {
    if (documentIds.length === 0) return [];

    const matches = await Promise.all(
      documentIds.map((documentId) =>
        this.getAccessMatch({
          capability: 'read_metadata',
          documentIncludeDeleted: options?.documentIncludeDeleted,
          id: documentId,
          kind: 'document',
        }),
      ),
    );

    return documentIds.filter((_, i) => matches[i]?.canAccess);
  };

  filterReadableSourceSetIds = async (sourceSetIds: string[]) => {
    if (sourceSetIds.length === 0) return [];

    const matches = await Promise.all(
      sourceSetIds.map((sourceSetId) =>
        this.getAccessMatch({
          capability: 'preview_content',
          id: sourceSetId,
          kind: 'source_set',
        }),
      ),
    );

    return sourceSetIds.filter((_, i) => matches[i]?.canAccess);
  };

  filterVisibleSourceSetIdsForList = async (sourceSetIds: string[]) => {
    if (sourceSetIds.length === 0) return [];

    const matches = await Promise.all(
      sourceSetIds.map((sourceSetId) =>
        this.getAccessMatch({
          capability: 'read_metadata',
          id: sourceSetId,
          kind: 'source_set',
        }),
      ),
    );

    return sourceSetIds.filter((_, i) => matches[i]?.canAccess);
  };
}

export class AuthorizedResourceResolver {
  private readonly authorizer: ContentAuthorizer;
  private readonly db: LobeChatDatabase;

  constructor(db: LobeChatDatabase, userId: string) {
    this.db = db;
    this.authorizer = new ContentAuthorizer(db, userId);
  }

  requireFile = async (id: string, capability: ContentCapability = 'read_content') => {
    await this.authorizer.assertCapability({ capability, id, kind: 'file' });

    const [file] = await this.db.select().from(files).where(eq(files.id, id)).limit(1);
    if (!file) throw new TRPCError({ code: 'NOT_FOUND', message: 'FILE_NOT_FOUND' });
    return file;
  };

  requireDocument = async (id: string, capability: ContentCapability = 'read_content') => {
    await this.authorizer.assertCapability({ capability, id, kind: 'document' });

    const [document] = await this.db
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), isNull(documents.deletedAt)))
      .limit(1);
    if (!document) throw new TRPCError({ code: 'NOT_FOUND', message: 'DOCUMENT_NOT_FOUND' });
    return document;
  };

  requireSourceSet = async (id: string, capability: ContentCapability = 'read_content') => {
    await this.authorizer.assertCapability({ capability, id, kind: 'source_set' });

    const [sourceSet] = await this.db
      .select()
      .from(sourceSets)
      .where(eq(sourceSets.id, id))
      .limit(1);

    if (!sourceSet) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'SOURCE_SET_NOT_FOUND' });
    }

    return sourceSet;
  };
}

export class TreeGuard {
  private readonly authorizer: ContentAuthorizer;
  private readonly db: LobeChatDatabase;

  constructor(db: LobeChatDatabase, userId: string) {
    this.db = db;
    this.authorizer = new ContentAuthorizer(db, userId);
  }

  assertParentAssignment = async (params: {
    currentSpaceId: string | null | undefined;
    itemId?: string | null;
    parentId?: string | null;
  }) => {
    if (!params.parentId) return;

    const [parent] = await this.db
      .select({
        fileType: documents.fileType,
        id: documents.id,
        parentId: documents.parentId,
        spaceId: documents.spaceId,
      })
      .from(documents)
      .where(and(eq(documents.id, params.parentId), isNull(documents.deletedAt)))
      .limit(1);

    if (!parent?.id) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'PARENT_FOLDER_NOT_FOUND' });
    }

    if (params.currentSpaceId && parent.spaceId && params.currentSpaceId !== parent.spaceId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'CROSS_SPACE_MOVE_NOT_ALLOWED' });
    }

    if (parent.fileType !== 'custom/folder') {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'PARENT_IS_NOT_FOLDER' });
    }

    if (params.itemId) {
      let currentParentId: string | null = parent.id;

      while (currentParentId) {
        if (currentParentId === params.itemId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'CYCLE_MOVE_NOT_ALLOWED' });
        }

        const [ancestor] = await this.db
          .select({
            parentId: documents.parentId,
          })
          .from(documents)
          .where(and(eq(documents.id, currentParentId), isNull(documents.deletedAt)))
          .limit(1);

        currentParentId = ancestor?.parentId ?? null;
      }
    }

    await this.authorizer.assertCapability({
      capability: 'create_child',
      id: parent.id,
      kind: 'document',
    });
  };
}
