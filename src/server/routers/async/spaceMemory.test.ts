// @vitest-environment node
import type { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { spaceMemoryRouter } from './spaceMemory';

const {
  mockCreateAuditLog,
  mockCreateCandidates,
  mockFindAccessibleSpaceById,
  mockGetServerDB,
  mockUserFindById,
  mockValidateInternalJWT,
} = vi.hoisted(() => ({
  mockCreateAuditLog: vi.fn(),
  mockCreateCandidates: vi.fn(),
  mockFindAccessibleSpaceById: vi.fn(),
  mockGetServerDB: vi.fn(),
  mockUserFindById: vi.fn(),
  mockValidateInternalJWT: vi.fn(),
}));

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: mockGetServerDB,
}));

vi.mock('@/libs/trpc/utils/internalJwt', () => ({
  validateInternalJWT: mockValidateInternalJWT,
}));

vi.mock('@/database/models/user', () => ({
  UserModel: {
    findById: mockUserFindById,
  },
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
  })),
}));

describe('async spaceMemoryRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerDB.mockResolvedValue({});
    mockValidateInternalJWT.mockResolvedValue(true);
    mockUserFindById.mockResolvedValue({ id: 'test-user' });
    mockCreateCandidates.mockImplementation(async (entries) =>
      entries.map((entry: any, index: number) => ({
        ...entry,
        id: `mem_${index + 1}`,
        status: 'candidate',
      })),
    );
  });

  it('ingests candidate drafts through the async router', async () => {
    mockFindAccessibleSpaceById.mockResolvedValue({
      id: 'spc_team',
      kind: 'team',
      membershipRole: 'editor',
    });

    const caller = spaceMemoryRouter.createCaller({
      authorizationToken: 'test-token',
      userId: 'test-user',
    } as any);

    const result = await caller.ingestCandidates({
      drafts: [{ title: 'Async candidate' }],
      origin: 'automation',
      producer: 'topic-summary-extractor',
      spaceId: 'spc_team',
      traceId: 'trace-1',
    });

    expect(result).toEqual({ count: 1, success: true });
    expect(mockCreateCandidates).toHaveBeenCalledWith([
      {
        createdBy: 'test-user',
        metadata: {
          intake: {
            origin: 'automation',
            producer: 'topic-summary-extractor',
            traceId: 'trace-1',
          },
        },
        spaceId: 'spc_team',
        title: 'Async candidate',
      },
    ]);
  });

  it('maps forbidden ingestion to TRPC forbidden', async () => {
    mockFindAccessibleSpaceById.mockResolvedValue({
      id: 'spc_team',
      kind: 'team',
      membershipRole: 'viewer',
    });

    const caller = spaceMemoryRouter.createCaller({
      authorizationToken: 'test-token',
      userId: 'test-user',
    } as any);

    await expect(
      caller.ingestCandidates({
        drafts: [{ title: 'Async candidate' }],
        origin: 'automation',
        spaceId: 'spc_team',
      }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    } satisfies Partial<TRPCError>);
  });

  it('ingests harness drafts through the dedicated async contract', async () => {
    mockFindAccessibleSpaceById.mockResolvedValue({
      id: 'spc_team',
      kind: 'team',
      membershipRole: 'editor',
    });

    const caller = spaceMemoryRouter.createCaller({
      authorizationToken: 'test-token',
      userId: 'test-user',
    } as any);

    const result = await caller.ingestHarnessCandidates({
      adapter: 'ops-harness-v1',
      drafts: [
        {
          kind: 'policy',
          recall: {
            reason: 'User asked for approval policy.',
            relevance: 0.91,
          },
          sourceRefs: [
            { objectId: 'doc_1', objectType: 'doc', title: 'Policy doc' },
            { objectId: 'meeting_1', objectType: 'meeting', title: 'Weekly sync' },
          ],
          title: 'Approval policy',
        },
      ],
      producer: 'custom-harness',
      spaceId: 'spc_team',
      traceId: 'trace-2',
    });

    expect(result).toEqual({ count: 1, success: true });
    expect(mockCreateCandidates).toHaveBeenCalledWith([
      {
        category: 'policy',
        createdBy: 'test-user',
        metadata: {
          harness: {
            adapter: 'ops-harness-v1',
            confidence: null,
            contractVersion: 1,
            decision: null,
            kind: 'policy',
            normalizedKey: null,
            proposedOwnerId: null,
            proposedReviewerId: null,
            recall: {
              reason: 'User asked for approval policy.',
              relevance: 0.91,
            },
            scope: null,
            sourceAttribution: [
              { objectId: 'doc_1', objectType: 'doc', title: 'Policy doc' },
              { objectId: 'meeting_1', objectType: 'meeting', title: 'Weekly sync' },
            ],
          },
          intake: {
            origin: 'harness',
            producer: 'custom-harness',
            traceId: 'trace-2',
          },
        },
        sourceRefs: [{ id: 'doc_1', kind: 'document', title: 'Policy doc' }],
        spaceId: 'spc_team',
        title: 'Approval policy',
      },
    ]);
  });
});
