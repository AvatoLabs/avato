// @vitest-environment node
import { LayersEnum } from '@lobechat/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SpaceMemoryUserMemoryIngestionService } from './userMemoryIngestion';

const {
  mockCreateAuditLog,
  mockCreateCandidates,
  mockEnqueueIngest,
  mockFindAccessibleSpaceById,
  mockFindExistingSourceSummaryEntry,
} = vi.hoisted(() => ({
  mockCreateAuditLog: vi.fn(),
  mockCreateCandidates: vi.fn(),
  mockEnqueueIngest: vi.fn(),
  mockFindAccessibleSpaceById: vi.fn(),
  mockFindExistingSourceSummaryEntry: vi.fn(),
}));

vi.mock('@/database/models/content', () => ({
  ContentModel: vi.fn(() => ({
    createAuditLog: mockCreateAuditLog,
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
    findExistingSourceSummaryEntry: mockFindExistingSourceSummaryEntry,
  })),
}));

vi.mock('./async', () => ({
  SpaceMemoryAsyncService: {
    enqueueIngest: mockEnqueueIngest,
  },
}));

describe('SpaceMemoryUserMemoryIngestionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateCandidates.mockImplementation(async (entries) =>
      entries.map((entry: any, index: number) => ({
        ...entry,
        id: `mem_${index + 1}`,
        status: 'candidate',
      })),
    );
    mockFindExistingSourceSummaryEntry.mockResolvedValue(null);
    mockEnqueueIngest.mockResolvedValue({ triggerId: 'trigger-1' });
  });

  it('ingests team-safe user memory drafts into Space Memory', async () => {
    mockFindAccessibleSpaceById.mockResolvedValue({
      id: 'spc_team',
      kind: 'team',
      membershipRole: 'editor',
    });

    const service = new SpaceMemoryUserMemoryIngestionService({} as any, 'user-1');
    const result = await service.ingestTopicExtraction({
      extraction: {
        decision: {
          activity: { reasoning: '', shouldExtract: false },
          context: { reasoning: '', shouldExtract: true },
          experience: { reasoning: '', shouldExtract: true },
          identity: { reasoning: '', shouldExtract: false },
          preference: { reasoning: '', shouldExtract: false },
        },
        inputs: {},
        layers: [LayersEnum.Context, LayersEnum.Experience],
        outputs: {
          context: {
            data: {
              memories: [
                {
                  details: 'Blocked on legal signoff.',
                  summary: 'Renewal is blocked on legal review.',
                  title: 'Renewal status',
                  withContext: { currentStatus: 'blocked' },
                },
              ],
            } as any,
          },
          experience: {
            data: {
              memories: [
                {
                  details: 'Explicit rollback ownership helped the deploy.',
                  summary: 'Assign a rollback owner before release.',
                  title: 'Rollback owner practice',
                  withExperience: { keyLearning: 'Named owners reduce confusion.' },
                },
              ],
            } as any,
          },
        },
        processedCounts: 2,
        processedErrorsCount: {
          [LayersEnum.Activity]: 0,
          [LayersEnum.Context]: 0,
          [LayersEnum.Experience]: 0,
          [LayersEnum.Identity]: 0,
          [LayersEnum.Preference]: 0,
        },
        processedLayersCount: {
          [LayersEnum.Activity]: 0,
          [LayersEnum.Context]: 1,
          [LayersEnum.Experience]: 1,
          [LayersEnum.Identity]: 0,
          [LayersEnum.Preference]: 0,
        },
      },
      messageIds: ['msg_1'],
      topic: {
        id: 'topic_1',
        spaceId: 'spc_team',
        title: 'Renewal topic',
      },
      traceId: 'trace-1',
    });

    expect(result).toEqual({ createdCount: 2, status: 'created' });
    expect(mockCreateCandidates).toHaveBeenCalledTimes(1);
    expect(mockCreateAuditLog).toHaveBeenCalledTimes(2);
    expect(mockCreateCandidates.mock.calls[0][0][0]).toMatchObject({
      metadata: expect.objectContaining({
        derivedFrom: expect.objectContaining({ layer: 'context' }),
        intake: expect.objectContaining({
          origin: 'automation',
          producer: 'user-memory-extractor',
          traceId: 'trace-1',
        }),
      }),
      spaceId: 'spc_team',
    });
    expect(mockCreateCandidates.mock.calls[0][0][1]).toMatchObject({
      category: 'playbook',
      metadata: expect.objectContaining({
        derivedFrom: expect.objectContaining({ layer: 'experience' }),
      }),
    });
  });

  it('skips when all drafts already exist for the same topic summary', async () => {
    mockFindAccessibleSpaceById.mockResolvedValue({
      id: 'spc_team',
      kind: 'team',
      membershipRole: 'editor',
    });
    mockFindExistingSourceSummaryEntry.mockResolvedValue({
      id: 'mem_existing',
      status: 'candidate',
      summary: 'Renewal is blocked on legal review.',
    });

    const service = new SpaceMemoryUserMemoryIngestionService({} as any, 'user-1');
    const result = await service.ingestTopicExtraction({
      extraction: {
        decision: {
          activity: { reasoning: '', shouldExtract: false },
          context: { reasoning: '', shouldExtract: true },
          experience: { reasoning: '', shouldExtract: false },
          identity: { reasoning: '', shouldExtract: false },
          preference: { reasoning: '', shouldExtract: false },
        },
        inputs: {},
        layers: [LayersEnum.Context],
        outputs: {
          context: {
            data: {
              memories: [
                {
                  details: 'Blocked on legal signoff.',
                  summary: 'Renewal is blocked on legal review.',
                  title: 'Renewal status',
                  withContext: { currentStatus: 'blocked' },
                },
              ],
            } as any,
          },
        },
        processedCounts: 1,
        processedErrorsCount: {
          [LayersEnum.Activity]: 0,
          [LayersEnum.Context]: 0,
          [LayersEnum.Experience]: 0,
          [LayersEnum.Identity]: 0,
          [LayersEnum.Preference]: 0,
        },
        processedLayersCount: {
          [LayersEnum.Activity]: 0,
          [LayersEnum.Context]: 1,
          [LayersEnum.Experience]: 0,
          [LayersEnum.Identity]: 0,
          [LayersEnum.Preference]: 0,
        },
      },
      topic: {
        id: 'topic_1',
        spaceId: 'spc_team',
      },
    });

    expect(result).toEqual({ reason: 'duplicate', status: 'skipped' });
    expect(mockCreateCandidates).not.toHaveBeenCalled();
    expect(mockCreateAuditLog).not.toHaveBeenCalled();
  });

  it('triggers webhook-based ingestion for automation producers', async () => {
    mockFindAccessibleSpaceById.mockResolvedValue({
      id: 'spc_team',
      kind: 'team',
      membershipRole: 'editor',
    });

    const service = new SpaceMemoryUserMemoryIngestionService({} as any, 'user-1');
    const result = await service.triggerTopicExtraction({
      extraction: {
        decision: {
          activity: { reasoning: '', shouldExtract: false },
          context: { reasoning: '', shouldExtract: true },
          experience: { reasoning: '', shouldExtract: false },
          identity: { reasoning: '', shouldExtract: false },
          preference: { reasoning: '', shouldExtract: false },
        },
        inputs: {},
        layers: [LayersEnum.Context],
        outputs: {
          context: {
            data: {
              memories: [
                {
                  details: 'Blocked on legal signoff.',
                  summary: 'Renewal is blocked on legal review.',
                  title: 'Renewal status',
                  withContext: { currentStatus: 'blocked' },
                },
              ],
            } as any,
          },
        },
        processedCounts: 1,
        processedErrorsCount: {
          [LayersEnum.Activity]: 0,
          [LayersEnum.Context]: 0,
          [LayersEnum.Experience]: 0,
          [LayersEnum.Identity]: 0,
          [LayersEnum.Preference]: 0,
        },
        processedLayersCount: {
          [LayersEnum.Activity]: 0,
          [LayersEnum.Context]: 1,
          [LayersEnum.Experience]: 0,
          [LayersEnum.Identity]: 0,
          [LayersEnum.Preference]: 0,
        },
      },
      messageIds: ['msg_1'],
      topic: {
        id: 'topic_1',
        spaceId: 'spc_team',
        title: 'Renewal topic',
      },
      traceId: 'trace-1',
    });

    expect(result).toEqual({ draftCount: 1, status: 'scheduled', triggerId: 'trigger-1' });
    expect(mockEnqueueIngest).toHaveBeenCalledWith({
      drafts: [
        expect.objectContaining({
          category: 'general',
          metadata: expect.objectContaining({
            derivedFrom: expect.objectContaining({ layer: 'context' }),
          }),
          sourceRefs: expect.arrayContaining([
            { id: 'topic_1', kind: 'topic', title: 'Renewal topic' },
          ]),
        }),
      ],
      origin: 'automation',
      producer: 'user-memory-extractor',
      spaceId: 'spc_team',
      traceId: 'trace-1',
      userId: 'user-1',
    });
    expect(mockCreateCandidates).not.toHaveBeenCalled();
    expect(mockCreateAuditLog).not.toHaveBeenCalled();
  });
});
