import { NextResponse } from 'next/server';

import { AsyncTaskModel } from '@/database/models/asyncTask';
import { getServerDB } from '@/database/server';
import { parseMemoryExtractionConfig } from '@/server/globalConfig/parseMemoryExtractionConfig';
import {
  MemoryExtractionExecutor,
  type MemoryExtractionNormalizedPayload,
  memoryExtractionPayloadSchema,
  normalizeMemoryExtractionPayload,
} from '@/server/services/memory/userMemory/extract';
import { validateWebhookRequestAuth } from '@/server/services/memory/userMemory/webhookAuth';
import { AsyncTaskError, AsyncTaskErrorType, AsyncTaskStatus } from '@/types/asyncTask';

export const POST = async (req: Request) => {
  const { webhook } = parseMemoryExtractionConfig();
  let params: MemoryExtractionNormalizedPayload | undefined;

  const authFailure = validateWebhookRequestAuth({
    expectedHeaders: webhook.headers,
    requestHeaders: req.headers,
  });

  if (authFailure) {
    return NextResponse.json({ error: authFailure.error }, { status: authFailure.status });
  }

  try {
    const json = await req.json();
    const origin = new URL(req.url).origin;

    const payload = memoryExtractionPayloadSchema.parse({
      ...json,
      baseUrl: json.baseUrl || origin,
    });
    if (payload.fromDate && payload.toDate && payload.fromDate > payload.toDate) {
      return NextResponse.json(
        { error: '`fromDate` cannot be later than `toDate`' },
        { status: 400 },
      );
    }

    params = normalizeMemoryExtractionPayload(payload, origin);
    const executor = await MemoryExtractionExecutor.create();
    const result = await executor.runDirect(params);

    return NextResponse.json(
      { message: 'Memory extraction executed successfully.', result },
      { status: 200 },
    );
  } catch (error) {
    console.error('[memory-extraction] failed', error);

    const taskId = params?.asyncTaskId;
    const taskUserId = params?.userId ?? params?.userIds?.[0];

    if (taskId && taskUserId && params?.userInitiated) {
      try {
        const asyncTaskModel = new AsyncTaskModel(await getServerDB(), taskUserId);
        await asyncTaskModel.update(taskId, {
          error: new AsyncTaskError(
            AsyncTaskErrorType.ServerError,
            error instanceof Error ? error.message : 'Extraction failed',
          ),
          status: AsyncTaskStatus.Error,
        });
      } catch (taskError) {
        console.error('[memory-extraction] failed to update async task status', taskError);
      }
    }

    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
};
