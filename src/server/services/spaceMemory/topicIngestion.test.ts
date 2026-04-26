// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SpaceMemoryTopicIngestionService } from './topicIngestion';

const {
  mockCreateAuditLog,
  mockCreateCandidates,
  mockFindAccessibleSpaceById,
  mockFindExistingTopicSummaryEntry,
  mockMessageQuery,
  mockEnqueueIngest,
  mockTopicFindById,
} = vi.hoisted(() => ({
  mockCreateAuditLog: vi.fn(),
  mockCreateCandidates: vi.fn(),
  mockFindAccessibleSpaceById: vi.fn(),
  mockFindExistingTopicSummaryEntry: vi.fn(),
  mockMessageQuery: vi.fn(),
  mockEnqueueIngest: vi.fn(),
  mockTopicFindById: vi.fn(),
}));

vi.mock('@/database/models/content', () => ({
  ContentModel: vi.fn(() => ({
    createAuditLog: mockCreateAuditLog,
  })),
}));

vi.mock('@/database/models/message', () => ({
  MessageModel: vi.fn(() => ({
    query: mockMessageQuery,
  })),
}));

vi.mock('@/database/models/space', () => ({
  SpaceModel: vi.fn(() => ({
    findAccessibleSpaceById: mockFindAccessibleSpaceById,
  })),
}));

vi.mock('@/database/models/spaceMemory', () => ({
  SpaceMemoryModel: vi.fn(() => ({
    createCandidates: mockCreateCandidates,
    findExistingTopicSummaryEntry: mockFindExistingTopicSummaryEntry,
  })),
}));

vi.mock('@/database/models/topic', () => ({
  TopicModel: vi.fn(() => ({
    findById: mockTopicFindById,
  })),
}));

vi.mock('./async', () => ({
  SpaceMemoryAsyncService: {
    enqueueIngest: mockEnqueueIngest,
  },
}));

describe('SpaceMemoryTopicIngestionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateCandidates.mockImplementation(async (entries) =>
      entries.map((entry: any, index: number) => ({
        ...entry,
        id: `mem_${index + 1}`,
        status: 'candidate',
      })),
    );
    mockFindExistingTopicSummaryEntry.mockResolvedValue(null);
    mockEnqueueIngest.mockResolvedValue({ triggerId: 'trigger-1' });
  });

  it('creates a candidate for a team-scoped topic summary', async () => {
    mockTopicFindById.mockResolvedValue({
      historySummary: 'The team aligned on a rollout checklist.',
      id: 'topic_1',
      spaceId: 'spc_team',
      title: 'Rollout topic',
    });
    mockFindAccessibleSpaceById.mockResolvedValue({
      id: 'spc_team',
      kind: 'team',
      membershipRole: 'editor',
    });
    mockMessageQuery.mockResolvedValue([
      { content: 'Confirm rollback owner.', id: 'msg_1', role: 'user' },
    ]);

    const service = new SpaceMemoryTopicIngestionService({} as any, 'user-1');
    const result = await service.ingestTopicCandidate({ topicId: 'topic_1' });

    expect(result).toMatchObject({ status: 'created' });
    expect(mockCreateCandidates).toHaveBeenCalledTimes(1);
    expect(mockCreateAuditLog).toHaveBeenCalledTimes(1);
  });

  it('skips duplicate topic summaries', async () => {
    mockTopicFindById.mockResolvedValue({
      historySummary: 'The team aligned on a rollout checklist.',
      id: 'topic_1',
      spaceId: 'spc_team',
      title: 'Rollout topic',
    });
    mockFindAccessibleSpaceById.mockResolvedValue({
      id: 'spc_team',
      kind: 'team',
      membershipRole: 'editor',
    });
    mockMessageQuery.mockResolvedValue([]);
    mockFindExistingTopicSummaryEntry.mockResolvedValue({
      id: 'mem_existing',
      status: 'candidate',
      summary: 'The team aligned on a rollout checklist.',
    });

    const service = new SpaceMemoryTopicIngestionService({} as any, 'user-1');
    const result = await service.ingestTopicCandidate({ topicId: 'topic_1' });

    expect(result).toEqual({ reason: 'duplicate', status: 'skipped' });
    expect(mockCreateCandidates).not.toHaveBeenCalled();
    expect(mockCreateAuditLog).not.toHaveBeenCalled();
  });

  it('triggers webhook-based ingestion for async producers', async () => {
    mockTopicFindById.mockResolvedValue({
      historySummary: 'The team aligned on a rollout checklist.',
      id: 'topic_1',
      spaceId: 'spc_team',
      title: 'Rollout topic',
    });
    mockFindAccessibleSpaceById.mockResolvedValue({
      id: 'spc_team',
      kind: 'team',
      membershipRole: 'editor',
    });
    mockMessageQuery.mockResolvedValue([
      { content: 'Confirm rollback owner.', id: 'msg_1', role: 'user' },
    ]);

    const service = new SpaceMemoryTopicIngestionService({} as any, 'user-1');
    const result = await service.triggerTopicCandidate({ topicId: 'topic_1' });

    expect(result).toEqual({ draftCount: 1, status: 'scheduled', triggerId: 'trigger-1' });
    expect(mockEnqueueIngest).toHaveBeenCalledWith({
      drafts: [
        expect.objectContaining({
          category: 'general',
          sourceRefs: expect.arrayContaining([
            { id: 'topic_1', kind: 'topic', title: 'Rollout topic' },
          ]),
        }),
      ],
      origin: 'automation',
      producer: 'topic-summary-extractor',
      spaceId: 'spc_team',
      traceId: 'topic:topic_1',
      userId: 'user-1',
    });
    expect(mockCreateCandidates).not.toHaveBeenCalled();
  });
});
