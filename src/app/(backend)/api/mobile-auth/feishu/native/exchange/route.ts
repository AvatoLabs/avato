import { getServerDB } from '@lobechat/database';
import { type NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { FeishuNativeMobileAuthService } from '@/server/services/mobileAuth/feishuNative';

export const dynamic = 'force-dynamic';

const optionalNonEmptyString = z.preprocess((value) => {
  if (typeof value !== 'string') return undefined;

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}, z.string().min(1).optional());

const exchangeBodySchema = z.object({
  code: z.string().trim().min(1),
  codeVerifier: optionalNonEmptyString,
});

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json().catch(() => null);
    const parsedBody = exchangeBodySchema.safeParse(rawBody);

    if (!parsedBody.success) {
      return NextResponse.json({ error: 'Invalid exchange payload.' }, { status: 400 });
    }

    const db = await getServerDB();
    const service = new FeishuNativeMobileAuthService(db);
    const session = await service.exchangeCode(parsedBody.data);

    return NextResponse.json(session);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Feishu mobile sign-in failed.' },
      { status: 500 },
    );
  }
}
