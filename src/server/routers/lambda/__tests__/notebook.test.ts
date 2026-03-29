// @vitest-environment node
import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { notebookRouter } from '@/server/routers/lambda/notebook';

const mockDocumentModelCreate = vi.fn();
const mockDocumentModelFindByIdAny = vi.fn();
const mockDocumentModelUpdateAny = vi.fn();
const mockContentModelEnsureContentRegistry = vi.fn();
const mockContentModelEnsureOwnerPermission = vi.fn();
const mockSpaceModelFindAccessibleSpaceById = vi.fn();
const mockSpaceModelGetOrCreatePersonalSpace = vi.fn();
const mockTopicModelFindById = vi.fn();
const mockTopicDocumentModelAssociate = vi.fn();

vi.mock('@/database/models/content', () => ({
  ContentModel: vi.fn(() => ({
    ensureContentRegistry: mockContentModelEnsureContentRegistry,
    ensureOwnerPermission: mockContentModelEnsureOwnerPermission,
    invalidateAuthzEpochsAfterRemoval: vi.fn(),
  })),
}));

vi.mock('@/database/models/document', () => ({
  DocumentModel: vi.fn(() => ({
    create: mockDocumentModelCreate,
    deleteManyAny: vi.fn(),
    findByIdAny: mockDocumentModelFindByIdAny,
    updateAny: mockDocumentModelUpdateAny,
  })),
}));

vi.mock('@/database/models/space', () => ({
  SpaceModel: vi.fn(() => ({
    findAccessibleSpaceById: mockSpaceModelFindAccessibleSpaceById,
    getOrCreatePersonalSpace: mockSpaceModelGetOrCreatePersonalSpace,
  })),
}));

vi.mock('@/database/models/topic', () => ({
  TopicModel: vi.fn(() => ({
    findById: mockTopicModelFindById,
  })),
}));

vi.mock('@/database/models/topicDocument', () => ({
  TopicDocumentModel: vi.fn(() => ({
    associate: mockTopicDocumentModelAssociate,
    deleteByDocumentId: vi.fn(),
    findByTopicId: vi.fn(),
  })),
}));

vi.mock('@/server/services/content', () => ({
  ContentAuthorizer: vi.fn(() => ({
    getAccessMatch: vi.fn(),
  })),
}));

describe('notebookRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockContentModelEnsureContentRegistry.mockResolvedValue({ contentUid: 'res_doc_1' });
    mockDocumentModelCreate.mockResolvedValue({ id: 'doc_1' });
    mockDocumentModelFindByIdAny.mockResolvedValue(undefined);
    mockSpaceModelGetOrCreatePersonalSpace.mockResolvedValue({ id: 'spc_personal' });
  });

  it('should reject inaccessible topic spaces before creating a notebook document', async () => {
    mockTopicModelFindById.mockResolvedValue({ id: 'topic-1', spaceId: 'spc_blocked' });
    mockSpaceModelFindAccessibleSpaceById.mockResolvedValue(undefined);

    const caller = notebookRouter.createCaller({
      serverDB: {} as any,
      userId: 'test-user',
    } as any);

    await expect(
      caller.createDocument({
        content: '# Hello',
        description: 'desc',
        title: 'Notebook Doc',
        topicId: 'topic-1',
      }),
    ).rejects.toThrow(new TRPCError({ code: 'FORBIDDEN', message: 'SPACE_ACCESS_DENIED' }));

    expect(mockDocumentModelCreate).not.toHaveBeenCalled();
  });

  it('should reject viewer-only topic spaces before creating a notebook document', async () => {
    mockTopicModelFindById.mockResolvedValue({ id: 'topic-1', spaceId: 'spc_viewer' });
    mockSpaceModelFindAccessibleSpaceById.mockResolvedValue({
      id: 'spc_viewer',
      membershipRole: 'viewer',
    });

    const caller = notebookRouter.createCaller({
      serverDB: {} as any,
      userId: 'test-user',
    } as any);

    await expect(
      caller.createDocument({
        content: '# Hello',
        description: 'desc',
        title: 'Notebook Doc',
        topicId: 'topic-1',
      }),
    ).rejects.toThrow(new TRPCError({ code: 'FORBIDDEN', message: 'SPACE_WRITE_DENIED' }));

    expect(mockDocumentModelCreate).not.toHaveBeenCalled();
  });
});
