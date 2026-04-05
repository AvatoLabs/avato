import type { SpaceMemoryHarnessIngestPayload } from '@lobechat/types';

import { buildInternalServiceAuthHeaders } from '@/server/utils/internalServiceAuth';

const SPACE_MEMORY_TRIGGER_PATH = '/api/webhooks/space-memory-ingest';

const buildTriggerUrl = (path: string, baseUrl: string) => {
  const url = new URL(path, baseUrl);

  return url.toString();
};

const createTriggerHeaders = () => ({
  'Content-Type': 'application/json',
  ...(process.env.VERCEL_AUTOMATION_BYPASS_SECRET && {
    'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
  }),
  ...buildInternalServiceAuthHeaders(),
});

const triggerInternalEndpoint = (url: string, body: Record<string, unknown>) => {
  const triggerId = `space-memory-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  void fetch(url, {
    body: JSON.stringify(body),
    headers: createTriggerHeaders(),
    method: 'POST',
  })
    .then(async (response) => {
      if (response.ok) return;

      const detail = await response.text().catch(() => '');
      throw new Error(
        `Space memory trigger failed (${response.status}${detail ? `): ${detail}` : ')'}`,
      );
    })
    .catch((error) => {
      console.error('[space-memory] Internal trigger failed:', error);
    });

  return Promise.resolve({ triggerId });
};

export interface SpaceMemoryTriggerHarnessIngestPayload extends SpaceMemoryHarnessIngestPayload {
  baseUrl?: string;
}

export class SpaceMemoryTriggerService {
  static triggerHarnessIngest(payload: SpaceMemoryTriggerHarnessIngestPayload) {
    const baseUrl = payload.baseUrl || process.env.INTERNAL_APP_URL || process.env.APP_URL;

    if (!baseUrl) {
      throw new Error('Missing baseUrl for Space Memory trigger');
    }

    const url = buildTriggerUrl(SPACE_MEMORY_TRIGGER_PATH, baseUrl);

    return triggerInternalEndpoint(url, {
      adapter: payload.adapter,
      drafts: payload.drafts,
      producer: payload.producer,
      spaceId: payload.spaceId,
      traceId: payload.traceId,
      userId: payload.userId,
    });
  }
}
