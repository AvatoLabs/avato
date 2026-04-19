import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';

import { fileApi } from '../lib/api';
import { haptics } from '../lib/haptics';
import { clearResourceListCache } from '../lib/resourceListCache';
import type { FileListItem } from '../types';

interface ResourceUploadActionMessages {
  resourceUploaded: string;
  resourceUploadFailed: string;
}

interface UseResourceUploadActionsProps {
  currentFolderId: string | null;
  currentFolderSlug: string | null;
  effectiveSpaceId?: string;
  loadFiles: (silent?: boolean, append?: boolean) => Promise<void>;
  messages: ResourceUploadActionMessages;
  refreshCachedResources: () => Promise<void>;
  refreshTreeData: () => Promise<void>;
  setFiles: React.Dispatch<React.SetStateAction<FileListItem[]>>;
  showToast: (type: 'error' | 'info' | 'success', message: string) => void;
  sourceSetId: string | null;
}

export function useResourceUploadActions({
  currentFolderId,
  currentFolderSlug,
  effectiveSpaceId,
  loadFiles,
  messages,
  refreshCachedResources,
  refreshTreeData,
  setFiles,
  showToast,
  sourceSetId,
}: UseResourceUploadActionsProps) {
  const [attachmentSheetVisible, setAttachmentSheetVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const closeAttachmentSheet = useCallback(() => setAttachmentSheetVisible(false), []);

  const doUpload = useCallback(
    async (uri: string, name: string, mimeType: string) => {
      setUploading(true);
      setUploadProgress(0);

      try {
        const created = await fileApi.upload(uri, name, mimeType, {
          sourceSetId: sourceSetId ?? undefined,
          onProgress: (progress) => setUploadProgress(progress),
          parentId: currentFolderId ?? currentFolderSlug ?? undefined,
          ...(effectiveSpaceId ? { spaceId: effectiveSpaceId } : {}),
        });

        haptics.success();
        showToast('success', messages.resourceUploaded);
        setFiles((prev) => {
          const optimistic: FileListItem = {
            chunkCount: null,
            chunkingError: null,
            chunkingStatus: null,
            createdAt: new Date().toISOString(),
            editorData: null,
            embeddingError: null,
            embeddingStatus: null,
            fileType: mimeType,
            finishEmbedding: false,
            id: created.id,
            name,
            size: 0,
            sourceType: 'file',
            url: created.url,
          };

          return [optimistic, ...prev];
        });

        await new Promise((resolve) => setTimeout(resolve, 200));
        clearResourceListCache();
        await loadFiles(true);
        await refreshTreeData();
        await refreshCachedResources();
      } catch {
        showToast('error', messages.resourceUploadFailed);
      } finally {
        setUploading(false);
        setUploadProgress(0);
      }
    },
    [
      currentFolderId,
      currentFolderSlug,
      effectiveSpaceId,
      loadFiles,
      messages.resourceUploaded,
      messages.resourceUploadFailed,
      refreshCachedResources,
      refreshTreeData,
      setFiles,
      showToast,
      sourceSetId,
    ],
  );

  const handlePickPhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'] as any,
      allowsMultipleSelection: true,
      quality: 0.85,
    });
    if (result.canceled) return;

    for (const asset of result.assets) {
      const assetName = asset.fileName ?? `photo_${Date.now()}.jpg`;
      const mimeType = asset.mimeType ?? 'image/jpeg';
      await doUpload(asset.uri, assetName, mimeType);
    }
  }, [doUpload]);

  const handlePickFile = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;

    for (const asset of result.assets) {
      await doUpload(asset.uri, asset.name, asset.mimeType ?? 'application/octet-stream');
    }
  }, [doUpload]);

  const handleUpload = useCallback(() => {
    haptics.light();
    setAttachmentSheetVisible(true);
  }, []);

  return {
    attachmentSheetVisible,
    closeAttachmentSheet,
    handlePickFile,
    handlePickPhoto,
    handleUpload,
    uploading,
    uploadProgress,
  };
}
