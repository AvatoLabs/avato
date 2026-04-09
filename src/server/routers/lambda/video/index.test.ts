import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AsyncTaskStatus, AsyncTaskType } from '@/types/asyncTask';

import { videoRouter } from './index';

const {
  mockAsyncTaskModelUpdate,
  mockChargeBeforeGenerate,
  mockCreateVideo,
  mockGetFullFileUrl,
  mockGetKeyFromFullUrl,
  mockInitModelRuntimeFromDB,
  mockResolveProviderReadableFileReference,
  mockServerDB,
} = vi.hoisted(() => ({
  mockAsyncTaskModelUpdate: vi.fn(),
  mockChargeBeforeGenerate: vi.fn(),
  mockCreateVideo: vi.fn(),
  mockGetFullFileUrl: vi.fn(),
  mockGetKeyFromFullUrl: vi.fn(),
  mockInitModelRuntimeFromDB: vi.fn(),
  mockResolveProviderReadableFileReference: vi.fn(),
  mockServerDB: {
    transaction: vi.fn(),
  },
}));

vi.mock('debug', () => ({
  default: () => () => {},
}));

vi.mock('@lobechat/utils/server', () => ({
  getXorPayload: vi.fn(() => ({})),
}));

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: vi.fn(async () => mockServerDB),
}));

vi.mock('@/envs/app', () => ({
  appEnv: {
    APP_URL: 'https://app.example.com',
  },
}));

vi.mock('@/server/services/file', () => ({
  FileService: vi.fn(() => ({
    getFullFileUrl: mockGetFullFileUrl,
    getKeyFromFullUrl: mockGetKeyFromFullUrl,
  })),
}));

vi.mock('@/server/services/file/resolveProviderReadableFileReference', () => ({
  resolveProviderReadableFileReference: mockResolveProviderReadableFileReference,
}));

vi.mock('@/database/models/asyncTask', () => ({
  AsyncTaskModel: vi.fn(() => ({
    update: mockAsyncTaskModelUpdate,
  })),
}));

vi.mock('@/business/server/video-generation/chargeBeforeGenerate', () => ({
  chargeBeforeGenerate: (params: any) => mockChargeBeforeGenerate(params),
}));

vi.mock('@/business/server/video-generation/chargeAfterGenerate', () => ({
  chargeAfterGenerate: vi.fn(),
}));

vi.mock('@/business/server/video-generation/getVideoFreeQuota', () => ({
  getVideoFreeQuota: vi.fn(),
}));

vi.mock('@/server/modules/ModelRuntime', () => ({
  initModelRuntimeFromDB: mockInitModelRuntimeFromDB,
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args) => args),
  eq: vi.fn((a, b) => ({ a, b })),
}));

vi.mock('@/database/schemas', () => ({
  asyncTasks: { id: 'asyncTasks.id', userId: 'asyncTasks.userId' },
  generationBatches: { id: 'generationBatches.id' },
  generations: { id: 'generations.id', userId: 'generations.userId' },
}));

