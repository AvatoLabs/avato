import type { LobeChatDatabase } from '@lobechat/database';
import { contentRegistry, files, messages, messagesFiles } from '@lobechat/database/schemas';
import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';

import { ContentModel } from '@/database/models/content';
import { FileModel } from '@/database/models/file';
import { TopicShareModel } from '@/database/models/topicShare';
import { appEnv } from '@/envs/app';
import { ContentAuthorizer, type ContentCapability } from '@/server/services/content';
import { resolveContentShareAccess } from '@/server/services/content/sharePolicy';
import type { FileService } from '@/server/services/file';
import { isCanonicalSpaceBlobKey } from '@/server/services/file/canonicalSpaceBlobKey';
import { isRawFileContentId } from '@/types/content';

type TrustedFileReference =
  | { password?: string | null; token: string; type: 'contentShare' }
  | { key: string; type: 'canonicalKey' }
  | { fileId: string; type: 'file' }
  | { fileId: string; shareId: string; type: 'topicShare' };

const DOCUMENT_REFERENCE_NOT_FETCHABLE_MESSAGE = 'DOCUMENT_REFERENCE_NOT_FETCHABLE';
const isNonEmptyString = (value: string | undefined | null): value is string => Boolean(value);

const assertRawFileReferenceId = (fileId: string) => {
  if (isRawFileContentId(fileId)) return;

  throw new TRPCError({
    code: 'BAD_REQUEST',
    message: DOCUMENT_REFERENCE_NOT_FETCHABLE_MESSAGE,
  });
};

