import type { FileModel } from '@/database/models/file';

export const resolveRemovableStorageUrls = async (
  fileModel: Pick<FileModel, 'checkHash'>,
  files: Array<{ fileHash?: string | null; url?: string | null }>,
  removeGlobalFile: boolean,
) => {
  const removableUrls = new Set<string>();
  const hashExistence = new Map<string, boolean>();

  for (const file of files) {
    if (!file.url) continue;

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
