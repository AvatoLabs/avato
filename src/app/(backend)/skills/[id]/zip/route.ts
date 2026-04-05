import { auth } from '@/auth';
import { AgentSkillModel } from '@/database/models/agentSkill';
import { ContentModel } from '@/database/models/content';
import { FileModel } from '@/database/models/file';
import { getServerDB } from '@/database/server';
import { appEnv } from '@/envs/app';
import { FileService } from '@/server/services/file';
import { verifySkillZipProxyToken } from '@/server/services/skill/skillZipProxyToken';

type Params = Promise<{ id: string }>;

export const GET = async (req: Request, segmentData: { params: Params }) => {
  try {
    const { id } = await segmentData.params;

    if (!id) {
      return new Response('Not found', { status: 404 });
    }

    const requestUrl = new URL(req.url);
    const hasValidInternalToken = verifySkillZipProxyToken(
      id,
      requestUrl.searchParams.get('token'),
    );

    const session =
      process.env.NOAUTH_MODE === '1'
        ? { user: { id: process.env.NOAUTH_USER_ID || 'local-user' } }
        : hasValidInternalToken
          ? null
          : await auth.api.getSession({ headers: req.headers });

    const userId = session?.user?.id;

    if (!userId && !hasValidInternalToken) {
      return new Response('Unauthorized', { status: 401 });
    }

    const db = await getServerDB();
    const actorId = userId || 'anonymous';
    const skillModel = new AgentSkillModel(db, actorId);
    const contentModel = new ContentModel(db, actorId);
    const fileModel = new FileModel(db, actorId);
    const fileService = new FileService(db, actorId);

    const skill = await skillModel.findById(id);

    if (!skill?.zipFileHash) {
      return new Response('Not found', { status: 404 });
    }

    if (!hasValidInternalToken) {
      const canAccess = await fileModel.canAccessGlobalFileByHash(skill.zipFileHash);
      if (!canAccess) {
        return new Response('Not found', { status: 404 });
      }
    }

    const fileInfo = await fileModel.checkHash(skill.zipFileHash);

    if (!fileInfo.isExist || !fileInfo.url) {
      return new Response('Not found', { status: 404 });
    }

    const fileUrl = await fileService.getFullFileUrl(fileInfo.url);

    if (!fileUrl) {
      return new Response('Not found', { status: 404 });
    }

    try {
      await contentModel.createAccessEvent({
        accessType: 'file_url_issued',
        metadata: {
          fileHash: skill.zipFileHash,
          skillId: skill.id,
          via: 'skill_zip_proxy',
        },
        sourceIp: req.headers.get('x-forwarded-for'),
        userAgent: req.headers.get('user-agent'),
      });
    } catch (error) {
      console.error('Failed to record skill zip URL issuance', error);
    }

    return Response.redirect(
      fileUrl.startsWith('http://') || fileUrl.startsWith('https://')
        ? fileUrl
        : new URL(fileUrl, appEnv.APP_URL).toString(),
      307,
    );
  } catch (error) {
    console.error('Skill zip download error:', error);
    return new Response('Internal server error', { status: 500 });
  }
};
