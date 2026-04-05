import type { FileMetadata } from '@lobechat/types';
import { AsyncTaskStatus, AsyncTaskType } from '@lobechat/types';
import { TRPCError } from '@trpc/server';
import { and, count, desc, eq, gte, ilike, inArray, lte, sum } from 'drizzle-orm';
import { sha256 } from 'js-sha256';

import { serverDBEnv } from '@/config/db';
import type { PERMISSION_ACTIONS } from '@/const/rbac';
import { ALL_SCOPE } from '@/const/rbac';
import { AsyncTaskModel } from '@/database/models/asyncTask';
import { ChunkModel } from '@/database/models/chunk';
import { ContentModel } from '@/database/models/content';
import { DocumentModel } from '@/database/models/document';
import { FileModel } from '@/database/models/file';
import { SourceSetModel } from '@/database/models/sourceSet';
import { SpaceModel } from '@/database/models/space';
import type { FileItem } from '@/database/schemas';
import {
  agentsToSessions,
  files,
  filesToSessions,
  sourceSetFiles,
  sourceSets,
  users,
} from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';
import { getBlobProvider } from '@/server/modules/BlobProvider';
import { ContentAuthorizer } from '@/server/services/content';
import { clampFileUrlExpiresIn } from '@/server/services/content/downloadPolicy';
import { DocumentService } from '@/server/services/document';
import { FileService as CoreFileService } from '@/server/services/file';
import { resolveRemovableStorageUrls } from '@/server/services/file/removableStorageUrls';
import { isChunkingUnsupported } from '@/utils/isChunkingUnsupported';
import { nanoid } from '@/utils/uuid';

import { BaseService } from '../common/base.service';
import { processPaginationConditions } from '../helpers/pagination';
import type {
  AsyncTaskErrorResponse,
  BatchFileUploadRequest,
  BatchFileUploadResponse,
  BatchGetFilesRequest,
  BatchGetFilesResponse,
  FileAsyncTaskResponse,
  FileChunkRequest,
  FileChunkResponse,
  FileDetailResponse,
  FileListQuery,
  FileListResponse,
  FileParseRequest,
  FileParseResponse,
  FileUrlRequest,
  FileUrlResponse,
  PublicFileUploadRequest,
} from '../types/file.type';
import type {
  MoveSourceSetFilesRequest,
  MoveSourceSetFilesResponse,
  SourceSetFileBatchRequest,
  SourceSetFileListQuery,
  SourceSetFileOperationResult,
} from '../types/source-set.type';

/**
 * 文件上传服务类
 * 专门处理服务端模式的文件上传和管理功能
 */
export class FileUploadService extends BaseService {
  private contentAuthorizer: ContentAuthorizer;
  private fileModel: FileModel;
  private contentModel: ContentModel;
  private documentModel: DocumentModel;
  private coreFileService: CoreFileService;
  private documentService: DocumentService;
  private blobProvider = getBlobProvider();
  private chunkModel: ChunkModel;
  private asyncTaskModel: AsyncTaskModel;
  private sourceSetModel: SourceSetModel;
  private spaceModel: SpaceModel;
  // 延迟引入 ChunkService，避免循环依赖开销
  // 注意：ChunkService 仅在服务端环境可用

  constructor(db: LobeChatDatabase, userId: string) {
    super(db, userId);
    this.contentAuthorizer = new ContentAuthorizer(db, userId);
    this.fileModel = new FileModel(db, userId);
    this.contentModel = new ContentModel(db, userId);
    this.documentModel = new DocumentModel(db, userId);
    this.coreFileService = new CoreFileService(db, userId!);
    this.documentService = new DocumentService(db, userId);
    this.chunkModel = new ChunkModel(db, userId);
    this.asyncTaskModel = new AsyncTaskModel(db, userId);
    this.sourceSetModel = new SourceSetModel(db, userId);
    this.spaceModel = new SpaceModel(db, userId);
  }

