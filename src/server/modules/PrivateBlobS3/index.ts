import {
  type BucketLocationConstraint,
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { fileEnv } from '@/envs/file';

const DEFAULT_S3_REGION = 'us-east-1';

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
   * Upload buffer with specified content type
   */
  public async uploadBuffer(
    path: string,
    buffer: Buffer,
    contentType?: string,
    cacheControl?: string,
  ) {
    return this.withBucketAutoCreateRetry(async () => {
      const command = new PutObjectCommand({
        // No ACL - always private
        Body: buffer,
        Bucket: this.bucket,
        CacheControl: cacheControl,
        ContentType: contentType,
        Key: path,
      });

      return this.client.send(command);
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
