import debug from 'debug';
import { type NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { ResourceModel } from '@/database/models/resource';
import { getServerDB } from '@/database/server';
import { LOBE_CHAT_OIDC_AUTH_HEADER } from '@/envs/auth';
import { validateOIDCJWT } from '@/libs/oidc-provider/jwt';
import { getPrivateBlobS3 } from '@/server/modules/PrivateBlobS3';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const log = debug('lobe-server:file-upload-session');

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

    const formData = await request.formData();
    const uploadSessionId = formData.get('uploadSessionId');
    const file = formData.get('file');

    if (typeof uploadSessionId !== 'string' || !uploadSessionId) {
      return NextResponse.json({ error: 'Invalid uploadSessionId.' }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Invalid file payload.' }, { status: 400 });
    }

    const db = await getServerDB();
    const resourceModel = new ResourceModel(db, userId);
    const uploadSession = await resourceModel.findPendingUploadSessionById(uploadSessionId);

    if (!uploadSession) {
      return NextResponse.json({ error: 'Upload session not found or expired.' }, { status: 400 });
    }

    if (uploadSession.createdBy !== userId) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length !== uploadSession.expectedSize) {
      return NextResponse.json(
        { error: 'File size does not match upload session.' },
        { status: 400 },
      );
    }

    const privateS3 = getPrivateBlobS3();
    await privateS3.uploadBuffer(
      uploadSession.storageKey,
      buffer,
      file.type || 'application/octet-stream',
    );

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
