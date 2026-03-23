import { parseDataUri } from '@lobechat/model-runtime';
import dayjs from 'dayjs';
import debug from 'debug';
import { sha256 } from 'js-sha256';

import { lambdaClient } from '@/libs/trpc/client';
import { API_ENDPOINTS } from '@/services/_url';
import { type FileMetadata, type UploadBase64ToS3Result } from '@/types/files';
import { type FileUploadState, type FileUploadStatus } from '@/types/files/upload';

export const UPLOAD_NETWORK_ERROR = 'NetWorkError';

const log = debug('lobe-client:upload');

const fileMetadataFromStorageKey = (storageKey: string): FileMetadata => {
  const parts = storageKey.split('/');
  const filename = parts.at(-1) ?? '';
  const dirname = parts.length > 1 ? parts.slice(0, -1).join('/') : '';

  return {
    date: (Date.now() / 1000 / 60 / 60).toFixed(0),
    dirname,
    filename,
    path: storageKey,
  };
};

interface UploadFileToS3Options {
  abortController?: AbortController;
  /** @deprecated Ignored; storage keys are server-generated from upload sessions. */
  directory?: string;
  filename?: string;
  knowledgeBaseId?: string;
  onNotSupported?: () => void;
  onProgress?: (status: FileUploadStatus, state: FileUploadState) => void;
  parentId?: string;
  /** @deprecated Ignored; storage keys are server-generated from upload sessions. */
  pathname?: string;
  /** Precomputed SHA-256 (hex) to avoid re-reading the file buffer. */
  sha256?: string;
  skipCheckFileType?: boolean;
  spaceId?: string;
}

const shouldUseSameOriginUpload = (preSignUrl: string): boolean => {
  if (typeof window === 'undefined') return false;

  try {
    return window.location.protocol === 'https:' && new URL(preSignUrl).protocol === 'http:';
  } catch {
    return false;
  }
};

const getUploadErrorMessage = (responseText: string, fallback: string): string => {
  if (!responseText) return fallback;

  try {
    const payload = JSON.parse(responseText) as { error?: string };
    if (payload.error) return payload.error;
  } catch {
    // ignore non-json responses
  }

  return responseText || fallback;
};

class UploadService {
  /**
   * uniform upload method for both server and client
   */
  uploadFileToS3 = async (
    file: File,
    { onProgress, abortController, ...options }: UploadFileToS3Options,
  ): Promise<{ data: FileMetadata; success: boolean }> => {
    const data = await this.uploadToServerS3(file, {
      abortController,
      onProgress,
      ...options,
    });
    return { data, success: true };
  };

