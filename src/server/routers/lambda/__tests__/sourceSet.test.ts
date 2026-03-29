// @vitest-environment node
import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sourceSetRouter } from '@/server/routers/lambda/sourceSet';

const mockAddFilesToSourceSetAny = vi.fn();
const mockCreate = vi.fn();
const mockDeleteAny = vi.fn();
const mockGetOrCreatePersonalSpace = vi.fn();
const mockEnsureContentRegistry = vi.fn();
const mockEnsureOwnerPermission = vi.fn();
const mockFilterVisibleSourceSetIdsForList = vi.fn();
const mockFindAccessibleSpaceById = vi.fn();
const mockQuery = vi.fn();
const mockRequireSourceSet = vi.fn();
const mockUpdateAny = vi.fn();
const mockAssertCapability = vi.fn();
const mockRemoveFilesFromSourceSetAny = vi.fn();

vi.mock('@/database/models/sourceSet', () => ({
  SourceSetModel: vi.fn(() => ({
    addFilesToSourceSetAny: mockAddFilesToSourceSetAny,
    create: mockCreate,
    deleteAny: mockDeleteAny,
    query: mockQuery,
    removeFilesFromSourceSetAny: mockRemoveFilesFromSourceSetAny,
    updateAny: mockUpdateAny,
  })),
}));

vi.mock('@/database/models/content', () => ({
  ContentModel: vi.fn(() => ({
    ensureContentRegistry: mockEnsureContentRegistry,
    ensureOwnerPermission: mockEnsureOwnerPermission,
  })),
}));

vi.mock('@/database/models/space', () => ({
  SpaceModel: vi.fn(() => ({
    findAccessibleSpaceById: mockFindAccessibleSpaceById,
    getOrCreatePersonalSpace: mockGetOrCreatePersonalSpace,
  })),
}));

vi.mock('@/server/services/content', () => ({
  AuthorizedResourceResolver: vi.fn(() => ({
    requireSourceSet: mockRequireSourceSet,
  })),
  ContentAuthorizer: vi.fn(() => ({
    assertCapability: mockAssertCapability,
    filterVisibleSourceSetIdsForList: mockFilterVisibleSourceSetIdsForList,
  })),
}));

describe('sourceSetRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockCreate.mockResolvedValue({ id: 'ss_1' });
    mockEnsureContentRegistry.mockResolvedValue({ contentUid: 'cnt_1' });
    mockEnsureOwnerPermission.mockResolvedValue(undefined);
    mockGetOrCreatePersonalSpace.mockResolvedValue({ id: 'spc_personal' });
    mockFilterVisibleSourceSetIdsForList.mockResolvedValue([]);
    mockFindAccessibleSpaceById.mockResolvedValue(undefined);
    mockQuery.mockResolvedValue([]);
    mockRequireSourceSet.mockResolvedValue({ id: 'ss_1', spaceId: 'spc_shared' });
    mockAssertCapability.mockResolvedValue(undefined);
    mockAddFilesToSourceSetAny.mockResolvedValue([]);
    mockRemoveFilesFromSourceSetAny.mockResolvedValue(undefined);
  });

  it('should reject source set creation when the target space is inaccessible', async () => {
    const caller = sourceSetRouter.createCaller({
      serverDB: {} as any,
      userId: 'user-1',
    } as any);

    await expect(
      caller.createSourceSet({
        name: 'Shared Sources',
        spaceId: 'spc_shared',
      }),
    ).rejects.toThrow(new TRPCError({ code: 'FORBIDDEN', message: 'SPACE_ACCESS_DENIED' }));

    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('should filter listed source sets by readable ACL ids', async () => {
    mockFindAccessibleSpaceById.mockResolvedValue({ id: 'spc_shared', membershipRole: 'viewer' });
    mockQuery.mockResolvedValue([
      { id: 'ss_1', name: 'Visible', spaceId: 'spc_shared' },
      { id: 'ss_2', name: 'Hidden', spaceId: 'spc_shared' },
    ]);
    mockFilterVisibleSourceSetIdsForList.mockResolvedValue(['ss_1']);

    const caller = sourceSetRouter.createCaller({
      serverDB: {} as any,
      userId: 'user-1',
    } as any);

    const result = await caller.getSourceSets({ spaceId: 'spc_shared' });

    expect(result).toEqual([{ id: 'ss_1', name: 'Visible', spaceId: 'spc_shared' }]);
    expect(mockFilterVisibleSourceSetIdsForList).toHaveBeenCalledWith(['ss_1', 'ss_2']);
  });

  it('should authorize each file/document before attaching them to a source set', async () => {
    const caller = sourceSetRouter.createCaller({
      serverDB: {} as any,
      userId: 'user-1',
    } as any);

    await caller.addFilesToSourceSet({
      ids: ['file_1', 'docs_1'],
      sourceSetId: 'ss_1',
    });

    expect(mockAssertCapability).toHaveBeenNthCalledWith(1, {
      capability: 'preview_content',
      id: 'file_1',
      kind: 'file',
    });
    expect(mockAssertCapability).toHaveBeenNthCalledWith(2, {
      capability: 'preview_content',
      id: 'docs_1',
      kind: 'document',
    });
    expect(mockAddFilesToSourceSetAny).toHaveBeenCalledWith('ss_1', ['file_1', 'docs_1']);
  });

  it('should use ACL-authorized mutations for shared source sets', async () => {
    const caller = sourceSetRouter.createCaller({
      serverDB: {} as any,
      userId: 'user-1',
    } as any);

    await caller.updateSourceSet({
      id: 'ss_1',
      value: { description: 'updated' },
    });
    await caller.deleteSourceSet({ id: 'ss_1' });

    expect(mockUpdateAny).toHaveBeenCalledWith('ss_1', { description: 'updated' });
    expect(mockDeleteAny).toHaveBeenCalledWith('ss_1');
  });
});
