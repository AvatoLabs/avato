import { type NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

const appendSetCookieHeaders = (target: Headers, source: Headers) => {
  const setCookies =
    typeof source.getSetCookie === 'function'
      ? source.getSetCookie()
      : source.get('set-cookie')
        ? [source.get('set-cookie')!]
        : [];

  for (const cookie of setCookies) {
    target.append('set-cookie', cookie);
  }
};

export const GET = async (request: NextRequest) => {
  const callbackUrl = request.nextUrl.searchParams.get('callbackUrl');

  if (!callbackUrl) {
    return NextResponse.json({ error: 'callbackUrl is required' }, { status: 400 });
  }

  const response = await auth.api.signInWithOAuth2({
    asResponse: true,
    body: {
      callbackURL: callbackUrl,
      providerId: 'feishu',
    },
    headers: request.headers,
  });

  const payload = (await response.clone().json().catch(() => null)) as
    | {
        url?: string;
      }
    | null;

  if (!response.ok || !payload?.url) {
    return response;
  }

  const redirectResponse = NextResponse.redirect(payload.url, { status: 302 });

  appendSetCookieHeaders(redirectResponse.headers, response.headers);

  return redirectResponse;
};
