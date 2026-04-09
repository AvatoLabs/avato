import debug from 'debug';

import { auth } from '@/auth';
import { FileModel } from '@/database/models/file';
import { getServerDB } from '@/database/server';
import { appEnv } from '@/envs/app';
import { serveAuthorizedFileDownload } from '@/server/modules/file-proxy/serveAuthorizedFileDownload';
import { isRawFileContentId } from '@/types/content';

const log = debug('lobe-file:proxy');

type Params = Promise<{ id: string }>;

/**
 * File proxy service
 * GET /f/:id
 *
 * Features:
 * - Session: GET /f/:id (login required)
 * - Share: prefer GET /share/f/:token (token-first). Legacy GET /f/:id?token=… redirects there (Phase 5).
 * - Generate access URL based on platform (desktop → local file, web → S3 presigned URL)
 * - Cache presigned URL in Redis to reduce S3 API calls
 * - Return 302 redirect
 */
export const GET = async (req: Request, segmentData: { params: Params }) => {
  try {
    const params = await segmentData.params;
    const { id } = params;
    const requestUrl =
      req.url.startsWith('http://') || req.url.startsWith('https://')
        ? new URL(req.url)
        : new URL(req.url, appEnv.APP_URL);
    const { searchParams } = requestUrl;
    const shareToken = searchParams.get('token')?.trim() || null;
    const sharePassword = searchParams.get('password');

    log('File proxy request: %s', id);

    if (!isRawFileContentId(id)) {
      return new Response('File not found', { status: 404 });
    }

    const session =
      process.env.NOAUTH_MODE === '1'
        ? { user: { id: process.env.NOAUTH_USER_ID || 'local-user' } }
        : await auth.api.getSession({ headers: req.headers });

    const userId = session?.user?.id;

    if (!userId && !shareToken) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Token-first share download: do not keep resource id in the URL surface.
    if (shareToken) {
      requestUrl.pathname = `/share/f/${encodeURIComponent(shareToken)}`;
      requestUrl.search = '';
      if (sharePassword) {
        requestUrl.searchParams.set('password', sharePassword);
      }
      return Response.redirect(requestUrl.toString(), 307);
    }

    const db = await getServerDB();

    const file = await FileModel.getFileById(db, id);

    if (!file) {
      log('File not found: %s', id);
      return new Response('File not found', {
        status: 404,
      });
    }

    return serveAuthorizedFileDownload({
      db,
      downloadVia: 'session',
      file,
      fileId: id,
      req,
      shareLinkId: null,
      shareToken: null,
      userId,
    });
  } catch (error) {
    console.error('File proxy error:', error);
    return new Response('Internal server error', {
      status: 500,
    });
  }
};
