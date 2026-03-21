import bcrypt from 'bcryptjs';
import debug from 'debug';

import { auth } from '@/auth';
import { FileModel } from '@/database/models/file';
import { ResourceModel } from '@/database/models/resource';
import { getServerDB } from '@/database/server';
import { serveAuthorizedFileDownload } from '@/server/modules/file-proxy/serveAuthorizedFileDownload';

const log = debug('lobe-file:proxy');

type Params = Promise<{ id: string }>;

/**
 * File proxy service
 * GET /f/:id
 *
 * Features:
 * - Load file by id, then authorize (session or share link token in query)
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

    const db = await getServerDB();

    const file = await FileModel.getFileById(db, id);

    if (!file) {
      log('File not found: %s', id);
      return new Response('File not found', {
        status: 404,
      });
    }

    let shareLinkId: string | null = null;

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

      shareLinkId = link.id;
    }

    return serveAuthorizedFileDownload({
      db,
      downloadVia: shareToken ? 'share_query' : 'session',
      file,
      fileId: id,
      req,
      shareLinkId,
      shareToken,
      userId,
    });
  } catch (error) {
    console.error('File proxy error:', error);
    return new Response('Internal server error', {
      status: 500,
    });
  }
};