const resolveTrustedFileReferenceFromPathname = (
  pathname: string,
  password?: string | null,
): TrustedFileReference | null => {
  if (pathname.startsWith('/f/')) {
    const fileId = pathname.slice(3).split(/[?#]/, 1)[0] || null;
    return fileId ? { fileId, type: 'file' } : null;
  }

  const contentShareMatch = pathname.match(/^\/share\/f\/([^/?#]+)$/);
  if (contentShareMatch) {
    const [, token] = contentShareMatch;
    return token ? { password, token, type: 'contentShare' } : null;
  }

  const topicShareMatch = pathname.match(/^\/share\/t\/([^/?#]+)\/f\/([^/?#]+)$/);
  if (topicShareMatch) {
    const [, shareId, fileId] = topicShareMatch;
    return shareId && fileId ? { fileId, shareId, type: 'topicShare' } : null;
  }

  return null;
};

const resolveTrustedFileReferenceFromUrl = (url: string): TrustedFileReference | null => {
  if (isCanonicalSpaceBlobKey(url)) {
    return { key: url.trim(), type: 'canonicalKey' };
  }

  if (url.startsWith('/')) {
    try {
      const parsedUrl = new URL(url, appEnv.APP_URL || 'https://app.local');
      return resolveTrustedFileReferenceFromPathname(
        parsedUrl.pathname,
        parsedUrl.searchParams.get('password'),
      );
    } catch {
      return null;
    }
  }

  try {
    const parsedUrl = new URL(url);
    const trustedOrigins = [appEnv.APP_URL, appEnv.INTERNAL_APP_URL]
      .filter(isNonEmptyString)
      .map((origin) => new URL(origin).origin);

    if (!trustedOrigins.includes(parsedUrl.origin)) return null;
    return resolveTrustedFileReferenceFromPathname(
      parsedUrl.pathname,
      parsedUrl.searchParams.get('password'),
    );
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
  const reference = resolveTrustedFileReferenceFromUrl(params.url);
  if (!reference) return null;

  const contentModel = new ContentModel(params.db, params.userId);
  const fileRef =
    reference.type === 'canonicalKey'
      ? await (async () => {
          const authorizer = new ContentAuthorizer(params.db, params.userId);
          const mappedFile = await FileModel.getFileByUrl(params.db, reference.key);

          if (mappedFile) {
            const access = await authorizer.assertCapability({
              capability: params.capability ?? 'preview_content',
              id: mappedFile.id,
              kind: 'file',
            });

            return {
              access,
              fileId: mappedFile.id,
              matchedBy: access.matchedBy,
              shareLinkId: null,
              spaceId: access.spaceId,
              url: mappedFile.url,
            };
          }

          const blob = await contentModel.findAccessibleSpaceBlobByStorageKey(reference.key);
          if (!blob) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'RESOURCE_ACCESS_DENIED' });
          }

          return {
            access: {
              contentUid: null,
              matchedBy: 'space_member',
              spaceId: blob.spaceId,
            },
            fileId: null,
            matchedBy: 'space_member',
            shareLinkId: null,
            spaceId: blob.spaceId,
            url: blob.storageKey,
          };
        })()
      : reference.type === 'file'
        ? await (async () => {
            assertRawFileReferenceId(reference.fileId);

            const authorizer = new ContentAuthorizer(params.db, params.userId);
            const access = await authorizer.assertCapability({
              capability: params.capability ?? 'preview_content',
              id: reference.fileId,
              kind: 'file',
            });

            const file = await FileModel.getFileById(params.db, reference.fileId);
            if (!file) {
              throw new TRPCError({ code: 'NOT_FOUND', message: 'FILE_NOT_FOUND' });
            }

            return {
              access,
              fileId: reference.fileId,
              matchedBy: access.matchedBy,
              shareLinkId: null,
              spaceId: access.spaceId,
              url: file.url,
            };
          })()
        : reference.type === 'contentShare'
          ? await (async () => {
              const shareAccess = await resolveContentShareAccess({
                contentModel,
                password: reference.password,
                token: reference.token,
              });

              if (shareAccess.status === 'missing_password') {
                throw new TRPCError({
                  code: 'UNAUTHORIZED',
                  message: 'CONTENT_SHARE_PASSWORD_REQUIRED',
                });
              }

              if (shareAccess.status === 'not_found') {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'FILE_NOT_FOUND' });
              }

              if (shareAccess.status !== 'ok') {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'FILE_NOT_FOUND' });
              }

              const registry = await contentModel.findContentRegistryByUid(
                shareAccess.link.contentUid,
              );
              if (!registry) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'FILE_NOT_FOUND' });
              }

              if (registry.kind !== 'file' || !isRawFileContentId(registry.localId)) {
                throw new TRPCError({
                  code: 'BAD_REQUEST',
                  message: DOCUMENT_REFERENCE_NOT_FETCHABLE_MESSAGE,
                });
              }

              const file = await FileModel.getFileById(params.db, registry.localId);
              if (!file) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'FILE_NOT_FOUND' });
              }

              return {
                access: {
                  contentUid: shareAccess.link.contentUid,
                  matchedBy: 'share_link',
                  spaceId: shareAccess.link.spaceId,
                },
                fileId: registry.localId,
                matchedBy: 'share_link',
                shareLinkId: shareAccess.link.id,
                spaceId: shareAccess.link.spaceId,
                url: file.url,
              };
            })()
          : await (async () => {
              assertRawFileReferenceId(reference.fileId);

              const share = await TopicShareModel.findByShareIdWithAccessCheck(
                params.db,
                reference.shareId,
                params.userId,
              );

              const [result] = await params.db
                .select({
                  contentUid: contentRegistry.contentUid,
                  fileId: files.id,
                  spaceId: contentRegistry.spaceId,
                  url: files.url,
                })
                .from(messagesFiles)
                .innerJoin(messages, eq(messagesFiles.messageId, messages.id))
                .innerJoin(files, eq(messagesFiles.fileId, files.id))
                .innerJoin(
                  contentRegistry,
                  and(eq(contentRegistry.kind, 'file'), eq(contentRegistry.localId, files.id)),
                )
                .where(and(eq(messages.topicId, share.topicId), eq(files.id, reference.fileId)))
                .limit(1);

              if (!result) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'FILE_NOT_FOUND' });
              }

              return {
                access: {
                  contentUid: result.contentUid,
                  matchedBy: 'share_link',
                  spaceId: result.spaceId,
                },
                fileId: result.fileId,
                matchedBy: 'share_link',
                shareLinkId: null,
                spaceId: result.spaceId,
                url: result.url,
              };
            })();

  const readableUrl = await params.fileService.getFullFileUrl(fileRef.url);
  if (!readableUrl) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'FILE_URL_UNAVAILABLE' });
  }

  try {
    await contentModel.createAccessEvent({
      accessType: 'file_url_issued',
      contentUid: fileRef.access.contentUid,
      metadata: {
        fileId: fileRef.fileId,
        matchedBy: fileRef.matchedBy,
        via: params.via,
      },
      shareLinkId: fileRef.shareLinkId ?? null,
      sourceIp: params.sourceIp ?? null,
      spaceId: fileRef.spaceId,
      userAgent: params.userAgent ?? null,
    });
  } catch (error) {
    console.error('Failed to record provider-readable file URL issuance', error);
  }

  return {
    fileId: fileRef.fileId,
    key: fileRef.url,
    url: readableUrl,
  };
};
