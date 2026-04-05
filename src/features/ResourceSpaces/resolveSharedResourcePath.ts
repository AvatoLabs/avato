import { getPageDetailPath, getPageKind } from '@/utils/docs';

import { buildFilesPreviewPath, buildSourceSetPath } from './paths';

interface SharedResourcePathTarget {
  kind: 'document' | 'file' | 'source_set';
  localId: string;
  metadata?: Record<string, unknown> | null;
  spaceId: string;
}

export const resolveSharedResourcePath = (item: SharedResourcePathTarget) => {
  if (item.kind === 'source_set') {
    return buildSourceSetPath(item.spaceId, item.localId);
  }

  if (item.kind === 'document') {
    return getPageDetailPath(item.localId, getPageKind(item.metadata?.pageKind), item.spaceId);
  }

  return buildFilesPreviewPath(item.spaceId, item.localId);
};
