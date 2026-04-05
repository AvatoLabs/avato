import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getServerDB } from '@/database/server';
import { parseMemoryExtractionConfig } from '@/server/globalConfig/parseMemoryExtractionConfig';
import {
  buildUserPersonaJobInput,
  UserPersonaService,
} from '@/server/services/memory/userMemory/persona/service';
import { validateWebhookRequestAuth } from '@/server/services/memory/userMemory/webhookAuth';

const userPersonaWebhookSchema = z.object({
  baseUrl: z.string().url().optional(),
  userId: z.string().optional(),
  userIds: z.array(z.string()).optional(),
});

type UserPersonaWebhookPayload = z.infer<typeof userPersonaWebhookSchema>;

const normalizeUserPersonaPayload = (
  payload: UserPersonaWebhookPayload,
  fallbackBaseUrl?: string,
) => {
  const parsed = userPersonaWebhookSchema.parse(payload);
  const baseUrl = parsed.baseUrl || fallbackBaseUrl;

  if (!baseUrl) throw new Error('Missing baseUrl for user persona trigger');

  return {
    userIds: Array.from(
      new Set([...(parsed.userIds || []), ...(parsed.userId ? [parsed.userId] : [])]),
    ).filter(Boolean),
  } as const;
};

export const POST = async (req: Request) => {
  const { webhook } = parseMemoryExtractionConfig();

  const authFailure = validateWebhookRequestAuth({
    allowInsecureDev: webhook.allowInsecureDev,
    expectedHeaders: webhook.headers,
    requestHeaders: req.headers,
  });

  if (authFailure) {
    return NextResponse.json({ error: authFailure.error }, { status: authFailure.status });
  }

  try {
    const json = await req.json();
    const origin = new URL(req.url).origin;
    const params = normalizeUserPersonaPayload(json, webhook.baseUrl || origin);

    if (params.userIds.length === 0) {
      return NextResponse.json({ error: 'userId or userIds is required' }, { status: 400 });
    }

    const db = await getServerDB();

    const service = new UserPersonaService(db);
    const results = [];

    for (const userId of params.userIds) {
      const context = await buildUserPersonaJobInput(db, userId);
      const result = await service.composeWriting({ ...context, userId });
      results.push({ userId, ...result });
    }

    return NextResponse.json(
      { message: 'User persona generated successfully.', results },
      { status: 200 },
    );
  } catch (error) {
    console.error('[user-persona] failed', error);

    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
};
