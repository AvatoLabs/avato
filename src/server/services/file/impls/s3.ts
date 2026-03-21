import { type LobeChatDatabase } from '@lobechat/database';

import { FileModel } from '@/database/models/file';
import { FileS3 } from '@/server/modules/S3';

import { type FileServiceImpl } from './type';

/**
 * S3-based file service implementation
 */
export class S3StaticFileImpl implements FileServiceImpl {
  private readonly s3: FileS3;
  private readonly db: LobeChatDatabase;

  constructor(db: LobeChatDatabase) {
    this.db = db;
    this.s3 = new FileS3();
  }

  async deleteFile(key: string) {
    return this.s3.deleteFile(key);
  }

  async deleteFiles(keys: string[]) {
    return this.s3.deleteFiles(keys);
  }

  async getFileContent(key: string): Promise<string> {
    return this.s3.getFileContent(key);
  }

  async getFileByteArray(key: string): Promise<Uint8Array> {
    return this.s3.getFileByteArray(key);
  }

  async createPreSignedUrl(key: string): Promise<string> {
    return this.s3.createPreSignedUrl(key);
  }

  async getFileMetadata(key: string): Promise<{ contentLength: number; contentType?: string }> {
    return this.s3.getFileMetadata(key);
  }

  async createPreSignedUrlForPreview(key: string, expiresIn?: number): Promise<string> {
    return this.s3.createPreSignedUrlForPreview(key, expiresIn);
  }

  async uploadContent(path: string, content: string) {
    return this.s3.uploadContent(path, content);
  }

  async getFullFileUrl(url?: string | null, expiresIn?: number): Promise<string> {
    if (!url) return '';

    // Handle legacy data compatibility - extract key from full URL if needed
    // Related issue: https://github.com/lobehub/lobe-chat/issues/8994
    let key = url;
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const extractedKey = await this.getKeyFromFullUrl(url);
      if (!extractedKey) {
        throw new Error('Key not found from url: ' + url);
      }
      key = extractedKey;
    }

    // User resources always stay private. Storage access must go through a presigned URL.
    return this.createPreSignedUrlForPreview(key, expiresIn);
  }

  async getKeyFromFullUrl(url: string): Promise<string | null> {
    try {
      const urlObject = new URL(url);
      const { pathname } = urlObject;

      // Case 1: File proxy URL pattern /f/{fileId} - query database for S3 key
      if (pathname.startsWith('/f/')) {
        const fileId = pathname.slice(3); // Remove '/f/' prefix
        const file = await FileModel.getFileById(this.db, fileId);
        return file?.url ?? null;
      }

      // Legacy S3 URLs are reduced to the object key regardless of public/private mode.
      return pathname.slice(1);
    } catch {
      // If url is not a valid URL, return null
      return null;
    }
  }

  async uploadMedia(key: string, buffer: Buffer): Promise<{ key: string }> {
    await this.s3.uploadMedia(key, buffer);
    return { key };
  }

  async uploadBuffer(key: string, buffer: Buffer, contentType: string): Promise<{ key: string }> {
    await this.s3.uploadBuffer(key, buffer, contentType);
    return { key };
  }
}
