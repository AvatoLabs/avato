import { Readable } from 'node:stream';

import debug from 'debug';
import { type NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { ContentModel } from '@/database/models/content';
import { getServerDB } from '@/database/server';
import { LOBE_CHAT_OIDC_AUTH_HEADER } from '@/envs/auth';
import { validateOIDCJWT } from '@/libs/oidc-provider/jwt';
import { getPrivateBlobS3 } from '@/server/modules/PrivateBlobS3';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const log = debug('lobe-server:file-upload-session');
const UPLOAD_SESSION_ID_HEADER = 'x-lobe-upload-session-id';

export async function POST(request: NextRequest) {
  try {
    let userId: string | undefined;

    if (process.env.NOAUTH_MODE === '1') {
      userId = process.env.NOAUTH_USER_ID || 'local-user';
    } else {
      const session = await auth.api.getSession({ headers: request.headers });
      userId = session?.user?.id;

      if (!userId) {
        const oidcAuthorization = request.headers.get(LOBE_CHAT_OIDC_AUTH_HEADER);
        if (oidcAuthorization) {
          const oidc = await validateOIDCJWT(oidcAuthorization);
          userId = oidc.userId;
        }
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const uploadSessionIdFromHeader = request.headers.get(UPLOAD_SESSION_ID_HEADER);
    const hasRawUploadHeader = !!uploadSessionIdFromHeader;

    let uploadSessionId = uploadSessionIdFromHeader;
    let contentType = request.headers.get('content-type') || 'application/octet-stream';
    let body: Buffer | Readable | null = null;

    const db = await getServerDB();
    const contentModel = new ContentModel(db, userId);

    if (hasRawUploadHeader) {
      if (!uploadSessionId) {
        return NextResponse.json({ error: 'Invalid uploadSessionId.' }, { status: 400 });
      }

      const declaredContentLength = request.headers.get('content-length');
      if (declaredContentLength) {
        const actualSize = Number(declaredContentLength);

        if (!Number.isFinite(actualSize)) {
          return NextResponse.json({ error: 'Invalid Content-Length header.' }, { status: 400 });
        }

        const uploadSession = await contentModel.findPendingUploadSessionById(uploadSessionId);

        if (!uploadSession) {
          return NextResponse.json(
            { error: 'Upload session not found or expired.' },
            { status: 400 },
          );
        }

        if (uploadSession.createdBy !== userId) {
          return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
        }

        if (actualSize !== uploadSession.expectedSize) {
          return NextResponse.json(
            { error: 'File size does not match upload session.' },
            { status: 400 },
          );
        }
      }

      if (!request.body) {
        return NextResponse.json({ error: 'Invalid file payload.' }, { status: 400 });
      }

      body = Readable.fromWeb(request.body as any) as Readable;
    } else {
      const formData = await request.formData();
      const file = formData.get('file');
      const formUploadSessionId = formData.get('uploadSessionId');

      if (typeof formUploadSessionId !== 'string' || !formUploadSessionId) {
        return NextResponse.json({ error: 'Invalid uploadSessionId.' }, { status: 400 });
      }

      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'Invalid file payload.' }, { status: 400 });
      }

      uploadSessionId = formUploadSessionId;
      contentType = file.type || contentType;
      body = Buffer.from(await file.arrayBuffer());
    }

    if (!uploadSessionId || !body) {
      return NextResponse.json({ error: 'Invalid upload payload.' }, { status: 400 });
    }

    const uploadSession = await contentModel.findPendingUploadSessionById(uploadSessionId);

    if (!uploadSession) {
      return NextResponse.json({ error: 'Upload session not found or expired.' }, { status: 400 });
    }

    if (uploadSession.createdBy !== userId) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    if (Buffer.isBuffer(body) && body.length !== uploadSession.expectedSize) {
      return NextResponse.json(
        { error: 'File size does not match upload session.' },
        { status: 400 },
      );
    }

    const privateS3 = getPrivateBlobS3();
    await privateS3.uploadBody(uploadSession.storageKey, body, {
      contentLength: Buffer.isBuffer(body) ? body.length : uploadSession.expectedSize,
      contentType,
    });

    log('Uploaded file via same-origin session fallback: %s', uploadSession.storageKey);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Same-origin session upload failed:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to upload file.',
      },
      { status: 500 },
    );
  }
}
