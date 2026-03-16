import { getServerDB } from '@lobechat/database';
import { TRPCError } from '@trpc/server';
import { type NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { FeishuNativeMobileAuthService } from '@/server/services/mobileAuth/feishuNative';

export const dynamic = 'force-dynamic';

const refreshBodySchema = z.object({
  refreshToken: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json().catch(() => null);
    const parsedBody = refreshBodySchema.safeParse(rawBody);

    if (!parsedBody.success) {
      return NextResponse.json({ error: 'Invalid refresh payload.' }, { status: 400 });
    }

    const db = await getServerDB();
    const service = new FeishuNativeMobileAuthService(db);
    const session = await service.refreshSession(parsedBody.data.refreshToken);

    return NextResponse.json(session);
  } catch (error) {
    if (error instanceof TRPCError && error.code === 'UNAUTHORIZED') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Feishu mobile refresh failed.' },
      { status: 500 },
    );
  }
}
