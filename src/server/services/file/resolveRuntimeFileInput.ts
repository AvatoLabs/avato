import type { LobeChatDatabase } from '@lobechat/database';
import { TRPCError } from '@trpc/server';

import type { FileService } from '@/server/services/file';
import { isCanonicalSpaceBlobKey } from '@/server/services/file/canonicalSpaceBlobKey';
import { resolveProviderReadableFileReference } from '@/server/services/file/resolveProviderReadableFileReference';

export const resolveRuntimeFileInput = async (params: {
  db: LobeChatDatabase;
  fileService: FileService;
  sourceIp?: string | null;
  url: string;
  userAgent?: string | null;
  userId: string;
  via: string;
}) => {
  const providerReadable = await resolveProviderReadableFileReference({
    db: params.db,
    fileService: params.fileService,
    sourceIp: params.sourceIp ?? null,
    url: params.url,
    userAgent: params.userAgent ?? null,
    userId: params.userId,
    via: params.via,
  });

  if (providerReadable) {
    return providerReadable;
  }

  const key = isCanonicalSpaceBlobKey(params.url)
    ? params.url.trim()
    : await params.fileService.getKeyFromFullUrl(params.url);
  if (!key) return null;

  const readableUrl = await params.fileService.getFullFileUrl(key);
  if (!readableUrl) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'RESOURCE_ACCESS_DENIED' });
  }

  return {
    key,
    url: readableUrl,
  };
};
