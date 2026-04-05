// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getServerDB } from '@/database/core/db-adaptor';
import { userMemoriesRouter } from '@/server/routers/lambda/userMemories';
import * as memorySearchModule from '@/server/services/memory/searchUserMemoriesCore';
import { calculateWeightedLength } from '@/utils/textLength';

const {
  mockFindAccessibleSpaceById,
  mockFindTopicById,
  mockGetUserMessagesQueryForTopic,
  mockListPublishedRecallEntries,
} = vi.hoisted(() => ({
  mockFindAccessibleSpaceById: vi.fn(),
  mockFindTopicById: vi.fn(),
  mockGetUserMessagesQueryForTopic: vi.fn(),
  mockListPublishedRecallEntries: vi.fn(),
}));

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: vi.fn(),
}));

vi.mock('@/server/globalConfig', () => ({
  getServerDefaultFilesConfig: vi.fn().mockReturnValue({
    embeddingModel: { model: 'text-embedding-3-small' },
  }),
}));

vi.mock('@/server/modules/ModelRuntime', () => ({
  initModelRuntimeFromDB: vi.fn(),
}));

vi.mock('@/database/models/userMemory', () => ({
  UserMemoryActivityModel: vi.fn().mockImplementation(() => ({})),
  UserMemoryExperienceModel: vi.fn().mockImplementation(() => ({})),
  UserMemoryIdentityModel: vi.fn().mockImplementation(() => ({})),
  UserMemoryModel: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@/database/models/topic', () => ({
  TopicModel: vi.fn().mockImplementation(() => ({
    findById: mockFindTopicById,
  })),
}));

vi.mock('@/database/models/space', () => ({
  SpaceModel: vi.fn().mockImplementation(() => ({
    findAccessibleSpaceById: mockFindAccessibleSpaceById,
  })),
}));

vi.mock('@/database/models/spaceMemory', () => ({
  SpaceMemoryModel: vi.fn().mockImplementation(() => ({
    listPublishedRecallEntries: mockListPublishedRecallEntries,
  })),
}));

vi.mock('@/database/repositories/userMemory', () => ({
  UserMemoryTopicRepository: vi.fn().mockImplementation(() => ({
    getUserMessagesQueryForTopic: mockGetUserMessagesQueryForTopic,
  })),
}));

const mockCtx = { authorizationHeader: 'Bearer mock-token', userId: 'test-user' };

const makeServerDBMock = () => ({
  query: {
    userSettings: {
      findFirst: vi.fn().mockResolvedValue({ memory: null }),
    },
  },
});

