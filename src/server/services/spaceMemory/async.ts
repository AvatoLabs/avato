import type {
  SpaceMemoryCandidateDraft,
  SpaceMemoryHarnessIngestPayload,
  SpaceMemoryIngestOrigin,
} from '@lobechat/types';

import { createAsyncCaller } from '@/server/routers/async/caller';

export interface SpaceMemoryAsyncIngestPayload {
  drafts: SpaceMemoryCandidateDraft[];
  origin: SpaceMemoryIngestOrigin;
  producer?: string;
  spaceId: string;
  traceId?: string;
  userId: string;
}

export class SpaceMemoryAsyncService {
  static async enqueueIngest(payload: SpaceMemoryAsyncIngestPayload) {
    const asyncCaller = await createAsyncCaller({ userId: payload.userId });
    const triggerId = `space-memory-async-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    void asyncCaller.spaceMemory
      .ingestCandidates({
        drafts: payload.drafts,
        origin: payload.origin,
        producer: payload.producer,
        spaceId: payload.spaceId,
        traceId: payload.traceId,
      })
      .catch((error: Error) => {
        console.error('[space-memory] Async ingest failed:', error);
      });

    return { triggerId };
  }

  static async enqueueHarnessIngest(payload: SpaceMemoryHarnessIngestPayload) {
    const asyncCaller = await createAsyncCaller({ userId: payload.userId });
    const triggerId = `space-memory-harness-async-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    void asyncCaller.spaceMemory
      .ingestHarnessCandidates({
        adapter: payload.adapter,
        drafts: payload.drafts,
        producer: payload.producer,
        spaceId: payload.spaceId,
        traceId: payload.traceId,
      })
      .catch((error: Error) => {
        console.error('[space-memory] Async harness ingest failed:', error);
      });

    return { triggerId };
  }
}
