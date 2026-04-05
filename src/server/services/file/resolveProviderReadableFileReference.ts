import type { LobeChatDatabase } from '@lobechat/database';
import { TRPCError } from '@trpc/server';

import { ContentModel } from '@/database/models/content';
import { FileModel } from '@/database/models/file';
import { appEnv } from '@/envs/app';
import { ContentAuthorizer, type ContentCapability } from '@/server/services/content';
import type { FileService } from '@/server/services/file';

const resolveTrustedFileIdFromUrl = (url: string) => {
  if (url.startsWith('/f/')) {
    return url.slice(3).split(/[?#]/, 1)[0] || null;
  }

  try {
    const parsedUrl = new URL(url);
    const trustedOrigins = [appEnv.APP_URL, appEnv.INTERNAL_APP_URL]
      .filter(Boolean)
      .map((origin) => new URL(origin).origin);

    if (!trustedOrigins.includes(parsedUrl.origin)) return null;
    if (!parsedUrl.pathname.startsWith('/f/')) return null;

    return parsedUrl.pathname.slice(3).split(/[?#]/, 1)[0] || null;
  } catch {
    return null;
  }
};

export const resolveProviderReadableFileReference = async (params: {
  capability?: ContentCapability;
  db: LobeChatDatabase;
  fileService: FileService;
  sourceIp?: string | null;
  url: string;
  userAgent?: string | null;
  userId: string;
  via: string;
}) => {
  const fileId = resolveTrustedFileIdFromUrl(params.url);
  if (!fileId) return null;

  const authorizer = new ContentAuthorizer(params.db, params.userId);
  const contentModel = new ContentModel(params.db, params.userId);

  const access = await authorizer.assertCapability({
    capability: params.capability ?? 'preview_content',
    id: fileId,
    kind: 'file',
  });

  const file = await FileModel.getFileById(params.db, fileId);
  if (!file) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'FILE_NOT_FOUND' });
  }

  const readableUrl = await params.fileService.getFullFileUrl(file.url);
  if (!readableUrl) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'FILE_URL_UNAVAILABLE' });
  }

  try {
    await contentModel.createAccessEvent({
      accessType: 'file_url_issued',
      contentUid: access.contentUid,
      metadata: {
        fileId,
        matchedBy: access.matchedBy,
        via: params.via,
      },
      sourceIp: params.sourceIp ?? null,
      spaceId: access.spaceId,
      userAgent: params.userAgent ?? null,
    });
  } catch (error) {
    console.error('Failed to record provider-readable file URL issuance', error);
  }

  return {
    fileId,
    key: file.url,
    url: readableUrl,
  };
};
