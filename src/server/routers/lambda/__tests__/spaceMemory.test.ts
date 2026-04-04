// @vitest-environment node
import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { spaceMemoryRouter } from '@/server/routers/lambda/spaceMemory';

const mockCreateAuditLog = vi.fn();
const mockFindAccessibleSpaceById = vi.fn();
const mockCreateCandidate = vi.fn();
const mockGetSummary = vi.fn();
const mockListEntries = vi.fn();
const mockPublishEntry = vi.fn();

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
    createCandidate: mockCreateCandidate,
    getSummary: mockGetSummary,
    listEntries: mockListEntries,
    publishEntry: mockPublishEntry,
  })),
}));

describe('spaceMemoryRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSummary.mockImplementation(async (input) => ({
      ...input,
      sections: {
        inbox: { count: 0 },
        playbooks: { count: 0 },
        policies: { count: 0 },
        published: { count: 0 },
      },
    }));
    mockListEntries.mockImplementation(async (input) => ({
      items: [],
      section: input.section,
    }));
    mockCreateCandidate.mockImplementation(async (input) => ({
      ...input,
      id: 'mem_candidate',
      status: 'candidate',
    }));
    mockPublishEntry.mockImplementation(async (input) => ({
      id: input.id,
      reviewedBy: input.reviewedBy,
      status: 'published',
    }));
  });

  it('creates a candidate entry for an accessible space', async () => {
    mockFindAccessibleSpaceById.mockResolvedValue({
      id: 'spc_team',
      kind: 'team',
      membershipRole: 'editor',
      name: 'Operations',
    });

    const caller = spaceMemoryRouter.createCaller({
      serverDB: {} as any,
      userId: 'user-1',
    } as any);

    const result = await caller.createCandidate({
      spaceId: 'spc_team',
      title: 'Shipping policy',
    });

    expect(mockCreateCandidate).toHaveBeenCalledWith({
      createdBy: 'user-1',
      spaceId: 'spc_team',
      title: 'Shipping policy',
    });
    expect(mockCreateAuditLog).toHaveBeenCalledWith({
      action: 'space.memory.candidate.create',
      metadata: {
        category: 'general',
        entryId: 'mem_candidate',
        status: 'candidate',
        title: 'Shipping policy',
      },
      spaceId: 'spc_team',
    });
    expect(result).toMatchObject({
      id: 'mem_candidate',
      status: 'candidate',
      title: 'Shipping policy',
    });
  });

  it('passes source refs through when creating a candidate entry', async () => {
    mockFindAccessibleSpaceById.mockResolvedValue({
      id: 'spc_team',
      kind: 'team',
      membershipRole: 'editor',
      name: 'Operations',
    });

    const caller = spaceMemoryRouter.createCaller({
      serverDB: {} as any,
      userId: 'user-1',
    } as any);

    await caller.createCandidate({
      sourceRefs: [
        { id: 'doc_1', kind: 'document', title: 'Runbook' },
        { id: 'sst_1', kind: 'source_set', title: 'Ops' },
      ],
      spaceId: 'spc_team',
      title: 'Shipping policy',
    });

    expect(mockCreateCandidate).toHaveBeenCalledWith({
      createdBy: 'user-1',
      sourceRefs: [
        { id: 'doc_1', kind: 'document', title: 'Runbook' },
        { id: 'sst_1', kind: 'source_set', title: 'Ops' },
      ],
      spaceId: 'spc_team',
      title: 'Shipping policy',
    });
  });

  it('returns reviewer capabilities for team editors', async () => {
    mockFindAccessibleSpaceById.mockResolvedValue({
      id: 'spc_team',
      kind: 'team',
      membershipRole: 'editor',
      name: 'Operations',
    });

    const caller = spaceMemoryRouter.createCaller({
      serverDB: {} as any,
      userId: 'user-1',
    } as any);

    const result = await caller.getSummary({ spaceId: 'spc_team' });

    expect(mockGetSummary).toHaveBeenCalledWith({
      canCreate: true,
      canPublish: true,
      canReview: true,
      id: 'spc_team',
      kind: 'team',
      membershipRole: 'editor',
      name: 'Operations',
    });
    expect(result).toEqual({
      canCreate: true,
      canPublish: true,
      canReview: true,
      id: 'spc_team',
      kind: 'team',
      membershipRole: 'editor',
      name: 'Operations',
      sections: {
        inbox: { count: 0 },
        playbooks: { count: 0 },
        policies: { count: 0 },
        published: { count: 0 },
      },
    });
  });

  it('returns non-reviewer capabilities for personal spaces', async () => {
    mockFindAccessibleSpaceById.mockResolvedValue({
      id: 'spc_personal',
      kind: 'personal',
      membershipRole: 'owner',
      name: 'My Space',
    });

    const caller = spaceMemoryRouter.createCaller({
      serverDB: {} as any,
      userId: 'user-1',
    } as any);

    const result = await caller.getSummary({ spaceId: 'spc_personal' });

    expect(result.canReview).toBe(false);
    expect(result.canCreate).toBe(false);
    expect(result.canPublish).toBe(false);
    expect(result.kind).toBe('personal');
  });

  it('returns a stable empty list contract', async () => {
    mockFindAccessibleSpaceById.mockResolvedValue({
      id: 'spc_team',
      kind: 'team',
      membershipRole: 'viewer',
      name: 'Operations',
    });

    const caller = spaceMemoryRouter.createCaller({
      serverDB: {} as any,
      userId: 'user-1',
    } as any);

    const result = await caller.listEntries({ section: 'published', spaceId: 'spc_team' });

    expect(mockListEntries).toHaveBeenCalledWith({
      section: 'published',
      spaceId: 'spc_team',
    });
    expect(result).toEqual({
      items: [],
      section: 'published',
    });
  });

  it('rejects inbox reads for non-reviewer roles', async () => {
    mockFindAccessibleSpaceById.mockResolvedValue({
      id: 'spc_team',
      kind: 'team',
      membershipRole: 'viewer',
      name: 'Operations',
    });

    const caller = spaceMemoryRouter.createCaller({
      serverDB: {} as any,
      userId: 'user-1',
    } as any);

    await expect(caller.listEntries({ section: 'inbox', spaceId: 'spc_team' })).rejects.toThrow(
      new TRPCError({ code: 'FORBIDDEN', message: 'SPACE_MEMORY_REVIEW_DENIED' }),
    );
  });

  it('throws when the space is inaccessible', async () => {
    mockFindAccessibleSpaceById.mockResolvedValue(undefined);

    const caller = spaceMemoryRouter.createCaller({
      serverDB: {} as any,
      userId: 'user-1',
    } as any);

    await expect(caller.getSummary({ spaceId: 'spc_missing' })).rejects.toThrow(
      new TRPCError({ code: 'NOT_FOUND', message: 'SPACE_NOT_FOUND' }),
    );
  });

  it('publishes entries only for reviewer roles', async () => {
    mockFindAccessibleSpaceById.mockResolvedValue({
      id: 'spc_team',
      kind: 'team',
      membershipRole: 'editor',
      name: 'Operations',
    });

    const caller = spaceMemoryRouter.createCaller({
      serverDB: {} as any,
      userId: 'user-1',
    } as any);

    const result = await caller.publishEntry({ id: 'mem_1', spaceId: 'spc_team' });

    expect(mockPublishEntry).toHaveBeenCalledWith({
      id: 'mem_1',
      reviewedBy: 'user-1',
      spaceId: 'spc_team',
    });
    expect(mockCreateAuditLog).toHaveBeenCalledWith({
      action: 'space.memory.publish',
      metadata: {
        entryId: 'mem_1',
        reviewedBy: 'user-1',
        status: 'published',
      },
      spaceId: 'spc_team',
    });
    expect(result).toEqual({
      id: 'mem_1',
      reviewedBy: 'user-1',
      status: 'published',
    });
  });

  it('rejects candidate creation for non-contributor roles', async () => {
    mockFindAccessibleSpaceById.mockResolvedValue({
      id: 'spc_team',
      kind: 'team',
      membershipRole: 'viewer',
      name: 'Operations',
    });

    const caller = spaceMemoryRouter.createCaller({
      serverDB: {} as any,
      userId: 'user-1',
    } as any);

    await expect(
      caller.createCandidate({
        spaceId: 'spc_team',
        title: 'Shipping policy',
      }),
    ).rejects.toThrow(new TRPCError({ code: 'FORBIDDEN', message: 'SPACE_MEMORY_CREATE_DENIED' }));
  });

  it('rejects publish when the entry does not belong to the current space', async () => {
    mockFindAccessibleSpaceById.mockResolvedValue({
      id: 'spc_team',
      kind: 'team',
      membershipRole: 'editor',
      name: 'Operations',
    });
    mockPublishEntry.mockResolvedValue(undefined);

    const caller = spaceMemoryRouter.createCaller({
      serverDB: {} as any,
      userId: 'user-1',
    } as any);

    await expect(caller.publishEntry({ id: 'mem_1', spaceId: 'spc_team' })).rejects.toThrow(
      new TRPCError({ code: 'NOT_FOUND', message: 'SPACE_MEMORY_ENTRY_NOT_FOUND' }),
    );
  });

  it('rejects publish for non-reviewer roles', async () => {
    mockFindAccessibleSpaceById.mockResolvedValue({
      id: 'spc_team',
      kind: 'team',
      membershipRole: 'viewer',
      name: 'Operations',
    });

    const caller = spaceMemoryRouter.createCaller({
      serverDB: {} as any,
      userId: 'user-1',
    } as any);

    await expect(caller.publishEntry({ id: 'mem_1', spaceId: 'spc_team' })).rejects.toThrow(
      new TRPCError({ code: 'FORBIDDEN', message: 'SPACE_MEMORY_REVIEW_DENIED' }),
    );
  });
});
