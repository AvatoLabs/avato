import bcrypt from 'bcryptjs';
import debug from 'debug';

import { auth } from '@/auth';
import { FileModel } from '@/database/models/file';
import { ResourceModel } from '@/database/models/resource';
import { getServerDB } from '@/database/server';
import { getRedisConfig } from '@/envs/redis';
import { initializeRedis, isRedisEnabled } from '@/libs/redis';
import { FileService } from '@/server/services/file';
import { ResourceAuthorizer } from '@/server/services/resource';

const log = debug('lobe-file:proxy');

type Params = Promise<{ id: string }>;

const FILE_PROXY_KEY_PREFIX = 'file-proxy:';
// Cache presigned URL for 4 minutes (URL expires in 5 minutes)
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

/**
 * File proxy service
 * GET /f/:id
 *
 * Features:
 * - Query database to get file record (without userId filter for public access)
 * - Generate access URL based on platform (desktop → local file, web → S3 presigned URL)
 * - Cache presigned URL in Redis to reduce S3 API calls
 * - Return 302 redirect
 */
export const GET = async (req: Request, segmentData: { params: Params }) => {
  try {
    const params = await segmentData.params;
    const { id } = params;
    const { searchParams } = new URL(req.url);
    const shareToken = searchParams.get('token');
    const sharePassword = searchParams.get('password');

    log('File proxy request: %s', id);

    const session =
      process.env.NOAUTH_MODE === '1'
        ? { user: { id: process.env.NOAUTH_USER_ID || 'local-user' } }
        : await auth.api.getSession({ headers: req.headers });

    const userId = session?.user?.id;

    if (!userId && !shareToken) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Get database connection
    const db = await getServerDB();

    // Query file record without userId filter, then authorize against resource ACL.
    const file = await FileModel.getFileById(db, id);

    if (!file) {
      log('File not found: %s', id);
      return new Response('File not found', {
        status: 404,
      });
    }

    if (shareToken) {
      const resourceModel = new ResourceModel(db, 'anonymous');
      const link = await resourceModel.resolveShareLinkByToken(shareToken);

      if (!link) {
        return new Response('Not found', { status: 404 });
      }

      if (link.passwordHash) {
        if (!sharePassword) {
          return new Response('Password required', { status: 401 });
        }

        const isValid = await bcrypt.compare(sharePassword, link.passwordHash);
        if (!isValid) {
          return new Response('Not found', { status: 404 });
        }
      }
    }

    const principalId = userId || 'anonymous';
    const cacheIdentity = shareToken ? `share:${shareToken}` : `user:${principalId}`;
    const authorizer = new ResourceAuthorizer(db, principalId);
    const access = await authorizer.getAccessMatch({
      capability: 'download_blob',
      id,
      kind: 'file',
      shareToken,
    });

    if (!access?.canAccess) {
      log('Access denied for file: %s user: %s', id, principalId);
      return new Response('Forbidden', { status: 403 });
    }

    // Try to get cached presigned URL from Redis
    const redisConfig = getRedisConfig();
    const redisClient = isRedisEnabled(redisConfig) ? await initializeRedis(redisConfig) : null;

    const cacheKey = buildCacheKey(id, cacheIdentity, access.authzEpoch);
    if (redisClient) {
      const cachedStr = await redisClient.get(cacheKey);
      const cached = cachedStr ? (JSON.parse(cachedStr) as CachedFileData) : null;
      if (cached?.redirectUrl) {
        log('Cache hit for file: %s', id);
        return Response.redirect(cached.redirectUrl, 302);
      }
      log('Cache miss for file: %s', id);
    }

    const fileService = new FileService(db, userId || 'anonymous');

    // Web: Generate S3 presigned URL (5 minutes expiry)
    const redirectUrl = await fileService.createPreSignedUrlForPreview(file.url, 300);
    log('Web S3 presigned URL generated (expires in 5 min)');

    if (shouldProxyFileResponse(redirectUrl)) {
      log('Proxying file content to avoid mixed content: %s', id);
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
        `inline; filename="${encodeURIComponent(file.name || id)}"`,
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

    // Cache the presigned URL in Redis
    if (redisClient) {
      await redisClient.set(cacheKey, JSON.stringify({ redirectUrl }), {
        ex: PRESIGNED_URL_CACHE_TTL,
      });
      log('Cached presigned URL for file: %s (TTL: %ds)', id, PRESIGNED_URL_CACHE_TTL);
    }

    // Return 302 redirect
    return Response.redirect(redirectUrl, 302);
  } catch (error) {
    console.error('File proxy error:', error);
    return new Response('Internal server error', {
      status: 500,
    });
  }
};
