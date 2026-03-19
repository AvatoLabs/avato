import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { userMemoryRouter } from '@/server/routers/lambda/userMemory';
import { AsyncTaskErrorType, AsyncTaskStatus, AsyncTaskType } from '@/types/asyncTask';
import { MemorySourceType } from '@/types/userMemory';

const mockFindActiveByType = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockFindById = vi.fn();

const mockCountTopicsForMemoryExtractor = vi.fn();
const {
  mockAddIdentityEntry,
  mockAppEnv,
  mockExperienceUpdate,
  mockGetAllIdentitiesWithMemory,
  mockParseMemoryExtractionConfig,
  mockTriggerProcessUsers,
  mockUpdateIdentityEntry,
} = vi.hoisted(() => ({
  mockAddIdentityEntry: vi.fn(),
  mockAppEnv: {
    APP_URL: 'https://example.com',
    INTERNAL_APP_URL: 'https://internal.example.com',
  } as { APP_URL?: string; INTERNAL_APP_URL?: string },
  mockExperienceUpdate: vi.fn(),
  mockGetAllIdentitiesWithMemory: vi.fn(),
  mockParseMemoryExtractionConfig: vi.fn(() => ({
    triggerExtraHeaders: { 'x-test': 'ok' },
    webhook: { baseUrl: 'https://internal.example.com' },
  })),
  mockTriggerProcessUsers: vi.fn(),
  mockUpdateIdentityEntry: vi.fn(),
}));

vi.mock('@/database/models/asyncTask', () => ({
  AsyncTaskModel: vi.fn(() => ({
    create: mockCreate,
    findById: mockFindById,
    findActiveByType: mockFindActiveByType,
    update: mockUpdate,
  })),
  initUserMemoryExtractionMetadata: vi.fn((metadata) => metadata),
}));

vi.mock('@/database/models/topic', () => ({
  TopicModel: vi.fn(() => ({
    countTopicsForMemoryExtractor: mockCountTopicsForMemoryExtractor,
  })),
}));

vi.mock('@/database/models/userMemory', () => ({
  UserMemoryActivityModel: vi.fn(() => ({
    delete: vi.fn(),
    update: vi.fn(),
  })),
  UserMemoryContextModel: vi.fn(() => ({
    delete: vi.fn(),
    update: vi.fn(),
  })),
  UserMemoryExperienceModel: vi.fn(() => ({
    delete: vi.fn(),
    update: mockExperienceUpdate,
  })),
  UserMemoryIdentityModel: vi.fn(() => ({
    delete: vi.fn(),
  })),
  UserMemoryModel: vi.fn(() => ({
    addIdentityEntry: mockAddIdentityEntry,
    getAllIdentitiesWithMemory: mockGetAllIdentitiesWithMemory,
    removeIdentityEntry: vi.fn(),
    searchActivities: vi.fn(),
    searchContexts: vi.fn(),
    searchExperiences: vi.fn(),
    searchPreferences: vi.fn(),
    updateIdentityEntry: mockUpdateIdentityEntry,
  })),
  UserMemoryPreferenceModel: vi.fn(() => ({
    delete: vi.fn(),
    update: vi.fn(),
  })),
}));

vi.mock('@/envs/app', () => ({
  appEnv: mockAppEnv,
}));

vi.mock('@/server/globalConfig/parseMemoryExtractionConfig', () => ({
  parseMemoryExtractionConfig: mockParseMemoryExtractionConfig,
}));

vi.mock('@/server/services/memory/userMemory/extract', () => ({
  MemoryExtractionWorkflowService: {
    triggerProcessUsers: mockTriggerProcessUsers,
  },
  buildWorkflowPayloadInput: (payload: any) => payload,
  normalizeMemoryExtractionPayload: (payload: any) => payload,
}));

const createCaller = (ctxOverrides: Partial<any> = {}) => {
  const ctx = {
    serverDB: {} as any,
    userId: 'user-1',
    ...ctxOverrides,
  };

  return userMemoryRouter.createCaller(ctx);
};

