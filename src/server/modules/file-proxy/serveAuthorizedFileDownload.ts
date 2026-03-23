import { type LobeChatDatabase } from '@lobechat/database';
import { type FileItem } from '@lobechat/database/schemas';
import debug from 'debug';

import { ResourceModel } from '@/database/models/resource';
import { getRedisConfig } from '@/envs/redis';
import { initializeRedis, isRedisEnabled } from '@/libs/redis';
import { FileService } from '@/server/services/file';
import { ResourceAuthorizer } from '@/server/services/resource';

const log = debug('lobe-file:proxy');

const FILE_PROXY_KEY_PREFIX = 'file-proxy:';
const PRESIGNED_URL_CACHE_TTL = 240;

const buildCacheKey = (id: string, identity: string, authzEpoch: number) =>
  `${FILE_PROXY_KEY_PREFIX}${id}:${identity}:${authzEpoch}`;

interface CachedFileData {
  redirectUrl: string;
}

const shouldProxyFileResponse = (redirectUrl: string) => {
  try {
    return new URL(redirectUrl).protocol === 'http:' && _reqAppProtocol() === 'https:';
  } catch {
    return false;
  }
};

const _reqAppProtocol = () => {
  try {
    return new URL(process.env.APP_URL || '').protocol;
  } catch {
    return 'http:';
  }
};

export const clientIpFromRequest = (req: Request): string | undefined => {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const ip = forwardedFor.split(',')[0]?.trim();
    if (ip) return ip;
  }
  const realIp = req.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  return undefined;
};

export type FileDownloadVia = 'session' | 'share_query' | 'share_path';

export interface ServeAuthorizedFileDownloadParams {
  db: LobeChatDatabase;
  downloadVia: FileDownloadVia;
  file: FileItem;
  fileId: string;
  req: Request;
  shareLinkId: string | null;
  shareToken: string | null;
  userId: string | undefined;
}

/**
 * Shared implementation for GET /f/:id and GET /share/f/:token after file row is resolved.
 */
export async function serveAuthorizedFileDownload(
  params: ServeAuthorizedFileDownloadParams,
): Promise<Response> {
  const { db, downloadVia, file, fileId, req, shareLinkId, shareToken, userId } = params;

  const principalId = userId || 'anonymous';
  const cacheIdentity = shareToken ? `share:${shareToken}` : `user:${principalId}`;
  const authorizer = new ResourceAuthorizer(db, principalId);
  const access = await authorizer.getAccessMatch({
    capability: 'download_blob',
    id: fileId,
    kind: 'file',
    shareToken,
  });

  if (!access?.canAccess) {
    log('Access denied for file: %s user: %s', fileId, principalId);
    // Phase 5: share links use a single failure shape (no 403 vs 404 oracle)
    if (shareToken) {
      return new Response('Not found', { status: 404 });
    }
    return new Response('Forbidden', { status: 403 });
  }

  try {
    const accessEventModel = new ResourceModel(db, principalId);
    await accessEventModel.createAccessEvent({
      accessType: 'file_download',
      metadata: {
        downloadVia,
        fileId,
        matchedBy: access.matchedBy,
        via: shareToken ? 'share_link' : 'session',
      },
      resourceUid: access.resourceUid,
      shareLinkId,
      spaceId: access.spaceId,
      sourceIp: clientIpFromRequest(req) ?? null,
      userAgent: req.headers.get('user-agent') ?? null,
    });
  } catch (eventError) {
    log('Failed to record file download access event: %O', eventError);
  }

  const redisConfig = getRedisConfig();
  const redisClient = isRedisEnabled(redisConfig) ? await initializeRedis(redisConfig) : null;

  const cacheKey = buildCacheKey(fileId, cacheIdentity, access.authzEpoch);
  if (redisClient) {
    const cachedStr = await redisClient.get(cacheKey);
    const cached = cachedStr ? (JSON.parse(cachedStr) as CachedFileData) : null;
    if (cached?.redirectUrl) {
      log('Cache hit for file: %s', fileId);
      return Response.redirect(cached.redirectUrl, 302);
    }
    log('Cache miss for file: %s', fileId);
  }

  const fileService = new FileService(db, userId || 'anonymous');

  const redirectUrl = await fileService.createPreSignedUrlForPreview(file.url, 300);
  log('Web S3 presigned URL generated (expires in 5 min)');

  if (shouldProxyFileResponse(redirectUrl)) {
    log('Proxying file content to avoid mixed content: %s', fileId);
    const rangeHeader = req.headers.get('range');
    const upstreamResponse = await fetch(redirectUrl, {
      headers: rangeHeader ? { range: rangeHeader } : undefined,
    });

    if (!upstreamResponse.ok && upstreamResponse.status !== 206) {
      return new Response('Failed to fetch file from storage', {
        status: upstreamResponse.status || 502,
      });
    }

    const headers = new Headers();
    headers.set('Cache-Control', 'private, max-age=60');
    headers.set(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(file.name || fileId)}"`,
    );
    headers.set(
      'Content-Type',
      upstreamResponse.headers.get('content-type') || file.fileType || 'application/octet-stream',
    );

    const contentLength = upstreamResponse.headers.get('content-length');
    if (contentLength) headers.set('Content-Length', contentLength);

    const contentRange = upstreamResponse.headers.get('content-range');
    if (contentRange) headers.set('Content-Range', contentRange);

    const acceptRanges = upstreamResponse.headers.get('accept-ranges');
    if (acceptRanges) headers.set('Accept-Ranges', acceptRanges);

    return new Response(upstreamResponse.body, {
      headers,
      status: upstreamResponse.status,
    });
  }

  if (redisClient) {
    await redisClient.set(cacheKey, JSON.stringify({ redirectUrl }), {
      ex: PRESIGNED_URL_CACHE_TTL,
    });
    log('Cached presigned URL for file: %s (TTL: %ds)', fileId, PRESIGNED_URL_CACHE_TTL);
  }

  return Response.redirect(redirectUrl, 302);
}
