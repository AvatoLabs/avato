import { contentRegistry } from '@lobechat/database/schemas';
import bcrypt from 'bcryptjs';
import debug from 'debug';
import { eq } from 'drizzle-orm';

import { auth } from '@/auth';
import { ContentModel } from '@/database/models/content';
import { FileModel } from '@/database/models/file';
import { getServerDB } from '@/database/server';
import { serveAuthorizedFileDownload } from '@/server/modules/file-proxy/serveAuthorizedFileDownload';

const log = debug('lobe-file:share-f');

type Params = Promise<{ token: string }>;

/**
 * Token-first file download (no file id in URL). Legacy GET /f/:id?token=… redirects here (307).
 * GET /share/f/:token — optional ?password= for protected links.
 */
export const GET = async (req: Request, segmentData: { params: Params }) => {
  try {
    const { token } = await segmentData.params;
    if (!token?.trim()) {
      return new Response('Not found', { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const sharePassword = searchParams.get('password');

    log('Share file proxy request (token-first)');

    const db = await getServerDB();
    const contentModel = new ContentModel(db, 'anonymous');
    const link = await contentModel.resolveShareLinkByToken(token);

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

    const [reg] = await db
      .select()
      .from(contentRegistry)
      .where(eq(contentRegistry.contentUid, link.contentUid))
      .limit(1);

    if (!reg || reg.kind !== 'file') {
      return new Response('Not found', { status: 404 });
    }

    const fileId = reg.localId;
    const file = await FileModel.getFileById(db, fileId);

    if (!file) {
      return new Response('Not found', { status: 404 });
    }

    const session =
      process.env.NOAUTH_MODE === '1'
        ? { user: { id: process.env.NOAUTH_USER_ID || 'local-user' } }
        : await auth.api.getSession({ headers: req.headers });

    const userId = session?.user?.id;

    return serveAuthorizedFileDownload({
      db,
      downloadVia: 'share_path',
      file,
      fileId,
      req,
      shareLinkId: link.id,
      shareToken: token,
      userId,
    });
  } catch (error) {
    console.error('Share file proxy error:', error);
    return new Response('Internal server error', {
      status: 500,
    });
  }
};
