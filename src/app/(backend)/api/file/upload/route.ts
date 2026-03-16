import debug from 'debug';
import { type NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { LOBE_CHAT_OIDC_AUTH_HEADER } from '@/envs/auth';
import { validateOIDCJWT } from '@/libs/oidc-provider/jwt';
import { FileS3 } from '@/server/modules/S3';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const log = debug('lobe-server:file-upload');

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
    const pathname = formData.get('pathname');
    const file = formData.get('file');

    if (typeof pathname !== 'string' || !pathname || pathname.startsWith('/')) {
      return NextResponse.json({ error: 'Invalid pathname.' }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Invalid file payload.' }, { status: 400 });
    }

    const s3 = new FileS3();
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    await s3.uploadBuffer(pathname, fileBuffer, file.type || 'application/octet-stream');

    log('Uploaded file through same-origin fallback: %s', pathname);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Same-origin file upload failed:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to upload file.',
      },
      { status: 500 },
    );
  }
}