describe('userMemoriesRouter.retrieveMemoryForTopic', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getServerDB).mockResolvedValue(makeServerDBMock() as any);
  });

  it('merges published team space memories into topic retrieval results', async () => {
    vi.spyOn(memorySearchModule, 'searchUserMemories').mockResolvedValue({
      activities: [],
      contexts: [
        {
          accessedAt: new Date('2026-04-04T09:00:00.000Z'),
          associatedObjects: null,
          associatedSubjects: null,
          createdAt: new Date('2026-04-04T09:00:00.000Z'),
          currentStatus: null,
          description: 'Personal memory',
          id: 'ctx-personal',
          metadata: null,
          scoreImpact: null,
          scoreUrgency: null,
          tags: null,
          title: 'Personal context',
          type: 'context',
          updatedAt: new Date('2026-04-04T09:00:00.000Z'),
          userMemoryIds: null,
        },
      ],
      experiences: [],
      preferences: [],
    });

    mockGetUserMessagesQueryForTopic.mockResolvedValue('rollback owner deploy approval');
    mockFindTopicById.mockResolvedValue({ id: 'topic-1', spaceId: 'spc-team' });
    mockFindAccessibleSpaceById.mockResolvedValue({
      id: 'spc-team',
      kind: 'team',
      membershipRole: 'owner',
    });
    mockListPublishedRecallEntries.mockResolvedValue([
      {
        category: 'general',
        content: 'Every rollout must name a rollback owner before approval.',
        id: 'sm-general-1',
        publishedAt: '2026-04-04T10:00:00.000Z',
        summary: 'Rollback owner is mandatory before deploy.',
        title: 'Rollback owner',
        updatedAt: '2026-04-04T10:00:00.000Z',
      },
      {
        category: 'policy',
        content: 'Do not promise an ETA without incident commander approval.',
        id: 'sm-policy-1',
        publishedAt: '2026-04-04T10:10:00.000Z',
        summary: 'Customer ETAs require approval.',
        title: 'Customer comms',
        updatedAt: '2026-04-04T10:10:00.000Z',
      },
    ]);

    const caller = userMemoriesRouter.createCaller(mockCtx as any);
    const result = await caller.retrieveMemoryForTopic({ topicId: 'topic-1' });

    expect(mockListPublishedRecallEntries).toHaveBeenCalledWith({
      query: 'rollback owner deploy approval',
      spaceId: 'spc-team',
    });
    expect(result.contexts.map((item) => item.id)).toEqual(['ctx-personal', 'sm-general-1']);
    expect(result.preferences.map((item) => item.id)).toEqual(['sm-policy-1']);
    expect(result.preferences[0]?.suggestions).toContain('Customer ETAs require approval.');
    expect(result.preferences[0]?.suggestions).toContain('Customer comms');
  });

  it('skips team recall for personal spaces', async () => {
    vi.spyOn(memorySearchModule, 'searchUserMemories').mockResolvedValue({
      activities: [],
      contexts: [],
      experiences: [],
      preferences: [],
    });

    mockGetUserMessagesQueryForTopic.mockResolvedValue('planning notes');
    mockFindTopicById.mockResolvedValue({ id: 'topic-2', spaceId: 'spc-personal' });
    mockFindAccessibleSpaceById.mockResolvedValue({
      id: 'spc-personal',
      kind: 'personal',
      membershipRole: 'owner',
    });

    const caller = userMemoriesRouter.createCaller(mockCtx as any);
    const result = await caller.retrieveMemoryForTopic({ topicId: 'topic-2' });

    expect(mockListPublishedRecallEntries).not.toHaveBeenCalled();
    expect(result).toEqual({
      activities: [],
      contexts: [],
      experiences: [],
      preferences: [],
    });
  });

  it('passes topic query into policy-aware recall packaging', async () => {
    vi.spyOn(memorySearchModule, 'searchUserMemories').mockResolvedValue({
      activities: [],
      contexts: [],
      experiences: [],
      preferences: [],
    });

    mockGetUserMessagesQueryForTopic.mockResolvedValue('can we promise eta to customers');
    mockFindTopicById.mockResolvedValue({ id: 'topic-3', spaceId: 'spc-team' });
    mockFindAccessibleSpaceById.mockResolvedValue({
      id: 'spc-team',
      kind: 'team',
      membershipRole: 'owner',
    });
    mockListPublishedRecallEntries.mockResolvedValue([
      {
        category: 'policy',
        content: Array.from(
          { length: 120 },
          (_, index) => `Do not promise external ETA without commander approval step ${index}`,
        ).join(' '),
        id: 'sm-policy-long',
        publishedAt: '2026-04-04T10:10:00.000Z',
        summary: 'Customer ETA commitments require approval.',
        title: 'Customer comms',
        updatedAt: '2026-04-04T10:10:00.000Z',
      },
    ]);

    const caller = userMemoriesRouter.createCaller(mockCtx as any);
    const result = await caller.retrieveMemoryForTopic({ topicId: 'topic-3' });

    expect(result.preferences).toHaveLength(1);
    expect(calculateWeightedLength(result.preferences[0]!.conclusionDirectives)).toBeGreaterThan(320);
    expect(calculateWeightedLength(result.preferences[0]!.conclusionDirectives)).toBeLessThanOrEqual(
      432,
    );
  });

  it('returns an explicit retrieval error marker when topic memory search fails', async () => {
    vi.spyOn(memorySearchModule, 'searchUserMemories').mockRejectedValue(new Error('boom'));

    mockGetUserMessagesQueryForTopic.mockResolvedValue('rollback owner deploy approval');

    const caller = userMemoriesRouter.createCaller(mockCtx as any);
    const result = await caller.retrieveMemoryForTopic({
      effort: 'high',
      topicId: 'topic-4',
    });

    expect(result).toEqual({
      activities: [],
      contexts: [],
      experiences: [],
      preferences: [],
      retrieval: {
        message: 'Failed to retrieve topic memories.',
        status: 'error',
      },
    });
  });
});
