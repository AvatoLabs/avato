import debug from 'debug';
import { type NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { FileS3 } from '@/server/modules/S3';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const log = debug('lobe-server:file-upload');

export async function POST(request: NextRequest) {
  try {
    const session =
      process.env.NOAUTH_MODE === '1'
        ? { user: { id: process.env.NOAUTH_USER_ID || 'local-user' } }
        : await auth.api.getSession({ headers: request.headers });

    if (!session?.user?.id) {
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
