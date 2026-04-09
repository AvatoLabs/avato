import { type FileModel } from '@/database/models/file';

import { getSkillZipProxyUrl } from './getSkillZipProxyUrl';
import { createSkillZipProxyToken } from './skillZipProxyToken';

interface ResolveAccessibleSkillZipProxyUrlParams {
  fileModel: Pick<FileModel, 'canAccessGlobalFileBySha256'>;
  internal?: boolean;
  skillId: string;
  zipSha256?: string | null;
}

/**
 * Returns a stable skill ZIP proxy URL when the caller can read the backing blob digest.
 *
 * This intentionally does not preflight object existence. Existence checks belong to
 * the stable `/skills/:id/zip` proxy at request time so server-side callers do not
 * reopen storage side channels before issuing the proxy URL.
 */
export const resolveAccessibleSkillZipProxyUrl = async ({
  fileModel,
  internal,
  skillId,
  zipSha256,
}: ResolveAccessibleSkillZipProxyUrlParams) => {
  if (!zipSha256) return;

  const canAccess = await fileModel.canAccessGlobalFileBySha256(zipSha256);
  if (!canAccess) return;

  const url = new URL(getSkillZipProxyUrl(skillId, { internal }));

  if (internal) {
    const token = createSkillZipProxyToken(skillId);
    if (token) {
      url.searchParams.set('token', token);
    }
  }

  return url.toString();
};
