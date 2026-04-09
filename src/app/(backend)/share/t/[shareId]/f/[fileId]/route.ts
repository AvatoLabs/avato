import { contentRegistry, files, messages, messagesFiles } from '@lobechat/database/schemas';
import debug from 'debug';
import { and, eq } from 'drizzle-orm';

import { auth } from '@/auth';
import { TopicShareModel } from '@/database/models/topicShare';
import { getServerDB } from '@/database/server';
import { serveAuthorizedFileDownload } from '@/server/modules/file-proxy/serveAuthorizedFileDownload';
import { isRawFileContentId } from '@/types/content';

const log = debug('lobe-file:share-topic-f');

type Params = Promise<{ fileId: string; shareId: string }>;

export const GET = async (req: Request, segmentData: { params: Params }) => {
  try {
    const { fileId, shareId } = await segmentData.params;

    if (!fileId?.trim() || !shareId?.trim()) {
      return new Response('Not found', { status: 404 });
    }

    if (!isRawFileContentId(fileId)) {
      return new Response('Not found', { status: 404 });
    }

    const session =
      process.env.NOAUTH_MODE === '1'
        ? { user: { id: process.env.NOAUTH_USER_ID || 'local-user' } }
        : await auth.api.getSession({ headers: req.headers });

    const userId = session?.user?.id;
    const db = await getServerDB();
    const share = await TopicShareModel.findByShareIdWithAccessCheck(db, shareId, userId);

    const [result] = await db
      .select({
        authzEpoch: contentRegistry.authzEpoch,
        contentUid: contentRegistry.contentUid,
        fileId: files.id,
        fileType: files.fileType,
        name: files.name,
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
      .where(and(eq(messages.topicId, share.topicId), eq(files.id, fileId)))
      .limit(1);

    if (!result) {
      log('Topic share attachment not found: %s share=%s', fileId, shareId);
      return new Response('Not found', { status: 404 });
    }

    return serveAuthorizedFileDownload({
      accessOverride: {
        authzEpoch: result.authzEpoch,
        canAccess: true,
        contentUid: result.contentUid,
        matchedBy: 'share_link',
        spaceId: result.spaceId,
      },
      cacheIdentity: `topic-share:${shareId}`,
      db,
      downloadVia: 'share_path',
      eventVia: 'topic_share',
      file: {
        fileType: result.fileType,
        id: result.fileId,
        name: result.name,
        url: result.url,
      } as any,
      fileId: result.fileId,
      req,
      shareLinkId: null,
      shareToken: null,
      userId,
    });
  } catch (error) {
    log('Topic share file proxy error: %O', error);
    return new Response('Not found', { status: 404 });
  }
};
