import type { Readable } from 'node:stream';

export interface BlobUploadBodyOptions {
  cacheControl?: string;
  contentLength?: number;
  contentType?: string;
}

export interface BlobObjectMetadata {
  contentLength: number;
  contentType?: string;
  etag?: string;
  lastModified?: Date;
}

export interface BlobProvider {
  createDownloadUrl: (key: string, options?: { expiresIn?: number }) => Promise<string>;
  createUploadUrl: (
    key: string,
    options?: {
      contentType?: string;
      expiresIn?: number;
    },
  ) => Promise<string>;
  deleteObject: (key: string) => Promise<unknown>;
  deleteObjects: (keys: string[]) => Promise<unknown>;
  getObjectByteArray: (key: string) => Promise<Uint8Array>;
  getObjectContent: (key: string) => Promise<string>;
  getObjectMetadata: (key: string) => Promise<BlobObjectMetadata>;
  uploadBody: (
    key: string,
    body: Buffer | Readable,
    options?: BlobUploadBodyOptions,
  ) => Promise<{ key: string }>;
  uploadBuffer: (
    key: string,
    buffer: Buffer,
    contentType?: string,
    cacheControl?: string,
  ) => Promise<{ key: string }>;
  uploadContent: (path: string, content: string) => Promise<unknown>;
  uploadMedia: (key: string, buffer: Buffer) => Promise<unknown>;
}
