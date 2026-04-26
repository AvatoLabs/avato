import { getCanonicalSharedContentKind } from '@/types/content';
import { getPageDetailPath, getPageKind } from '@/utils/docs';

import { buildFilesPreviewPath, buildSourceSetPath } from './paths';

interface SharedResourcePathTarget {
  kind: 'document' | 'file' | 'source_set';
  localId: string;
  metadata?: Record<string, unknown> | null;
  spaceId: string;
}

export const getCanonicalSharedResourceKind = (item: SharedResourcePathTarget) => {
  return getCanonicalSharedContentKind(item);
};

export const resolveSharedResourcePath = (item: SharedResourcePathTarget) => {
  const kind = getCanonicalSharedResourceKind(item);

  if (kind === 'source_set') {
    return buildSourceSetPath(item.spaceId, item.localId);
  }

  if (kind === 'document') {
    return getPageDetailPath(item.localId, getPageKind(item.metadata?.pageKind), item.spaceId);
  }

  return buildFilesPreviewPath(item.spaceId, item.localId);
};
