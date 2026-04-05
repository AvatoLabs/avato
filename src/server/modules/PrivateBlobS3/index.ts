import { Readable } from 'node:stream';

import {
  type BucketLocationConstraint,
  CreateBucketCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type PutObjectCommandInput,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import mime from 'mime';

import { fileEnv } from '@/envs/file';
import { YEAR } from '@/utils/units';

const DEFAULT_S3_REGION = 'us-east-1';

interface UploadBodyOptions {
  cacheControl?: string;
  contentLength?: number;
  contentType?: string;
}

/**
 * PrivateBlobS3 - S3 client for private blob storage
 *
 * This is a specialized S3 client for upload contract security.
 * - Always uses private ACL (no public-read option)
 * - Provides presigned URLs for secure uploads
 * - Verifies object metadata after upload
 */
export class PrivateBlobS3 {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly region: string;
  private isBucketReady = false;
  private ensureBucketPromise?: Promise<void>;

  constructor() {
    if (!fileEnv.S3_ACCESS_KEY_ID || !fileEnv.S3_SECRET_ACCESS_KEY || !fileEnv.S3_ENDPOINT) {
      throw new Error('S3 environment variables are not set completely, please check your env');
    }
    if (!fileEnv.S3_BUCKET) {
      throw new Error('S3 bucket is not set, please check your env');
    }

    this.bucket = fileEnv.S3_BUCKET;
    this.region = fileEnv.S3_REGION || DEFAULT_S3_REGION;

    this.client = new S3Client({
      credentials: {
        accessKeyId: fileEnv.S3_ACCESS_KEY_ID,
        secretAccessKey: fileEnv.S3_SECRET_ACCESS_KEY,
      },
      endpoint: fileEnv.S3_ENDPOINT,
      forcePathStyle: fileEnv.S3_ENABLE_PATH_STYLE,
      region: this.region,
      // refs: https://github.com/lobehub/lobe-chat/pull/5479
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  private isBucketNotFoundError(error: unknown): boolean {
    const code = (error as any)?.Code || (error as any)?.code || (error as any)?.name;
    const httpStatusCode = (error as any)?.$metadata?.httpStatusCode;

    return code === 'NoSuchBucket' || code === 'NotFound' || httpStatusCode === 404;
  }

  private isBucketAlreadyExistsError(error: unknown): boolean {
    const code = (error as any)?.Code || (error as any)?.code || (error as any)?.name;
    const httpStatusCode = (error as any)?.$metadata?.httpStatusCode;

    return (
      code === 'BucketAlreadyExists' || code === 'BucketAlreadyOwnedByYou' || httpStatusCode === 409
    );
  }

  private async createBucketIfNeeded() {
    const command = new CreateBucketCommand({
      Bucket: this.bucket,
      CreateBucketConfiguration:
        this.region === DEFAULT_S3_REGION
          ? undefined
          : { LocationConstraint: this.region as BucketLocationConstraint },
    });

    try {
      await this.client.send(command);
    } catch (error) {
      if (this.isBucketAlreadyExistsError(error)) return;
      throw error;
    }
  }

  private async ensureBucketExists() {
    if (this.isBucketReady) return;

    if (!this.ensureBucketPromise) {
      this.ensureBucketPromise = (async () => {
        await this.createBucketIfNeeded();
        this.isBucketReady = true;
      })().finally(() => {
        this.ensureBucketPromise = undefined;
      });
    }

    await this.ensureBucketPromise;
  }

  private async withBucketAutoCreateRetry<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (!this.isBucketNotFoundError(error)) throw error;

      await this.ensureBucketExists();
      return operation();
    }
  }

  /**
   * Create a presigned URL for uploading a file
   * - Uses private ACL (no public-read)
   * - Expires in 1 hour by default
   */
  public async createPreSignedUploadUrl(
    key: string,
    options?: {
      contentType?: string;
      expiresIn?: number;
    },
  ): Promise<string> {
    return this.withBucketAutoCreateRetry(async () => {
      const command = new PutObjectCommand({
        // No ACL - always private
        Bucket: this.bucket,
        ContentType: options?.contentType,
        Key: key,
      });

      return getSignedUrl(this.client, command, {
        expiresIn: options?.expiresIn ?? 3600,
      });
    });
  }

  /**
   * Get object metadata from S3 using HeadObject
   * Used to verify actual file properties after upload
   */
  public async getObjectMetadata(key: string): Promise<{
    contentLength: number;
    contentType?: string;
    etag?: string;
    lastModified?: Date;
  }> {
    const command = new HeadObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const response = await this.client.send(command);

    return {
      contentLength: response.ContentLength ?? 0,
      contentType: response.ContentType,
      etag: response.ETag?.replaceAll('"', ''), // Remove quotes from ETag
      lastModified: response.LastModified,
    };
  }

  /**
   * Get a presigned URL for downloading a file
   */
  public async createPreSignedDownloadUrl(
    key: string,
    options?: { expiresIn?: number },
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.client, command, {
      expiresIn: options?.expiresIn ?? fileEnv.S3_PREVIEW_URL_EXPIRE_IN,
    });
  }

  /**
   * Delete a file from S3
   */
  public async deleteFile(key: string) {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return this.client.send(command);
  }

  /**
   * Delete files from S3
   */
  public async deleteFiles(keys: string[]) {
    const command = new DeleteObjectsCommand({
      Bucket: this.bucket,
      Delete: { Objects: keys.map((key) => ({ Key: key })) },
    });

    return this.client.send(command);
  }

  /**
   * Get file content from S3
   */
  public async getFileContent(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const response = await this.client.send(command);

    if (!response.Body) {
      throw new Error(`No body in response with ${key}`);
    }

    return response.Body.transformToString();
  }

  /**
   * Get file bytes from S3
   */
  public async getFileByteArray(key: string): Promise<Uint8Array> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const response = await this.client.send(command);

    if (!response.Body) {
      throw new Error(`No body in response with ${key}`);
    }

    return response.Body.transformToByteArray();
  }

  /**
   * Upload buffer with specified content type
   */
  public async uploadBuffer(
    path: string,
    buffer: Buffer,
    contentType?: string,
    cacheControl?: string,
  ) {
    return this.uploadBody(path, buffer, {
      cacheControl,
      contentLength: buffer.length,
      contentType,
    });
  }

  public async uploadBody(
    path: string,
    body: NonNullable<PutObjectCommandInput['Body']>,
    { cacheControl, contentLength, contentType }: UploadBodyOptions = {},
  ) {
    if (body instanceof Readable && contentLength === undefined) {
      throw new Error('ContentLength is required when uploading a stream body to S3.');
    }

    return this.withBucketAutoCreateRetry(async () => {
      const command = new PutObjectCommand({
        // No ACL - always private
        Body: body,
        Bucket: this.bucket,
        CacheControl: cacheControl,
        ContentLength: contentLength,
        ContentType: contentType,
        Key: path,
      });

      return this.client.send(command);
    });
  }

  public async uploadContent(path: string, content: string) {
    return this.withBucketAutoCreateRetry(async () => {
      const command = new PutObjectCommand({
        Body: content,
        Bucket: this.bucket,
        Key: path,
      });

      return this.client.send(command);
    });
  }

  /**
   * Upload media file with long-term cache while keeping the blob private.
   */
  public async uploadMedia(key: string, buffer: Buffer) {
    await this.withBucketAutoCreateRetry(async () => {
      const contentType = mime.getType(key) || 'application/octet-stream';
      const command = new PutObjectCommand({
        Body: buffer,
        Bucket: this.bucket,
        CacheControl: `public, max-age=${YEAR}`,
        ContentType: contentType,
        Key: key,
      });

      await this.client.send(command);
    });
  }
}

// Singleton instance
let privateBlobS3Instance: PrivateBlobS3 | null = null;

export const getPrivateBlobS3 = (): PrivateBlobS3 => {
  if (!privateBlobS3Instance) {
    privateBlobS3Instance = new PrivateBlobS3();
  }
  return privateBlobS3Instance;
};
