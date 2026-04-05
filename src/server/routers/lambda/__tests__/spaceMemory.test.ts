// @vitest-environment node
import { getSpaceMemorySurfaceContract } from '@lobechat/types';
import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { spaceMemoryRouter } from '@/server/routers/lambda/spaceMemory';

const mockCreateAuditLog = vi.fn();
const mockFindAccessibleSpaceById = vi.fn();
const mockArchiveEntry = vi.fn();
const mockArchiveEntries = vi.fn();
const mockCreateCandidates = vi.fn();
const mockFindExistingTopicSummaryEntry = vi.fn();
const mockGetEntry = vi.fn();
const mockGetEntriesByIds = vi.fn();
const mockGetSummary = vi.fn();
const mockListEntries = vi.fn();
const mockMessageQuery = vi.fn();
const mockMergeCandidateIntoPublishedEntry = vi.fn();
const mockPublishEntry = vi.fn();
const mockPublishEntries = vi.fn();
const mockMarkPublishedEntriesStale = vi.fn();
const mockRevalidatePublishedEntries = vi.fn();
const mockTopicFindById = vi.fn();
const mockUpdatePublishedRecallPolicy = vi.fn();

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
    archiveEntry: mockArchiveEntry,
    archiveEntries: mockArchiveEntries,
    createCandidates: mockCreateCandidates,
    findExistingTopicSummaryEntry: mockFindExistingTopicSummaryEntry,
    getEntry: mockGetEntry,
    getEntriesByIds: mockGetEntriesByIds,
    getSummary: mockGetSummary,
    listEntries: mockListEntries,
    mergeCandidateIntoPublishedEntry: mockMergeCandidateIntoPublishedEntry,
    publishEntry: mockPublishEntry,
    publishEntries: mockPublishEntries,
    markPublishedEntriesStale: mockMarkPublishedEntriesStale,
    revalidatePublishedEntries: mockRevalidatePublishedEntries,
    updatePublishedRecallPolicy: mockUpdatePublishedRecallPolicy,
  })),
}));

vi.mock('@/database/models/topic', () => ({
  TopicModel: vi.fn(() => ({
    findById: mockTopicFindById,
  })),
}));

