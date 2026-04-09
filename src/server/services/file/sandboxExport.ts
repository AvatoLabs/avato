import { nanoid } from '@lobechat/utils';

import { SpaceModel } from '@/database/models/space';
import type { LobeChatDatabase } from '@/database/type';

import { resolveSpaceIdForSandboxExport } from './resolveSpaceIdForSandboxExport';

const SPACE_BLOB_STORAGE_PREFIX = 'v2/spaces';
const SANDBOX_EXPORT_SCOPE = 'sandbox-exports';

export const generateSandboxExportStorageKey = (spaceId: string) =>
  `${SPACE_BLOB_STORAGE_PREFIX}/${spaceId}/blobs/${SANDBOX_EXPORT_SCOPE}/${nanoid()}`;

export const resolveTargetSpaceIdForSandboxExport = async (params: {
  db: LobeChatDatabase;
  spaceId?: string;
  topicId: string;
  userId: string;
}) => {
  if (params.spaceId) {
    const explicitSpace = await new SpaceModel(params.db, params.userId).findAccessibleSpaceById(
      params.spaceId,
    );
    if (explicitSpace?.id) return explicitSpace.id;
  }

  const derivedSpaceId = await resolveSpaceIdForSandboxExport(
    params.db,
    params.userId,
    params.topicId,
  );
  if (derivedSpaceId) return derivedSpaceId;

  return (await new SpaceModel(params.db, params.userId).getOrCreatePersonalSpace()).id;
};
