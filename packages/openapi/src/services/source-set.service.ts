import type { SourceSetItem } from '@lobechat/types';
import { TRPCError } from '@trpc/server';
import { desc, inArray } from 'drizzle-orm';

import { ContentModel } from '@/database/models/content';
import { SourceSetModel } from '@/database/models/sourceSet';
import { SpaceModel } from '@/database/models/space';
import { sourceSets } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';
import { ContentAuthorizer } from '@/server/services/content';

import { BaseService } from '../common/base.service';
import { processPaginationConditions } from '../helpers/pagination';
import type {
  CreateSourceSetRequest,
  CreateSourceSetResponse,
  DeleteSourceSetResponse,
  SourceSetAccessType,
  SourceSetDetailResponse,
  SourceSetListItem,
  SourceSetListQuery,
  SourceSetListResponse,
  UpdateSourceSetRequest,
} from '../types/source-set.type';

/**
 * 来源集服务类
 * 处理来源集的增删改查功能
 */
export class SourceSetService extends BaseService {
  private contentAuthorizer: ContentAuthorizer;
  private contentModel: ContentModel;
  private sourceSetModel: SourceSetModel;
  private spaceModel: SpaceModel;

  constructor(db: LobeChatDatabase, userId: string) {
    super(db, userId);
    this.contentAuthorizer = new ContentAuthorizer(db, userId);
    this.contentModel = new ContentModel(db, userId);
    this.sourceSetModel = new SourceSetModel(db, userId);
    this.spaceModel = new SpaceModel(db, userId);
  }

  private mapContentAccessError = (error: unknown, fallbackMessage: string): never => {
    if (error instanceof TRPCError) {
      if (error.code === 'NOT_FOUND') {
        throw this.createNotFoundError(error.message);
      }

      if (error.code === 'FORBIDDEN') {
        throw this.createAuthorizationError(error.message || fallbackMessage);
      }
    }

    throw error;
  };

  private requireSourceSetAccess = async (
    sourceSetId: string,
    capability: 'delete' | 'move' | 'read_metadata',
  ) => {
    try {
      await this.contentAuthorizer.assertCapability({
        capability,
        id: sourceSetId,
        kind: 'source_set',
      });
    } catch (error) {
      this.mapContentAccessError(error, '无权访问此来源集');
    }

    const sourceSet = await this.sourceSetModel.findByIdAny(sourceSetId);

    if (!sourceSet) {
      throw this.createNotFoundError('Source set not found');
    }

    return sourceSet;
  };

  private resolveWriteSpaceId = async (spaceId?: string) => {
    if (!spaceId) {
      return (await this.spaceModel.getOrCreatePersonalSpace()).id;
    }

    const space = await this.spaceModel.findAccessibleSpaceById(spaceId);

    if (!space?.id) {
      throw this.createAuthorizationError('SPACE_ACCESS_DENIED');
    }

    if (space.membershipRole === 'viewer') {
      throw this.createAuthorizationError('SPACE_WRITE_DENIED');
    }

    return space.id;
  };

  /**
   * 获取来源集列表
   */
  async getSourceSetList(request: SourceSetListQuery): Promise<SourceSetListResponse> {
    try {
      const permissionResult = await this.resolveOperationPermission('SOURCE_SET_READ');

      if (!permissionResult.isPermitted) {
        throw this.createAuthorizationError(permissionResult.message || '无权访问来源集列表');
      }

      this.log('info', 'Getting source set list', request);

      const { limit, offset } = processPaginationConditions(request);
      const normalizedKeyword = request.keyword?.trim().toLowerCase();
      const requestedSpaceId = request.spaceId;

      const rawSourceSets = requestedSpaceId
        ? await (async () => {
          const space = await this.spaceModel.findAccessibleSpaceById(requestedSpaceId);
          if (!space?.id) {
            throw this.createAuthorizationError('SPACE_ACCESS_DENIED');
          }

          return this.db.query.sourceSets.findMany({
            orderBy: [desc(sourceSets.updatedAt)],
            where: inArray(sourceSets.spaceId, [space.id]),
          });
        })()
        : await (async () => {
            const spaces = await this.spaceModel.listSpaces();
            const accessibleSpaceIds = [...new Set(spaces.map((space) => space.id))];

            if (accessibleSpaceIds.length === 0) {
              return [];
            }

            return this.db.query.sourceSets.findMany({
              orderBy: [desc(sourceSets.updatedAt)],
              where: inArray(sourceSets.spaceId, accessibleSpaceIds),
            });
          })();

      const visibleIds = new Set(
        await this.contentAuthorizer.filterVisibleSourceSetIdsForList(
          rawSourceSets.map((item) => item.id),
        ),
      );

      const filteredSourceSets = rawSourceSets.filter((item) => {
        if (!visibleIds.has(item.id)) return false;

        if (!normalizedKeyword) return true;

        return (
          item.name.toLowerCase().includes(normalizedKeyword) ||
          item.description?.toLowerCase().includes(normalizedKeyword)
        );
      });

      const pagedSourceSets =
        limit !== undefined && offset !== undefined
          ? filteredSourceSets.slice(offset, offset + limit)
          : filteredSourceSets;

      const sourceSetsWithAccessType: SourceSetListItem[] = pagedSourceSets.map(
        ({ userId: ownerId, ...item }) => ({
          ...item,
          accessType: (ownerId === this.userId ? 'owner' : 'userGrant') as SourceSetAccessType,
        }),
      );

      return {
        sourceSets: sourceSetsWithAccessType,
        total: filteredSourceSets.length,
      };
    } catch (error) {
      this.handleServiceError(error, '获取来源集列表');
    }
  }

