import type { FileModel } from '@/database/models/file';

export const resolveRemovableStorageUrls = async (
  fileModel: Pick<FileModel, 'checkHash' | 'hasFilesForBlob'>,
  files: Array<{ blobId?: string | null; fileHash?: string | null; url?: string | null }>,
  removeGlobalFile: boolean,
) => {
  const removableUrls = new Set<string>();
  const hashExistence = new Map<string, boolean>();
  const blobUsage = new Map<string, boolean>();

  for (const file of files) {
    if (!file.url) continue;

    if (file.blobId) {
      if (!blobUsage.has(file.blobId)) {
        const inUse = await fileModel.hasFilesForBlob(file.blobId);
        blobUsage.set(file.blobId, inUse);
      }

      if (!blobUsage.get(file.blobId)) {
        removableUrls.add(file.url);
      }

      continue;
    }

    if (!file.fileHash) {
      removableUrls.add(file.url);
      continue;
    }

    if (!removeGlobalFile) continue;

    if (!hashExistence.has(file.fileHash)) {
      const result = await fileModel.checkHash(file.fileHash);
      hashExistence.set(file.fileHash, result.isExist);
    }

    if (!hashExistence.get(file.fileHash)) {
      removableUrls.add(file.url);
    }
  }

  return [...removableUrls];
};
