import { type LobeChatDatabase } from '@lobechat/database';
import {
  documents,
  files,
  knowledgeBases,
  resourcePermissions,
  resourceRegistry,
  spaces,
} from '@lobechat/database/schemas';
import type { ExplainAccessResult, ResourceKind, ResourceRole, SpaceRole } from '@lobechat/types';
import { TRPCError } from '@trpc/server';
import { and, eq, gt, inArray, isNull, or } from 'drizzle-orm';

import { ResourceModel } from '@/database/models/resource';

export type ResourceCapability =
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

interface ResolvedResource {
  authzEpoch: number;
  inheritMode?: 'explicit_only' | 'inherit' | null;
  kind: ResourceKind;
  localId: string;
  parentId: string | null;
  resourceUid: string;
  spaceAuthzEpoch: number;
  spaceId: string;
}

interface AccessMatch {
  authzEpoch: number;
  canAccess: boolean;
  matchedBy?: ExplainAccessResult['matchedBy'];
  reason?: string;
  resourceRole?: ResourceRole;
  resourceUid: string;
  spaceId: string;
}

const RESOURCE_ROLE_CAPABILITIES: Record<ResourceRole, ResourceCapability[]> = {
  editor: [
    'create_child',
    'delete',
    'download_blob',
    'move',
    'preview_content',
    'read_content',
    'read_metadata',
    'share_link',
    'share_member',
  ],
  owner: [
    'create_child',
    'delete',
    'download_blob',
    'manage_members',
    'move',
    'preview_content',
    'read_content',
    'read_metadata',
    'share_link',
    'share_member',
  ],
  viewer: ['download_blob', 'preview_content', 'read_content', 'read_metadata'],
};

const SPACE_ROLE_CAPABILITIES: Record<SpaceRole, ResourceCapability[]> = {
  admin: [
    'create_child',
    'delete',
    'download_blob',
    'manage_members',
    'move',
    'preview_content',
    'read_content',
    'read_metadata',
    'share_link',
    'share_member',
  ],
  editor: [
    'create_child',
    'delete',
    'download_blob',
    'move',
    'preview_content',
    'read_content',
    'read_metadata',
    'share_link',
    'share_member',
  ],
  owner: [
    'create_child',
    'delete',
    'download_blob',
    'manage_members',
    'move',
    'preview_content',
    'read_content',
    'read_metadata',
    'share_link',
    'share_member',
  ],
  viewer: ['download_blob', 'preview_content', 'read_content', 'read_metadata'],
};

const hasCapability = (capabilitySet: ResourceCapability[], capability: ResourceCapability) =>
  capabilitySet.includes(capability);

/** Parse / preview / RAG / search: allow `preview_content` or stricter `read_content`. */
const resourceRoleHasCapability = (role: ResourceRole, capability: ResourceCapability) => {
  const caps = RESOURCE_ROLE_CAPABILITIES[role];
  if (capability === 'preview_content') {
    return hasCapability(caps, 'preview_content') || hasCapability(caps, 'read_content');
  }
  return hasCapability(caps, capability);
};

const spaceRoleHasCapability = (role: SpaceRole, capability: ResourceCapability) => {
  const caps = SPACE_ROLE_CAPABILITIES[role];
  if (capability === 'preview_content') {
    return hasCapability(caps, 'preview_content') || hasCapability(caps, 'read_content');
  }
  return hasCapability(caps, capability);
};

const shareViewerAllowsCapability = (capability: ResourceCapability) => {
  if (capability === 'preview_content') {
    return (
      hasCapability(RESOURCE_ROLE_CAPABILITIES.viewer, 'preview_content') ||
      hasCapability(RESOURCE_ROLE_CAPABILITIES.viewer, 'read_content')
    );
  }
  return hasCapability(RESOURCE_ROLE_CAPABILITIES.viewer, capability);
};

export class ResourceAuthorizer {
  private readonly db: LobeChatDatabase;
  private readonly resourceModel: ResourceModel;
  private readonly userId: string;

  constructor(db: LobeChatDatabase, userId: string) {
    this.db = db;
    this.userId = userId;
    this.resourceModel = new ResourceModel(db, userId);
  }

