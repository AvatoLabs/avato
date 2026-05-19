import type { FileAttachment, FileListItem } from '../types';

export type PendingAttachmentDraft = Omit<FileAttachment, 'progress' | 'status'>;

interface CreatePendingAttachmentIdOptions {
  now?: number;
  random?: string;
}

export function createPendingAttachmentId({
  now = Date.now(),
  random = Math.random().toString(36).slice(2, 8),
}: CreatePendingAttachmentIdOptions = {}) {
  return `${now}-${random}`;
}

interface CreatePickedAttachmentParams {
  fallbackName: string;
  fallbackType: string;
  id: string;
  name?: string | null;
  size?: number | null;
  type?: string | null;
  uri: string;
}

export function createPickedAttachment({
  fallbackName,
  fallbackType,
  id,
  name,
  size,
  type,
  uri,
}: CreatePickedAttachmentParams): PendingAttachmentDraft {
  return {
    id,
    name: name || fallbackName,
    size: size || 0,
    type: type || fallbackType,
    uri,
  };
}

export function createWorkspacePendingAttachment(
  item: Pick<FileListItem, 'fileType' | 'id' | 'name' | 'size' | 'url'>,
  apiBaseUrl: string,
  id: string,
): PendingAttachmentDraft {
  const normalizedBase = apiBaseUrl.replace(/\/$/, '');
  const remoteUrl = item.url?.startsWith('http')
    ? item.url
    : normalizedBase
      ? `${normalizedBase}/f/${item.id}`
      : item.url;

  return {
    fileId: item.id,
    id,
    name: item.name,
    size: item.size,
    type: item.fileType,
    uri: remoteUrl || `file://${item.id}`,
    url: remoteUrl,
  };
}