describe('userMemoryRouter.requestMemoryFromChatTopic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAppEnv.APP_URL = 'https://example.com';
    mockAppEnv.INTERNAL_APP_URL = 'https://internal.example.com';
    mockParseMemoryExtractionConfig.mockReturnValue({
      triggerExtraHeaders: { 'x-test': 'ok' },
      webhook: { baseUrl: 'https://internal.example.com' },
    });
  });

  it('dedupes when an active task exists', async () => {
    mockFindActiveByType.mockResolvedValue({
      id: 'existing-task',
      metadata: { progress: { completedTopics: 0, totalTopics: 1 } },
      status: AsyncTaskStatus.Pending,
    });

    const caller = createCaller();
    const result = await caller.requestMemoryFromChatTopic({});

    expect(result).toEqual({
      deduped: true,
      id: 'existing-task',
      metadata: { progress: { completedTopics: 0, totalTopics: 1 } },
      status: AsyncTaskStatus.Pending,
    });
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockTriggerProcessUsers).not.toHaveBeenCalled();
  });

  it('creates task and triggers workflow with user context and dates', async () => {
    mockFindActiveByType.mockResolvedValue(undefined);
    mockCreate.mockResolvedValue('new-task');
    mockCountTopicsForMemoryExtractor.mockResolvedValue(2);

    const caller = createCaller();
    const result = await caller.requestMemoryFromChatTopic({
      fromDate: new Date('2024-01-01'),
      toDate: new Date('2024-02-01'),
    });

    expect(mockCreate).toHaveBeenCalledWith({
      metadata: {
        progress: { completedTopics: 0, totalTopics: 2 },
        range: {
          from: new Date('2024-01-01').toISOString(),
          to: new Date('2024-02-01').toISOString(),
        },
        source: 'chat_topic',
      },
      status: AsyncTaskStatus.Pending,
      type: AsyncTaskType.UserMemoryExtractionWithChatTopic,
    });
    expect(mockTriggerProcessUsers).toHaveBeenCalledWith(
      expect.objectContaining({
        asyncTaskId: 'new-task',
        baseUrl: 'https://internal.example.com',
        fromDate: new Date('2024-01-01'),
        sources: [MemorySourceType.ChatTopic],
        toDate: new Date('2024-02-01'),
        userIds: ['user-1'],
        userInitiated: true,
      }),
      { extraHeaders: { 'x-test': 'ok' } },
    );
    expect(result).toMatchObject({
      deduped: false,
      id: 'new-task',
      status: AsyncTaskStatus.Pending,
    });
  });

  it('returns success immediately when no topics', async () => {
    mockFindActiveByType.mockResolvedValue(undefined);
    mockCountTopicsForMemoryExtractor.mockResolvedValue(0);
    mockCreate.mockResolvedValue('empty-task');

    const caller = createCaller();
    const result = await caller.requestMemoryFromChatTopic({});

    expect(result).toEqual({
      deduped: false,
      id: 'empty-task',
      metadata: {
        progress: { completedTopics: 0, totalTopics: 0 },
        range: { from: undefined, to: undefined },
        source: 'chat_topic',
      },
      status: AsyncTaskStatus.Success,
    });
    expect(mockTriggerProcessUsers).not.toHaveBeenCalled();
  });

  it('does not create a task when async trigger baseUrl is unavailable', async () => {
    mockFindActiveByType.mockResolvedValue(undefined);
    mockCountTopicsForMemoryExtractor.mockResolvedValue(3);

    mockAppEnv.APP_URL = undefined;
    mockAppEnv.INTERNAL_APP_URL = undefined;
    mockParseMemoryExtractionConfig.mockReturnValueOnce({
      triggerExtraHeaders: { 'x-test': 'ok' },
      webhook: { baseUrl: undefined },
    } as any);

    const caller = createCaller();

    await expect(caller.requestMemoryFromChatTopic({})).rejects.toBeInstanceOf(TRPCError);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockTriggerProcessUsers).not.toHaveBeenCalled();
  });

  it('throws on invalid date range', async () => {
    const caller = createCaller();
    await expect(
      caller.requestMemoryFromChatTopic({
        fromDate: new Date('2024-02-02'),
        toDate: new Date('2024-01-01'),
      }),
    ).rejects.toBeInstanceOf(TRPCError);
  });
});

