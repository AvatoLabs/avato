import type { ResourceNavigationTarget } from '../navigation/types';
import type { FileListItem } from '../types';
import { getCanonicalResourceKind } from './resourceList';

interface SharedResourceCandidate {
  fileType?: string;
  kind: 'document' | 'file';
  localId: string;
  name: string;
}

export function fileListItemFromShared(params: SharedResourceCandidate): FileListItem {
  const canonicalKind = getCanonicalResourceKind({ id: params.localId, kind: params.kind });
  const isFile = canonicalKind === 'file';
  const createdAt = new Date().toISOString();

  return {
    id: params.localId,
    name: params.name,
    fileType: isFile ? 'application/octet-stream' : params.fileType || 'text/plain',
    sourceType: isFile ? 'file' : 'document',
    size: 0,
    createdAt,
    chunkCount: null,
    chunkingError: null,
    embeddingError: null,
    embeddingStatus: null,
    finishEmbedding: false,
    url: '',
  };
}

export function fileListItemFromNavigationTarget(target: ResourceNavigationTarget): FileListItem {
  return {
    chunkCount: null,
    chunkingError: null,
    content: target.content ?? null,
    createdAt: new Date().toISOString(),
    embeddingError: null,
    embeddingStatus: null,
    fileType:
      target.fileType ??
      (target.sourceType === 'document' ? 'text/plain' : 'application/octet-stream'),
    finishEmbedding: false,
    id: target.id,
    name: target.name,
    size: 0,
    sourceType: target.sourceType ?? 'file',
    url: target.url ?? '',
  };
}