  /**
   * 确保获取完整URL，避免重复拼接
   * 检查URL是否已经是完整URL，如果不是则生成完整URL
   */
  private async ensureFullUrl(url?: string): Promise<string> {
    if (!url) {
      return '';
    }

    // 检查URL是否已经是完整URL（向后兼容历史数据）
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      return url; // 已经是完整URL，直接返回
    } else {
      // 相对路径，生成完整URL
      return await this.coreFileService.getFullFileUrl(url);
    }
  }

  /**
   * 转换为上传响应格式
   */
  private async convertToResponse(file: FileItem): Promise<FileDetailResponse['file']> {
    const fullUrl = await this.ensureFullUrl(file.url);

    return {
      ...file,
      url: fullUrl || file.url,
    };
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

  /**
   * 校验来源集访问权限
   */
  private async assertSourceSetAccess(
    sourceSetId: string,
    action: keyof typeof PERMISSION_ACTIONS,
    capability: 'create_child' | 'read_metadata',
  ) {
    const permissionResult = await this.resolveOperationPermission(action);
    if (!permissionResult.isPermitted) {
      throw this.createAuthorizationError(permissionResult.message || '无权访问来源集文件');
    }

    try {
      await this.contentAuthorizer.assertCapability({
        capability,
        id: sourceSetId,
        kind: 'source_set',
      });
    } catch (error) {
      this.mapContentAccessError(error, '无权访问来源集');
    }

    const sourceSet = await this.sourceSetModel.findByIdAny(sourceSetId);

    if (!sourceSet) {
      throw this.createNotFoundError('来源集不存在或无权访问');
    }

    return sourceSet;
  }

  private async assertReadableSourceItems(ids: string[]) {
    const uniqueIds = Array.from(new Set(ids));
    const failed: SourceSetFileOperationResult['failed'] = [];
    const successed: string[] = [];

    for (const id of uniqueIds) {
      try {
        await this.contentAuthorizer.assertCapability({
          capability: 'preview_content',
          id,
          kind: id.startsWith('docs_') ? 'document' : 'file',
        });
        successed.push(id);
      } catch {
        failed.push({ fileId: id, reason: '文件不存在或无权访问' });
      }
    }

    return { failed, successed };
  }

  /**
   * 批量文件上传
   */
  async uploadFiles(request: BatchFileUploadRequest): Promise<BatchFileUploadResponse> {
    try {
      const isPermitted = await this.resolveOperationPermission('FILE_UPLOAD');
      if (!isPermitted.isPermitted) {
        throw this.createAuthorizationError(isPermitted.message || '无权上传文件');
      }

      const results: BatchFileUploadResponse = {
        failed: [],
        successful: [],
        summary: {
          failed: 0,
          successful: 0,
          total: request.files.length,
        },
      };

      for (const file of request.files) {
        try {
          const result = await this.uploadFile(file, {
            agentId: request.agentId,
            directory: request.directory,
            sourceSetId: request.sourceSetId,
            sessionId: request.sessionId,
            skipCheckFileType: request.skipCheckFileType,
          });
          results.successful.push(result);
          results.summary.successful++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          results.failed.push({
            error: errorMessage,
            name: file.name,
          });
          results.summary.failed++;
          this.log('warn', 'File upload failed in batch', {
            error: errorMessage,
            name: file.name,
          });
        }
      }

      return results;
    } catch (error) {
      this.handleServiceError(error, '批量上传文件');
    }
  }

  /**
   * 获取文件列表，支持三种场景：
   * 1. 获取当前用户的文件（默认）
   * 2. 获取指定用户的文件（需要 ALL 权限，或目标用户是自己）
   * 3. 获取系统中所有用户的文件（需要 ALL 权限，queryAll=true）
   */
  async getFileList(request: FileListQuery): Promise<FileListResponse> {
    try {
      if (request.sourceSetId) {
        return this.getSourceSetFileList(request.sourceSetId, request);
      }

      // 检查是否有全局权限
      const hasGlobalPermission = await this.hasGlobalPermission('FILE_READ');

      // 根据请求参数决定权限校验的资源范围
      // 1. queryAll=true 时，使用 ALL_SCOPE 查询全量数据
      // 2. 指定 userId 时，查询指定用户的数据
      // 3. 如果查询来源集文件且有全局权限，使用 ALL_SCOPE 以获取所有文件
      // 4. 否则查询当前用户的数据
      let resourceInfo: { targetUserId: string } | typeof ALL_SCOPE | undefined;

      if (request.queryAll) {
        resourceInfo = ALL_SCOPE;
      } else if (request.userId) {
        resourceInfo = { targetUserId: request.userId };
      } else if (request.sourceSetId && hasGlobalPermission) {
        // 查询来源集文件时，如果有全局权限，可查询所有文件
        resourceInfo = ALL_SCOPE;
      }

      const permissionResult = await this.resolveOperationPermission('FILE_READ', resourceInfo);

      if (!permissionResult.isPermitted) {
        throw this.createAuthorizationError(permissionResult.message || '无权访问文件列表');
      }

      this.log('info', 'Getting file list', {
        ...request,
        hasGlobalPermission,
        queryAll: request.queryAll,
      });

      // 计算分页参数
      const { limit, offset } = processPaginationConditions(request);

      // 构建查询条件
      const { sourceSetId } = request;

      // 如果指定了来源集 ID，使用 JOIN 查询
      if (sourceSetId) {
        // 构建查询条件
        const whereConditions = [
          eq(sourceSetFiles.sourceSetId, sourceSetId),
          ...this.buildFileWhereConditions(request, permissionResult),
        ];

        const whereClause = and(...whereConditions);

        // 使用 JOIN 查询来源集关联的文件
        const baseQuery = this.db
          .select({ file: files })
          .from(sourceSetFiles)
          .innerJoin(files, eq(sourceSetFiles.fileId, files.id))
          .where(whereClause)
          .orderBy(desc(files.createdAt));

        const listQuery =
          limit !== undefined && offset !== undefined
            ? baseQuery.limit(limit).offset(offset)
            : baseQuery;

        const [records, totalResult] = await Promise.all([
          listQuery,
          this.db
            .select({ count: count(), totalSize: sum(files.size) })
            .from(sourceSetFiles)
            .innerJoin(files, eq(sourceSetFiles.fileId, files.id))
            .where(whereClause),
        ]);

        const filesResult: FileItem[] = records.map((row) => row.file);
        const total = totalResult[0]?.count || 0;

        // 构建响应 (JOIN查询需要手动获取关联数据)
        const responseFiles = await this.buildFileListResponse(
          filesResult,
          true,
          hasGlobalPermission,
        );

        this.log('info', 'File list retrieved successfully (by sourceSet)', {
          count: responseFiles.length,
          sourceSetId,
          total,
        });

        return {
          files: responseFiles,
          total,
          totalSize: totalResult[0]?.totalSize || '0',
        };
      }

      // 未指定来源集 ID，使用关系查询(自动 join user 和 sourceSets)
      const whereConditions = this.buildFileWhereConditions(request, permissionResult);
      const whereClause = and(...whereConditions);

      // 当前 files 关系未定义 user/sourceSets，采用基础查询并手动补齐关联数据
      const queryOptions = {
        limit,
        offset,
        orderBy: desc(files.createdAt),
        where: whereClause,
      };

      const [filesResult, totalResult] = await Promise.all([
        this.db.query.files.findMany(queryOptions),
        this.db
          .select({ count: count(), totalSize: sum(files.size) })
          .from(files)
          .where(whereClause),
      ]);

      const total = totalResult[0]?.count || 0;

      // 构建响应 (关系查询已包含 user 和 sourceSets)
      const responseFiles = await this.buildFileListResponse(
        filesResult,
        true,
        hasGlobalPermission,
      );

      this.log('info', 'File list retrieved successfully', {
        count: responseFiles.length,
        total,
      });

      return {
        files: responseFiles,
        total,
        totalSize: totalResult[0]?.totalSize || '0',
      };
    } catch (error) {
      this.handleServiceError(error, '获取文件列表');
    }
  }

  /**
   * 获取指定来源集下的文件列表
   * 复用 getFileList 的查询逻辑，但使用 SOURCE_SET_READ 权限
   */
  async getSourceSetFileList(
    sourceSetId: string,
    request: SourceSetFileListQuery,
  ): Promise<FileListResponse> {
    try {
      // 权限校验（来源集读取权限）
      const permissionResult = await this.resolveOperationPermission('SOURCE_SET_READ');

      if (!permissionResult.isPermitted) {
        throw this.createAuthorizationError(permissionResult.message || '无权访问来源集文件列表');
      }

      await this.assertSourceSetAccess(sourceSetId, 'SOURCE_SET_READ', 'read_metadata');

      this.log('info', 'Getting source set file list', {
        sourceSetId,
        request,
      });

      const { limit, offset } = processPaginationConditions(request);
      const whereConditions = [eq(sourceSetFiles.sourceSetId, sourceSetId)];

      if (request.keyword) {
        whereConditions.push(ilike(files.name, `%${request.keyword}%`));
      }

      if (request.fileType) {
        whereConditions.push(ilike(files.fileType, `${request.fileType}%`));
      }

      const rows = await this.db
        .select({ file: files })
        .from(sourceSetFiles)
        .innerJoin(files, eq(sourceSetFiles.fileId, files.id))
        .where(and(...whereConditions))
        .orderBy(desc(files.createdAt));

      const visibleIds = new Set(
        await this.contentAuthorizer.filterVisibleFileIdsForList(rows.map((row) => row.file.id)),
      );

      const visibleFiles = rows.map((row) => row.file).filter((file) => visibleIds.has(file.id));

      const pagedFiles =
        limit !== undefined && offset !== undefined
          ? visibleFiles.slice(offset, offset + limit)
          : visibleFiles;

      const responseFiles = await this.buildFileListResponse(pagedFiles, true, false);

      this.log('info', 'Source set file list retrieved successfully', {
        count: responseFiles.length,
        sourceSetId,
        total: visibleFiles.length,
      });

      return {
        files: responseFiles,
        total: visibleFiles.length,
        totalSize: String(visibleFiles.reduce((acc, file) => acc + (file.size || 0), 0)),
      };
    } catch (error) {
      this.handleServiceError(error, '获取来源集文件列表');
    }
  }

  /**
   * 批量创建来源集与文件的关联
   */
  async addFilesToSourceSet(
    sourceSetId: string,
    request: SourceSetFileBatchRequest,
  ): Promise<SourceSetFileOperationResult> {
    try {
      const sourceSet = await this.assertSourceSetAccess(
        sourceSetId,
        'SOURCE_SET_UPDATE',
        'create_child',
      );

      if (request.fileIds.length === 0) {
        throw this.createValidationError('文件ID列表不能为空');
      }

      const { failed, successed } = await this.assertReadableSourceItems(request.fileIds);

      if (successed.length > 0) {
        await this.sourceSetModel.addFilesToSourceSetAny(sourceSetId, successed, sourceSet.spaceId);
      }

      return {
        failed,
        successed,
      };
    } catch (error) {
      this.handleServiceError(error, '批量添加来源集文件关联');
    }
  }

  /**
   * 批量移除来源集与文件的关联
   */
  async removeFilesFromSourceSet(
    sourceSetId: string,
    request: SourceSetFileBatchRequest,
  ): Promise<SourceSetFileOperationResult> {
    try {
      if (request.fileIds.length === 0) {
        throw this.createValidationError('文件ID列表不能为空');
      }

      await this.assertSourceSetAccess(sourceSetId, 'SOURCE_SET_UPDATE', 'create_child');
      const { failed, successed } = await this.assertReadableSourceItems(request.fileIds);

      if (successed.length > 0) {
        await this.sourceSetModel.removeFilesFromSourceSetAny(sourceSetId, successed);
      }

      return {
        failed,
        successed,
      };
    } catch (error) {
      this.handleServiceError(error, '批量移除来源集文件关联');
    }
  }

  /**
   * 批量移动文件到另一个来源集
   */
  async moveFilesBetweenSourceSets(
    sourceSourceSetId: string,
    request: MoveSourceSetFilesRequest,
  ): Promise<MoveSourceSetFilesResponse> {
    try {
      if (sourceSourceSetId === request.targetSourceSetId) {
        throw this.createValidationError('目标来源集不能与源来源集相同');
      }

      await this.assertSourceSetAccess(sourceSourceSetId, 'SOURCE_SET_UPDATE', 'create_child');
      const targetSourceSet = await this.assertSourceSetAccess(
        request.targetSourceSetId,
        'SOURCE_SET_UPDATE',
        'create_child',
      );

      const { failed, successed } = await this.assertReadableSourceItems(request.fileIds);

      if (!successed.length) {
        return {
          failed,
          successed: [],
        };
      }

      await this.sourceSetModel.removeFilesFromSourceSetAny(sourceSourceSetId, successed);
      await this.sourceSetModel.addFilesToSourceSetAny(
        request.targetSourceSetId,
        successed,
        targetSourceSet.spaceId,
      );

      return {
        failed,
        successed,
      };
    } catch (error) {
      this.handleServiceError(error, '移动来源集文件');
    }
  }

  /**
   * 获取文件详情
   */
  async getFileDetail(fileId: string): Promise<FileDetailResponse> {
    try {
      // 权限校验
      const permissionResult = await this.resolveOperationPermission('FILE_READ', {
        targetFileId: fileId,
      });

      if (!permissionResult.isPermitted) {
        throw this.createAuthorizationError(permissionResult.message || '无权访问此文件');
      }

      const file = await this.findFileByIdWithPermission(fileId, permissionResult);

      // 检查是否为图片文件
      const isImage = file.fileType.startsWith('image/');

      const convertedFile = await this.convertToResponse(file);

      if (!isImage) {
        // 非图片文件：获取解析结果
        try {
          const parseResult = await this.parseFile(fileId, { skipExist: true });

          return {
            file: convertedFile,
            parsed: parseResult,
          };
        } catch (parseError) {
          // 如果解析失败，仍然返回文件详情，但不包含解析结果
          this.log('warn', 'Failed to parse file content', {
            error: parseError,
            fileId,
          });

          return {
            file: convertedFile,
            parsed: {
              error: parseError instanceof Error ? parseError.message : 'Unknown error',
              fileId,
              fileType: file.fileType,
              name: file.name,
              parseStatus: 'failed',
            },
          };
        }
      }

      return {
        file: convertedFile,
      };
    } catch (error) {
      this.handleServiceError(error, '获取文件详情');
    }
  }

  /**
   * 获取文件预签名访问URL
   */
  async getFileUrl(fileId: string, options: FileUrlRequest = {}): Promise<FileUrlResponse> {
    try {
      // 权限校验
      const permissionResult = await this.resolveOperationPermission('FILE_READ', {
        targetFileId: fileId,
      });

      if (!permissionResult.isPermitted) {
        throw this.createAuthorizationError(permissionResult.message || '无权访问此文件');
      }

      const file = await this.findFileByIdWithPermission(fileId, permissionResult);

      // 设置过期时间（默认并最大均为 1 小时）
      const expiresIn = clampFileUrlExpiresIn(options.expiresIn);

      // 使用 blob provider 生成预签名访问 URL
      const signedUrl = await this.blobProvider.createDownloadUrl(file.url, { expiresIn });

      // 计算过期时间戳
      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

      this.log('info', 'File URL generated successfully', {
        expiresIn,
        fileId,
        name: file.name,
      });

      return {
        expiresAt,
        expiresIn,
        fileId,
        name: file.name,
        url: signedUrl,
      };
    } catch (error) {
      this.handleServiceError(error, '获取文件URL');
    }
  }

  /**
   * 文件上传
   */
  async uploadFile(file: File, options: PublicFileUploadRequest = {}): Promise<FileDetailResponse> {
    try {
      const isPermitted = await this.resolveOperationPermission('FILE_UPLOAD');

      if (!isPermitted.isPermitted) {
        throw this.createAuthorizationError(isPermitted.message || '无权上传文件');
      }

      this.log('info', 'Starting public file upload', {
        directory: options.directory,
        name: file.name,
        size: file.size,
        type: file.type,
      });

      // 1. 验证文件
      await this.validateFile(file, options.skipCheckFileType);

      // 2. 计算文件哈希
      const fileArrayBuffer = await file.arrayBuffer();
      const hash = sha256(fileArrayBuffer);
      const resolvedSessionId = await this.resolveSessionId(options);
      const uploadSpaceId = await this.resolveUploadSpaceId(options);

      // 3. 同一 Space 内去重：仅查询 space_blobs（不调用全局 global_files / checkHash，避免跨用户存在性侧信道）
      if (!options.skipDeduplication) {
        const existingBlob = await this.contentModel.findSpaceBlobByHash(uploadSpaceId, hash);

        if (existingBlob) {
          this.log('info', 'OpenAPI upload dedup: space_blobs hit in space', {
            hash,
            name: file.name,
            spaceId: uploadSpaceId,
            storageKey: existingBlob.storageKey,
          });

          const existingUserFile = await this.findExistingUserFile(hash);

          if (existingUserFile) {
            this.log('info', 'User already has file row for this hash', {
              fileId: existingUserFile.id,
              name: existingUserFile.name,
            });

            if (resolvedSessionId) {
              await this.createFileSessionRelation(existingUserFile.id, resolvedSessionId);
              this.log('info', 'Existing file associated with session', {
                fileId: existingUserFile.id,
                sessionId: resolvedSessionId,
              });
            }

            return await this.getFileDetail(existingUserFile.id);
          }

          const metaFromBlob =
            (existingBlob.metadata as FileMetadata | undefined) ||
            this.generateFileMetadata(file, options.directory);

          const fileRecord = {
            chunkTaskId: null,
            clientId: null,
            embeddingTaskId: null,
            fileHash: hash,
            fileType: file.type,
            sourceSetId: options.sourceSetId,
            metadata: metaFromBlob,
            name: file.name,
            size: file.size,
            spaceId: uploadSpaceId,
            url: existingBlob.storageKey,
            userId: this.userId,
          };

          // 仍尝试写入 global_files（onConflictDoNothing），满足 files.file_hash 外键；对象实际复用 space_blobs.storageKey
          const createResult = await this.fileModel.create(fileRecord, true);

          if (resolvedSessionId) {
            await this.createFileSessionRelation(createResult.id, resolvedSessionId);
            this.log('info', 'Space-deduped file associated with session', {
              fileId: createResult.id,
              sessionId: resolvedSessionId,
            });
          }

          this.log('info', 'Space-deduped public file created', {
            fileId: createResult.id,
            sessionId: resolvedSessionId,
            storageKey: existingBlob.storageKey,
          });

          return await this.getFileDetail(createResult.id);
        }
      }

      // 4. 本 Space 无就绪 blob：走完整上传，并登记 space_blobs（仍写 global_files 以满足 fileHash 外键）
      const metadata = this.generateFileMetadata(file, options.directory);

      const fileBuffer = Buffer.from(fileArrayBuffer);
      const blobProvider = getBlobProvider();
      await blobProvider.uploadBuffer(metadata.path, fileBuffer, file.type);
      const head = await blobProvider.getObjectMetadata(metadata.path);
      if (head.contentLength !== file.size) {
        await this.contentModel.quarantineSpaceBlobAfterFailedVerify({
          actualSize: head.contentLength,
          createdBy: this.userId!,
          extraMetadata: { ...metadata, source: 'openapi_upload' } as Record<string, unknown>,
          fileType: file.type,
          reason: 'size_mismatch',
          sha256: hash,
          size: head.contentLength,
          spaceId: uploadSpaceId,
          storageKey: metadata.path,
        });
        throw this.createBusinessError('上传校验失败：存储对象大小与声明不一致');
      }

      const fileRecord = {
        chunkTaskId: null,
        clientId: null,
        embeddingTaskId: null,
        fileHash: hash,
        fileType: file.type,
        sourceSetId: options.sourceSetId,
        metadata,
        name: file.name,
        size: file.size,
        spaceId: uploadSpaceId,
        url: metadata.path,
        userId: this.userId,
      };

      const createResult = await this.fileModel.create(fileRecord, true);

      await this.contentModel.upsertSpaceBlob({
        createdBy: this.userId!,
        etag: head.etag,
        fileType: file.type,
        metadata: metadata as Record<string, unknown>,
        sha256: hash,
        size: file.size,
        spaceId: uploadSpaceId,
        status: 'ready',
        storageKey: metadata.path,
        verifiedAt: new Date(),
      });

      if (resolvedSessionId) {
        await this.createFileSessionRelation(createResult.id, resolvedSessionId);
        this.log('info', 'Public file associated with session', {
          fileId: createResult.id,
          sessionId: resolvedSessionId,
        });
      }

      return await this.getFileDetail(createResult.id);
    } catch (error) {
      this.handleServiceError(error, '上传文件');
    }
  }

  /**
   * 解析文件内容
   */
  async parseFile(
    fileId: string,
    options: Partial<FileParseRequest> = {},
  ): Promise<FileParseResponse> {
    try {
      // 1. 权限校验
      const permissionResult = await this.resolveOperationPermission('FILE_READ', {
        targetFileId: fileId,
      });

      if (!permissionResult.isPermitted) {
        throw this.createAuthorizationError(permissionResult.message || '无权访问此文件');
      }

      // 2. 查询文件
      const file = await this.findFileByIdWithPermission(fileId, permissionResult);

      // 3. 检查文件类型是否支持解析
      if (isChunkingUnsupported(file.fileType)) {
        throw this.createBusinessError(
          `File type '${file.fileType}' does not support content parsing`,
        );
      }

      // 4. 检查是否已经解析过（如果不跳过已存在的）
      if (!options.skipExist) {
        const existingDocument = await this.documentModel.findByFileId(fileId);
        if (existingDocument) {
          this.log('info', 'File already parsed, returning existing result', { fileId });

          return {
            content: existingDocument.content as string,
            fileId,
            fileType: file.fileType,
            metadata: {
              pages: existingDocument.pages?.length || 0,
              title: existingDocument.title || undefined,
              totalCharCount: existingDocument.totalCharCount || undefined,
              totalLineCount: existingDocument.totalLineCount || undefined,
            },
            name: file.name,
            parseStatus: 'completed',
            parsedAt: existingDocument.createdAt.toISOString(),
          };
        }
      }

      this.log('info', 'Starting file parsing', {
        fileId,
        fileType: file.fileType,
        name: file.name,
        skipExist: options.skipExist,
      });

      try {
        // 5. 使用 DocumentService 解析文件
        const document = await this.documentService.parseFile(fileId);

        this.log('info', 'File parsed successfully', {
          contentLength: document.content?.length || 0,
          fileId,
          pages: document.pages,
          totalCharCount: document.totalCharCount,
        });

        // 6. 返回解析结果
        return {
          content: document.content || '',
          fileId,
          fileType: file.fileType,
          metadata: {
            pages: document.pages?.length || 0,
            title: document.title || undefined,
            totalCharCount: document.totalCharCount || undefined,
            totalLineCount: document.totalLineCount || undefined,
          },
          name: file.name,
          parseStatus: 'completed',
          parsedAt: new Date().toISOString(),
        };
      } catch (parseError) {
        const errorMessage =
          parseError instanceof Error ? parseError.message : 'Unknown parsing error';

        this.log('error', 'File parsing failed', {
          error: errorMessage,
          fileId,
          name: file.name,
        });

        // 返回失败结果
        return {
          content: '',
          error: errorMessage,
          fileId,
          fileType: file.fileType,
          name: file.name,
          parseStatus: 'failed',
          parsedAt: new Date().toISOString(),
        };
      }
    } catch (error) {
      this.handleServiceError(error, '解析文件');
    }
  }

  /**
   * 创建分块任务（可选自动触发嵌入）
   */
  async createChunkTask(
    fileId: string,
    req: Partial<FileChunkRequest> = {},
  ): Promise<FileChunkResponse> {
    try {
      // 权限：更新文件即可
      const permissionResult = await this.resolveOperationPermission('FILE_UPDATE', {
        targetFileId: fileId,
      });
      if (!permissionResult.isPermitted) {
        throw this.createAuthorizationError(permissionResult.message || '无权操作该文件');
      }

      const file = await this.findFileByIdWithPermission(fileId, permissionResult);
      const access = await this.contentAuthorizer
        .assertCapability({
          capability: 'preview_content',
          id: fileId,
          kind: 'file',
        })
        .catch((error) => this.mapContentAccessError(error, '无权预览此文件'));

      if (isChunkingUnsupported(file.fileType)) {
        throw this.createBusinessError(`File type '${file.fileType}' does not support chunking`);
      }

      // 触发分块异步任务
      const { ChunkService } = await import('@/server/services/chunk');
      const chunkService = new ChunkService(this.db, this.userId);

      const chunkTaskId = await chunkService.asyncParseFileToChunks(fileId, req.skipExist, {
        contentGuardAuthzEpoch: access.authzEpoch,
      });

      let embeddingTaskId: string | null | undefined = null;
      if (req.autoEmbedding) {
        embeddingTaskId = await chunkService.asyncEmbeddingFileChunks(fileId, {
          contentGuardAuthzEpoch: access.authzEpoch,
        });
      }

      this.log('info', 'Chunk task created', {
        autoEmbedding: !!req.autoEmbedding,
        chunkTaskId,
        embeddingTaskId,
        fileId,
      });

      return {
        chunkTaskId: chunkTaskId || null,
        embeddingTaskId: embeddingTaskId || null,
        fileId,
        message: 'Task created',
        success: true,
      };
    } catch (error) {
      this.handleServiceError(error, '创建分块任务');
    }
  }

  /**
   * 查询文件分块与嵌入任务状态
   */
  async getFileChunkStatus(fileId: string) {
    try {
      // 权限：读取文件即可
      const permissionResult = await this.resolveOperationPermission('FILE_READ', {
        targetFileId: fileId,
      });

      if (!permissionResult.isPermitted) {
        throw this.createAuthorizationError(permissionResult.message || '无权访问此文件');
      }

      const file = await this.findFileByIdWithPermission(fileId, permissionResult);

      const [chunkCount, chunkTask, embeddingTask] = await Promise.all([
        this.chunkModel.countByFileId(fileId),
        file.chunkTaskId ? this.asyncTaskModel.findById(file.chunkTaskId) : Promise.resolve(null),
        file.embeddingTaskId
          ? this.asyncTaskModel.findById(file.embeddingTaskId)
          : Promise.resolve(null),
      ]);

      return {
        chunkCount,
        chunkingError: (chunkTask?.error as any) || null,
        chunkingStatus: (chunkTask?.status as AsyncTaskStatus | null | undefined) || null,
        embeddingError: (embeddingTask?.error as any) || null,
        embeddingStatus: (embeddingTask?.status as AsyncTaskStatus | null | undefined) || null,
        finishEmbedding: embeddingTask?.status === AsyncTaskStatus.Success,
      };
    } catch (error) {
      this.handleServiceError(error, '查询文件分块状态');
    }
  }

  /**
   * 删除文件
   */
  async deleteFile(fileId: string): Promise<void> {
    try {
      // 权限校验
      const permissionResult = await this.resolveOperationPermission('FILE_DELETE', {
        targetFileId: fileId,
      });

      if (!permissionResult.isPermitted) {
        throw this.createAuthorizationError(permissionResult.message || '无权删除此文件');
      }

      const file = await this.findFileByIdWithPermission(fileId, permissionResult);

      // 删除数据库记录及关联 chunks / global_files（权限已在上方校验）
      await this.fileModel.deleteAny(fileId, serverDBEnv.REMOVE_GLOBAL_FILE);
      await this.contentModel.invalidateAuthzEpochsAfterRemoval([
        { contentUid: file.contentUid, spaceId: file.spaceId },
      ]);

      const removableUrls = await resolveRemovableStorageUrls(
        this.fileModel,
        [file],
        serverDBEnv.REMOVE_GLOBAL_FILE,
      );

      if (removableUrls.length > 0) {
        await this.coreFileService.deleteFile(removableUrls[0]!);
      }

      this.log('info', 'File deleted successfully', { fileId, key: file.url });

      return;
    } catch (error) {
      this.handleServiceError(error, '删除文件');
    }
  }

  /**
   * 验证文件
   */
  private async validateFile(file: File, skipCheckFileType = false): Promise<void> {
    // 文件大小限制 (100MB)
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      throw this.createBusinessError(
        `File size exceeds maximum limit of ${maxSize / 1024 / 1024}MB`,
      );
    }

    // 文件名长度限制
    if (file.name.length > 255) {
      throw this.createBusinessError('Filename is too long (max 255 characters)');
    }

    // 检查文件类型（如果未跳过检查）
    if (!skipCheckFileType) {
      const allowedTypes = [
        'image/',
        'video/',
        'audio/',
        'text/',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/x-yaml',
        'application/yaml',
        'application/json',
      ];

      // 基于文件扩展名的额外验证（用于处理 application/octet-stream 等通用类型）
      const allowedExtensions = [
        '.yaml',
        '.yml',
        '.json',
        '.txt',
        '.md',
        '.xml',
        '.csv',
        '.tsv',
        '.pdf',
        '.doc',
        '.docx',
        '.xls',
        '.xlsx',
        '.ppt',
        '.pptx',
        '.jpg',
        '.jpeg',
        '.png',
        '.gif',
        '.bmp',
        '.webp',
        '.svg',
        '.mp4',
        '.avi',
        '.mov',
        '.wmv',
        '.flv',
        '.webm',
        '.mp3',
        '.wav',
        '.ogg',
        '.aac',
        '.flac',
        '.m4a',
      ];

      const isAllowed = allowedTypes.some((type) => file.type.startsWith(type));
      const fileExtension = file.name.toLowerCase().slice(Math.max(0, file.name.lastIndexOf('.')));
      const isExtensionAllowed = allowedExtensions.includes(fileExtension);

      // 如果文件类型不被允许，但扩展名是允许的（处理 application/octet-stream 等情况）
      if (!isAllowed && !isExtensionAllowed) {
        throw this.createBusinessError(`File type '${file.type}' is not supported`);
      }
    }
  }

  /**
   * 生成文件元数据
   */
  private generateFileMetadata(file: File, directory?: string): FileMetadata {
    const now = new Date();
    const datePath = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const dir = directory || 'uploads';
    const objectId = nanoid();
    const path = `${dir}/${datePath}/${objectId}`;

    return {
      date: now.toISOString(),
      dirname: dir,
      filename: file.name,
      path,
    };
  }

  /**
   * 上传归属的 Space：来源集优先其 spaceId，否则个人空间。
   */
  private async resolveUploadSpaceId(options: PublicFileUploadRequest): Promise<string> {
    if (options.sourceSetId) {
      const sourceSet = await this.assertSourceSetAccess(
        options.sourceSetId,
        'SOURCE_SET_UPDATE',
        'create_child',
      );
      if (sourceSet.spaceId) return sourceSet.spaceId;
    }

    const personal = await this.spaceModel.getOrCreatePersonalSpace();
    return personal.id;
  }

  /**
   * 解析上传请求中的 sessionId（agentId 优先，sessionId 兼容）
   */
  private async resolveSessionId(options: PublicFileUploadRequest): Promise<string | undefined> {
    if (!options.agentId) {
      return options.sessionId;
    }

    const relation = await this.db.query.agentsToSessions.findFirst({
      columns: { sessionId: true },
      where: and(
        eq(agentsToSessions.agentId, options.agentId),
        eq(agentsToSessions.userId, this.userId),
      ),
    });

    if (!relation) {
      this.log('warn', 'No session relation found for agent, fallback to sessionId', {
        agentId: options.agentId,
        sessionId: options.sessionId,
      });
      return options.sessionId;
    }

    return relation.sessionId;
  }

  /**
   * 创建文件和会话的关联关系
   */
  private async createFileSessionRelation(fileId: string, sessionId: string): Promise<void> {
    try {
      await this.db
        .insert(filesToSessions)
        .values({
          fileId,
          sessionId,
          userId: this.userId,
        })
        .onConflictDoNothing();

      this.log('info', 'File-session relation created', {
        fileId,
        sessionId,
        userId: this.userId,
      });
    } catch (error) {
      this.handleServiceError(error, '创建文件和会话的关联关系');
    }
  }

  /**
   * 批量获取文件详情和内容
   */
  async handleQueries(request: BatchGetFilesRequest): Promise<BatchGetFilesResponse> {
    try {
      this.log('info', 'Starting batch file retrieval', {
        count: request.fileIds.length,
        fileIds: request.fileIds,
      });

      const files: BatchGetFilesResponse['files'] = [];
      const failed: BatchGetFilesResponse['failed'] = [];

      // 并行处理所有文件
      const promises = request.fileIds.map(async (fileId) => {
        try {
          // 获取文件详情
          const fileDetail = await this.getFileDetail(fileId);

          files.push(fileDetail);
        } catch (error) {
          this.log('error', 'Failed to get file detail', {
            error,
            fileId,
          });

          failed.push({
            error: error instanceof Error ? error.message : 'Unknown error',
            fileId,
          });
        }
      });

      // 等待所有异步操作完成
      await Promise.all(promises);

      const result: BatchGetFilesResponse = {
        failed,
        files,
        success: files.length,
        total: request.fileIds.length,
      };

      this.log('info', 'Batch file retrieval completed', {
        failed: result.failed.length,
        success: result.success,
        total: result.total,
      });

      return result;
    } catch (error) {
      this.handleServiceError(error, '批量获取文件详情和内容');
    }
  }

  /**
   * 查找用户是否已有指定哈希的文件记录
   */
  private async findExistingUserFile(hash: string): Promise<FileItem | null> {
    try {
      const existingFile = await this.db.query.files.findFirst({
        where: and(eq(files.fileHash, hash), eq(files.userId, this.userId)),
      });

      return existingFile || null;
    } catch (error) {
      this.handleServiceError(error, '查找用户是否已有指定哈希的文件记录');
    }
  }

  /**
   * 构建文件查询的 WHERE 条件
   */
  private buildFileWhereConditions(
    request: FileListQuery,
    permissionResult: {
      condition?: { userId?: string };
      isPermitted: boolean;
      message?: string;
    },
  ) {
    const { keyword, fileType, updatedAtStart, updatedAtEnd } = request;
    const conditions = [];

    // 权限条件
    if (permissionResult?.condition?.userId) {
      conditions.push(eq(files.userId, permissionResult.condition.userId));
    }

    // 关键词搜索
    if (keyword) {
      conditions.push(ilike(files.name, `%${keyword}%`));
    }

    // 文件类型过滤
    if (fileType) {
      conditions.push(ilike(files.fileType, `${fileType}%`));
    }

    // 更新时间区间
    if (updatedAtStart) {
      conditions.push(gte(files.updatedAt, new Date(updatedAtStart)));
    }
    if (updatedAtEnd) {
      conditions.push(lte(files.updatedAt, new Date(updatedAtEnd)));
    }

    return conditions;
  }

  /**
   * 根据权限结果查询单个文件
   * @param fileId 文件 ID
   * @param permissionResult 权限校验结果
   * @returns 文件记录，如果找不到则抛出错误
   */
  private async findFileByIdWithPermission(
    fileId: string,
    permissionResult: { condition?: { userId?: string } },
  ): Promise<FileItem> {
    const whereConditions = [eq(files.id, fileId)];
    if (permissionResult.condition?.userId) {
      whereConditions.push(eq(files.userId, permissionResult.condition.userId));
    }

    const file = await this.db.query.files.findFirst({
      where: and(...whereConditions),
    });

    if (!file) {
      throw this.createCommonError('File not found');
    }

    return file;
  }

  /**
   * 批量获取文件关联数据并构建响应
   * @param filesResult 文件列表(FileItem 或带关系的文件对象)
   * @param needsManualRelationFetch 是否需要手动获取关联数据(JOIN查询时需要)
   * @param hasGlobalPermission 是否有全局权限（决定是否显示所有关联用户）
   */
  private async buildFileListResponse(
    filesResult: (FileItem & {
      sourceSets?: any[];
      user?: any;
    })[],
    needsManualRelationFetch = false,
    hasGlobalPermission = false,
  ): Promise<FileDetailResponse['file'][]> {
    if (filesResult.length === 0) return [];

    // 1. 按 fileHash 去重（相同 hash 的文件只保留第一个）
    const uniqueFilesByHash = new Map<string, (typeof filesResult)[0]>();
    for (const file of filesResult) {
      const key = file.fileHash || file.id;
      if (!uniqueFilesByHash.has(key)) {
        uniqueFilesByHash.set(key, file);
      }
    }
    const dedupedFiles = Array.from(uniqueFilesByHash.values());

    const fileIds = dedupedFiles.map((file) => file.id);
    const fileHashes = dedupedFiles.map((file) => file.fileHash).filter(Boolean) as string[];

    // 批量查询分块、任务状态
    const [chunkCounts, chunkTasks, embeddingTasks] = await Promise.all([
      this.chunkModel.countByFileIds(fileIds),
      this.asyncTaskModel.findByIds(
        dedupedFiles.map((file) => file.chunkTaskId).filter(Boolean) as string[],
        AsyncTaskType.Chunking,
      ),
      this.asyncTaskModel.findByIds(
        dedupedFiles.map((file) => file.embeddingTaskId).filter(Boolean) as string[],
        AsyncTaskType.Embedding,
      ),
    ]);

    // 2. 查询所有相同 hash 的文件对应的用户
    // 只有全局权限时才查询所有用户，否则只返回当前文件的用户
    const hashUsersMap = new Map<string, any[]>();

    if (hasGlobalPermission && fileHashes.length > 0) {
      // 查询所有相同 hash 的文件
      const allFilesWithSameHash = await this.db.query.files.findMany({
        columns: { fileHash: true, userId: true },
        where: inArray(files.fileHash, fileHashes),
      });

      // 收集所有用户 ID
      const allUserIds = [...new Set(allFilesWithSameHash.map((f) => f.userId))];

      // 查询用户信息
      const allUsers =
        allUserIds.length > 0
          ? await this.db.query.users.findMany({
              columns: { avatar: true, email: true, fullName: true, id: true, username: true },
              where: inArray(users.id, allUserIds),
            })
          : [];

      // 构建 hash -> users 映射
      for (const file of allFilesWithSameHash) {
        if (!file.fileHash) continue;
        const user = allUsers.find((u) => u.id === file.userId);
        if (user) {
          if (!hashUsersMap.has(file.fileHash)) {
            hashUsersMap.set(file.fileHash, []);
          }
          // 避免重复添加同一用户
          const existingUsers = hashUsersMap.get(file.fileHash)!;
          if (!existingUsers.some((u) => u.id === user.id)) {
            existingUsers.push(user);
          }
        }
      }
    }

    // 如果是 JOIN 查询,需要单独查询来源集和用户信息
    let fileSourceSets: any[] = [];
    let usersData: any[] = [];

    if (needsManualRelationFetch) {
      const userIds = [...new Set(dedupedFiles.map((file) => file.userId))];

      [fileSourceSets, usersData] = await Promise.all([
        this.db
          .select({
            fileId: sourceSetFiles.fileId,
            sourceSetAvatar: sourceSets.avatar,
            sourceSetDescription: sourceSets.description,
            sourceSetId: sourceSets.id,
            sourceSetName: sourceSets.name,
          })
          .from(sourceSetFiles)
          .innerJoin(sourceSets, eq(sourceSetFiles.sourceSetId, sourceSets.id))
          .where(inArray(sourceSetFiles.fileId, fileIds)),
        userIds.length > 0
          ? this.db.query.users.findMany({
              columns: {
                avatar: true,
                email: true,
                fullName: true,
                id: true,
                username: true,
              },
              where: inArray(users.id, userIds),
            })
          : [],
      ]);
    }

    // 构建响应数据
    return Promise.all(
      dedupedFiles.map(async (file) => {
        const base = await this.convertToResponse(file);

        const chunkCountItem = chunkCounts.find((c) => c.id === file.id);
        const chunkTask = file.chunkTaskId
          ? chunkTasks.find((task) => task.id === file.chunkTaskId)
          : null;
        const embeddingTask = file.embeddingTaskId
          ? embeddingTasks.find((task) => task.id === file.embeddingTaskId)
          : null;

        // 获取来源集信息
        const sourceSets = needsManualRelationFetch
          ? fileSourceSets
              .filter((sourceSet) => sourceSet.fileId === file.id)
              .map((sourceSet) => ({
                avatar: sourceSet.sourceSetAvatar,
                description: sourceSet.sourceSetDescription,
                id: sourceSet.sourceSetId,
                name: sourceSet.sourceSetName,
              }))
          : file.sourceSets?.map((sourceSet) => sourceSet.sourceSet) || [];

        // 获取用户信息
        let fileUsers = [];

        if (hasGlobalPermission && file.fileHash && hashUsersMap.has(file.fileHash)) {
          // 全局权限：返回所有关联该 hash 的用户
          fileUsers = hashUsersMap.get(file.fileHash) || [];
        } else {
          // 非全局权限：只返回当前文件的用户
          const currentUser = needsManualRelationFetch
            ? usersData.find((u) => u.id === file.userId) || null
            : file.user || null;
          if (currentUser) {
            fileUsers = [currentUser];
          }
        }

        let chunking: FileAsyncTaskResponse | null = null;

        if (chunkTask || chunkCountItem) {
          chunking = {
            count: chunkCountItem?.count ?? null,
            error: (chunkTask?.error as AsyncTaskErrorResponse | null) ?? null,
            id: chunkTask?.id,
            status: (chunkTask?.status as FileAsyncTaskResponse['status']) ?? null,
            type: chunkTask?.type as FileAsyncTaskResponse['type'],
          };
        }

        const embedding: FileAsyncTaskResponse | null = embeddingTask
          ? {
              error: (embeddingTask.error as AsyncTaskErrorResponse | null) ?? null,
              id: embeddingTask.id,
              status: (embeddingTask.status as FileAsyncTaskResponse['status']) ?? null,
              type: embeddingTask.type as FileAsyncTaskResponse['type'],
            }
          : null;

        return {
          ...base,
          chunking,
          embedding,
          sourceSets,
          users: fileUsers,
        };
      }),
    );
  }

  /**
   * 更新文件
   * PATCH /files/:id
   */
  async updateFile(
    fileId: string,
    updateData: { sourceSetId?: string | null },
  ): Promise<FileDetailResponse> {
    try {
      // 1. 权限校验
      const permissionResult = await this.resolveOperationPermission('FILE_UPDATE', {
        targetFileId: fileId,
      });
      if (!permissionResult.isPermitted) {
        throw this.createAuthorizationError(permissionResult.message || '无权更新文件');
      }

      // 2. 查询文件
      await this.findFileByIdWithPermission(fileId, permissionResult);

      // 3. 处理来源集关联
      if ('sourceSetId' in updateData) {
        await this.db.transaction(async (trx) => {
          await trx.delete(sourceSetFiles).where(eq(sourceSetFiles.fileId, fileId));

          // 如果提供了新的来源集 ID，创建新的关联
          if (updateData.sourceSetId) {
            const sourceSet = await this.assertSourceSetAccess(
              updateData.sourceSetId,
              'SOURCE_SET_UPDATE',
              'create_child',
            );

            await trx.insert(sourceSetFiles).values({
              fileId,
              sourceSetId: updateData.sourceSetId,
              spaceId: sourceSet.spaceId,
              userId: this.userId,
            });
          }
        });
      }

      // 4. 获取更新后的文件详情
      const updatedFile = await this.getFileDetail(fileId);

      return updatedFile;
    } catch (error) {
      this.handleServiceError(error, '更新文件');
    }
  }
}
