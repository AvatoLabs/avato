import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';

import { getAllScopePermissions } from '@/utils/rbac';

import { SourceSetController } from '../controllers/source-set.controller';
import { requireAnyPermission } from '../middleware';
import { requireAuth } from '../middleware/auth';
import {
  CreateSourceSetSchema,
  MoveSourceSetFilesSchema,
  SourceSetFileBatchSchema,
  SourceSetFileListQuerySchema,
  SourceSetIdParamSchema,
  SourceSetListQuerySchema,
  UpdateSourceSetSchema,
} from '../types/source-set.type';

const app = new Hono();

/**
 * 获取来源集列表
 * GET /source-sets
 *
 * Query parameters:
 * - page: number (optional) - 页码，默认1
 * - pageSize: number (optional) - 每页数量，默认20，最大100
 * - keyword: string (optional) - 搜索关键词（匹配名称或描述）
 */
app.get(
  '/',
  requireAuth,
  requireAnyPermission(getAllScopePermissions('SOURCE_SET_READ'), '您没有权限查看来源集列表'),
  zValidator('query', SourceSetListQuerySchema),
  async (c) => {
    const controller = new SourceSetController();
    return await controller.getSourceSets(c);
  },
);

/**
 * 创建来源集
 * POST /source-sets
 * Content-Type: application/json
 *
 * Request body:
 * {
 *   "name": "来源集名称",
 *   "description": "来源集描述（可选）",
 *   "avatar": "头像URL（可选）"
 * }
 */
app.post(
  '/',
  requireAuth,
  requireAnyPermission(getAllScopePermissions('SOURCE_SET_CREATE'), '您没有权限创建来源集'),
  zValidator('json', CreateSourceSetSchema),
  async (c) => {
    const controller = new SourceSetController();
    return await controller.createSourceSet(c);
  },
);

/**
 * 获取来源集详情
 * GET /source-sets/:id
 *
 * Path parameters:
 * - id: string (required) - 来源集 ID
 */
app.get(
  '/:id',
  requireAuth,
  requireAnyPermission(getAllScopePermissions('SOURCE_SET_READ'), '您没有权限查看来源集详情'),
  zValidator('param', SourceSetIdParamSchema),
  async (c) => {
    const controller = new SourceSetController();
    return await controller.getSourceSet(c);
  },
);

/**
 * 更新来源集
 * PATCH /source-sets/:id
 * Content-Type: application/json
 *
 * Path parameters:
 * - id: string (required) - 来源集 ID
 *
 * Request body:
 * {
 *   "name": "新名称（可选）",
 *   "description": "新描述（可选）",
 *   "avatar": "新头像URL（可选）"
 * }
 */
app.patch(
  '/:id',
  requireAuth,
  requireAnyPermission(getAllScopePermissions('SOURCE_SET_UPDATE'), '您没有权限更新来源集'),
  zValidator('param', SourceSetIdParamSchema),
  zValidator('json', UpdateSourceSetSchema),
  async (c) => {
    const controller = new SourceSetController();
    return await controller.updateSourceSet(c);
  },
);

/**
 * 删除来源集
 * DELETE /source-sets/:id
 *
 * Path parameters:
 * - id: string (required) - 来源集 ID
 */
app.delete(
  '/:id',
  requireAuth,
  requireAnyPermission(getAllScopePermissions('SOURCE_SET_DELETE'), '您没有权限删除来源集'),
  zValidator('param', SourceSetIdParamSchema),
  async (c) => {
    const controller = new SourceSetController();
    return await controller.deleteSourceSet(c);
  },
);

/**
 * 获取指定来源集下的文件列表
 * GET /source-sets/:id/files
 *
 * Path parameters:
 * - id: string (required) - 来源集 ID
 *
 * Query parameters:
 * - page: number (optional) - 页码；仅传 page 时，默认 pageSize=20
 * - pageSize: number (optional) - 每页数量，默认最大100；仅传 pageSize 时，默认 page=1
 * - fileType: string (optional) - 文件类型过滤
 * - keyword: string (optional) - 搜索关键词（匹配文件名）
 *
 * 说明：
 * - 未提供 page 和 pageSize 时，不进行分页，返回全部数据
 */
app.get(
  '/:id/files',
  requireAuth,
  requireAnyPermission(getAllScopePermissions('SOURCE_SET_READ'), '您没有权限查看来源集文件列表'),
  zValidator('param', SourceSetIdParamSchema),
  zValidator('query', SourceSetFileListQuerySchema),
  async (c) => {
    const controller = new SourceSetController();
    return await controller.getSourceSetFiles(c);
  },
);

/**
 * 批量为来源集添加文件关联
 * POST /source-sets/:id/files/batch
 */
app.post(
  '/:id/files/batch',
  requireAuth,
  requireAnyPermission(getAllScopePermissions('SOURCE_SET_UPDATE'), '您没有权限更新来源集文件'),
  zValidator('param', SourceSetIdParamSchema),
  zValidator('json', SourceSetFileBatchSchema),
  async (c) => {
    const controller = new SourceSetController();
    return await controller.addFilesToSourceSet(c);
  },
);

/**
 * 批量移除来源集与文件的关联
 * DELETE /source-sets/:id/files/batch
 */
app.delete(
  '/:id/files/batch',
  requireAuth,
  requireAnyPermission(getAllScopePermissions('SOURCE_SET_UPDATE'), '您没有权限更新来源集文件'),
  zValidator('param', SourceSetIdParamSchema),
  zValidator('json', SourceSetFileBatchSchema),
  async (c) => {
    const controller = new SourceSetController();
    return await controller.removeFilesFromSourceSet(c);
  },
);

/**
 * 批量将文件从当前来源集移动到目标来源集
 * POST /source-sets/:id/files/move
 */
app.post(
  '/:id/files/move',
  requireAuth,
  requireAnyPermission(getAllScopePermissions('SOURCE_SET_UPDATE'), '您没有权限更新来源集文件'),
  zValidator('param', SourceSetIdParamSchema),
  zValidator('json', MoveSourceSetFilesSchema),
  async (c) => {
    const controller = new SourceSetController();
    return await controller.moveFilesBetweenSourceSets(c);
  },
);

export default app;
