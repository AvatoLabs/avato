// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SpaceMemoryAsyncService } from './async';

const { mockCreateAsyncCaller, mockIngestCandidates, mockIngestHarnessCandidates } = vi.hoisted(() => ({
  mockCreateAsyncCaller: vi.fn(),
  mockIngestCandidates: vi.fn(),
  mockIngestHarnessCandidates: vi.fn(),
}));

vi.mock('@/server/routers/async/caller', () => ({
  createAsyncCaller: mockCreateAsyncCaller,
}));

describe('SpaceMemoryAsyncService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIngestCandidates.mockResolvedValue({ count: 1, success: true });
    mockIngestHarnessCandidates.mockResolvedValue({ count: 1, success: true });
    mockCreateAsyncCaller.mockResolvedValue({
      spaceMemory: {
        ingestCandidates: mockIngestCandidates,
        ingestHarnessCandidates: mockIngestHarnessCandidates,
      },
    });
  });

  it('schedules candidate ingestion through the async router', async () => {
    const result = await SpaceMemoryAsyncService.enqueueIngest({
      drafts: [{ title: 'Candidate title' }],
      origin: 'automation',
      producer: 'topic-summary-extractor',
      spaceId: 'spc_team',
      traceId: 'trace-1',
      userId: 'user-1',
    });

    expect(result.triggerId).toContain('space-memory-async-');
    expect(mockCreateAsyncCaller).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(mockIngestCandidates).toHaveBeenCalledWith({
      drafts: [{ title: 'Candidate title' }],
      origin: 'automation',
      producer: 'topic-summary-extractor',
      spaceId: 'spc_team',
      traceId: 'trace-1',
    });
  });

  it('schedules harness ingestion through the dedicated async router contract', async () => {
    const result = await SpaceMemoryAsyncService.enqueueHarnessIngest({
      adapter: 'ops-harness-v1',
      drafts: [
        {
          kind: 'policy',
          sourceRefs: [{ objectId: 'doc_1', objectType: 'doc', title: 'Policy doc' }],
          title: 'Approval policy',
        },
      ],
      producer: 'custom-harness',
      spaceId: 'spc_team',
      traceId: 'trace-2',
      userId: 'user-1',
    });

    expect(result.triggerId).toContain('space-memory-harness-async-');
    expect(mockCreateAsyncCaller).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(mockIngestHarnessCandidates).toHaveBeenCalledWith({
      adapter: 'ops-harness-v1',
      drafts: [
        {
          kind: 'policy',
          sourceRefs: [{ objectId: 'doc_1', objectType: 'doc', title: 'Policy doc' }],
          title: 'Approval policy',
        },
      ],
      producer: 'custom-harness',
      spaceId: 'spc_team',
      traceId: 'trace-2',
    });
  });
});
