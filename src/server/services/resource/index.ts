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
    'read_content',
    'read_metadata',
    'share_link',
    'share_member',
  ],
  viewer: ['download_blob', 'read_content', 'read_metadata'],
};

const SPACE_ROLE_CAPABILITIES: Record<SpaceRole, ResourceCapability[]> = {
  admin: [
    'create_child',
    'delete',
    'download_blob',
    'manage_members',
    'move',
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
    'read_content',
    'read_metadata',
    'share_link',
    'share_member',
  ],
  viewer: ['download_blob', 'read_content', 'read_metadata'],
};

const hasCapability = (capabilitySet: ResourceCapability[], capability: ResourceCapability) =>
  capabilitySet.includes(capability);

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
      const [doc] = await this.db
        .select({
          inheritMode: documents.inheritMode,
          parentId: documents.parentId,
        })
        .from(documents)
        .where(eq(documents.id, localId))
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
    if (spaceRole && hasCapability(SPACE_ROLE_CAPABILITIES[spaceRole], capability)) {
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
    if (
      directPermission &&
      hasCapability(RESOURCE_ROLE_CAPABILITIES[directPermission.role], capability)
    ) {
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

    const inherited = inheritedPermissions.find((item) =>
      hasCapability(RESOURCE_ROLE_CAPABILITIES[item.role], capability),
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
    kind?: ResourceKind;
    resourceUid?: string;
    shareToken?: string | null;
    id?: string;
  }): Promise<AccessMatch | null> => {
    const resource = params.resourceUid
      ? await this.resolveByUid(params.resourceUid)
      : params.kind && params.id
        ? await this.resolveByKind(params.kind, params.id)
        : null;

    if (!resource) return null;

    const shareLinkAccess = await this.getShareLinkAccess(resource, params.shareToken);
    if (shareLinkAccess && hasCapability(RESOURCE_ROLE_CAPABILITIES.viewer, params.capability)) {
      return shareLinkAccess;
    }

    return this.getBestPermission(resource, params.capability);
  };

  assertCapability = async (params: {
    capability: ResourceCapability;
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
    const readable: string[] = [];

    for (const fileId of fileIds) {
      const match = await this.getAccessMatch({
        capability: 'read_content',
        id: fileId,
        kind: 'file',
      });

      if (match?.canAccess) readable.push(fileId);
    }

    return readable;
  };

  filterReadableKnowledgeBaseIds = async (knowledgeIds: string[]) => {
    const readable: string[] = [];

    for (const knowledgeId of knowledgeIds) {
      const match = await this.getAccessMatch({
        capability: 'read_content',
        id: knowledgeId,
        kind: 'knowledge_base',
      });

      if (match?.canAccess) readable.push(knowledgeId);
    }

    return readable;
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

    const [document] = await this.db.select().from(documents).where(eq(documents.id, id)).limit(1);
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
      .where(eq(documents.id, params.parentId))
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
