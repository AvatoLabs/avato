import { LOBE_CHAT_CLOUD } from '@lobechat/business-const';
import { t } from 'i18next';
import { sha256 } from 'js-sha256';

import { message } from '@/components/AntdStaticMethods';
import { uploadErrorNotification } from '@/components/Error/uploadErrorNotification';
import { fileService } from '@/services/file';
import { uploadService } from '@/services/upload';
import { type StoreSetter } from '@/store/types';
import { type FileMetadata, type UploadFileItem } from '@/types/files';
import { getImageDimensions } from '@/utils/client/imageDimensions';

import { type FileStore } from '../../store';

type OnStatusUpdate = (
  data:
    | {
        id: string;
        type: 'updateFile';
        value: Partial<UploadFileItem>;
      }
    | {
        id: string;
        type: 'removeFile';
      },
) => void;

interface UploadWithProgressParams {
  abortController?: AbortController;
  file: File;
  onStatusUpdate?: OnStatusUpdate;
  parentId?: string;
  /**
   * Optional flag to indicate whether to skip the file type check.
   * When set to `true`, any file type checks will be bypassed.
   * Default is `false`, which means file type checks will be performed.
   */
  skipCheckFileType?: boolean;
  /**
   * Optional source identifier for the file (e.g., 'page-editor', 'image_generation')
   */
  source?: string;
  sourceSetId?: string;
  spaceId?: string;
  uploadId?: string;
}

interface UploadWithProgressResult {
  dimensions?: {
    height: number;
    width: number;
  };
  filename?: string;
  id: string;
  url: string;
}

type Setter = StoreSetter<FileStore>;
export const createFileUploadSlice = (set: Setter, get: () => FileStore, _api?: unknown) =>
  new FileUploadActionImpl(set, get, _api);

export class FileUploadActionImpl {
  constructor(set: Setter, get: () => FileStore, _api?: unknown) {
    void _api;
    void set;
    void get;
  }

  uploadBase64FileWithProgress = async (
    base64: string,
  ): Promise<UploadWithProgressResult | undefined> => {
    // Extract image dimensions from base64 data
    const dimensions = await getImageDimensions(base64);

    const { metadata, fileType, size, sha256 } = await uploadService.uploadBase64ToS3(base64);

    const res = await fileService.createFile({
      fileType,
      sha256,
      metadata,
      name: metadata.filename,
      size,
      storageKey: metadata.path,
    });
    return { ...res, dimensions, filename: metadata.filename };
  };

  uploadWithProgress = async ({
    file,
    onStatusUpdate,
    sourceSetId,
    skipCheckFileType,
    parentId,
    spaceId,
    source,
    abortController,
    uploadId,
  }: UploadWithProgressParams): Promise<UploadWithProgressResult | undefined> => {
    const statusUpdateId = uploadId ?? file.name;

    try {
      const fileArrayBuffer = await file.arrayBuffer();

      // 1. extract image dimensions if applicable
      const dimensions = await getImageDimensions(file);

      // 2. check whether the same space-scoped blob already exists
      const sha256Hex = sha256(fileArrayBuffer);

      const checkStatus = await fileService.checkSpaceBlob(sha256Hex, spaceId);
      let metadata: FileMetadata;

      // 3. if file exist, just skip upload
      if (checkStatus.isExist) {
        metadata = checkStatus.metadata as FileMetadata;
        onStatusUpdate?.({
          id: statusUpdateId,
          type: 'updateFile',
          value: { status: 'processing', uploadState: { progress: 100, restTime: 0, speed: 0 } },
        });
      }
      // 3. if file don't exist, need upload files
      else {
        const { data, success } = await uploadService.uploadFileToS3(file, {
          abortController,
          sourceSetId,
          onNotSupported: () => {
            onStatusUpdate?.({ id: statusUpdateId, type: 'removeFile' });
            message.info({
              content: t('upload.fileOnlySupportInServerMode', {
                cloud: LOBE_CHAT_CLOUD,
                ext: file.name.split('.').pop(),
                ns: 'error',
              }),
              duration: 5,
            });
          },
          onProgress: (status, upload) => {
            onStatusUpdate?.({
              id: statusUpdateId,
              type: 'updateFile',
              value: { status: status === 'success' ? 'processing' : status, uploadState: upload },
            });
          },
          parentId,
          sha256: sha256Hex,
          skipCheckFileType,
          spaceId,
        });
        if (!success) return;

        metadata = data;
      }

      // 4. use more powerful file type detector to get file type
      let fileType = file.type;

      if (!file.type) {
        const { fileTypeFromBuffer } = await import('file-type');

        const type = await fileTypeFromBuffer(fileArrayBuffer);
        fileType = type?.mime || 'text/plain';
      }

      // 5. create file to db
      const storageKey = metadata.path ?? checkStatus.storageKey;
      if (!storageKey) {
        throw new Error('Missing storage key for uploaded file');
      }

      const data = await fileService.createFile(
        {
          fileType,
          sha256: sha256Hex,
          metadata,
          name: file.name,
          parentId,
          spaceId,
          size: file.size,
          source,
          storageKey,
        },
        sourceSetId,
      );

      onStatusUpdate?.({
        id: statusUpdateId,
        type: 'updateFile',
        value: {
          fileId: data.id,
          fileUrl: data.url,
          status: 'success',
          uploadState: { progress: 100, restTime: 0, speed: 0 },
        },
      });

      return { ...data, dimensions, filename: file.name };
    } catch (error) {
      // Handle file storage plan limit error
      if ((error as any)?.message?.includes('beyond the plan limit')) {
        onStatusUpdate?.({ id: statusUpdateId, type: 'removeFile' });
        uploadErrorNotification.error(error, {
          description: t('upload.storageLimitExceeded', { ns: 'error' }),
          message: t('upload.title', { ns: 'error' }),
        });
        return;
      }

      onStatusUpdate?.({
        id: statusUpdateId,
        type: 'updateFile',
        value: { status: abortController?.signal.aborted ? 'cancelled' : 'error' },
      });

      throw error;
    }
  };
}

export type FileUploadAction = Pick<FileUploadActionImpl, keyof FileUploadActionImpl>;