describe('userMemoryRouter.getMemoryExtractionTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('returns null when no active task', async () => {
    mockFindActiveByType.mockResolvedValue(undefined);

    const caller = createCaller();
    const result = await caller.getMemoryExtractionTask();

    expect(result).toBeNull();
  });

  it('returns active task with normalized metadata', async () => {
    mockFindActiveByType.mockResolvedValue({
      id: 'task-1',
      metadata: {
        progress: { completedTopics: 1, totalTopics: 4 },
        source: 'chat_topic',
      },
      status: AsyncTaskStatus.Processing,
      userId: 'user-1',
    });

    const caller = createCaller();
    const result = await caller.getMemoryExtractionTask();

    expect(result).toEqual({
      error: undefined,
      id: 'task-1',
      metadata: {
        progress: { completedTopics: 1, totalTopics: 4 },
        range: undefined,
        source: 'chat_topic',
      },
      status: AsyncTaskStatus.Processing,
    });
  });

  it('fetches by task id when provided', async () => {
    mockFindActiveByType.mockResolvedValue(undefined);
    mockFindById.mockResolvedValue({
      id: 'a0a0a0a0-a0a0-4a0a-a0a0-a0a0a0a0a0a0',
      metadata: {
        progress: { completedTopics: 2, totalTopics: 8 },
        source: 'chat_topic',
      },
      status: AsyncTaskStatus.Pending,
      userId: 'user-1',
    });

    const caller = createCaller();
    const result = await caller.getMemoryExtractionTask({
      taskId: 'a0a0a0a0-a0a0-4a0a-a0a0-a0a0a0a0a0a0',
    });

    expect(mockFindById).toHaveBeenCalledWith('a0a0a0a0-a0a0-4a0a-a0a0-a0a0a0a0a0a0');
    expect(result?.id).toBe('a0a0a0a0-a0a0-4a0a-a0a0-a0a0a0a0a0a0');
  });

  it('marks active task as error when topic-based timeout is exceeded', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-03-01T01:00:00.000Z'));

    mockFindActiveByType.mockResolvedValue({
      createdAt: new Date('2024-03-01T00:00:00.000Z'),
      id: 'task-timeout',
      metadata: {
        progress: { completedTopics: 1, totalTopics: 6 },
        source: 'chat_topic',
      },
      status: AsyncTaskStatus.Processing,
      userId: 'user-1',
    });

    const caller = createCaller();
    const result = await caller.getMemoryExtractionTask();

    expect(mockUpdate).toHaveBeenCalledWith(
      'task-timeout',
      expect.objectContaining({
        error: expect.objectContaining({
          body: expect.objectContaining({
            detail: expect.stringContaining('timed out after 30 minutes'),
          }),
          name: AsyncTaskErrorType.Timeout,
        }),
        status: AsyncTaskStatus.Error,
      }),
    );
    expect(result).toEqual({
      error: expect.objectContaining({
        body: expect.objectContaining({
          detail: expect.stringContaining('timed out after 30 minutes'),
        }),
        name: AsyncTaskErrorType.Timeout,
      }),
      id: 'task-timeout',
      metadata: {
        progress: { completedTopics: 1, totalTopics: 6 },
        range: undefined,
        source: 'chat_topic',
      },
      status: AsyncTaskStatus.Error,
    });
  });
});

