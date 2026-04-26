import { NextResponse } from 'next/server';
import { getServerDB } from '@/database/server';
import {
  normalizeSpaceMemoryHarnessIngestPayload,
  spaceMemoryHarnessIngestPayloadSchema,
} from '@/server/services/spaceMemory/harness';
import { SpaceMemoryIntakeService } from '@/server/services/spaceMemory/intake';
import { isValidInternalServiceAuth } from '@/server/utils/internalServiceAuth';
import { z } from 'zod';

export const POST = async (req: Request) => {
  if (!process.env.KEY_VAULTS_SECRET) {
    return NextResponse.json(
      { error: 'Internal service authentication secret is not configured.' },
      { status: 503 },
    );
  }

  if (!isValidInternalServiceAuth(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized internal service request.' }, { status: 403 });
  }

  try {
    const json = await req.json();
    const payload = spaceMemoryHarnessIngestPayloadSchema.parse(json);
    if (!payload.userId?.trim()) {
      return NextResponse.json({ error: 'userId is required.' }, { status: 400 });
    }

    const normalized = normalizeSpaceMemoryHarnessIngestPayload(payload);

    const intakeService = new SpaceMemoryIntakeService(await getServerDB(), payload.userId);
    const result = await intakeService.ingestCandidates({
      drafts: normalized.drafts,
      origin: 'harness',
      producer: normalized.producer,
      spaceId: normalized.spaceId,
      traceId: normalized.traceId,
    });

    return NextResponse.json(
      {
        count: result.length,
        items: result,
        ok: true,
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'SPACE_NOT_FOUND') {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message === 'SPACE_MEMORY_CREATE_DENIED') {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error('[space-memory-ingest] failed', error);

    return NextResponse.json({ error: message }, { status: 500 });
  }
};
