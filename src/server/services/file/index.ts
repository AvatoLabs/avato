import { type LobeChatDatabase } from '@lobechat/database';
import { inferContentTypeFromImageUrl, nanoid, uuid } from '@lobechat/utils';
import { TRPCError } from '@trpc/server';
import { sha256 } from 'js-sha256';

import { ContentModel } from '@/database/models/content';
import { DocumentModel } from '@/database/models/document';
import { FileModel } from '@/database/models/file';
import { SpaceModel } from '@/database/models/space';
import { type FileItem } from '@/database/schemas';
import { AuthorizedResourceResolver, type ContentCapability } from '@/server/services/content';
import { TempFileManager } from '@/server/utils/tempFileManager';

import { isCanonicalSpaceBlobKey } from './canonicalSpaceBlobKey';
import { createFileServiceModule } from './impls';
import { type FileServiceImpl } from './impls/type';
import { isStorageObjectMissingError, STORAGE_OBJECT_MISSING_MESSAGE } from './storageErrors';

const INTERNAL_DOCUMENT_URL_PREFIX = 'internal://document/';
const SPACE_BLOB_STORAGE_PREFIX = 'v2/spaces';
const INTERNAL_DOCUMENT_URL_NOT_FETCHABLE_MESSAGE = 'INTERNAL_DOCUMENT_URL_NOT_FETCHABLE';

/**
 * File service class
 * Provides file operation services using a modular implementation approach
 */
export class FileService {
  private readonly db: LobeChatDatabase;
  private userId: string;
  private documentModel: DocumentModel;
  private fileModel: FileModel;
  private contentModel: ContentModel;
  private resolver: AuthorizedResourceResolver;

  private impl: FileServiceImpl;

  constructor(db: LobeChatDatabase, userId: string) {
    this.db = db;
    this.userId = userId;
    this.documentModel = new DocumentModel(db, userId);
    this.fileModel = new FileModel(db, userId);
    this.contentModel = new ContentModel(db, userId);
    this.resolver = new AuthorizedResourceResolver(db, userId);
    this.impl = createFileServiceModule(db);
  }

  private extractInternalDocumentId(key: string) {
    if (!key.startsWith(INTERNAL_DOCUMENT_URL_PREFIX)) return;

    const documentId = key.slice(INTERNAL_DOCUMENT_URL_PREFIX.length).trim();
    return documentId || undefined;
  }

  private async getInternalDocumentContent(documentId: string) {
    const document = await this.documentModel.findByIdAny(documentId);

    if (!document) {
      throw new TRPCError({ code: 'NOT_FOUND', message: `Document not found: ${documentId}` });
    }

    return document.content || '';
  }

  /**
   * Delete file
   */
  public async deleteFile(key: string) {
    return this.impl.deleteFile(key);
  }

  /**
   * Delete files in batch
   */
  public async deleteFiles(keys: string[]) {
    return this.impl.deleteFiles(keys);
  }

  /**
   * Get file content
   */
  public async getFileContent(key: string): Promise<string> {
    const internalDocumentId = this.extractInternalDocumentId(key);
    if (internalDocumentId) {
      return this.getInternalDocumentContent(internalDocumentId);
    }

    return this.impl.getFileContent(key);
  }

  /**
   * Get file byte array
   */
  public async getFileByteArray(key: string): Promise<Uint8Array> {
    const internalDocumentId = this.extractInternalDocumentId(key);
    if (internalDocumentId) {
      const content = await this.getInternalDocumentContent(internalDocumentId);
      return new TextEncoder().encode(content);
    }

    return this.impl.getFileByteArray(key);
  }

  /**
   * Create pre-signed upload URL
   */
  public async createPreSignedUrl(key: string): Promise<string> {
    return this.impl.createPreSignedUrl(key);
  }

  /**
   * Get file metadata from storage
   * Used to verify actual file size instead of trusting client-provided values
   */
  public async getFileMetadata(
    key: string,
  ): Promise<{ contentLength: number; contentType?: string }> {
    return this.impl.getFileMetadata(key);
  }

  /**
   * Create pre-signed preview URL
   */
  public async createPreSignedUrlForPreview(key: string, expiresIn?: number): Promise<string> {
    return this.impl.createPreSignedUrlForPreview(key, expiresIn);
  }