  private resolveByKind = async (
    kind: ResourceKind,
    localId: string,
    options?: { documentIncludeDeleted?: boolean },
  ): Promise<ResolvedResource | null> => {
    const [registryRow] = await this.db
      .select({
        authzEpoch: resourceRegistry.authzEpoch,
        kind: resourceRegistry.kind,
        localId: resourceRegistry.localId,
        resourceUid: resourceRegistry.resourceUid,
        spaceAuthzEpoch: spaces.authzEpoch,
        spaceId: resourceRegistry.spaceId,
      })
      .from(resourceRegistry)
      .innerJoin(spaces, eq(resourceRegistry.spaceId, spaces.id))
      .where(and(eq(resourceRegistry.kind, kind), eq(resourceRegistry.localId, localId)))
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

  private resolveByUid = async (resourceUid: string): Promise<ResolvedResource | null> => {
    const [registryRow] = await this.db
      .select({
        kind: resourceRegistry.kind,
        localId: resourceRegistry.localId,
      })
      .from(resourceRegistry)
      .where(eq(resourceRegistry.resourceUid, resourceUid))
      .limit(1);

    if (!registryRow) return null;

    return this.resolveByKind(registryRow.kind as ResourceKind, registryRow.localId);
  };

  private getParentChain = async (resource: ResolvedResource) => {
    const chain: ResolvedResource[] = [];

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

  private getDirectPermissionForUser = async (resourceUid: string) => {
    const [permission] = await this.db
      .select({
        canReshare: resourcePermissions.canReshare,
        expiresAt: resourcePermissions.expiresAt,
        role: resourcePermissions.role,
      })
      .from(resourcePermissions)
      .where(
        and(
          eq(resourcePermissions.resourceUid, resourceUid),
          eq(resourcePermissions.subjectType, 'user'),
          eq(resourcePermissions.subjectId, this.userId),
          or(isNull(resourcePermissions.expiresAt), gt(resourcePermissions.expiresAt, new Date())),
        ),
      )
      .limit(1);

    return permission;
  };

  /** First inherited row on the parent chain that grants `share_member` (if any). */
  private resolveInheritedShareDelegatingGrant = async (resource: ResolvedResource) => {
    const parentChain = await this.getParentChain(resource);
    if (parentChain.length === 0) return null;

    const parentUids = parentChain.map((item) => item.resourceUid);
    const inheritedPermissions = await this.db
      .select({
        canReshare: resourcePermissions.canReshare,
        resourceUid: resourcePermissions.resourceUid,
        role: resourcePermissions.role,
      })
      .from(resourcePermissions)
      .where(
        and(
          inArray(resourcePermissions.resourceUid, parentUids),
          eq(resourcePermissions.subjectType, 'user'),
          eq(resourcePermissions.subjectId, this.userId),
          eq(resourcePermissions.inheritsToChildren, true),
          or(isNull(resourcePermissions.expiresAt), gt(resourcePermissions.expiresAt, new Date())),
        ),
      );

    return (
      inheritedPermissions.find(
        (item: { canReshare: boolean; resourceUid: string; role: ResourceRole }) =>
          hasCapability(RESOURCE_ROLE_CAPABILITIES[item.role], 'share_member'),
      ) ?? null
    );
  };

  private getShareLinkAccess = async (
    resource: ResolvedResource,
    shareToken?: string | null,
  ): Promise<AccessMatch | null> => {
    if (!shareToken) return null;

    const link = await this.resourceModel.resolveShareLinkByToken(shareToken);
    if (!link || link.resourceUid !== resource.resourceUid) return null;

    const capabilities = RESOURCE_ROLE_CAPABILITIES.viewer;
    if (!hasCapability(capabilities, 'read_content')) return null;

    return {
      authzEpoch: Math.max(resource.authzEpoch, resource.spaceAuthzEpoch),
      canAccess: true,
      matchedBy: 'share_link',
      resourceRole: 'viewer',
      resourceUid: resource.resourceUid,
      spaceId: link.spaceId,
    };
  };

  private getSpaceRole = async (spaceId: string) => {
    return this.resourceModel.getSpaceMemberRole(spaceId, this.userId);
  };

  private getBestPermission = async (
    resource: ResolvedResource,
    capability: ResourceCapability,
  ): Promise<AccessMatch | null> => {
    const spaceRole = await this.getSpaceRole(resource.spaceId);
    if (spaceRole && spaceRoleHasCapability(spaceRole, capability)) {
      return {
        authzEpoch: Math.max(resource.authzEpoch, resource.spaceAuthzEpoch),
        canAccess: true,
        matchedBy: 'space_member',
        reason: `space:${spaceRole}`,
        resourceRole: spaceRole === 'viewer' ? 'viewer' : 'owner',
        resourceUid: resource.resourceUid,
        spaceId: resource.spaceId,
      };
    }

    const directPermission = await this.getDirectPermissionForUser(resource.resourceUid);
    if (directPermission && resourceRoleHasCapability(directPermission.role, capability)) {
      return {
        authzEpoch: Math.max(resource.authzEpoch, resource.spaceAuthzEpoch),
        canAccess: true,
        matchedBy: 'direct',
        reason: `direct:${directPermission.role}`,
        resourceRole: directPermission.role,
        resourceUid: resource.resourceUid,
        spaceId: resource.spaceId,
      };
    }

    const parentChain = await this.getParentChain(resource);
    if (parentChain.length === 0) return null;

    const parentUids = parentChain.map((item) => item.resourceUid);
    const inheritedPermissions = await this.db
      .select({
        canReshare: resourcePermissions.canReshare,
        inheritsToChildren: resourcePermissions.inheritsToChildren,
        resourceUid: resourcePermissions.resourceUid,
        role: resourcePermissions.role,
      })
      .from(resourcePermissions)
      .where(
        and(
          inArray(resourcePermissions.resourceUid, parentUids),
          eq(resourcePermissions.subjectType, 'user'),
          eq(resourcePermissions.subjectId, this.userId),
          eq(resourcePermissions.inheritsToChildren, true),
          or(isNull(resourcePermissions.expiresAt), gt(resourcePermissions.expiresAt, new Date())),
        ),
      );

    const inherited = inheritedPermissions.find(
      (item: {
        canReshare: boolean;
        inheritsToChildren: boolean;
        resourceUid: string;
        role: ResourceRole;
      }) => resourceRoleHasCapability(item.role, capability),
    );

    if (!inherited) return null;

    return {
      authzEpoch: Math.max(resource.authzEpoch, resource.spaceAuthzEpoch),
      canAccess: true,
      matchedBy: 'inherited',
      reason: `inherited:${inherited.role}`,
      resourceRole: inherited.role,
      resourceUid: resource.resourceUid,
      spaceId: resource.spaceId,
    };
  };

  getAccessMatch = async (params: {
    capability: ResourceCapability;
    documentIncludeDeleted?: boolean;
    kind?: ResourceKind;
    resourceUid?: string;
    shareToken?: string | null;
    id?: string;
  }): Promise<AccessMatch | null> => {
    const resource = params.resourceUid
      ? await this.resolveByUid(params.resourceUid)
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
    capability: ResourceCapability;
    documentIncludeDeleted?: boolean;
    kind?: ResourceKind;
    resourceUid?: string;
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
  assertCanDelegateSharing = async (resourceUid: string) => {
    const resource = await this.resolveByUid(resourceUid);
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

      const direct = await this.getDirectPermissionForUser(resource.resourceUid);
      if (direct?.role === 'owner') return;
      if (direct?.role === 'editor' && direct.canReshare) return;

      const inheritedSpace = await this.resolveInheritedShareDelegatingGrant(resource);
      if (inheritedSpace?.role === 'owner') return;
      if (inheritedSpace?.role === 'editor' && inheritedSpace.canReshare) return;

      throw new TRPCError({ code: 'FORBIDDEN', message: 'RESOURCE_RESHARE_DENIED' });
    }

    if (access.matchedBy === 'direct') {
      const direct = await this.getDirectPermissionForUser(resource.resourceUid);
      if (!direct) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'RESOURCE_ACCESS_DENIED' });
      }
      if (direct.role === 'owner') {
        return;
      }
      if (direct.role === 'editor' && !direct.canReshare) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'RESOURCE_RESHARE_DENIED' });
      }
      if (direct.role === 'viewer') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'RESOURCE_ACCESS_DENIED' });
      }
      return;
    }

    if (access.matchedBy === 'inherited') {
      const inherited = await this.resolveInheritedShareDelegatingGrant(resource);

      if (!inherited) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'RESOURCE_ACCESS_DENIED' });
      }
      if (inherited.role === 'owner') {
        return;
      }
      if (inherited.role === 'editor' && !inherited.canReshare) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'RESOURCE_RESHARE_DENIED' });
      }
      if (inherited.role === 'viewer') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'RESOURCE_ACCESS_DENIED' });
      }
      return;
    }

    throw new TRPCError({ code: 'FORBIDDEN', message: 'RESOURCE_ACCESS_DENIED' });
  };

  explainAccess = async (params: {
    kind?: ResourceKind;
    resourceUid?: string;
    id?: string;
  }): Promise<ExplainAccessResult> => {
    const resource = params.resourceUid
      ? await this.resolveByUid(params.resourceUid)
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
        resourceUid: resource.resourceUid,
        spaceId: resource.spaceId,
      } satisfies AccessMatch);

    return {
      authzEpoch: access.authzEpoch,
      canAccess: access.canAccess,
      matchedBy: access.matchedBy,
      reason: access.reason,
      resourceUid: resource.resourceUid,
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

  filterReadableKnowledgeBaseIds = async (knowledgeIds: string[]) => {
    if (knowledgeIds.length === 0) return [];

    const matches = await Promise.all(
      knowledgeIds.map((knowledgeId) =>
        this.getAccessMatch({
          capability: 'preview_content',
          id: knowledgeId,
          kind: 'knowledge_base',
        }),
      ),
    );

    return knowledgeIds.filter((_, i) => matches[i]?.canAccess);
  };
}

