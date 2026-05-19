import { Share } from 'react-native';

import { contentShareApi, type ContentShareKind } from './api';
import { getCanonicalSharedResourceKind } from './resourceShare';

export type ShareLinkAttempt = 'ok' | 'fail';

export async function shareResourceWithLink(params: {
  expiresInDays: 1 | 7 | 30;
  id: string;
  kind: ContentShareKind;
  name: string;
  password?: string;
}): Promise<ShareLinkAttempt> {
  const pwd = params.password?.trim();
  const canonicalKind =
    params.kind === 'source_set'
      ? params.kind
      : getCanonicalSharedResourceKind({ kind: params.kind, localId: params.id });
  try {
    const link = await contentShareApi.createContentShareLink({
      expiresInDays: params.expiresInDays,
      id: params.id,
      kind: params.kind,
      ...(pwd ? { password: pwd } : {}),
    });
    const lines = [link.shareUrl];
    if (canonicalKind === 'file' && link.fileShareDownloadUrl) {
      lines.push(link.fileShareDownloadUrl);
    }
    const message = lines.join('\n');
    await Share.share({ message, title: params.name, url: link.shareUrl });
    return 'ok';
  } catch {
    // Do not fall back to file:// or authenticated /f/{id} URLs — recipients cannot use them reliably.
    return 'fail';
  }
}
