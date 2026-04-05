import type { Readable } from 'node:stream';

import { getPrivateBlobS3 } from '@/server/modules/PrivateBlobS3';

import type { BlobProvider, BlobUploadBodyOptions } from './type';

class S3CompatibleBlobProvider implements BlobProvider {
  createDownloadUrl(key: string, options?: { expiresIn?: number }) {
    return getPrivateBlobS3().createPreSignedDownloadUrl(key, options);
  }

  createUploadUrl(
    key: string,
    options?: {
      contentType?: string;
      expiresIn?: number;
    },
  ) {
    return getPrivateBlobS3().createPreSignedUploadUrl(key, options);
  }

  deleteObject(key: string) {
    return getPrivateBlobS3().deleteFile(key);
  }

  deleteObjects(keys: string[]) {
    return getPrivateBlobS3().deleteFiles(keys);
  }

  getObjectByteArray(key: string) {
    return getPrivateBlobS3().getFileByteArray(key);
  }

  getObjectContent(key: string) {
    return getPrivateBlobS3().getFileContent(key);
  }

  getObjectMetadata(key: string) {
    return getPrivateBlobS3().getObjectMetadata(key);
  }

  uploadContent(path: string, content: string) {
    return getPrivateBlobS3().uploadContent(path, content);
  }

  uploadMedia(key: string, buffer: Buffer) {
    return getPrivateBlobS3().uploadMedia(key, buffer);
  }

  uploadBody(key: string, body: Buffer | Readable, options?: BlobUploadBodyOptions) {
    return getPrivateBlobS3().uploadBody(key, body, options);
  }

  uploadBuffer(key: string, buffer: Buffer, contentType?: string, cacheControl?: string) {
    return getPrivateBlobS3().uploadBuffer(key, buffer, contentType, cacheControl);
  }
}

let blobProviderInstance: BlobProvider | undefined;

export const getBlobProvider = (): BlobProvider => {
  if (!blobProviderInstance) {
    blobProviderInstance = new S3CompatibleBlobProvider();
  }

  return blobProviderInstance;
};
