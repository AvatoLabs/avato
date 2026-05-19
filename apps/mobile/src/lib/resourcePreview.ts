import * as FileSystem from 'expo-file-system/legacy';

import type { FileListItem } from '../types';
import { fileApi, resourceApi } from './api';
import { clearResourceCacheEntry, getResourceCacheEntry, type ResourceCacheEntry, saveResourceCacheEntry } from './resourceCache';
import { isImage } from './resourceFile';
import {
  buildRemoteFetchInit,
  buildRemoteFileCandidates,
  buildRemoteSource,
  resolveRemoteFileUrl,
} from './resourcePreviewUrl';

export {
  buildRemoteFetchInit,
  buildRemoteFileCandidates,
  buildRemoteSource,
  resolveRemoteFileUrl,
};

export function canWarmPreviewCache(item: FileListItem) {
  return item.sourceType === 'file' && isImage(item.fileType, item.name);
}

const previewCacheRequestMap = new Map<string, Promise<ResourceCacheEntry | null>>();

export async function ensurePreviewCacheEntry(
  item: Pick<FileListItem, 'id' | 'name' | 'updatedAt' | 'url'>,
  options?: {
    onProgress?: (progress: number) => void;
  },
) {
  const existing = await getResourceCacheEntry(item.id);
  const itemUpdatedAt = item.updatedAt ?? undefined;
  const isFresh =
    existing && (!itemUpdatedAt || !existing.updatedAt || existing.updatedAt === itemUpdatedAt);

  if (isFresh) {
    return existing;
  }

  if (existing && !isFresh) {
    await removeLocalCachedFile(existing);
    await clearResourceCacheEntry(item.id);
  }

  const inFlight = previewCacheRequestMap.get(item.id);
  if (inFlight) return inFlight;

  const request = (async () => {
    try {
      const { localUri } = await fileApi.download(item, options);
      const nextEntry: ResourceCacheEntry = {
        cachedAt: Date.now(),
        fileId: item.id,
        localUri,
        name: item.name,
        updatedAt: itemUpdatedAt,
      };
      await saveResourceCacheEntry(nextEntry);
      return nextEntry;
    } catch {
      return null;
    } finally {
      previewCacheRequestMap.delete(item.id);
    }
  })();

  previewCacheRequestMap.set(item.id, request);
  return request;
}

export async function removeLocalCachedFile(entry?: ResourceCacheEntry | null) {
  if (!entry?.localUri) return;

  try {
    const info = await FileSystem.getInfoAsync(entry.localUri);
    if (info.exists) {
      await FileSystem.deleteAsync(entry.localUri, { idempotent: true });
    }
  } catch {
    /* ignore */
  }
}

export async function ensureNotebookDocumentFromFile(item: FileListItem): Promise<{
  documentId: string;
  nextItem: FileListItem;
} | null> {
  const ensured = await resourceApi.ensureFileDocument(item.id);
  const documentId = ensured?.id;

  if (!documentId) return null;

  const document = await resourceApi.getDocument(documentId).catch(() => null);

  return {
    documentId,
    nextItem: {
      ...item,
      ...(typeof document?.content === 'string' ? { content: document.content } : {}),
      fileType: document?.fileType ?? item.fileType,
      id: documentId,
      name: document?.title || item.name,
      sourceType: 'document',
    },
  };
}