describe('userMemoryRouter identity contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes title and summary into base memory when creating an identity', async () => {
    mockAddIdentityEntry.mockResolvedValue({
      identityId: 'identity-1',
      userMemoryId: 'memory-1',
    });

    const caller = createCaller();
    const result = await caller.createIdentity({
      description: 'Arthur profile',
      role: 'founder',
      summary: 'Key profile summary',
      title: 'Arthur',
    });

    expect(mockAddIdentityEntry).toHaveBeenCalledWith({
      base: {
        summary: 'Key profile summary',
        title: 'Arthur',
      },
      identity: {
        description: 'Arthur profile',
        episodicDate: undefined,
        relationship: undefined,
        role: 'founder',
        tags: undefined,
        type: undefined,
      },
    });
    expect(result).toEqual({
      identityId: 'identity-1',
      userMemoryId: 'memory-1',
    });
  });

  it('flattens identity base fields for mobile consumers', async () => {
    mockGetAllIdentitiesWithMemory.mockResolvedValue([
      {
        identity: {
          capturedAt: new Date('2024-01-02T00:00:00.000Z'),
          createdAt: new Date('2024-01-02T00:00:00.000Z'),
          description: 'Likes concise status updates',
          episodicDate: null,
          id: 'identity-1',
          relationship: 'self',
          role: 'operator',
          tags: ['ops'],
          type: 'professional',
          updatedAt: new Date('2024-01-03T00:00:00.000Z'),
          userId: 'user-1',
          userMemoryId: 'memory-1',
        },
        memory: {
          capturedAt: new Date('2024-01-01T00:00:00.000Z'),
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          memoryCategory: 'profile',
          memoryLayer: 'identity',
          memoryType: 'identity',
          status: 'active',
          summary: 'Prefers direct communication',
          tags: ['profile'],
          title: 'Arthur',
          updatedAt: new Date('2024-01-04T00:00:00.000Z'),
          userId: 'user-1',
        },
      },
    ]);

    const caller = createCaller();
    const result = await caller.getIdentities();

    expect(result).toEqual([
      expect.objectContaining({
        description: 'Likes concise status updates',
        id: 'identity-1',
        memoryCategory: 'profile',
        memoryLayer: 'identity',
        memoryType: 'identity',
        role: 'operator',
        summary: 'Prefers direct communication',
        title: 'Arthur',
        type: 'professional',
        userMemoryId: 'memory-1',
      }),
    ]);
  });

  it('passes title and summary into base memory when updating an identity', async () => {
    mockUpdateIdentityEntry.mockResolvedValue(true);

    const caller = createCaller();
    const result = await caller.updateIdentity({
      data: {
        description: 'Updated profile',
        summary: 'Updated summary',
        title: 'Updated Arthur',
      },
      id: 'identity-1',
    });

    expect(mockUpdateIdentityEntry).toHaveBeenCalledWith({
      base: {
        summary: 'Updated summary',
        title: 'Updated Arthur',
      },
      identity: {
        description: 'Updated profile',
        episodicDate: undefined,
        relationship: undefined,
        role: undefined,
        tags: undefined,
        type: undefined,
      },
      identityId: 'identity-1',
    });
    expect(result).toBe(true);
  });
});

describe('userMemoryRouter.updateExperience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('forwards reasoning updates to the experience model', async () => {
    mockExperienceUpdate.mockResolvedValue({ success: true });

    const caller = createCaller();
    const result = await caller.updateExperience({
      data: {
        action: 'Ship the patch',
        keyLearning: 'Validate the mobile contract',
        reasoning: 'Title and summary belong to base memory',
        situation: 'Mobile memory audit',
      },
      id: 'experience-1',
    });

    expect(mockExperienceUpdate).toHaveBeenCalledWith('experience-1', {
      action: 'Ship the patch',
      keyLearning: 'Validate the mobile contract',
      reasoning: 'Title and summary belong to base memory',
      situation: 'Mobile memory audit',
    });
    expect(result).toEqual({ success: true });
  });
});
