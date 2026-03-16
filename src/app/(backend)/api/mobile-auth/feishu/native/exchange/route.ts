import { getServerDB } from '@lobechat/database';
import { type NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { FeishuNativeMobileAuthService } from '@/server/services/mobileAuth/feishuNative';

export const dynamic = 'force-dynamic';

const exchangeBodySchema = z.object({
  code: z.string().min(1),
  codeVerifier: z.string().min(1).optional(),
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
