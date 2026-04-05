/**
 * Legacy same-origin upload: client supplies `pathname` + `file` (e.g. mobile).
 * Prefer `POST /api/file/upload-session` with `uploadSessionId` for server-issued keys.
 * Uses PrivateBlobS3 (private objects, no per-object ACL) like presigned PUT / upload-session.
 */
import debug from 'debug';
import { type NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { LOBE_CHAT_OIDC_AUTH_HEADER } from '@/envs/auth';
import { validateOIDCJWT } from '@/libs/oidc-provider/jwt';
import { getBlobProvider } from '@/server/modules/BlobProvider';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const log = debug('lobe-server:file-upload');

const MAX_LEGACY_PATHNAME_LEN = 2048;
const LEGACY_ALLOWED_UPLOAD_PREFIXES = ['files/', 'v2/spaces/'] as const;

/**
 * Reject path traversal and absolute keys. Exported for unit tests.
 * Clients must send a relative object key under an allowed storage namespace
 * (legacy `files/...` or current `v2/spaces/...`).
 */
export function getLegacyUploadPathnameValidationError(pathname: unknown): string | null {
  if (typeof pathname !== 'string' || !pathname) return 'Invalid pathname.';
  if (pathname.startsWith('/')) return 'Invalid pathname.';
  if (pathname.length > MAX_LEGACY_PATHNAME_LEN) return 'Invalid pathname.';
  const norm = pathname.replaceAll('\\', '/');
  if (norm.includes('\0')) return 'Invalid pathname.';
  for (const segment of norm.split('/')) {
    if (segment === '..') return 'Invalid pathname.';
  }
  if (!LEGACY_ALLOWED_UPLOAD_PREFIXES.some((prefix) => norm.startsWith(prefix))) {
    return 'Invalid pathname.';
  }
  return null;
}

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
    const pathnameField = formData.get('pathname');
    const file = formData.get('file');

    const pathError = getLegacyUploadPathnameValidationError(pathnameField);
    if (pathError) {
      return NextResponse.json({ error: pathError }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Invalid file payload.' }, { status: 400 });
    }

    const objectKey = pathnameField as string;
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const blobProvider = getBlobProvider();

    await blobProvider.uploadBuffer(objectKey, fileBuffer, file.type || 'application/octet-stream');

    log('Uploaded file through legacy same-origin path (PrivateBlobS3): %s', objectKey);

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