describe('spaceMemoryRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSummary.mockImplementation(async (input) => ({
      ...input,
      sections: {
        inbox: { count: 0, recall: { active: 0, disabled: 0, expired: 0, stale: 0 } },
        playbooks: { count: 0, recall: { active: 0, disabled: 0, expired: 0, stale: 0 } },
        policies: { count: 0, recall: { active: 0, disabled: 0, expired: 0, stale: 0 } },
        published: { count: 0, recall: { active: 0, disabled: 0, expired: 0, stale: 0 } },
      },
    }));
    mockGetEntry.mockResolvedValue(null);
    mockGetEntriesByIds.mockResolvedValue([]);
    mockListEntries.mockImplementation(async (input) => ({
      items: [],
      section: input.section,
    }));
    mockCreateCandidates.mockImplementation(async (input) =>
      input.map((item: any, index: number) => ({
        ...item,
        id: `mem_candidate_${index + 1}`,
        status: 'candidate',
      })),
    );
    mockArchiveEntry.mockImplementation(async (input) => ({
      id: input.id,
      reviewedBy: input.reviewedBy,
      status: 'archived',
    }));
    mockArchiveEntries.mockImplementation(async (idsInput) =>
      idsInput.ids.map((id: string) => ({
        id,
        reviewedBy: idsInput.reviewedBy,
        status: 'archived',
      })),
    );
    mockFindExistingTopicSummaryEntry.mockResolvedValue(null);
    mockMergeCandidateIntoPublishedEntry.mockImplementation(async (input) => ({
      archivedCandidate: {
        id: input.candidateId,
        reviewedBy: input.reviewedBy,
        status: 'archived',
      },
      updatedTarget: {
        id: input.targetEntryId,
        reviewedBy: input.reviewedBy,
        status: 'published',
      },
    }));
    mockPublishEntry.mockImplementation(async (input) => ({
      id: input.id,
      reviewedBy: input.reviewedBy,
      status: 'published',
    }));
    mockPublishEntries.mockImplementation(async (idsInput) =>
      idsInput.ids.map((id: string) => ({
        id,
        reviewedBy: idsInput.reviewedBy,
        status: 'published',
      })),
    );
    mockMarkPublishedEntriesStale.mockImplementation(async (idsInput) =>
      idsInput.ids.map((id: string) => ({
        id,
        reviewedBy: idsInput.reviewedBy,
        status: 'stale',
      })),
    );
    mockRevalidatePublishedEntries.mockImplementation(async (idsInput) =>
      idsInput.ids.map((id: string) => ({
        id,
        reviewedBy: idsInput.reviewedBy,
        status: 'revalidated',
      })),
    );
    mockUpdatePublishedRecallPolicy.mockImplementation(async (input) => ({
      expiresAt: input.expiresAt,
      id: input.id,
      lastVerifiedAt: input.lastVerifiedAt,
      recallEnabled: input.recallEnabled,
      staleAt: input.staleAt,
      reviewedBy: input.reviewedBy,
      status: 'published',
    }));
    mockMessageQuery.mockResolvedValue([]);
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

    expect(mockCreateCandidates).toHaveBeenCalledWith([
      {
        createdBy: 'user-1',
        metadata: {
          intake: {
            origin: 'manual',
            producer: undefined,
            traceId: undefined,
          },
        },
        spaceId: 'spc_team',
        title: 'Shipping policy',
      },
    ]);
    expect(mockCreateAuditLog).toHaveBeenCalledWith({
      action: 'space.memory.candidate.create',
      metadata: {
        category: 'general',
        entryId: 'mem_candidate_1',
        intakeOrigin: 'manual',
        status: 'candidate',
        title: 'Shipping policy',
      },
      spaceId: 'spc_team',
    });
    expect(result).toMatchObject({
      id: 'mem_candidate_1',
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

    expect(mockCreateCandidates).toHaveBeenCalledWith([
      {
        createdBy: 'user-1',
        metadata: {
          intake: {
            origin: 'manual',
            producer: undefined,
            traceId: undefined,
          },
        },
        sourceRefs: [
          { id: 'doc_1', kind: 'document', title: 'Runbook' },
          { id: 'sst_1', kind: 'source_set', title: 'Ops' },
        ],
        spaceId: 'spc_team',
        title: 'Shipping policy',
      },
    ]);
  });

  it('supports batched candidate ingestion for automation producers', async () => {
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

    const result = await caller.ingestCandidates({
      drafts: [
        { title: 'Policy draft' },
        { category: 'playbook', summary: 'Summarized', title: 'Runbook draft' },
      ],
      origin: 'automation',
      producer: 'memory-harness',
      spaceId: 'spc_team',
      traceId: 'trace-1',
    });

    expect(mockCreateCandidates).toHaveBeenCalledWith([
      {
        createdBy: 'user-1',
        metadata: {
          intake: {
            origin: 'automation',
            producer: 'memory-harness',
            traceId: 'trace-1',
          },
        },
        spaceId: 'spc_team',
        title: 'Policy draft',
      },
      {
        category: 'playbook',
        createdBy: 'user-1',
        metadata: {
          intake: {
            origin: 'automation',
            producer: 'memory-harness',
            traceId: 'trace-1',
          },
        },
        spaceId: 'spc_team',
        summary: 'Summarized',
        title: 'Runbook draft',
      },
    ]);
    expect(mockCreateAuditLog).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: 'mem_candidate_1', title: 'Policy draft' });
    expect(result[1]).toMatchObject({ id: 'mem_candidate_2', title: 'Runbook draft' });
  });

  it('creates an automation candidate from a scoped topic', async () => {
    mockTopicFindById.mockResolvedValue({
      historySummary: 'The team aligned on a Friday deployment checklist.',
      id: 'topic_1',
      spaceId: 'spc_team',
      title: 'Friday rollout',
    });
    mockFindAccessibleSpaceById.mockResolvedValue({
      id: 'spc_team',
      kind: 'team',
      membershipRole: 'editor',
      name: 'Operations',
    });
    mockMessageQuery.mockResolvedValue([
      { content: 'We should verify smoke tests before deploy.', id: 'msg_1', role: 'user' },
      { content: 'Add rollback owner confirmation.', id: 'msg_2', role: 'assistant' },
    ]);

    const caller = spaceMemoryRouter.createCaller({
      serverDB: {} as any,
      userId: 'user-1',
    } as any);

    const result = await caller.ingestTopicCandidate({
      topicId: 'topic_1',
    });

    expect(mockCreateCandidates).toHaveBeenCalledWith([
      expect.objectContaining({
        createdBy: 'user-1',
        metadata: {
          intake: {
            origin: 'automation',
            producer: 'topic-summary-extractor',
            traceId: 'topic:topic_1',
          },
        },
        spaceId: 'spc_team',
        summary: 'The team aligned on a Friday deployment checklist.',
        title: 'Friday rollout',
      }),
    ]);
    expect(result).toMatchObject({
      id: 'mem_candidate_1',
      status: 'candidate',
      title: 'Friday rollout',
    });
  });

  it('rejects topic ingestion when the topic is not space-scoped', async () => {
    mockTopicFindById.mockResolvedValue({
      historySummary: 'Personal chat summary',
      id: 'topic_personal',
      spaceId: null,
      title: 'Personal topic',
    });

    const caller = spaceMemoryRouter.createCaller({
      serverDB: {} as any,
      userId: 'user-1',
    } as any);

    await expect(caller.ingestTopicCandidate({ topicId: 'topic_personal' })).rejects.toThrow(
      new TRPCError({ code: 'PRECONDITION_FAILED', message: 'SPACE_MEMORY_TOPIC_NOT_SCOPED' }),
    );
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
      contract: getSpaceMemorySurfaceContract('reviewer'),
      id: 'spc_team',
      kind: 'team',
      membershipRole: 'editor',
      name: 'Operations',
      surface: 'reviewer',
    });
    expect(result).toEqual({
      canCreate: true,
      canPublish: true,
      canReview: true,
      contract: getSpaceMemorySurfaceContract('reviewer'),
      id: 'spc_team',
      kind: 'team',
      membershipRole: 'editor',
      name: 'Operations',
      surface: 'reviewer',
      sections: {
        inbox: { count: 0, recall: { active: 0, disabled: 0, expired: 0, stale: 0 } },
        playbooks: { count: 0, recall: { active: 0, disabled: 0, expired: 0, stale: 0 } },
        policies: { count: 0, recall: { active: 0, disabled: 0, expired: 0, stale: 0 } },
        published: { count: 0, recall: { active: 0, disabled: 0, expired: 0, stale: 0 } },
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
    expect(result.surface).toBe('personal');
    expect(result.contract).toEqual(getSpaceMemorySurfaceContract('personal'));
  });

  it('strips recall breakdown from summary payloads for non-reviewer roles', async () => {
    mockFindAccessibleSpaceById.mockResolvedValue({
      id: 'spc_team',
      kind: 'team',
      membershipRole: 'viewer',
      name: 'Operations',
    });
    mockGetSummary.mockResolvedValue({
      canCreate: false,
      canPublish: false,
      canReview: false,
      id: 'spc_team',
      kind: 'team',
      membershipRole: 'viewer',
      name: 'Operations',
      surface: 'viewer',
      sections: {
        inbox: { count: 0, recall: { active: 0, disabled: 0, expired: 0, stale: 0 } },
        playbooks: { count: 2, recall: { active: 1, disabled: 0, expired: 0, stale: 1 } },
        policies: { count: 1, recall: { active: 0, disabled: 1, expired: 0, stale: 0 } },
        published: { count: 3, recall: { active: 2, disabled: 0, expired: 1, stale: 0 } },
      },
    });

    const caller = spaceMemoryRouter.createCaller({
      serverDB: {} as any,
      userId: 'user-1',
    } as any);

    const result = await caller.getSummary({ spaceId: 'spc_team' });

    expect(result.sections.playbooks.recall).toEqual({
      active: 0,
      disabled: 0,
      expired: 0,
      stale: 0,
    });
    expect(result.sections.published.recall).toEqual({
      active: 0,
      disabled: 0,
      expired: 0,
      stale: 0,
    });
    expect(result.contract).toEqual(getSpaceMemorySurfaceContract('viewer'));
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
      contract: getSpaceMemorySurfaceContract('viewer'),
      items: [],
      section: 'published',
      surface: 'viewer',
    });
  });

  it('returns an entry detail for an accessible space', async () => {
    mockFindAccessibleSpaceById.mockResolvedValue({
      id: 'spc_team',
      kind: 'team',
      membershipRole: 'viewer',
      name: 'Operations',
    });
    mockGetEntry.mockResolvedValue({
      category: 'general',
      id: 'mem_published',
      kind: 'memory',
      sourceCount: 0,
      sourceRefs: [],
      title: 'Release checklist',
      updatedAt: '2026-04-04T10:00:00.000Z',
    });

    const caller = spaceMemoryRouter.createCaller({
      serverDB: {} as any,
      userId: 'user-1',
    } as any);

    const result = await caller.getEntry({ id: 'mem_published', spaceId: 'spc_team' });

    expect(mockGetEntry).toHaveBeenCalledWith({
      id: 'mem_published',
      spaceId: 'spc_team',
    });
    expect(result).toMatchObject({
      contract: getSpaceMemorySurfaceContract('viewer'),
      entry: {
        id: 'mem_published',
        kind: 'memory',
        title: 'Release checklist',
      },
      surface: 'viewer',
    });
  });

  it('strips governance fields from published entry detail for non-reviewer roles', async () => {
    mockFindAccessibleSpaceById.mockResolvedValue({
      id: 'spc_team',
      kind: 'team',
      membershipRole: 'viewer',
      name: 'Operations',
    });
    mockGetEntry.mockResolvedValue({
      actor: { id: 'user-2', name: 'Reviewer' },
      category: 'general',
      history: [{ action: 'published', at: '2026-04-04T09:00:00.000Z' }],
      id: 'mem_published',
      intake: { origin: 'manual', producer: 'reviewer', traceId: 'trace-1' },
      kind: 'memory',
      recall: {
        lastVerifiedAt: '2026-04-04T10:00:00.000Z',
        recallBlockedReason: 'stale',
        recallEnabled: true,
      },
      sourceCount: 0,
      sourceRefs: [],
      title: 'Release checklist',
      updatedAt: '2026-04-04T10:00:00.000Z',
    });

    const caller = spaceMemoryRouter.createCaller({
      serverDB: {} as any,
      userId: 'user-1',
    } as any);

    const result = await caller.getEntry({ id: 'mem_published', spaceId: 'spc_team' });

    expect(result.surface).toBe('viewer');
    expect(result.entry.actor).toBeUndefined();
    expect(result.entry.history).toBeUndefined();
    expect(result.entry.intake).toBeUndefined();
    expect(result.entry.recall).toBeUndefined();
  });

  it('exports a server-side audit bundle for published memories', async () => {
    mockFindAccessibleSpaceById.mockResolvedValue({
      id: 'spc_team',
      kind: 'team',
      membershipRole: 'editor',
      name: 'Operations',
    });
    mockGetEntry.mockResolvedValue({
      category: 'general',
      history: [{ action: 'published', at: '2026-04-04T09:00:00.000Z' }],
      id: 'mem_published',
      kind: 'memory',
      sourceCount: 0,
      sourceRefs: [],
      title: 'Release checklist',
      updatedAt: '2026-04-04T10:00:00.000Z',
    });

    const caller = spaceMemoryRouter.createCaller({
      serverDB: {} as any,
      userId: 'user-1',
    } as any);

    const result = await caller.exportAuditBundle({
      id: 'mem_published',
      spaceId: 'spc_team',
    });

    expect(mockGetEntry).toHaveBeenCalledWith({
      id: 'mem_published',
      spaceId: 'spc_team',
    });
    expect(result).toMatchObject({
      auditPath: '/spaces/spc_team/memory/audit/mem_published?section=published',
      detailView: 'audit',
      entry: expect.objectContaining({
        id: 'mem_published',
        title: 'Release checklist',
      }),
      recallFilter: 'all',
      section: 'published',
      space: {
        id: 'spc_team',
        kind: 'team',
        membershipRole: 'editor',
        name: 'Operations',
      },
    });
    expect(result.exportedAt).toEqual(expect.any(String));
  });

  it('keeps stale recall filters in the exported audit bundle path', async () => {
    mockFindAccessibleSpaceById.mockResolvedValue({
      id: 'spc_team',
      kind: 'team',
      membershipRole: 'editor',
      name: 'Operations',
    });
    mockGetEntry.mockResolvedValue({
      category: 'policy',
      id: 'mem_policy',
      kind: 'memory',
      sourceCount: 0,
      sourceRefs: [],
      title: 'Security policy',
      updatedAt: '2026-04-04T10:00:00.000Z',
    });

    const caller = spaceMemoryRouter.createCaller({
      serverDB: {} as any,
      userId: 'user-1',
    } as any);

    const result = await caller.exportAuditBundle({
      id: 'mem_policy',
      recallFilter: 'stale',
      spaceId: 'spc_team',
    });

    expect(result.auditPath).toBe(
      '/spaces/spc_team/memory/audit/mem_policy?section=policies&recallFilter=stale',
    );
    expect(result.recallFilter).toBe('stale');
    expect(result.section).toBe('policies');
  });

  it('keeps disabled recall filters in the exported audit bundle path', async () => {
    mockFindAccessibleSpaceById.mockResolvedValue({
      id: 'spc_team',
      kind: 'team',
      membershipRole: 'editor',
      name: 'Operations',
    });
    mockGetEntry.mockResolvedValue({
      category: 'general',
      id: 'mem_paused',
      kind: 'memory',
      sourceCount: 0,
      sourceRefs: [],
      title: 'Paused memory',
      updatedAt: '2026-04-04T10:00:00.000Z',
    });

    const caller = spaceMemoryRouter.createCaller({
      serverDB: {} as any,
      userId: 'user-1',
    } as any);

    const result = await caller.exportAuditBundle({
      id: 'mem_paused',
      recallFilter: 'disabled',
      spaceId: 'spc_team',
    });

    expect(result.auditPath).toBe(
      '/spaces/spc_team/memory/audit/mem_paused?section=published&recallFilter=disabled',
    );
    expect(result.recallFilter).toBe('disabled');
    expect(result.section).toBe('published');
  });

  it('keeps active recall filters in the exported audit bundle path', async () => {
    mockFindAccessibleSpaceById.mockResolvedValue({
      id: 'spc_team',
      kind: 'team',
      membershipRole: 'editor',
      name: 'Operations',
    });
    mockGetEntry.mockResolvedValue({
      category: 'general',
      id: 'mem_active',
      kind: 'memory',
      sourceCount: 0,
      sourceRefs: [],
      title: 'Active memory',
      updatedAt: '2026-04-04T10:00:00.000Z',
    });

    const caller = spaceMemoryRouter.createCaller({
      serverDB: {} as any,
      userId: 'user-1',
    } as any);

    const result = await caller.exportAuditBundle({
      id: 'mem_active',
      recallFilter: 'active',
      spaceId: 'spc_team',
    });

    expect(result.auditPath).toBe(
      '/spaces/spc_team/memory/audit/mem_active?section=published&recallFilter=active',
    );
    expect(result.recallFilter).toBe('active');
    expect(result.section).toBe('published');
  });

  it('exports a server-side batched audit bundle for selected memories', async () => {
    mockFindAccessibleSpaceById.mockResolvedValue({
      id: 'spc_team',
      kind: 'team',
      membershipRole: 'editor',
      name: 'Operations',
    });
    mockGetEntriesByIds.mockResolvedValue([
      {
        category: 'general',
        id: 'mem_one',
        kind: 'memory',
        sourceCount: 0,
        sourceRefs: [],
        title: 'Release checklist',
        updatedAt: '2026-04-04T10:00:00.000Z',
      },
      {
        category: 'playbook',
        id: 'mem_two',
        kind: 'memory',
        sourceCount: 0,
        sourceRefs: [],
        title: 'Incident playbook',
        updatedAt: '2026-04-04T10:05:00.000Z',
      },
    ]);

    const caller = spaceMemoryRouter.createCaller({
      serverDB: {} as any,
      userId: 'user-1',
    } as any);

    const result = await caller.exportAuditBundles({
      ids: ['mem_one', 'mem_two'],
      spaceId: 'spc_team',
    });

    expect(mockGetEntriesByIds).toHaveBeenCalledWith({
      ids: ['mem_one', 'mem_two'],
      spaceId: 'spc_team',
    });
    expect(result.count).toBe(2);
    expect(result.recallFilter).toBe('all');
    expect(result.items).toMatchObject([
      {
        auditPath: '/spaces/spc_team/memory/audit/mem_one?section=published',
        entry: { id: 'mem_one' },
        section: 'published',
      },
      {
        auditPath: '/spaces/spc_team/memory/audit/mem_two?section=playbooks',
        entry: { id: 'mem_two' },
        section: 'playbooks',
      },
    ]);
    expect(result.exportedAt).toEqual(expect.any(String));
    expect(result.items[0]?.exportedAt).toBe(result.exportedAt);
    expect(result.items[1]?.exportedAt).toBe(result.exportedAt);
  });

  it('rejects audit export for published entries when the member cannot review', async () => {
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
      caller.exportAuditBundle({ id: 'mem_published', spaceId: 'spc_team' }),
    ).rejects.toThrow(
      new TRPCError({ code: 'FORBIDDEN', message: 'SPACE_MEMORY_REVIEW_DENIED' }),
    );
  });

  it('rejects batched audit export when the member cannot review', async () => {
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
      caller.exportAuditBundles({ ids: ['mem_one'], spaceId: 'spc_team' }),
    ).rejects.toThrow(
      new TRPCError({ code: 'FORBIDDEN', message: 'SPACE_MEMORY_REVIEW_DENIED' }),
    );
  });

  it('strips governance fields from published list entries for non-reviewer roles', async () => {
    mockFindAccessibleSpaceById.mockResolvedValue({
      id: 'spc_team',
      kind: 'team',
      membershipRole: 'viewer',
      name: 'Operations',
    });
    mockListEntries.mockResolvedValue({
      items: [
        {
          actor: { id: 'user-2', name: 'Reviewer' },
          category: 'general',
          history: [{ action: 'published', at: '2026-04-04T09:00:00.000Z' }],
          id: 'mem_1',
          intake: { origin: 'manual', producer: 'reviewer', traceId: 'trace-1' },
          kind: 'memory',
          recall: {
            lastVerifiedAt: '2026-04-04T10:00:00.000Z',
            recallBlockedReason: 'disabled',
            recallEnabled: false,
          },
          sourceCount: 0,
          sourceRefs: [],
          title: 'Older rollback owner confirmation',
          updatedAt: '2026-04-04T09:00:00.000Z',
        },
        {
          actor: { id: 'user-2', name: 'Reviewer' },
          category: 'general',
          history: [{ action: 'policy_updated', at: '2026-04-05T11:00:00.000Z' }],
          id: 'mem_2',
          intake: { origin: 'manual', producer: 'reviewer', traceId: 'trace-2' },
          kind: 'memory',
          publishedAt: '2026-04-05T12:00:00.000Z',
          recall: {
            lastVerifiedAt: '2026-04-05T12:00:00.000Z',
            recallBlockedReason: 'stale',
            recallEnabled: true,
            staleAt: '2026-04-05T12:00:00.000Z',
          },
          sourceCount: 0,
          sourceRefs: [],
          title: 'Rollback owner confirmation',
          updatedAt: '2026-04-05T12:00:00.000Z',
        },
      ],
      section: 'published',
    });

    const caller = spaceMemoryRouter.createCaller({
      serverDB: {} as any,
      userId: 'user-1',
    } as any);

    const result = await caller.listEntries({ section: 'published', spaceId: 'spc_team' });

    expect(result.items.map((item) => item.id)).toEqual(['mem_2', 'mem_1']);
    expect(result.items[0]).toMatchObject({
      id: 'mem_2',
      kind: 'memory',
      title: 'Rollback owner confirmation',
    });
    expect(result.items[0]?.actor).toBeUndefined();
    expect(result.items[0]?.history).toBeUndefined();
    expect(result.items[0]?.intake).toBeUndefined();
    expect(result.items[0]?.recall).toBeUndefined();
    expect(result.items[1]?.actor).toBeUndefined();
    expect(result.items[1]?.history).toBeUndefined();
    expect(result.items[1]?.intake).toBeUndefined();
    expect(result.items[1]?.recall).toBeUndefined();
  });

  it('passes review hints through for inbox entries', async () => {
    mockFindAccessibleSpaceById.mockResolvedValue({
      id: 'spc_team',
      kind: 'team',
      membershipRole: 'editor',
      name: 'Operations',
    });
    mockListEntries.mockResolvedValue({
      items: [
        {
          category: 'general',
          id: 'mem_1',
          kind: 'candidate',
          reviewHint: {
            kind: 'duplicate_published',
            match: {
              id: 'mem_published',
              publishedAt: '2026-04-04T10:00:00.000Z',
              title: 'Release checklist',
            },
          },
          sourceCount: 0,
          sourceRefs: [],
          title: 'Rollback owner confirmation',
          updatedAt: '2026-04-04T09:00:00.000Z',
        },
      ],
      section: 'inbox',
    });

    const caller = spaceMemoryRouter.createCaller({
      serverDB: {} as any,
      userId: 'user-1',
    } as any);

    const result = await caller.listEntries({ section: 'inbox', spaceId: 'spc_team' });

    expect(result.items[0]?.reviewHint).toEqual({
      kind: 'duplicate_published',
      match: {
        id: 'mem_published',
        publishedAt: '2026-04-04T10:00:00.000Z',
        title: 'Release checklist',
      },
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

  it('rejects candidate detail reads for non-reviewer roles', async () => {
    mockFindAccessibleSpaceById.mockResolvedValue({
      id: 'spc_team',
      kind: 'team',
      membershipRole: 'viewer',
      name: 'Operations',
    });
    mockGetEntry.mockResolvedValue({
      category: 'general',
      id: 'mem_candidate',
      kind: 'candidate',
      sourceCount: 0,
      sourceRefs: [],
      title: 'Draft memory',
      updatedAt: '2026-04-04T10:00:00.000Z',
    });

    const caller = spaceMemoryRouter.createCaller({
      serverDB: {} as any,
      userId: 'user-1',
    } as any);

    await expect(caller.getEntry({ id: 'mem_candidate', spaceId: 'spc_team' })).rejects.toThrow(
      new TRPCError({ code: 'FORBIDDEN', message: 'SPACE_MEMORY_REVIEW_DENIED' }),
    );
  });

  it('rejects audit export for candidate entries', async () => {
    mockFindAccessibleSpaceById.mockResolvedValue({
      id: 'spc_team',
      kind: 'team',
      membershipRole: 'editor',
      name: 'Operations',
    });
    mockGetEntry.mockResolvedValue({
      category: 'general',
      id: 'mem_candidate',
      kind: 'candidate',
      sourceCount: 0,
      sourceRefs: [],
      title: 'Draft memory',
      updatedAt: '2026-04-04T10:00:00.000Z',
    });

    const caller = spaceMemoryRouter.createCaller({
      serverDB: {} as any,
      userId: 'user-1',
    } as any);

    await expect(
      caller.exportAuditBundle({ id: 'mem_candidate', spaceId: 'spc_team' }),
    ).rejects.toThrow(
      new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'SPACE_MEMORY_AUDIT_EXPORT_UNAVAILABLE',
      }),
    );
  });

  it('rejects batched audit export when one selected entry is not exportable', async () => {
    mockFindAccessibleSpaceById.mockResolvedValue({
      id: 'spc_team',
      kind: 'team',
      membershipRole: 'editor',
      name: 'Operations',
    });
    mockGetEntriesByIds.mockResolvedValue([
      {
        category: 'general',
        id: 'mem_published',
        kind: 'memory',
        sourceCount: 0,
        sourceRefs: [],
        title: 'Published memory',
        updatedAt: '2026-04-04T10:00:00.000Z',
      },
      {
        category: 'general',
        id: 'mem_candidate',
        kind: 'candidate',
        sourceCount: 0,
        sourceRefs: [],
        title: 'Draft memory',
        updatedAt: '2026-04-04T10:00:00.000Z',
      },
    ]);

    const caller = spaceMemoryRouter.createCaller({
      serverDB: {} as any,
      userId: 'user-1',
    } as any);

    await expect(
      caller.exportAuditBundles({
        ids: ['mem_published', 'mem_candidate'],
        spaceId: 'spc_team',
      }),
    ).rejects.toThrow(
      new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'SPACE_MEMORY_AUDIT_EXPORT_UNAVAILABLE',
      }),
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

  it('rejects entries only for reviewer roles', async () => {
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

    const result = await caller.rejectEntry({ id: 'mem_1', spaceId: 'spc_team' });

    expect(mockArchiveEntry).toHaveBeenCalledWith({
      id: 'mem_1',
      reviewedBy: 'user-1',
      spaceId: 'spc_team',
    });
    expect(mockCreateAuditLog).toHaveBeenCalledWith({
      action: 'space.memory.reject',
      metadata: {
        entryId: 'mem_1',
        reviewedBy: 'user-1',
        status: 'archived',
      },
      spaceId: 'spc_team',
    });
    expect(result).toEqual({
      id: 'mem_1',
      reviewedBy: 'user-1',
      status: 'archived',
    });
  });

  it('publishes entries in batch for reviewer roles', async () => {
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

    const result = await caller.publishEntries({
      ids: ['mem_1', 'mem_2'],
      spaceId: 'spc_team',
    });

    expect(mockPublishEntries).toHaveBeenCalledWith({
      ids: ['mem_1', 'mem_2'],
      reviewedBy: 'user-1',
      spaceId: 'spc_team',
    });
    expect(mockCreateAuditLog).toHaveBeenCalledWith({
      action: 'space.memory.publish.batch',
      metadata: {
        count: 2,
        entryIds: ['mem_1', 'mem_2'],
        failures: [],
        reviewedBy: 'user-1',
        status: 'published',
      },
      spaceId: 'spc_team',
    });
    expect(result).toEqual([
      { id: 'mem_1', reviewedBy: 'user-1', status: 'published' },
      { id: 'mem_2', reviewedBy: 'user-1', status: 'published' },
    ]);
  });

  it('revalidates published entries in batch for reviewer roles', async () => {
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

    const result = await caller.revalidateEntries({
      ids: ['mem_1', 'mem_2'],
      spaceId: 'spc_team',
    });

    expect(mockRevalidatePublishedEntries).toHaveBeenCalledWith({
      ids: ['mem_1', 'mem_2'],
      reviewedBy: 'user-1',
      spaceId: 'spc_team',
    });
    expect(mockCreateAuditLog).toHaveBeenCalledWith({
      action: 'space.memory.revalidate.batch',
      metadata: {
        count: 2,
        entryIds: ['mem_1', 'mem_2'],
        failures: [],
        reviewedBy: 'user-1',
        status: 'revalidated',
      },
      spaceId: 'spc_team',
    });
    expect(result).toEqual([
      { id: 'mem_1', reviewedBy: 'user-1', status: 'revalidated' },
      { id: 'mem_2', reviewedBy: 'user-1', status: 'revalidated' },
    ]);
  });

  it('marks published entries stale in batch for reviewer roles', async () => {
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

    const result = await caller.markEntriesStale({
      ids: ['mem_1', 'mem_2'],
      spaceId: 'spc_team',
    });

    expect(mockMarkPublishedEntriesStale).toHaveBeenCalledWith({
      ids: ['mem_1', 'mem_2'],
      reviewedBy: 'user-1',
      spaceId: 'spc_team',
    });
    expect(mockCreateAuditLog).toHaveBeenCalledWith({
      action: 'space.memory.stale.batch',
      metadata: {
        count: 2,
        entryIds: ['mem_1', 'mem_2'],
        failures: [],
        reviewedBy: 'user-1',
        status: 'stale',
      },
      spaceId: 'spc_team',
    });
    expect(result).toEqual([
      { id: 'mem_1', reviewedBy: 'user-1', status: 'stale' },
      { id: 'mem_2', reviewedBy: 'user-1', status: 'stale' },
    ]);
  });

  it('merges a candidate into a published entry for reviewer roles', async () => {
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

    const result = await caller.mergeEntry({
      candidateId: 'mem_candidate',
      merge: {
        appendSources: true,
        applyContent: false,
        applySummary: true,
        applyTitle: false,
      },
      spaceId: 'spc_team',
      targetEntryId: 'mem_published',
    });

    expect(mockMergeCandidateIntoPublishedEntry).toHaveBeenCalledWith({
      candidateId: 'mem_candidate',
      merge: {
        appendSources: true,
        applyContent: false,
        applySummary: true,
        applyTitle: false,
      },
      reviewedBy: 'user-1',
      spaceId: 'spc_team',
      targetEntryId: 'mem_published',
    });
    expect(mockCreateAuditLog).toHaveBeenCalledWith({
      action: 'space.memory.merge',
      metadata: {
        candidateId: 'mem_candidate',
        merge: {
          appendSources: true,
          applyContent: false,
          applySummary: true,
          applyTitle: false,
        },
        reviewedBy: 'user-1',
        targetEntryId: 'mem_published',
      },
      spaceId: 'spc_team',
    });
    expect(result).toEqual({
      archivedCandidate: {
        id: 'mem_candidate',
        reviewedBy: 'user-1',
        status: 'archived',
      },
      updatedTarget: {
        id: 'mem_published',
        reviewedBy: 'user-1',
        status: 'published',
      },
    });
  });

  it('rejects entries in batch for reviewer roles', async () => {
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

    const result = await caller.rejectEntries({
      ids: ['mem_1', 'mem_2'],
      spaceId: 'spc_team',
    });

    expect(mockArchiveEntries).toHaveBeenCalledWith({
      ids: ['mem_1', 'mem_2'],
      reviewedBy: 'user-1',
      spaceId: 'spc_team',
    });
    expect(mockCreateAuditLog).toHaveBeenCalledWith({
      action: 'space.memory.reject.batch',
      metadata: {
        count: 2,
        entryIds: ['mem_1', 'mem_2'],
        failures: [],
        reviewedBy: 'user-1',
        status: 'archived',
      },
      spaceId: 'spc_team',
    });
    expect(result).toEqual([
      { id: 'mem_1', reviewedBy: 'user-1', status: 'archived' },
      { id: 'mem_2', reviewedBy: 'user-1', status: 'archived' },
    ]);
  });

  it('records skipped batch publish outcomes and failure reasons', async () => {
    mockFindAccessibleSpaceById.mockResolvedValue({
      id: 'spc_team',
      kind: 'team',
      membershipRole: 'editor',
      name: 'Operations',
    });
    mockPublishEntries.mockResolvedValue([
      { id: 'mem_1', reviewedBy: 'user-1', status: 'published' },
      { id: 'mem_2', reason: 'already_reviewed', status: 'skipped' },
      { id: 'mem_3', reason: 'not_found', status: 'skipped' },
    ]);

    const caller = spaceMemoryRouter.createCaller({
      serverDB: {} as any,
      userId: 'user-1',
    } as any);

    const result = await caller.publishEntries({
      ids: ['mem_1', 'mem_2', 'mem_3'],
      spaceId: 'spc_team',
    });

    expect(mockCreateAuditLog).toHaveBeenCalledWith({
      action: 'space.memory.publish.batch',
      metadata: {
        count: 1,
        entryIds: ['mem_1'],
        failures: [
          { id: 'mem_2', reason: 'already_reviewed' },
          { id: 'mem_3', reason: 'not_found' },
        ],
        reviewedBy: 'user-1',
        status: 'published',
      },
      spaceId: 'spc_team',
    });
    expect(result).toEqual([
      { id: 'mem_1', reviewedBy: 'user-1', status: 'published' },
      { id: 'mem_2', reason: 'already_reviewed', status: 'skipped' },
      { id: 'mem_3', reason: 'not_found', status: 'skipped' },
    ]);
  });

  it('records skipped batch revalidate outcomes and failure reasons', async () => {
    mockFindAccessibleSpaceById.mockResolvedValue({
      id: 'spc_team',
      kind: 'team',
      membershipRole: 'editor',
      name: 'Operations',
    });
    mockRevalidatePublishedEntries.mockResolvedValue([
      { id: 'mem_1', reviewedBy: 'user-1', status: 'revalidated' },
      { id: 'mem_2', reason: 'not_published', status: 'skipped' },
      { id: 'mem_3', reason: 'not_found', status: 'skipped' },
    ]);

    const caller = spaceMemoryRouter.createCaller({
      serverDB: {} as any,
      userId: 'user-1',
    } as any);

    const result = await caller.revalidateEntries({
      ids: ['mem_1', 'mem_2', 'mem_3'],
      spaceId: 'spc_team',
    });

    expect(mockCreateAuditLog).toHaveBeenCalledWith({
      action: 'space.memory.revalidate.batch',
      metadata: {
        count: 1,
        entryIds: ['mem_1'],
        failures: [
          { id: 'mem_2', reason: 'not_published' },
          { id: 'mem_3', reason: 'not_found' },
        ],
        reviewedBy: 'user-1',
        status: 'revalidated',
      },
      spaceId: 'spc_team',
    });
    expect(result).toEqual([
      { id: 'mem_1', reviewedBy: 'user-1', status: 'revalidated' },
      { id: 'mem_2', reason: 'not_published', status: 'skipped' },
      { id: 'mem_3', reason: 'not_found', status: 'skipped' },
    ]);
  });

  it('records skipped batch mark stale outcomes and failure reasons', async () => {
    mockFindAccessibleSpaceById.mockResolvedValue({
      id: 'spc_team',
      kind: 'team',
      membershipRole: 'editor',
      name: 'Operations',
    });
    mockMarkPublishedEntriesStale.mockResolvedValue([
      { id: 'mem_1', reviewedBy: 'user-1', status: 'stale' },
      { id: 'mem_2', reason: 'already_stale', status: 'skipped' },
      { id: 'mem_3', reason: 'not_found', status: 'skipped' },
    ]);

    const caller = spaceMemoryRouter.createCaller({
      serverDB: {} as any,
      userId: 'user-1',
    } as any);

    const result = await caller.markEntriesStale({
      ids: ['mem_1', 'mem_2', 'mem_3'],
      spaceId: 'spc_team',
    });

    expect(mockCreateAuditLog).toHaveBeenCalledWith({
      action: 'space.memory.stale.batch',
      metadata: {
        count: 1,
        entryIds: ['mem_1'],
        failures: [
          { id: 'mem_2', reason: 'already_stale' },
          { id: 'mem_3', reason: 'not_found' },
        ],
        reviewedBy: 'user-1',
        status: 'stale',
      },
      spaceId: 'spc_team',
    });
    expect(result).toEqual([
      { id: 'mem_1', reviewedBy: 'user-1', status: 'stale' },
      { id: 'mem_2', reason: 'already_stale', status: 'skipped' },
      { id: 'mem_3', reason: 'not_found', status: 'skipped' },
    ]);
  });

  it('updates published recall policy for reviewer roles', async () => {
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

    const result = await caller.updateRecallPolicy({
      expiresAt: '2026-04-10T12:30:00.000Z',
      id: 'mem_published',
      lastVerifiedAt: '2026-04-04T12:00:00.000Z',
      recallEnabled: false,
      staleAt: '2026-04-05T09:00:00.000Z',
      spaceId: 'spc_team',
    });

    expect(mockUpdatePublishedRecallPolicy).toHaveBeenCalledWith({
      expiresAt: '2026-04-10T12:30:00.000Z',
      id: 'mem_published',
      lastVerifiedAt: '2026-04-04T12:00:00.000Z',
      recallEnabled: false,
      staleAt: '2026-04-05T09:00:00.000Z',
      reviewedBy: 'user-1',
      spaceId: 'spc_team',
    });
    expect(mockCreateAuditLog).toHaveBeenCalledWith({
      action: 'space.memory.recall_policy.update',
      metadata: {
        entryId: 'mem_published',
        expiresAt: '2026-04-10T12:30:00.000Z',
        lastVerifiedAt: '2026-04-04T12:00:00.000Z',
        recallEnabled: false,
        staleAt: '2026-04-05T09:00:00.000Z',
      },
      spaceId: 'spc_team',
    });
    expect(result).toEqual({
      expiresAt: '2026-04-10T12:30:00.000Z',
      id: 'mem_published',
      lastVerifiedAt: '2026-04-04T12:00:00.000Z',
      recallEnabled: false,
      staleAt: '2026-04-05T09:00:00.000Z',
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

  it('blocks reject for non-reviewer roles', async () => {
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

    await expect(caller.rejectEntry({ id: 'mem_1', spaceId: 'spc_team' })).rejects.toThrow(
      new TRPCError({ code: 'FORBIDDEN', message: 'SPACE_MEMORY_REVIEW_DENIED' }),
    );
  });

  it('blocks batch publish for non-reviewer roles', async () => {
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
      caller.publishEntries({ ids: ['mem_1', 'mem_2'], spaceId: 'spc_team' }),
    ).rejects.toThrow(new TRPCError({ code: 'FORBIDDEN', message: 'SPACE_MEMORY_REVIEW_DENIED' }));
  });

  it('blocks batch revalidate for non-reviewer roles', async () => {
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
      caller.revalidateEntries({ ids: ['mem_1', 'mem_2'], spaceId: 'spc_team' }),
    ).rejects.toThrow(new TRPCError({ code: 'FORBIDDEN', message: 'SPACE_MEMORY_REVIEW_DENIED' }));
  });

  it('blocks batch mark stale for non-reviewer roles', async () => {
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
      caller.markEntriesStale({ ids: ['mem_1', 'mem_2'], spaceId: 'spc_team' }),
    ).rejects.toThrow(new TRPCError({ code: 'FORBIDDEN', message: 'SPACE_MEMORY_REVIEW_DENIED' }));
  });

  it('blocks batch reject for non-reviewer roles', async () => {
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
      caller.rejectEntries({ ids: ['mem_1', 'mem_2'], spaceId: 'spc_team' }),
    ).rejects.toThrow(new TRPCError({ code: 'FORBIDDEN', message: 'SPACE_MEMORY_REVIEW_DENIED' }));
  });

  it('blocks merge for non-reviewer roles', async () => {
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
      caller.mergeEntry({
        candidateId: 'mem_candidate',
        spaceId: 'spc_team',
        targetEntryId: 'mem_published',
      }),
    ).rejects.toThrow(new TRPCError({ code: 'FORBIDDEN', message: 'SPACE_MEMORY_REVIEW_DENIED' }));
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