  uploadBase64ToS3 = async (
    base64Data: string,
    options: UploadFileToS3Options = {},
  ): Promise<UploadBase64ToS3Result> => {
    const { base64, mimeType, type } = parseDataUri(base64Data);

    if (!base64 || !mimeType || type !== 'base64') {
      throw new Error('Invalid base64 data for image');
    }

    const byteCharacters = atob(base64);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += 1024) {
      const slice = byteCharacters.slice(offset, offset + 1024);

      const byteNumbers: number[] = Array.from({ length: slice.length });
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }

      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }

    const blob = new Blob(byteArrays, { type: mimeType });

    const fileExtension = mimeType.split('/')[1] || 'png';
    const fileName = `${options.filename || `image_${dayjs().format('YYYY-MM-DD-hh-mm-ss')}`}.${fileExtension}`;

    const file = new File([blob], fileName, { type: mimeType });

    const { data: metadata } = await this.uploadFileToS3(file, options);
    const hash = sha256(await file.arrayBuffer());

    return {
      fileType: mimeType,
      hash,
      metadata,
      size: file.size,
    };
  };

  uploadDataToS3 = async (data: object, options: UploadFileToS3Options = {}) => {
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const file = new File([blob], options.filename || 'data.json', { type: 'application/json' });
    return await this.uploadFileToS3(file, options);
  };

  uploadToServerS3 = async (
    file: File,
    {
      onProgress,
      abortController,
      knowledgeBaseId,
      parentId,
      sha256: sha256Option,
      spaceId,
    }: UploadFileToS3Options,
  ): Promise<FileMetadata> => {
    const sha256Hex = sha256Option ?? sha256(new Uint8Array(await file.arrayBuffer()));

    const prep = await lambdaClient.upload.prepareResourceUpload.mutate({
      filename: file.name,
      fileType: file.type || 'application/octet-stream',
      knowledgeBaseId,
      parentId,
      sha256: sha256Hex,
      size: file.size,
      spaceId,
    });

    const result = fileMetadataFromStorageKey(prep.storageKey);
    // Object key is opaque; keep user-facing name from the File (not the storage path segment).
    result.filename = file.name;
    const startTime = Date.now();

    if (shouldUseSameOriginUpload(prep.presignedUrl)) {
      log('Falling back to same-origin upload for mixed content path: %s', prep.storageKey);
      await this.uploadToSameOriginWithSession(file, prep.sessionId, {
        abortController,
        onProgress,
        startTime,
      });
    } else {
      const xhr = new XMLHttpRequest();

      if (abortController) {
        abortController.signal.addEventListener('abort', () => {
          xhr.abort();
        });
      }

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Number(((event.loaded / event.total) * 100).toFixed(1));

          const speedInByte = event.loaded / ((Date.now() - startTime) / 1000);

          onProgress?.('uploading', {
            progress: progress === 100 ? 99.9 : progress,
            restTime: (event.total - event.loaded) / speedInByte,
            speed: speedInByte,
          });
        }
      });

      xhr.open('PUT', prep.presignedUrl);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      const data = await file.arrayBuffer();

      await new Promise((resolve, reject) => {
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            onProgress?.('success', {
              progress: 100,
              restTime: 0,
              speed: file.size / ((Date.now() - startTime) / 1000),
            });
            resolve(xhr.response);
          } else {
            reject(xhr.statusText);
          }
        });
        xhr.addEventListener('error', () => {
          if (xhr.status === 0) reject(UPLOAD_NETWORK_ERROR);
          else reject(xhr.statusText);
        });
        xhr.addEventListener('abort', () => {
          onProgress?.('cancelled', { progress: 0, restTime: 0, speed: 0 });
          reject(new Error('Upload cancelled by user'));
        });
        xhr.send(data);
      });
    }

    await lambdaClient.upload.completeResourceUpload.mutate({
      uploadSessionId: prep.sessionId,
    });

    return result;
  };

  private uploadToSameOriginWithSession = async (
    file: File,
    uploadSessionId: string,
    {
      onProgress,
      abortController,
      startTime,
    }: {
      abortController?: AbortController;
      onProgress?: (status: FileUploadStatus, state: FileUploadState) => void;
      startTime: number;
    },
  ): Promise<void> => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();

    formData.append('file', file, file.name);
    formData.append('uploadSessionId', uploadSessionId);

    if (abortController) {
      abortController.signal.addEventListener('abort', () => {
        xhr.abort();
      });
    }

    xhr.upload.addEventListener('progress', (event) => {
      if (!event.lengthComputable) return;

      const progress = Number(((event.loaded / event.total) * 100).toFixed(1));
      const speedInByte = event.loaded / ((Date.now() - startTime) / 1000);

      onProgress?.('uploading', {
        progress: progress === 100 ? 99.9 : progress,
        restTime: (event.total - event.loaded) / speedInByte,
        speed: speedInByte,
      });
    });

    xhr.open('POST', API_ENDPOINTS.fileUploadSession);

    await new Promise<void>((resolve, reject) => {
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress?.('success', {
            progress: 100,
            restTime: 0,
            speed: file.size / ((Date.now() - startTime) / 1000),
          });
          resolve();
          return;
        }

        reject(getUploadErrorMessage(xhr.responseText, xhr.statusText));
      });

      xhr.addEventListener('error', () => {
        if (xhr.status === 0) reject(UPLOAD_NETWORK_ERROR);
        else reject(getUploadErrorMessage(xhr.responseText, xhr.statusText));
      });

      xhr.addEventListener('abort', () => {
        onProgress?.('cancelled', { progress: 0, restTime: 0, speed: 0 });
        reject(new Error('Upload cancelled by user'));
      });

      xhr.send(formData);
    });
  };

  /**
   * get image File item with cors image URL
   * @param url
   * @param filename
   * @param fileType
   */
  getImageFileByUrlWithCORS = async (url: string, filename: string, fileType = 'image/png') => {
    const res = await fetch(API_ENDPOINTS.proxy, { body: url, method: 'POST' });
    const data = await res.arrayBuffer();

    return new File([data], filename, { lastModified: Date.now(), type: fileType });
  };
}

export const uploadService = new UploadService();
