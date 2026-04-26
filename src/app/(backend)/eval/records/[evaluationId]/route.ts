import { auth } from '@/auth';
import { ContentModel } from '@/database/models/content';
import { EvalEvaluationModel } from '@/database/models/ragEval';
import { getServerDB } from '@/database/server';
import { appEnv } from '@/envs/app';
import { FileService } from '@/server/services/file';

type Params = Promise<{ evaluationId: string }>;

export const GET = async (req: Request, segmentData: { params: Params }) => {
  try {
    const { evaluationId } = await segmentData.params;

    if (!evaluationId) {
      return new Response('Not found', { status: 404 });
    }

    const session =
      process.env.NOAUTH_MODE === '1'
        ? { user: { id: process.env.NOAUTH_USER_ID || 'local-user' } }
        : await auth.api.getSession({ headers: req.headers });

    const userId = session?.user?.id;

    if (!userId) {
      return new Response('Unauthorized', { status: 401 });
    }

    const db = await getServerDB();
    const contentModel = new ContentModel(db, userId);
    const evaluation = await new EvalEvaluationModel(db, userId).findById(evaluationId);

    if (!evaluation?.evalRecordsUrl) {
      return new Response('Not found', { status: 404 });
    }

    const fileUrl = await new FileService(db, userId).getFullFileUrl(evaluation.evalRecordsUrl);

    if (!fileUrl) {
      return new Response('Not found', { status: 404 });
    }

    try {
      await contentModel.createAccessEvent({
        accessType: 'file_url_issued',
        metadata: {
          evaluationId,
          fileKey: evaluation.evalRecordsUrl,
          via: 'rag_eval_records_proxy',
        },
        sourceIp: req.headers.get('x-forwarded-for'),
        userAgent: req.headers.get('user-agent'),
      });
    } catch (error) {
      console.error('Failed to record evaluation records URL issuance', error);
    }

    return Response.redirect(
      fileUrl.startsWith('http://') || fileUrl.startsWith('https://')
        ? fileUrl
        : new URL(fileUrl, appEnv.APP_URL).toString(),
      307,
    );
  } catch (error) {
    console.error('Evaluation records download error:', error);
    return new Response('Internal server error', { status: 500 });
  }
};
