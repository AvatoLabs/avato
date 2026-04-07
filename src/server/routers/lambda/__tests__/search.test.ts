// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { searchRouter } from '@/server/routers/lambda/search';

const mockSearch = vi.fn();
const mockGetAccessMatch = vi.fn();

vi.mock('@/database/repositories/search', () => ({
  SearchRepo: vi.fn(() => ({
    search: mockSearch,
  })),
}));

vi.mock('@/server/services/discover', () => ({
  DiscoverService: vi.fn(() => ({
    getAssistantList: vi.fn().mockResolvedValue({ items: [] }),
    getMcpList: vi.fn().mockResolvedValue({ items: [] }),
    getPluginList: vi.fn().mockResolvedValue({ items: [] }),
  })),
}));

vi.mock('@/server/services/content', () => ({
  ContentAuthorizer: vi.fn(() => ({
    getAccessMatch: mockGetAccessMatch,
  })),
}));

describe('searchRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should filter content results by metadata visibility before returning them', async () => {
    mockSearch.mockResolvedValue([
      {
        createdAt: new Date('2026-01-01'),
        id: 'docs_visible',
        relevance: 1,
        title: 'Visible Doc',
        type: 'page',
        updatedAt: new Date('2026-01-02'),
      },
      {
        createdAt: new Date('2026-01-01'),
        id: 'docs_hidden',
        relevance: 2,
        title: 'Hidden Folder',
        type: 'folder',
        updatedAt: new Date('2026-01-02'),
      },
      {
        createdAt: new Date('2026-01-01'),
        id: 'file_hidden',
        name: 'Hidden File',
        fileType: 'application/pdf',
        relevance: 3,
        size: 10,
        sourceSetId: null,
        title: 'Hidden File',
        type: 'file',
        updatedAt: new Date('2026-01-02'),
        url: null,
      },
      {
        createdAt: new Date('2026-01-01'),
        id: 'docs_file_visible',
        name: 'Visible Derived Doc',
        fileType: 'application/pdf',
        relevance: 3,
        size: 12,
        sourceSetId: null,
        title: 'Visible Derived Doc',
        type: 'file',
        updatedAt: new Date('2026-01-02'),
        url: null,
      },
      {
        avatar: null,
        createdAt: new Date('2026-01-01'),
        id: 'ss_visible',
        relevance: 4,
        title: 'Visible Source Set',
        type: 'sourceSet',
        updatedAt: new Date('2026-01-02'),
      },
      {
        avatar: null,
        backgroundColor: null,
        createdAt: new Date('2026-01-01'),
        description: null,
        id: 'agent_visible',
        relevance: 5,
        slug: null,
        tags: [],
        title: 'Visible Agent',
        type: 'agent',
        updatedAt: new Date('2026-01-02'),
      },
    ]);
    mockGetAccessMatch.mockImplementation(async ({ id }) => ({
      canAccess: !String(id).includes('hidden'),
    }));

    const caller = searchRouter.createCaller({
      marketAccessToken: 'token',
      serverDB: {} as any,
      userId: 'user-1',
    } as any);

    const result = await caller.query({ query: 'visible' });

    expect(result.map((item: any) => item.id)).toEqual([
      'docs_visible',
      'docs_file_visible',
      'ss_visible',
      'agent_visible',
    ]);
    expect(mockGetAccessMatch).toHaveBeenCalledWith({
      capability: 'read_metadata',
      id: 'docs_visible',
      kind: 'document',
    });
    expect(mockGetAccessMatch).toHaveBeenCalledWith({
      capability: 'read_metadata',
      id: 'file_hidden',
      kind: 'file',
    });
    expect(mockGetAccessMatch).toHaveBeenCalledWith({
      capability: 'read_metadata',
      id: 'docs_file_visible',
      kind: 'document',
    });
    expect(mockGetAccessMatch).toHaveBeenCalledWith({
      capability: 'read_metadata',
      id: 'ss_visible',
      kind: 'source_set',
    });
  });
});