describe('videoRouter', () => {
  const mockUserId = 'test-user-id';

  const createMockCtx = (overrides = {}) => ({
    authorizationHeader: 'mock-auth-header',
    userId: mockUserId,
    ...overrides,
  });

  const createDefaultInput = (overrides = {}) => ({
    generationTopicId: 'topic-1',
    model: 'wanx',
    params: {
      duration: 5,
      imageUrl: '/f/file-1',
      prompt: 'animate this image',
    },
    provider: 'test-provider',
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockGetKeyFromFullUrl.mockResolvedValue(null);
    mockGetFullFileUrl.mockResolvedValue(null);
    mockResolveProviderReadableFileReference.mockResolvedValue(null);
    mockChargeBeforeGenerate.mockResolvedValue({
      errorBatch: null,
      prechargeResult: null,
    });
    mockCreateVideo.mockResolvedValue({
      inferenceId: 'infer-1',
    });
    mockInitModelRuntimeFromDB.mockResolvedValue({
      createVideo: mockCreateVideo,
    });

    const mockBatch = {
      id: 'batch-1',
      model: 'wanx',
      provider: 'test-provider',
      userId: mockUserId,
    };
    const mockGeneration = {
      generationBatchId: 'batch-1',
      id: 'gen-1',
      userId: mockUserId,
    };
    const mockAsyncTask = {
      id: 'task-1',
      status: AsyncTaskStatus.Pending,
      type: AsyncTaskType.VideoGeneration,
    };

    let insertCallCount = 0;
    mockServerDB.transaction.mockImplementation(async (callback) => {
      insertCallCount = 0;
      const tx = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockImplementation(() => {
              insertCallCount++;
              if (insertCallCount === 1) return [mockBatch];
              if (insertCallCount === 2) return [mockGeneration];
              return [mockAsyncTask];
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      };

      return callback(tx);
    });
  });

  it('uses provider-readable urls for internal file references', async () => {
    mockResolveProviderReadableFileReference.mockResolvedValue({
      fileId: 'file-1',
      key: 'v2/spaces/space-1/blobs/frame.jpg',
      url: 'https://blob.example.com/frame.jpg',
    });

    const caller = videoRouter.createCaller(createMockCtx());
    const result = await caller.createVideo(createDefaultInput());

    expect(result.success).toBe(true);
    expect(mockResolveProviderReadableFileReference).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceIp: null,
        url: '/f/file-1',
        userAgent: null,
        userId: mockUserId,
        via: 'video_generation_input',
      }),
    );
    expect(mockCreateVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          imageUrl: 'https://blob.example.com/frame.jpg',
        }),
      }),
    );
    expect(mockAsyncTaskModelUpdate).toHaveBeenCalledWith('task-1', {
      inferenceId: 'infer-1',
      status: AsyncTaskStatus.Processing,
    });
  });

  it('uses provider-readable urls for topic share attachment references', async () => {
    mockResolveProviderReadableFileReference.mockResolvedValue({
      fileId: 'file-1',
      key: 'v2/spaces/space-1/blobs/shared-frame.jpg',
      url: 'https://blob.example.com/shared-frame.jpg',
    });

    const caller = videoRouter.createCaller(createMockCtx());
    const result = await caller.createVideo(
      createDefaultInput({
        params: {
          duration: 5,
          endImageUrl: '/share/t/share-1/f/file-2',
          imageUrl: '/share/t/share-1/f/file-1',
          prompt: 'animate this image',
        },
      }),
    );

    expect(result.success).toBe(true);
    expect(mockResolveProviderReadableFileReference).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        url: '/share/t/share-1/f/file-1',
        via: 'video_generation_input',
      }),
    );
    expect(mockResolveProviderReadableFileReference).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        url: '/share/t/share-1/f/file-2',
        via: 'video_generation_input',
      }),
    );
    expect(mockCreateVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          imageUrl: 'https://blob.example.com/shared-frame.jpg',
        }),
      }),
    );
  });

  it('converts canonical blob keys to provider-readable urls', async () => {
    mockGetFullFileUrl.mockResolvedValue('https://blob.example.com/frame.jpg');

    const caller = videoRouter.createCaller(createMockCtx());
    const result = await caller.createVideo(
      createDefaultInput({
        params: {
          duration: 5,
          imageUrl: 'v2/spaces/space-1/blobs/frame.jpg',
          prompt: 'animate this image',
        },
      }),
    );

    expect(result.success).toBe(true);
    expect(mockGetKeyFromFullUrl).not.toHaveBeenCalled();
    expect(mockGetFullFileUrl).toHaveBeenCalledWith('v2/spaces/space-1/blobs/frame.jpg');
    expect(mockCreateVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          imageUrl: 'https://blob.example.com/frame.jpg',
        }),
      }),
    );
  });

  it('fails closed when internal file reference is no longer readable', async () => {
    mockResolveProviderReadableFileReference.mockRejectedValue(
      new TRPCError({ code: 'FORBIDDEN', message: 'RESOURCE_ACCESS_DENIED' }),
    );

    const caller = videoRouter.createCaller(createMockCtx());

    await expect(caller.createVideo(createDefaultInput())).rejects.toThrow(
      'RESOURCE_ACCESS_DENIED',
    );
    expect(mockCreateVideo).not.toHaveBeenCalled();
  });

  it('fails closed when a canonical blob key cannot be converted to a readable url', async () => {
    mockGetFullFileUrl.mockResolvedValue(null);

    const caller = videoRouter.createCaller(createMockCtx());

    await expect(
      caller.createVideo(
        createDefaultInput({
          params: {
            duration: 5,
            imageUrl: 'v2/spaces/space-1/blobs/frame.jpg',
            prompt: 'animate this image',
          },
        }),
      ),
    ).rejects.toThrow('RESOURCE_ACCESS_DENIED');
    expect(mockGetKeyFromFullUrl).not.toHaveBeenCalled();
    expect(mockCreateVideo).not.toHaveBeenCalled();
  });
});
