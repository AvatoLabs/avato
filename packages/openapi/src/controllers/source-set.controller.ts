import type { Context } from 'hono';

import { BaseController } from '../common/base.controller';
import { FileUploadService } from '../services/file.service';
import { SourceSetService } from '../services/source-set.service';
import type {
  CreateSourceSetRequest,
  MoveSourceSetFilesRequest,
  SourceSetFileBatchRequest,
  SourceSetFileListQuery,
  SourceSetListQuery,
  UpdateSourceSetRequest,
} from '../types/source-set.type';

/**
 * 来源集控制器
 * 处理来源集相关的 HTTP 请求
 */
export class SourceSetController extends BaseController {
  /**
   * 获取来源集列表
   * GET /source-sets
   */
  async getSourceSets(c: Context) {
    try {
      const userId = this.getUserId(c)!;
      const query = this.getQuery(c) as SourceSetListQuery;

      const db = await this.getDatabase();
      const sourceSetService = new SourceSetService(db, userId);

      const result = await sourceSetService.getSourceSetList(query);

      return this.success(c, result, 'Source sets retrieved successfully');
    } catch (error) {
      return this.handleError(c, error);
    }
  }

  /**
   * 获取单个来源集详情
   * GET /source-sets/:id
   */
  async getSourceSet(c: Context) {
    try {
      const userId = this.getUserId(c)!;
      const { id } = this.getParams(c);

      const db = await this.getDatabase();
      const sourceSetService = new SourceSetService(db, userId);

      const result = await sourceSetService.getSourceSetDetail(id);

      return this.success(c, result, 'Source set retrieved successfully');
    } catch (error) {
      return this.handleError(c, error);
    }
  }

  /**
   * 获取来源集下的文件列表
   * GET /source-sets/:id/files
   */
  async getSourceSetFiles(c: Context) {
    try {
      const userId = this.getUserId(c)!;
      const { id } = this.getParams(c);
      const query = this.getQuery(c) as SourceSetFileListQuery;

      const db = await this.getDatabase();
      const fileService = new FileUploadService(db, userId);

      const result = await fileService.getSourceSetFileList(id, query);

      return this.success(c, result, 'Source set files retrieved successfully');
    } catch (error) {
      return this.handleError(c, error);
    }
  }

  /**
   * 批量添加文件到来源集
   * POST /source-sets/:id/files/batch
   */
  async addFilesToSourceSet(c: Context) {
    try {
      const userId = this.getUserId(c)!;
      const { id } = this.getParams(c);
      const body = await this.getBody<SourceSetFileBatchRequest>(c);

      const db = await this.getDatabase();
      const fileService = new FileUploadService(db, userId);

      const result = await fileService.addFilesToSourceSet(id, body);

      return this.success(c, result, 'Files added to source set');
    } catch (error) {
      return this.handleError(c, error);
    }
  }

  /**
   * 批量从来源集移除文件
   * DELETE /source-sets/:id/files/batch
   */
  async removeFilesFromSourceSet(c: Context) {
    try {
      const userId = this.getUserId(c)!;
      const { id } = this.getParams(c);
      const body = await this.getBody<SourceSetFileBatchRequest>(c);

      const db = await this.getDatabase();
      const fileService = new FileUploadService(db, userId);

      const result = await fileService.removeFilesFromSourceSet(id, body);

      return this.success(c, result, 'Files removed from source set');
    } catch (error) {
      return this.handleError(c, error);
    }
  }

  /**
   * 批量移动文件到其他来源集
   * POST /source-sets/:id/files/move
   */
  async moveFilesBetweenSourceSets(c: Context) {
    try {
      const userId = this.getUserId(c)!;
      const { id } = this.getParams(c);
      const body = await this.getBody<MoveSourceSetFilesRequest>(c);

      const db = await this.getDatabase();
      const fileService = new FileUploadService(db, userId);

      const result = await fileService.moveFilesBetweenSourceSets(id, body);

      return this.success(c, result, 'Files moved to target source set');
    } catch (error) {
      return this.handleError(c, error);
    }
  }

  /**
   * 创建来源集
   * POST /source-sets
   */
  async createSourceSet(c: Context) {
    try {
      const userId = this.getUserId(c)!;
      const body = await this.getBody<CreateSourceSetRequest>(c);

      const db = await this.getDatabase();
      const sourceSetService = new SourceSetService(db, userId);

      const result = await sourceSetService.createSourceSet(body);

      return this.success(c, result, 'Source set created successfully');
    } catch (error) {
      return this.handleError(c, error);
    }
  }

  /**
   * 更新来源集
   * PATCH /source-sets/:id
   */
  async updateSourceSet(c: Context) {
    try {
      const userId = this.getUserId(c)!;
      const { id } = this.getParams(c);
      const body = await this.getBody<UpdateSourceSetRequest>(c);

      const db = await this.getDatabase();
      const sourceSetService = new SourceSetService(db, userId);

      const result = await sourceSetService.updateSourceSet(id, body);

      return this.success(c, result, 'Source set updated successfully');
    } catch (error) {
      return this.handleError(c, error);
    }
  }

  /**
   * 删除来源集
   * DELETE /source-sets/:id
   */
  async deleteSourceSet(c: Context) {
    try {
      const userId = this.getUserId(c)!;
      const { id } = this.getParams(c);

      const db = await this.getDatabase();
      const sourceSetService = new SourceSetService(db, userId);

      const result = await sourceSetService.deleteSourceSet(id);

      return this.success(c, result, 'Source set deleted successfully');
    } catch (error) {
      return this.handleError(c, error);
    }
  }
}
