import type { SourceSetItem } from '@lobechat/types';
import { z } from 'zod';

import type { IPaginationQuery, PaginationQueryResponse } from './common.type';
import { PaginationQuerySchema } from './common.type';

// ==================== Source Set Query Types ====================

/**
 * 来源集列表查询参数
 */
export interface SourceSetListQuery extends IPaginationQuery {
  // 继承自 IPaginationQuery: keyword, page, pageSize
  /** 所属空间 ID（可选） */
  spaceId?: string;
}

export const SourceSetListQuerySchema = PaginationQuerySchema.extend({
  spaceId: z.string().optional(),
});

/**
 * 来源集文件列表查询参数
 */
export interface SourceSetFileListQuery extends IPaginationQuery {
  /** 文件类型过滤 */
  fileType?: string;
}

export const SourceSetFileListQuerySchema = PaginationQuerySchema.extend({
  fileType: z.string().nullish(),
});

/**
 * 来源集文件批量操作请求
 */
export interface SourceSetFileBatchRequest {
  /** 文件 ID 列表 */
  fileIds: string[];
}

export const SourceSetFileBatchSchema = z.object({
  fileIds: z.array(z.string().min(1, '文件ID不能为空')).min(1, '文件ID列表不能为空'),
});

/**
 * 来源集文件移动请求
 */
export interface MoveSourceSetFilesRequest extends SourceSetFileBatchRequest {
  /** 目标来源集 ID */
  targetSourceSetId: string;
}

export const MoveSourceSetFilesSchema = SourceSetFileBatchSchema.extend({
  targetSourceSetId: z.string().min(1, '目标来源集 ID 不能为空'),
});

/**
 * 来源集文件批量操作结果
 */
export interface SourceSetFileOperationResult {
  /** 失败的文件及原因 */
  failed: Array<{
    fileId: string;
    reason: string;
  }>;
  /** 操作成功的文件 ID 列表 */
  successed: string[];
}

/**
 * 来源集文件移动结果
 */
export interface MoveSourceSetFilesResponse {
  /** 失败的文件及原因 */
  failed: Array<{
    fileId: string;
    reason: string;
  }>;
  /** 成功移动的文件 ID 列表 */
  successed: string[];
}

/**
 * 来源集列表响应类型
 */
export type SourceSetAccessType = 'owner' | 'userGrant' | 'roleGrant' | 'public';

export interface SourceSetListItem extends SourceSetItem {
  /** 当前用户对该来源集的访问来源类型 */
  accessType?: SourceSetAccessType;
}

export type SourceSetListResponse = PaginationQueryResponse<{
  /** 来源集列表 */
  sourceSets: SourceSetListItem[];
}>;

// ==================== Source Set Management Types ====================

/**
 * 来源集 ID 参数
 */
export const SourceSetIdParamSchema = z.object({
  id: z.string().min(1, '来源集 ID 不能为空'),
});

/**
 * 创建来源集请求类型
 */
export interface CreateSourceSetRequest {
  /** 来源集头像 */
  avatar?: string;
  /** 来源集描述 */
  description?: string;
  /** 来源集名称 */
  name: string;
  /** 所属空间 ID（可选，默认个人空间） */
  spaceId?: string;
}

export const CreateSourceSetSchema = z.object({
  avatar: z.string().url('头像必须是有效的URL').optional(),
  description: z.string().max(1000, '来源集描述过长').optional(),
  name: z.string().min(1, '来源集名称不能为空').max(255, '来源集名称过长'),
  spaceId: z.string().optional(),
});

/**
 * 创建来源集响应类型
 */
export interface CreateSourceSetResponse {
  /** 来源集信息 */
  sourceSet: SourceSetItem;
}

/**
 * 更新来源集请求类型
 */
export interface UpdateSourceSetRequest {
  /** 来源集头像 */
  avatar?: string;
  /** 来源集描述 */
  description?: string;
  /** 来源集名称 */
  name?: string;
}

export const UpdateSourceSetSchema = z.object({
  avatar: z.string().url('头像必须是有效的URL').optional(),
  description: z.string().max(1000, '来源集描述过长').optional(),
  name: z.string().min(1, '来源集名称不能为空').max(255, '来源集名称过长').optional(),
});

/**
 * 来源集详情响应类型
 */
export interface SourceSetDetailResponse {
  /** 来源集信息 */
  sourceSet: SourceSetItem;
}

/**
 * 删除来源集响应类型
 */
export interface DeleteSourceSetResponse {
  /** 响应消息 */
  message?: string;
  /** 是否删除成功 */
  success: boolean;
}
