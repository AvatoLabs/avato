import { type ContentItem, type ContentQueryParams } from '@/types/content';
import { type FileListItem, FilesTabs } from '@/types/files';
import { type FileUploadStatus, type UploadFileItem } from '@/types/files/upload';

export interface ExplorerItem extends FileListItem {
  uploadStatus?: FileUploadStatus;
}

export const getInlineUploadStatusKey = (status?: FileUploadStatus) => {
  switch (status) {
    case 'pending': {
      return 'uploadDock.body.item.pending';
    }
    case 'uploading': {
      return 'uploadDock.uploadStatus.processing';
    }
    case 'processing': {
      return 'uploadDock.body.item.processing';
    }
    case 'success': {
      return 'uploadDock.body.item.done';
    }
    case 'error': {
      return 'uploadDock.body.item.error';
    }
    case 'cancelled': {
      return 'uploadDock.body.item.cancelled';
    }
    default: {
      return undefined;
    }
  }
};

const toExplorerItem = (item: ContentItem): ExplorerItem => ({
  ...item,
  chunkCount: item.chunkCount ?? null,
  chunkingError: item.chunkingError ?? null,
  chunkingStatus: (item.chunkingStatus ?? null) as any,
  embeddingError: item.embeddingError ?? null,
  embeddingStatus: (item.embeddingStatus ?? null) as any,
  finishEmbedding: item.finishEmbedding ?? false,
  url: item.url ?? '',
});

const matchesContentCategory = (fileType: string, category?: FilesTabs) => {
  switch (category) {
    case FilesTabs.Audios: {
      return fileType.startsWith('audio');
    }
    case FilesTabs.Documents: {
      return (
        fileType.startsWith('application') ||
        fileType.startsWith('custom') ||
        fileType.startsWith('text')
      );
    }
    case FilesTabs.Images: {
      return fileType.startsWith('image');
    }
    case FilesTabs.Videos: {
      return fileType.startsWith('video');
    }
    case FilesTabs.Websites: {
      return fileType === 'text/html';
    }
    default: {
      return true;
    }
  }
};

const isPendingUploadVisible = (
  uploadItem: UploadFileItem,
  params: ContentQueryParams | null,
  existingIds: Set<string>,
) => {
  if (!params) return false;

  const persistedId = uploadItem.fileId;
  if (persistedId && existingIds.has(persistedId)) return false;

  const shouldShowByStatus =
    uploadItem.status === 'pending' ||
    uploadItem.status === 'uploading' ||
    uploadItem.status === 'processing' ||
    (uploadItem.status === 'success' && !!persistedId);

  if (!shouldShowByStatus) return false;

  if ((params.sourceSetId ?? undefined) !== (uploadItem.sourceSetId ?? undefined)) return false;
  if ((params.spaceId ?? undefined) !== (uploadItem.spaceId ?? undefined)) return false;

  if (typeof params.parentId !== 'undefined' && (uploadItem.parentId ?? null) !== params.parentId) {
    return false;
  }

  if (params.q && !uploadItem.file.name.toLowerCase().includes(params.q.toLowerCase())) {
    return false;
  }

  return matchesContentCategory(uploadItem.file.type || 'application/octet-stream', params.category);
};

export const mapContentItemsToExplorerItems = (items: ContentItem[]): ExplorerItem[] =>
  items.map(toExplorerItem);

export const buildPendingUploadExplorerItems = (
  uploadItems: UploadFileItem[],
  params: ContentQueryParams | null,
  existingItems: ContentItem[],
): ExplorerItem[] => {
  const existingIds = new Set(
    existingItems.flatMap((item) => [item.id, item.fileId].filter(Boolean) as string[]),
  );

  return uploadItems
    .filter((item) => isPendingUploadVisible(item, params, existingIds))
    .map((item) => {
      const createdAt = item.createdAt ?? new Date();
      const resolvedId = item.fileId ?? `upload:${item.id}`;

      return {
        chunkCount: null,
        chunkingError: null,
        chunkingStatus: null,
        createdAt,
        embeddingError: null,
        embeddingStatus: null,
        fileId: item.fileId ?? null,
        fileType: item.file.type || 'application/octet-stream',
        finishEmbedding: false,
        id: resolvedId,
        name: item.file.name,
        parentId: item.parentId ?? null,
        size: item.file.size,
        sourceType: 'file',
        spaceId: item.spaceId ?? null,
        updatedAt: createdAt,
        uploadStatus: item.status,
        url: item.fileUrl ?? '',
      };
    });
};