  /**
   * 获取来源集详情
   */
  async getSourceSetDetail(id: string): Promise<SourceSetDetailResponse> {
    try {
      const permissionResult = await this.resolveOperationPermission('SOURCE_SET_READ');

      if (!permissionResult.isPermitted) {
        throw this.createAuthorizationError(permissionResult.message || '无权访问此来源集');
      }

      this.log('info', 'Getting source set detail', { id });

      const sourceSet = await this.requireSourceSetAccess(id, 'read_metadata');

      return {
        sourceSet,
      };
    } catch (error) {
      this.handleServiceError(error, '获取来源集详情');
    }
  }

  /**
   * 创建来源集
   */
  async createSourceSet(request: CreateSourceSetRequest): Promise<CreateSourceSetResponse> {
    try {
      const permissionResult = await this.resolveOperationPermission('SOURCE_SET_CREATE');

      if (!permissionResult.isPermitted) {
        throw this.createAuthorizationError(permissionResult.message || '无权创建来源集');
      }

      const spaceId = await this.resolveWriteSpaceId(request.spaceId);

      this.log('info', 'Creating source set', {
        name: request.name,
        spaceId,
      });

      const created = await this.sourceSetModel.create({
        avatar: request.avatar,
        description: request.description,
        name: request.name,
        spaceId,
      });

      const registry = await this.contentModel.ensureContentRegistry({
        createdBy: this.userId,
        kind: 'source_set',
        localId: created.id,
        spaceId,
      });

      await this.sourceSetModel.updateAny(created.id, {
        contentUid: registry.contentUid,
        spaceId,
      });

      await this.contentModel.ensureOwnerPermission({
        contentUid: registry.contentUid,
        spaceId,
      });

      const sourceSet = await this.sourceSetModel.findByIdAny(created.id);

      if (!sourceSet) {
        throw this.createNotFoundError('Source set not found');
      }

      return {
        sourceSet,
      };
    } catch (error) {
      this.handleServiceError(error, '创建来源集');
    }
  }

  /**
   * 更新来源集
   */
  async updateSourceSet(
    id: string,
    request: UpdateSourceSetRequest,
  ): Promise<SourceSetDetailResponse> {
    try {
      const permissionResult = await this.resolveOperationPermission('SOURCE_SET_UPDATE');

      if (!permissionResult.isPermitted) {
        throw this.createAuthorizationError(permissionResult.message || '无权更新此来源集');
      }

      this.log('info', 'Updating source set', { id, request });

      await this.requireSourceSetAccess(id, 'move');
      await this.sourceSetModel.updateAny(id, request);

      const sourceSet = await this.sourceSetModel.findByIdAny(id);

      if (!sourceSet) {
        throw this.createNotFoundError('Source set not found');
      }

      return {
        sourceSet,
      };
    } catch (error) {
      this.handleServiceError(error, '更新来源集');
    }
  }

  /**
   * 删除来源集
   */
  async deleteSourceSet(id: string): Promise<DeleteSourceSetResponse> {
    try {
      const permissionResult = await this.resolveOperationPermission('SOURCE_SET_DELETE');

      if (!permissionResult.isPermitted) {
        throw this.createAuthorizationError(permissionResult.message || '无权删除此来源集');
      }

      this.log('info', 'Deleting source set', { id });

      await this.requireSourceSetAccess(id, 'delete');
      await this.sourceSetModel.deleteAny(id);

      return {
        message: 'Source set deleted successfully',
        success: true,
      };
    } catch (error) {
      this.handleServiceError(error, '删除来源集');
    }
  }
}
