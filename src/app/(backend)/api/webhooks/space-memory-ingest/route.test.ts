// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from './route';

const mockIngestCandidates = vi.fn();

vi.mock('@/database/server', () => ({
  getServerDB: vi.fn(async () => ({})),
}));

vi.mock('@/server/services/spaceMemory/intake', () => ({
  SpaceMemoryIntakeService: vi.fn(() => ({
    ingestCandidates: mockIngestCandidates,
  })),
}));

describe('POST /api/webhooks/space-memory-ingest', () => {
  beforeEach(() => {
    vi.stubEnv('KEY_VAULTS_SECRET', 'test-secret');
    mockIngestCandidates.mockReset();
    mockIngestCandidates.mockResolvedValue([
      {
        id: 'memory_1',
        status: 'candidate',
        title: 'Ops playbook',
      },
    ]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('rejects requests without internal auth', async () => {
    const req = new NextRequest('http://localhost/api/webhooks/space-memory-ingest', {
      body: JSON.stringify({}),
      method: 'POST',
    });

    const res = await POST(req);

    expect(res.status).toBe(403);
    expect(mockIngestCandidates).not.toHaveBeenCalled();
  });

  it('ingests harness candidates with internal auth', async () => {
    const req = new NextRequest('http://localhost/api/webhooks/space-memory-ingest', {
      body: JSON.stringify({
        adapter: 'ops-harness-v1',
        drafts: [
          {
            decision: {
              decision: 'REVIEW',
              reason: 'Matches an existing playbook draft.',
            },
            kind: 'playbook',
            sourceRefs: [
              { objectId: 'topic_1', objectType: 'topic', title: 'Release topic' },
              { objectId: 'task_1', objectType: 'task', title: 'Checklist task' },
            ],
            title: 'Ops playbook',
          },
        ],
        producer: 'custom-harness',
        spaceId: 'spc_team',
        traceId: 'trace-1',
        userId: 'user-1',
      }),
      headers: {
        'authorization': 'Bearer test-secret',
        'content-type': 'application/json',
      },
      method: 'POST',
    });

    const res = await POST(req);
    const body = (await res.json()) as { count: number; ok: boolean };

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ count: 1, ok: true });
    expect(mockIngestCandidates).toHaveBeenCalledWith({
      drafts: [
        {
          category: 'playbook',
          metadata: {
            harness: {
              adapter: 'ops-harness-v1',
              confidence: null,
              contractVersion: 1,
              decision: {
                decision: 'REVIEW',
                reason: 'Matches an existing playbook draft.',
              },
              kind: 'playbook',
              normalizedKey: null,
              proposedOwnerId: null,
              proposedReviewerId: null,
              recall: null,
              scope: null,
              sourceAttribution: [
                { objectId: 'topic_1', objectType: 'topic', title: 'Release topic' },
                { objectId: 'task_1', objectType: 'task', title: 'Checklist task' },
              ],
            },
          },
          sourceRefs: [{ id: 'topic_1', kind: 'topic', title: 'Release topic' }],
          title: 'Ops playbook',
        },
      ],
      origin: 'harness',
      producer: 'custom-harness',
      spaceId: 'spc_team',
      traceId: 'trace-1',
    });
  });
});