export class AuthorizedResourceResolver {
  private readonly authorizer: ResourceAuthorizer;
  private readonly db: LobeChatDatabase;

  constructor(db: LobeChatDatabase, userId: string) {
    this.db = db;
    this.authorizer = new ResourceAuthorizer(db, userId);
  }

  requireFile = async (id: string, capability: ResourceCapability = 'read_content') => {
    await this.authorizer.assertCapability({ capability, id, kind: 'file' });

    const [file] = await this.db.select().from(files).where(eq(files.id, id)).limit(1);
    if (!file) throw new TRPCError({ code: 'NOT_FOUND', message: 'FILE_NOT_FOUND' });
    return file;
  };

  requireDocument = async (id: string, capability: ResourceCapability = 'read_content') => {
    await this.authorizer.assertCapability({ capability, id, kind: 'document' });

    const [document] = await this.db
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), isNull(documents.deletedAt)))
      .limit(1);
    if (!document) throw new TRPCError({ code: 'NOT_FOUND', message: 'DOCUMENT_NOT_FOUND' });
    return document;
  };

  requireKnowledgeBase = async (id: string, capability: ResourceCapability = 'read_content') => {
    await this.authorizer.assertCapability({ capability, id, kind: 'knowledge_base' });

    const [knowledgeBase] = await this.db
      .select()
      .from(knowledgeBases)
      .where(eq(knowledgeBases.id, id))
      .limit(1);

    if (!knowledgeBase) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'KNOWLEDGE_BASE_NOT_FOUND' });
    }

    return knowledgeBase;
  };
}

export class TreeGuard {
  private readonly authorizer: ResourceAuthorizer;
  private readonly db: LobeChatDatabase;

  constructor(db: LobeChatDatabase, userId: string) {
    this.db = db;
    this.authorizer = new ResourceAuthorizer(db, userId);
  }

  assertParentAssignment = async (params: {
    currentSpaceId: string | null | undefined;
    parentId?: string | null;
  }) => {
    if (!params.parentId) return;

    const [parent] = await this.db
      .select({
        id: documents.id,
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

    await this.authorizer.assertCapability({
      capability: 'create_child',
      id: parent.id,
      kind: 'document',
    });
  };
}