  /**
   * Upload content
   */
  public async uploadContent(path: string, content: string) {
    return this.impl.uploadContent(path, content);
  }

  /**
   * Get full file URL
   */
  public async getFullFileUrl(url?: string | null, expiresIn?: number): Promise<string> {
    if (url && this.extractInternalDocumentId(url)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: INTERNAL_DOCUMENT_URL_NOT_FETCHABLE_MESSAGE,
      });
    }

    return this.impl.getFullFileUrl(url, expiresIn);
  }

  /**
   * Extract key from full URL
   */
  public async getKeyFromFullUrl(url: string): Promise<string | null> {
    return this.impl.getKeyFromFullUrl(url);
  }

  /**
   * Upload media file (images only)
   */
  public async uploadMedia(key: string, buffer: Buffer): Promise<{ key: string }> {
    return this.impl.uploadMedia(key, buffer);
  }

  /**
   * Upload buffer with specified content type (for any file type)
   */
  public async uploadBuffer(
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<{ key: string }> {
    return this.impl.uploadBuffer(key, buffer, contentType);
  }

  public async createOpaqueUserBlobPath(scope: string, extension: string, spaceId?: string | null) {
    const resolvedSpaceId =
      spaceId ?? (await new SpaceModel(this.db, this.userId).getOrCreatePersonalSpace()).id;
    const normalizedScope = scope.replace(/^\/+/, '').replace(/\/+$/, '');
    const normalizedExtension = extension.replace(/^\.+/, '') || 'bin';

    return {
      key: `${SPACE_BLOB_STORAGE_PREFIX}/${resolvedSpaceId}/blobs/${normalizedScope}/${nanoid()}.${normalizedExtension}`,
      spaceId: resolvedSpaceId,
    };
  }

  private async createSpaceScopedFileRecord(params: {
    blobEtag?: string;
    blobId?: string;
    blobMetadata?: Record<string, unknown>;
    fileType: string;
    id?: string;
    metadata?: FileItem['metadata'];
    name: string;
    parentId?: string;
    source?: string | null;
    sourceSetId?: string;
    sha256: string;
    size: number;
    spaceId: string;
    storageKey: string;
  }): Promise<{ id: string }> {
    const blobId =
      params.blobId ??
      (
        await this.contentModel.upsertSpaceBlob({
          createdBy: this.userId,
          etag: params.blobEtag,
          fileType: params.fileType,
          metadata: params.blobMetadata ?? {},
          sha256: params.sha256,
          size: params.size,
          spaceId: params.spaceId,
          status: 'ready',
          storageKey: params.storageKey,
          verifiedAt: new Date(),
        })
      ).id;

    const { id } = await this.fileModel.create(
      {
        blobId,
        fileHash: null,
        fileType: params.fileType,
        id: params.id,
        metadata: params.metadata,
        name: params.name,
        parentId: params.parentId,
        size: params.size,
        source: params.source as any,
        sourceSetId: params.sourceSetId,
        spaceId: params.spaceId,
        url: params.storageKey,
      },
      false,
    );

    const registry = await this.contentModel.ensureContentRegistry({
      createdBy: this.userId,
      kind: 'file',
      localId: id,
      spaceId: params.spaceId,
    });

    await this.fileModel.update(id, {
      blobId,
      contentUid: registry.contentUid,
      spaceId: params.spaceId,
    } as any);

    await this.contentModel.ensureOwnerPermission({
      contentUid: registry.contentUid,
      spaceId: params.spaceId,
    });

    return { id };
  }

  /**
   * Create file record (common method)
   * File records are always space-scoped and always register `space_blobs` plus content registry ownership.
   * Internal no-space CAS artifacts must use `createGlobalFile` instead.
   *
   * @param params - File parameters
   * @param params.id - Optional custom file ID (defaults to auto-generated)
   * @returns File record and proxy URL
   */
  public async createFileRecord(params: {
    blobEtag?: string;
    blobId?: string;
    blobMetadata?: Record<string, unknown>;
    fileType: string;
    id?: string;
    metadata?: FileItem['metadata'];
    name: string;
    parentId?: string;
    source?: string | null;
    sourceSetId?: string;
    sha256: string;
    size: number;
    spaceId?: string | null;
    storageKey: string;
  }): Promise<{ fileId: string; url: string }> {
    if (params.spaceId === null) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message:
          'createFileRecord requires a space-scoped destination; use createGlobalFile instead',
      });
    }

    const resolvedSpaceId =
      params.spaceId ?? (await new SpaceModel(this.db, this.userId).getOrCreatePersonalSpace()).id;

    const { id } = await this.createSpaceScopedFileRecord({
      blobEtag: params.blobEtag,
      blobId: params.blobId,
      blobMetadata: params.blobMetadata,
      fileType: params.fileType,
      id: params.id,
      metadata: params.metadata,
      name: params.name,
      parentId: params.parentId,
      source: params.source,
      sourceSetId: params.sourceSetId,
      sha256: params.sha256,
      size: params.size,
      spaceId: resolvedSpaceId,
      storageKey: params.storageKey,
    });

    return {
      fileId: id,
      url: `/f/${id}`,
    };
  }

  /**
   * Create a file record for an object that has already been uploaded to storage.
   * Reads the stored bytes to compute the canonical sha256 used by `space_blobs`.
   */
  public async createFileRecordFromStorageObject(params: {
    fileType: string;
    id?: string;
    name: string;
    spaceId?: string | null;
    storageKey: string;
  }): Promise<{ fileId: string; sha256: string; size: number; url: string }> {
    const bytes = await this.getFileByteArray(params.storageKey);
    const size = bytes.byteLength;
    const contentSha256 = sha256(bytes);

    const { fileId, url } = await this.createFileRecord({
      fileType: params.fileType,
      id: params.id,
      name: params.name,
      sha256: contentSha256,
      size,
      ...(params.spaceId !== undefined ? { spaceId: params.spaceId } : {}),
      storageKey: params.storageKey,
    });

    return {
      fileId,
      sha256: contentSha256,
      size,
      url,
    };
  }

  /**
   * Delete user file record but keep globalFiles record
   * Used for GitHub skill imports where we only need globalFiles for foreign key
   *
   * @param fileId - File ID to delete from user's files table
   */
  public async deleteUserFileRecord(fileId: string): Promise<void> {
    await this.fileModel.delete(fileId, false); // false = don't remove globalFiles
  }

  /**
   * Create global file record only (no user file record)
   * Used for skill resources that should not appear in user's file list
   * Always attempts insert with `onConflictDoNothing` to avoid existence pre-check side channels.
   *
   * @param params - File parameters
   * @returns sha256 for reference
   */
  public async createGlobalFile(params: {
    fileType: string;
    metadata?: { dirname: string; filename: string; originalPath?: string; path: string };
    sha256: string;
    size: number;
    storageKey: string;
  }): Promise<{ sha256: string }> {
    await this.fileModel.createGlobalFile({
      creator: this.userId,
      fileType: params.fileType,
      hashId: params.sha256,
      metadata: params.metadata,
      size: params.size,
      url: params.storageKey,
    });

    return { sha256: params.sha256 };
  }

  /**
   * Get file content by sha256 from globalFiles
   * Used for reading skill resources stored in globalFiles only
   *
   * @param sha256 - File digest stored in globalFiles.hashId
   * @returns File content as string
   */
  public async getFileContentBySha256(sha256: string): Promise<string> {
    const allowed = await this.fileModel.canAccessGlobalFileBySha256(sha256);
    if (!allowed) {
      throw new TRPCError({ code: 'NOT_FOUND', message: `Global file not found: ${sha256}` });
    }

    const result = await this.fileModel.checkHash(sha256);
    if (!result.isExist || !result.url) {
      throw new TRPCError({ code: 'NOT_FOUND', message: `Global file not found: ${sha256}` });
    }
    return this.getFileContent(result.url);
  }

  public async getFileByteArrayBySha256(sha256: string): Promise<Uint8Array> {
    const allowed = await this.fileModel.canAccessGlobalFileBySha256(sha256);
    if (!allowed) {
      throw new TRPCError({ code: 'NOT_FOUND', message: `Global file not found: ${sha256}` });
    }

    const result = await this.fileModel.checkHash(sha256);
    if (!result.isExist || !result.url) {
      throw new TRPCError({ code: 'NOT_FOUND', message: `Global file not found: ${sha256}` });
    }
    return this.getFileByteArray(result.url);
  }

  /**
   * Upload base64 data and create database record
   * @param base64Data - Base64 data (supports data URI format or pure base64)
   * @param pathname - File storage path (must include file extension)
   * @returns Contains key (storage path), fileId (database record ID) and url (proxy access path)
   */
  public async uploadBase64(
    base64Data: string,
    pathname: string,
  ): Promise<{ fileId: string; key: string; url: string }> {
    if (!isCanonicalSpaceBlobKey(pathname)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'uploadBase64 only accepts canonical v2/spaces/{spaceId}/blobs keys',
      });
    }

    let base64String: string;

    // If data URI format (data:image/png;base64,xxx)
    if (base64Data.startsWith('data:')) {
      const commaIndex = base64Data.indexOf(',');
      if (commaIndex === -1) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid base64 data format' });
      }
      base64String = base64Data.slice(commaIndex + 1);
    } else {
      // Pure base64 string
      base64String = base64Data;
    }

    // Convert to Buffer
    const buffer = Buffer.from(base64String, 'base64');

    // Upload to storage (S3 or local)
    const { key } = await this.uploadMedia(pathname, buffer);

    // Extract filename from pathname
    const name = pathname.split('/').pop() || 'unknown';

    // Calculate file metadata
    const size = buffer.length;
    const fileType = inferContentTypeFromImageUrl(pathname) || 'application/octet-stream';
    const contentSha256 = sha256(buffer);

    // Generate UUID for cleaner URLs
    const fileId = uuid();

    // Use common method to create file record
    const { fileId: createdId, url } = await this.createFileRecord({
      fileType,
      id: fileId, // Use UUID instead of auto-generated ID
      name,
      sha256: contentSha256,
      size,
      storageKey: key, // Store original key (S3 key or desktop://)
    });

    return { fileId: createdId, key, url };
  }

  /**
   * Download file from external URL, upload to S3, and create database record
   * @param externalUrl - External file URL to download (e.g., Discord CDN)
   * @param pathname - File storage path in S3 (must include file extension)
   * @returns Contains key (storage path), fileId (database record ID) and url (proxy access path)
   */
  public async uploadFromUrl(
    externalUrl: string,
    pathname: string,
    options?: {
      name?: string;
      spaceId?: string | null;
    },
  ): Promise<{ fileId: string; key: string; url: string }> {
    if (!isCanonicalSpaceBlobKey(pathname)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'uploadFromUrl only accepts canonical v2/spaces/{spaceId}/blobs keys',
      });
    }

    const response = await fetch(externalUrl);

    if (!response.ok) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Failed to download file from URL: ${response.status} ${response.statusText}`,
      });
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    // Upload to storage (S3 or local)
    const { key } = await this.uploadMedia(pathname, buffer);

    // Extract filename from pathname
    const name = options?.name || pathname.split('/').pop() || 'unknown';

    // Calculate file metadata
    const size = buffer.length;
    const fileType =
      response.headers.get('content-type') ||
      inferContentTypeFromImageUrl(pathname) ||
      'application/octet-stream';
    const contentSha256 = sha256(buffer);

    // Generate UUID for cleaner URLs
    const fileId = uuid();

    // Use common method to create file record
    const { fileId: createdId, url } = await this.createFileRecord({
      fileType,
      id: fileId,
      name,
      sha256: contentSha256,
      size,
      ...(options && 'spaceId' in options ? { spaceId: options.spaceId } : {}),
      storageKey: key,
    });

    return { fileId: createdId, key, url };
  }

  async downloadFileToLocal(
    fileId: string,
    capability: ContentCapability = 'read_content',
  ): Promise<{ cleanup: () => void; file: FileItem; filePath: string }> {
    const file = (await this.resolver.requireFile(fileId, capability)) as FileItem;

    let content: Uint8Array | undefined;
    try {
      content = await this.getFileByteArray(file.url);
    } catch (e) {
      console.error(e);

      if (isStorageObjectMissingError(e)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: STORAGE_OBJECT_MISSING_MESSAGE,
        });
      }
    }

    if (!content) throw new TRPCError({ code: 'BAD_REQUEST', message: 'File content is empty' });

    const dir = nanoid();
    const tempManager = new TempFileManager(dir);

    const filePath = await tempManager.writeTempFile(content, file.name);
    return { cleanup: () => tempManager.cleanup(), file, filePath };
  }
}
