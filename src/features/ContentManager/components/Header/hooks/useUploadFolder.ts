import { type ChangeEvent } from 'react';
import { useCallback } from 'react';

import { type FileManageAction } from '@/store/file/slices/fileManager/action';

import {
  filterFilesByBuiltInBlockList,
  filterFilesByGitignore,
  findGitignoreFile,
  readGitignoreContent,
} from '../../../../../utils/gitignore';

interface UseUploadFolderOptions {
  currentFolderId?: string | null;
  sourceSetId?: string | null;
  spaceId?: string;
  t: (key: any, options?: any) => string;
  uploadFolderWithStructure: FileManageAction['uploadFolderWithStructure'];
}

const useUploadFolder = ({
  currentFolderId,
  sourceSetId,
  spaceId,
  t,
  uploadFolderWithStructure,
}: UseUploadFolderOptions) => {
  const handleFolderUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      let files = Array.from(event.target.files || []);
      if (files.length === 0) return;

      const translateText = (key: string, options?: Record<string, unknown>) => t(key, options);
      const targetFolderId = currentFolderId ?? undefined;
      const targetSourceSetId = sourceSetId ?? undefined;
      const upload = async (fileList: File[]) =>
        uploadFolderWithStructure(fileList, targetSourceSetId, targetFolderId, spaceId);
      const startUpload = (fileList: File[]) => {
        void upload(fileList).catch((error) => {
          console.error('Failed to upload folder:', error);
        });
      };

      // Apply built-in block list first
      const originalCount = files.length;
      files = filterFilesByBuiltInBlockList(files);
      const builtInBlockedCount = originalCount - files.length;

      if (builtInBlockedCount > 0) {
        const { message } = await import('antd');
        message.info(
          translateText('header.actions.builtInBlockList.filtered', {
            ignored: builtInBlockedCount,
            total: originalCount,
          }),
        );
      }

      const gitignoreFile = findGitignoreFile(files);

      if (gitignoreFile) {
        try {
          const gitignoreContent = await readGitignoreContent(gitignoreFile);
          const gitignoreOriginalCount = files.length;

          const { Modal } = await import('antd');

          Modal.confirm({
            cancelText: translateText('header.actions.gitignore.cancel'),
            content: translateText('header.actions.gitignore.content', {
              count: gitignoreOriginalCount,
            }),
            okText: translateText('header.actions.gitignore.apply'),
            onCancel: () => {
              startUpload(files);
            },
            onOk: async () => {
              const filteredFiles = filterFilesByGitignore(files, gitignoreContent);
              const ignoredCount = gitignoreOriginalCount - filteredFiles.length;

              if (ignoredCount > 0) {
                const { message } = await import('antd');
                message.info(
                  translateText('header.actions.gitignore.filtered', {
                    ignored: ignoredCount,
                    total: gitignoreOriginalCount,
                  }),
                );
              }

              startUpload(filteredFiles);
            },
            title: translateText('header.actions.gitignore.title'),
          });
        } catch (error) {
          console.error('Failed to read .gitignore:', error);
          await upload(files);
        }
      } else {
        await upload(files);
      }

      event.target.value = '';
    },
    [currentFolderId, sourceSetId, spaceId, t, uploadFolderWithStructure],
  );

  return { handleFolderUpload };
};

export default useUploadFolder;
