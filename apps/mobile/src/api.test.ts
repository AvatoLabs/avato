import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const streamedTool = {
  apiName: 'search',
  arguments: '{}',
  id: 'tool-1',
  identifier: 'lobe-web-browsing',
  type: 'function',
};

const mockReadAsStringAsync = vi.fn();
const mockGetInfoAsync = vi.fn();
const mockMakeDirectoryAsync = vi.fn();
const mockCopyAsync = vi.fn();
const mockUploadAsync = vi.fn();
const mockCreateUploadTask = vi.fn(() => ({
  uploadAsync: mockUploadAsync,
}));
const mockGetAuthHeaders = vi.fn().mockResolvedValue({ 'X-lobe-chat-auth': 'token' });
const mockGetApiUrl = vi.fn().mockResolvedValue('https://example.com');

vi.mock('@lobechat/fetch-sse/sseParser', () => ({
  createSSEChunkParser: vi.fn(() => {
    return (chunk: string) =>
      chunk
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          if (line === 'TOOLS') return { data: [streamedTool], event: 'tool_calls' };
          if (line.startsWith('TEXT:')) return { data: line.slice(5), event: 'text' };
          return null;
        })
        .filter(Boolean);
  }),
}));

vi.mock('expo-file-system/legacy', () => ({
  EncodingType: {
    Base64: 'base64',
  },
  FileSystemUploadType: {
    BINARY_CONTENT: 'binary',
    MULTIPART: 'multipart',
  },
  cacheDirectory: '/tmp/',
  copyAsync: mockCopyAsync,
  createUploadTask: mockCreateUploadTask,
  documentDirectory: '/tmp/',
  getInfoAsync: mockGetInfoAsync,
  makeDirectoryAsync: mockMakeDirectoryAsync,
  readAsStringAsync: mockReadAsStringAsync,
}));

vi.mock('./lib/auth', () => ({
  clearStoredAuthSession: vi.fn(),
  getAuthHeaders: mockGetAuthHeaders,
}));

vi.mock('./lib/i18n', () => ({
  useI18n: {
    getState: () => ({
      locale: 'en-US',
      t: new Proxy(
        {},
        {
          get: (_target, property) => String(property),
        },
      ),
    }),
  },
}));

vi.mock('./lib/server', () => ({
  getApiUrl: mockGetApiUrl,
  hasConfiguredUrl: vi.fn(),
  setApiUrl: vi.fn(),
  testConnection: vi.fn(),
}));

vi.mock('./constants/session', () => ({
  AVATO_INBOX_ICON_ASSET: 1,
  DEFAULT_INBOX_AVATAR: '/icons/icon-192x192.png',
  INBOX_SESSION_ID: 'inbox',
  isBuiltinInboxAvatar: vi.fn().mockReturnValue(false),
}));

class MockXMLHttpRequest {
  static instances: MockXMLHttpRequest[] = [];

  onabort: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onload: (() => void) | null = null;
  onprogress: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  readyState = 4;
  responseText = '';
  responseType = 'text';
  status = 200;
  timeout = 0;

  constructor() {
    MockXMLHttpRequest.instances.push(this);
  }

  abort = vi.fn(() => {
    this.onabort?.();
  });

  open = vi.fn();

  send = vi.fn(() => {
    this.responseText = 'TOOLS\n';
    this.onprogress?.();

    this.responseText = 'TOOLS\nTEXT:hi\n';
    this.onprogress?.();
    this.onload?.();
  });

  setRequestHeader = vi.fn();
}

describe('aiChatApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCopyAsync.mockReset();
    mockCreateUploadTask.mockClear();
    mockGetApiUrl.mockResolvedValue('https://example.com');
    mockGetAuthHeaders.mockResolvedValue({ 'X-lobe-chat-auth': 'token' });
    mockGetInfoAsync.mockReset();
    mockMakeDirectoryAsync.mockReset();
    mockReadAsStringAsync.mockReset();
    mockUploadAsync.mockReset();
    MockXMLHttpRequest.instances = [];
    vi.stubGlobal('XMLHttpRequest', MockXMLHttpRequest as unknown as typeof XMLHttpRequest);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('continueToolIntervention only parses newly received SSE chunks', async () => {
    const { aiChatApi } = await import('./lib/api');
    const onContent = vi.fn();
    const onTools = vi.fn();

    const result = await aiChatApi.continueToolIntervention(
      'openai',
      {
        approvedToolCall: streamedTool,
        sessionId: 'session-1',
        topicId: 'topic-1',
      },
      {
        onContent,
        onTools,
      },
    );

    expect(result.text).toBe('hi');
    expect(result.tools).toEqual([streamedTool]);
    expect(onContent).toHaveBeenCalledTimes(1);
    expect(onContent).toHaveBeenCalledWith({ content: 'hi' });
    expect(onTools).toHaveBeenCalledTimes(1);
    expect(onTools).toHaveBeenCalledWith([streamedTool]);
    expect(MockXMLHttpRequest.instances).toHaveLength(1);
  });
});

describe('spaceMemoryApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('wraps listEntries queries with the expected tRPC input envelope', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          result: {
            data: {
              json: {
                contract: {
                  canAccessAudit: false,
                  canCreate: false,
                  canManageRecall: false,
                  canViewInbox: false,
                  detailViews: ['overview'],
                  recallFilters: ['all'],
                  sections: ['published'],
                },
                items: [],
                section: 'published',
                surface: 'viewer',
              },
            },
          },
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { spaceMemoryApi } = await import('./lib/api');
    const result = await spaceMemoryApi.listEntries('space-team-1', 'published');

    expect(result.section).toBe('published');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0] as [string, { method: string }];

    expect(url).toContain('/trpc/lambda/spaceMemory.listEntries?input=');
    expect(decodeURIComponent(url)).toContain('"spaceId":"space-team-1"');
    expect(decodeURIComponent(url)).toContain('"section":"published"');
    expect(decodeURIComponent(url)).toContain('"recallFilter":"all"');
    expect(options.method).toBe('GET');
  });

  it('wraps getEntry queries with the expected tRPC input envelope', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          result: {
            data: {
              json: {
                contract: {
                  canAccessAudit: false,
                  canCreate: false,
                  canManageRecall: false,
                  canViewInbox: false,
                  detailViews: ['overview'],
                  recallFilters: ['all'],
                  sections: ['published'],
                },
                entry: {
                  category: 'general',
                  id: 'mem-1',
                  kind: 'memory',
                  sourceCount: 1,
                  sourceRefs: [],
                  title: 'Policy',
                  updatedAt: '2026-04-06T08:00:00.000Z',
                },
                surface: 'viewer',
              },
            },
          },
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { spaceMemoryApi } = await import('./lib/api');
    const result = await spaceMemoryApi.getEntry('space-team-1', 'mem-1');

    expect(result.entry.id).toBe('mem-1');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0] as [string, { method: string }];

    expect(url).toContain('/trpc/lambda/spaceMemory.getEntry?input=');
    expect(decodeURIComponent(url)).toContain('"spaceId":"space-team-1"');
    expect(decodeURIComponent(url)).toContain('"id":"mem-1"');
    expect(options.method).toBe('GET');
  });

  it('wraps createCandidate mutations with the expected tRPC input envelope', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          result: {
            data: {
              json: {
                category: 'general',
                id: 'mem-candidate-1',
                kind: 'candidate',
                sourceCount: 0,
                sourceRefs: [],
                title: 'New draft',
                updatedAt: '2026-04-06T08:00:00.000Z',
              },
            },
          },
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { spaceMemoryApi } = await import('./lib/api');
    await spaceMemoryApi.createCandidate('space-team-1', {
      summary: 'A concise summary',
      title: 'New draft',
    });

    const [url, options] = fetchMock.mock.calls[0] as [string, { body: string; method: string }];
    expect(url).toContain('/trpc/lambda/spaceMemory.createCandidate');
    expect(options.method).toBe('POST');
    expect(options.body).toContain('"spaceId":"space-team-1"');
    expect(options.body).toContain('"title":"New draft"');
    expect(options.body).toContain('"summary":"A concise summary"');
  });

  it('wraps exportAuditBundle queries with the expected tRPC input envelope', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          result: {
            data: {
              json: {
                auditPath: '/spaces/space-team-1/memory/audit/mem-1?section=published',
                detailView: 'audit',
                entry: {
                  category: 'general',
                  id: 'mem-1',
                  kind: 'memory',
                  sourceCount: 1,
                  sourceRefs: [],
                  title: 'Policy',
                  updatedAt: '2026-04-06T08:00:00.000Z',
                },
                exportedAt: '2026-04-06T08:00:00.000Z',
                recallFilter: 'all',
                section: 'published',
                space: {
                  id: 'space-team-1',
                  kind: 'team',
                },
              },
            },
          },
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { spaceMemoryApi } = await import('./lib/api');
    await spaceMemoryApi.exportAuditBundle('space-team-1', 'mem-1');

    const [url, options] = fetchMock.mock.calls[0] as [string, { method: string }];
    expect(url).toContain('/trpc/lambda/spaceMemory.exportAuditBundle?input=');
    expect(decodeURIComponent(url)).toContain('"spaceId":"space-team-1"');
    expect(decodeURIComponent(url)).toContain('"id":"mem-1"');
    expect(decodeURIComponent(url)).toContain('"recallFilter":"all"');
    expect(options.method).toBe('GET');
  });

  it('wraps exportAuditBundles queries with the expected tRPC input envelope', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          result: {
            data: {
              json: {
                count: 2,
                exportedAt: '2026-04-06T08:00:00.000Z',
                items: [
                  {
                    auditPath: '/spaces/space-team-1/memory/audit/mem-1?section=published',
                    detailView: 'audit',
                    entry: {
                      category: 'general',
                      id: 'mem-1',
                      kind: 'memory',
                      sourceCount: 1,
                      sourceRefs: [],
                      title: 'One',
                      updatedAt: '2026-04-06T08:00:00.000Z',
                    },
                    exportedAt: '2026-04-06T08:00:00.000Z',
                    recallFilter: 'active',
                    section: 'published',
                    space: { id: 'space-team-1', kind: 'team' },
                  },
                ],
                recallFilter: 'active',
                space: { id: 'space-team-1', kind: 'team' },
              },
            },
          },
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { spaceMemoryApi } = await import('./lib/api');
    await spaceMemoryApi.exportAuditBundles('space-team-1', ['mem-1', 'mem-2'], 'active');

    const [url, options] = fetchMock.mock.calls[0] as [string, { method: string }];
    expect(url).toContain('/trpc/lambda/spaceMemory.exportAuditBundles?input=');
    expect(decodeURIComponent(url)).toContain('"spaceId":"space-team-1"');
    expect(decodeURIComponent(url)).toContain('"ids":["mem-1","mem-2"]');
    expect(decodeURIComponent(url)).toContain('"recallFilter":"active"');
    expect(options.method).toBe('GET');
  });

  it('wraps publishEntry mutations with the expected tRPC input envelope', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ result: { data: { json: { id: 'mem-1', status: 'published' } } } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { spaceMemoryApi } = await import('./lib/api');
    await spaceMemoryApi.publishEntry('space-team-1', 'mem-1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, { body: string; method: string }];

    expect(url).toContain('/trpc/lambda/spaceMemory.publishEntry');
    expect(options.method).toBe('POST');
    expect(options.body).toContain('"spaceId":"space-team-1"');
    expect(options.body).toContain('"id":"mem-1"');
  });

  it('wraps rejectEntry mutations with the expected tRPC input envelope', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ result: { data: { json: { id: 'mem-1', status: 'archived' } } } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { spaceMemoryApi } = await import('./lib/api');
    await spaceMemoryApi.rejectEntry('space-team-1', 'mem-1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, { body: string; method: string }];

    expect(url).toContain('/trpc/lambda/spaceMemory.rejectEntry');
    expect(options.method).toBe('POST');
    expect(options.body).toContain('"spaceId":"space-team-1"');
    expect(options.body).toContain('"id":"mem-1"');
  });

  it('wraps mergeEntry mutations with the expected tRPC input envelope', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ result: { data: { json: { id: 'mem-1', status: 'published' } } } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { spaceMemoryApi } = await import('./lib/api');
    await spaceMemoryApi.mergeEntry('space-team-1', {
      candidateId: 'mem-candidate',
      merge: {
        appendSources: true,
        applyContent: true,
        applySummary: false,
        applyTitle: true,
      },
      targetEntryId: 'mem-published',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, { body: string; method: string }];

    expect(url).toContain('/trpc/lambda/spaceMemory.mergeEntry');
    expect(options.method).toBe('POST');
    expect(options.body).toContain('"spaceId":"space-team-1"');
    expect(options.body).toContain('"candidateId":"mem-candidate"');
    expect(options.body).toContain('"targetEntryId":"mem-published"');
    expect(options.body).toContain('"appendSources":true');
  });

  it('wraps revalidateEntry mutations with the expected batch tRPC envelope', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ result: { data: { json: [{ id: 'mem-1', status: 'revalidated' }] } } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { spaceMemoryApi } = await import('./lib/api');
    await spaceMemoryApi.revalidateEntry('space-team-1', 'mem-1');

    const [url, options] = fetchMock.mock.calls[0] as [string, { body: string; method: string }];
    expect(url).toContain('/trpc/lambda/spaceMemory.revalidateEntries');
    expect(options.method).toBe('POST');
    expect(options.body).toContain('"spaceId":"space-team-1"');
    expect(options.body).toContain('"ids":["mem-1"]');
  });

  it('wraps markEntryStale mutations with the expected batch tRPC envelope', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ result: { data: { json: [{ id: 'mem-1', status: 'stale' }] } } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { spaceMemoryApi } = await import('./lib/api');
    await spaceMemoryApi.markEntryStale('space-team-1', 'mem-1');

    const [url, options] = fetchMock.mock.calls[0] as [string, { body: string; method: string }];
    expect(url).toContain('/trpc/lambda/spaceMemory.markEntriesStale');
    expect(options.method).toBe('POST');
    expect(options.body).toContain('"spaceId":"space-team-1"');
    expect(options.body).toContain('"ids":["mem-1"]');
  });
});

describe('lobehubSkillApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('uses the tools tRPC namespace for connect queries', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          result: {
            data: {
              json: {
                authorizeUrl: 'https://market.example.com/oauth',
              },
            },
          },
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { lobehubSkillApi } = await import('./lib/api');
    await lobehubSkillApi.getAuthorizeUrl('github', {
      redirectUri: 'com.avato.app://oauth',
      scopes: ['repo'],
    });

    const [url, options] = fetchMock.mock.calls[0] as [string, { method: string }];

    expect(url).toContain('/trpc/tools/market.connectGetAuthorizeUrl?input=');
    expect(decodeURIComponent(url)).toContain('"provider":"github"');
    expect(decodeURIComponent(url)).toContain('"redirectUri":"com.avato.app://oauth"');
    expect(decodeURIComponent(url)).toContain('"scopes":["repo"]');
    expect(options.method).toBe('GET');
  });

  it('uses the tools tRPC namespace for connect mutations', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ result: { data: { json: { success: true } } } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { lobehubSkillApi } = await import('./lib/api');
    await lobehubSkillApi.revoke('github');

    const [url, options] = fetchMock.mock.calls[0] as [string, { body: string; method: string }];

    expect(url).toContain('/trpc/tools/market.connectRevoke');
    expect(options.method).toBe('POST');
    expect(options.body).toContain('"provider":"github"');
  });
});

describe('marketSkillApi community discovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('loads the full Web community discovery source set', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      const decodedUrl = decodeURIComponent(url);
      if (decodedUrl.includes('aggregator.getRegistryEntries')) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              result: {
                data: {
                  json: {
                    currentPage: 1,
                    items: [
                      {
                        description: 'registry description',
                        icon: 'https://example.com/icon.png',
                        identifier: 'registry-fetch',
                        installability: {
                          installSchema: {
                            config: {
                              type: 'http',
                              url: 'https://mcp.example.com/sse',
                            },
                            identifier: 'registry-fetch',
                          },
                          level: 'verified',
                        },
                        sourceLinks: [{ source: 'official', url: 'https://example.com/registry' }],
                        sources: ['official'],
                        title: 'Registry Fetch',
                      },
                    ],
                    pageSize: 21,
                    totalCount: 1,
                    totalPages: 1,
                  },
                },
              },
            }),
        };
      }

      if (decodedUrl.includes('aggregator.getSkillEntries')) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              result: {
                data: {
                  json: {
                    currentPage: 1,
                    items: [
                      {
                        category: 'writing',
                        description: 'skillhub description',
                        importIdentifier: 'skillhub-writer',
                        importUrl: 'https://example.com/writer.md',
                        installability: { level: 'installable' },
                        sourceLinks: [{ source: 'skillhub', url: 'https://example.com/skillhub' }],
                        sources: ['skillhub'],
                        title: 'SkillHub Writer',
                      },
                    ],
                    pageSize: 21,
                    totalCount: 1,
                    totalPages: 1,
                  },
                },
              },
            }),
        };
      }

      const source = decodedUrl.includes('market.getAssistantList')
        ? 'agent'
        : decodedUrl.includes('market.getGroupAgentList')
          ? 'group_agent'
          : decodedUrl.includes('market.getModelList')
            ? 'model'
            : decodedUrl.includes('market.getPluginList')
              ? 'plugin'
              : decodedUrl.includes('market.getProviderList')
                ? 'provider'
                : 'unknown';

      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            result: {
              data: {
                json: {
                  currentPage: 1,
                  items: [
                    {
                      category: source === 'provider' ? undefined : 'productivity',
                      description: `${source} description`,
                      displayName: `${source} item`,
                      identifier: `${source}-1`,
                      meta: {
                        avatar: '🤖',
                        title: `${source} title`,
                      },
                    },
                  ],
                  pageSize: 21,
                  totalCount: 1,
                  totalPages: 1,
                },
              },
            },
          }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const { marketSkillApi } = await import('./lib/api');
    const [agents, groups, models, plugins, providers, aggregatorMcps, aggregatorSkills] =
      await Promise.all([
        marketSkillApi.getAgentList({ q: 'bot' }, { forceRefresh: true }),
        marketSkillApi.getGroupAgentList(undefined, { forceRefresh: true }),
        marketSkillApi.getModelList(undefined, { forceRefresh: true }),
        marketSkillApi.getPluginList(undefined, { forceRefresh: true }),
        marketSkillApi.getProviderList(undefined, { forceRefresh: true }),
        marketSkillApi.getAggregatorMcpList(undefined, { forceRefresh: true }),
        marketSkillApi.getAggregatorSkillList(undefined, { forceRefresh: true }),
      ]);

    expect(agents.items[0]).toMatchObject({ _source: 'agent', identifier: 'agent-1' });
    expect(groups.items[0]).toMatchObject({ _source: 'group_agent', identifier: 'group_agent-1' });
    expect(models.items[0]).toMatchObject({ _source: 'model', identifier: 'model-1' });
    expect(plugins.items[0]).toMatchObject({ _source: 'plugin', identifier: 'plugin-1' });
    expect(providers.items[0]).toMatchObject({ _source: 'provider', identifier: 'provider-1' });
    expect(aggregatorMcps.items[0]).toMatchObject({
      _source: 'aggregator_mcp',
      aggregatorInstallabilityLevel: 'verified',
      identifier: 'registry-fetch',
      webDetailPath: '/community/aggregator?q=registry-fetch',
    });
    expect(aggregatorSkills.items[0]).toMatchObject({
      _source: 'aggregator_skill',
      identifier: 'skillhub-writer',
      importUrl: 'https://example.com/writer.md',
      webDetailPath: '/community/aggregator?kind=skills&q=skillhub-writer',
    });

    const calledUrls = fetchMock.mock.calls.map(([url]) => decodeURIComponent(String(url)));
    expect(calledUrls.some((url) => url.includes('/trpc/mobile/market.getAssistantList'))).toBe(
      true,
    );
    expect(calledUrls.some((url) => url.includes('/trpc/mobile/market.getGroupAgentList'))).toBe(
      true,
    );
    expect(calledUrls.some((url) => url.includes('/trpc/mobile/market.getModelList'))).toBe(true);
    expect(calledUrls.some((url) => url.includes('/trpc/mobile/market.getPluginList'))).toBe(true);
    expect(calledUrls.some((url) => url.includes('/trpc/mobile/market.getProviderList'))).toBe(
      true,
    );
    expect(
      calledUrls.some((url) => url.includes('/trpc/mobile/aggregator.getRegistryEntries')),
    ).toBe(true);
    expect(calledUrls.some((url) => url.includes('/trpc/mobile/aggregator.getSkillEntries'))).toBe(
      true,
    );
  });

  it('installs installable aggregator entries through native mobile paths', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      const decodedUrl = decodeURIComponent(url);

      if (decodedUrl.includes('mcp.getStreamableMcpServerManifest')) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              result: {
                data: {
                  json: {
                    api: [{ name: 'search', parameters: {} }],
                    identifier: 'registry-fetch',
                    meta: { title: 'Registry Fetch' },
                  },
                },
              },
            }),
        };
      }

      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ result: { data: { json: { id: 'ok' } } } }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const { marketSkillApi } = await import('./lib/api');
    await marketSkillApi.install({
      _source: 'aggregator_skill',
      aggregatorInstallabilityLevel: 'verified',
      identifier: 'skillhub-writer',
      importIdentifier: 'skillhub-writer',
      importUrl: 'https://example.com/writer.md',
    });
    await marketSkillApi.install({
      _source: 'aggregator_mcp',
      aggregatorInstallSchema: {
        config: {
          headers: { 'X-Test': '1' },
          type: 'http',
          url: 'https://mcp.example.com/sse',
        },
        description: 'registry description',
        icon: 'https://example.com/icon.png',
        identifier: 'registry-fetch',
        name: 'Registry Fetch',
      },
      aggregatorInstallabilityLevel: 'verified',
      description: 'registry description',
      identifier: 'registry-fetch',
      name: 'Registry Fetch',
    });

    const calledUrls = fetchMock.mock.calls.map(([url]) => decodeURIComponent(String(url)));
    expect(calledUrls.some((url) => url.includes('/trpc/mobile/agentSkills.importFromUrl'))).toBe(
      true,
    );
    expect(
      calledUrls.some((url) => url.includes('/trpc/mobile/mcp.getStreamableMcpServerManifest')),
    ).toBe(true);
    expect(
      calledUrls.some((url) => url.includes('/trpc/mobile/plugin.createOrInstallPlugin')),
    ).toBe(true);

    const importCall = fetchMock.mock.calls.find(([url]) =>
      decodeURIComponent(String(url)).includes('agentSkills.importFromUrl'),
    );
    expect(JSON.parse(String(importCall?.[1]?.body))).toMatchObject({
      json: {
        identifier: 'skillhub-writer',
        source: 'market',
        url: 'https://example.com/writer.md',
      },
    });

    const pluginCall = fetchMock.mock.calls.find(([url]) =>
      decodeURIComponent(String(url)).includes('plugin.createOrInstallPlugin'),
    );
    expect(JSON.parse(String(pluginCall?.[1]?.body))).toMatchObject({
      json: {
        customParams: {
          mcp: {
            headers: { 'X-Test': '1' },
            type: 'http',
            url: 'https://mcp.example.com/sse',
          },
        },
        identifier: 'registry-fetch',
        type: 'customPlugin',
      },
    });
  });
});

describe('topicShareApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('loads shared topic metadata through the lambda namespace', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          result: {
            data: {
              json: {
                agentId: 'agent-1',
                shareId: 'share-1',
                title: 'Release plan',
                topicId: 'topic-1',
                visibility: 'link',
              },
            },
          },
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { topicShareApi } = await import('./lib/api');
    const result = await topicShareApi.getSharedTopic('share-1');

    const [url, options] = fetchMock.mock.calls[0] as [string, { method: string }];

    expect(result.title).toBe('Release plan');
    expect(url).toContain('/trpc/lambda/share.getSharedTopic?input=');
    expect(decodeURIComponent(url)).toContain('"shareId":"share-1"');
    expect(options.method).toBe('GET');
  });

  it('loads shared topic messages through the public lambda message endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          result: {
            data: {
              json: [
                {
                  content: 'hello',
                  createdAt: '2026-05-19T00:00:00.000Z',
                  id: 'msg-1',
                  role: 'user',
                  sessionId: 'agent-1',
                  updatedAt: '2026-05-19T00:00:00.000Z',
                },
              ],
            },
          },
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { topicShareApi } = await import('./lib/api');
    const messages = await topicShareApi.listMessages('share-1');

    const [url, options] = fetchMock.mock.calls[0] as [string, { method: string }];

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ content: 'hello', id: 'msg-1', role: 'user' });
    expect(url).toContain('/trpc/lambda/message.getMessages?input=');
    expect(decodeURIComponent(url)).toContain('"topicShareId":"share-1"');
    expect(options.method).toBe('GET');
  });
});

describe('statsApi usage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('loads monthly usage through the lambda usage router', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          result: {
            data: {
              json: [{ id: 'usage-1', model: 'gpt-5.4', provider: 'openai', type: 'chat' }],
            },
          },
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { statsApi } = await import('./lib/api');
    const result = await statsApi.findUsageByMonth('2026-05');

    const [url, options] = fetchMock.mock.calls[0] as [string, { method: string }];
    expect(result).toHaveLength(1);
    expect(url).toContain('/trpc/lambda/usage.findByMonth?input=');
    expect(decodeURIComponent(url)).toContain('"mo":"2026-05"');
    expect(options.method).toBe('GET');
  });

  it('loads grouped monthly usage through the lambda usage router', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          result: {
            data: {
              json: [
                {
                  day: '2026-05-19',
                  records: [],
                  totalRequests: 1,
                  totalSpend: 0.001,
                  totalTokens: 128,
                },
              ],
            },
          },
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { statsApi } = await import('./lib/api');
    const result = await statsApi.findUsageGroupedByDay('2026-05');

    const [url, options] = fetchMock.mock.calls[0] as [string, { method: string }];
    expect(result[0]?.totalTokens).toBe(128);
    expect(url).toContain('/trpc/lambda/usage.findAndGroupByDay?input=');
    expect(decodeURIComponent(url)).toContain('"mo":"2026-05"');
    expect(options.method).toBe('GET');
  });
});

describe('resourceApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('stringifies editorData when updating documents', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          result: {
            data: {
              json: {
                id: 'doc-1',
              },
            },
          },
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { resourceApi } = await import('./lib/api');
    await resourceApi.updateDocument('doc-1', {
      content: '| Name |\\n| --- |',
      editorData: { activeViewId: 'view_1', views: [] },
      title: 'Quarterly sheet',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, options] = fetchMock.mock.calls[0] as [string, { body: string; method: string }];
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({
      json: {
        content: '| Name |\\n| --- |',
        editorData: JSON.stringify({ activeViewId: 'view_1', views: [] }),
        id: 'doc-1',
        title: 'Quarterly sheet',
      },
    });
  });
});

describe('contentShareApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('creates content share links with the expected tRPC envelope', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          result: {
            data: {
              json: {
                expiresAt: '2026-04-10T08:00:00.000Z',
                fileShareDownloadUrl: 'https://example.com/share/f/tok_1',
                id: 'share-link-1',
                shareUrl: 'https://example.com/share/r/tok_1',
              },
            },
          },
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { contentShareApi } = await import('./lib/api');
    const result = await contentShareApi.createContentShareLink({
      expiresInDays: 7,
      id: 'file-1',
      kind: 'file',
      password: 'secret',
    });

    expect(result.id).toBe('share-link-1');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0] as [string, { body: string; method: string }];

    expect(url).toContain('/trpc/mobile/contentShare.createContentShareLink');
    expect(options.method).toBe('POST');
    expect(options.body).toContain('"id":"file-1"');
    expect(options.body).toContain('"kind":"file"');
    expect(options.body).toContain('"expiresInDays":7');
    expect(options.body).toContain('"password":"secret"');
  });
});

describe('threadApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('wraps createThread mutations with the expected tRPC input envelope', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          result: {
            data: {
              json: 'thread-created-1',
            },
          },
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { threadApi } = await import('./lib/api');
    const result = await threadApi.create({
      sourceMessageId: 'msg-1',
      topicId: 'topic-1',
      type: 'continuation',
    });

    expect(result).toBe('thread-created-1');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0] as [string, { body: string; method: string }];

    expect(url).toContain('/trpc/lambda/thread.createThread');
    expect(options.method).toBe('POST');
    expect(options.body).toContain('"sourceMessageId":"msg-1"');
    expect(options.body).toContain('"topicId":"topic-1"');
    expect(options.body).toContain('"type":"continuation"');
  });

  it('normalizes threadId when listing thread messages', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          result: {
            data: {
              json: [
                {
                  content: 'Source message',
                  createdAt: '2026-04-08T00:00:00.000Z',
                  id: 'msg-1',
                  role: 'user',
                  sessionId: 'session-1',
                  threadId: null,
                  updatedAt: '2026-04-08T00:00:00.000Z',
                },
                {
                  content: 'Thread reply',
                  createdAt: '2026-04-08T00:00:01.000Z',
                  id: 'msg-2',
                  role: 'assistant',
                  sessionId: 'session-1',
                  threadId: 'thread-1',
                  updatedAt: '2026-04-08T00:00:01.000Z',
                },
              ],
            },
          },
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { messageApi } = await import('./lib/api');
    const result = await messageApi.list('session-1', 'topic-1', { threadId: 'thread-1' });

    expect(result).toHaveLength(2);
    expect(result[0]?.threadId).toBeNull();
    expect(result[1]?.threadId).toBe('thread-1');
  });

  it('wraps createThreadWithMessage mutations with the expected lambda input envelope', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          result: {
            data: {
              json: {
                messageId: 'message-created-1',
                threadId: 'thread-created-2',
              },
            },
          },
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { threadApi } = await import('./lib/api');
    const result = await threadApi.createWithMessage({
      message: {
        content: 'hello',
        role: 'user',
        sessionId: 'session-1',
      },
      sourceMessageId: 'msg-1',
      topicId: 'topic-1',
      type: 'continuation',
    });

    expect(result).toEqual({
      messageId: 'message-created-1',
      threadId: 'thread-created-2',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0] as [string, { body: string; method: string }];

    expect(url).toContain('/trpc/lambda/thread.createThreadWithMessage');
    expect(options.method).toBe('POST');
    expect(options.body).toContain('"sourceMessageId":"msg-1"');
    expect(options.body).toContain('"topicId":"topic-1"');
    expect(options.body).toContain('"type":"continuation"');
    expect(options.body).toContain('"content":"hello"');
    expect(options.body).toContain('"sessionId":"session-1"');
  });

  it('queries draft thread context messages through the mobile message router', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          result: {
            data: {
              json: [
                {
                  content: 'Source context',
                  createdAt: '2026-04-08T00:00:00.000Z',
                  id: 'msg-1',
                  role: 'user',
                  sessionId: 'session-1',
                  threadId: null,
                  updatedAt: '2026-04-08T00:00:00.000Z',
                },
              ],
            },
          },
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { messageApi } = await import('./lib/api');
    const result = await messageApi.listThreadDraftMessages({
      sourceMessageId: 'msg-1',
      threadType: 'continuation',
      topicId: 'topic-1',
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('msg-1');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0] as [string, { method: string }];

    expect(url).toContain('/trpc/mobile/message.getThreadDraftMessages');
    expect(options.method).toBe('GET');
  });
});

describe('spaceApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('queries spaces through the lambda router', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          result: {
            data: {
              json: [{ id: 'space-1', kind: 'personal', name: 'Personal' }],
            },
          },
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { spaceApi } = await import('./lib/api');
    const result = await spaceApi.list();

    expect(result).toEqual([{ id: 'space-1', kind: 'personal', name: 'Personal' }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/trpc/lambda/space.listSpaces');
  });

  it('creates spaces through the lambda router', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          result: {
            data: {
              json: { id: 'space-2', kind: 'team', name: 'Design Ops' },
            },
          },
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { spaceApi } = await import('./lib/api');
    const result = await spaceApi.create({ name: 'Design Ops' });

    expect(result).toEqual({ id: 'space-2', kind: 'team', name: 'Design Ops' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/trpc/lambda/space.createTeamSpace');
  });

  it('wraps space management mutations through the lambda router', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ result: { data: { json: { success: true } } } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { spaceApi } = await import('./lib/api');
    await spaceApi.update('space-1', { description: 'Updated', name: 'Team' });
    await spaceApi.addMemberByUsername({
      role: 'editor',
      spaceId: 'space-1',
      username: 'arthur',
    });
    await spaceApi.updateMemberRole('space-1', 'user-1', 'viewer');
    await spaceApi.removeMember('space-1', 'user-1');
    await spaceApi.transferOwnership('space-1', 'user-2');
    await spaceApi.delete('space-1');

    const calls = fetchMock.mock.calls.map(([url, options]) => ({
      body: (options as { body?: string }).body,
      url: String(url),
    }));

    expect(calls[0]?.url).toContain('/trpc/lambda/space.updateSpace');
    expect(calls[0]?.body).toContain('"id":"space-1"');
    expect(calls[1]?.url).toContain('/trpc/lambda/space.addSpaceMemberByUsername');
    expect(calls[1]?.body).toContain('"username":"arthur"');
    expect(calls[2]?.url).toContain('/trpc/lambda/space.updateSpaceMemberRole');
    expect(calls[3]?.url).toContain('/trpc/lambda/space.removeSpaceMember');
    expect(calls[4]?.url).toContain('/trpc/lambda/space.transferSpaceOwnership');
    expect(calls[5]?.url).toContain('/trpc/lambda/space.deleteSpace');
  });
});

describe('resourceApi recent content wrappers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('queries recent files with the expected tRPC envelope', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          result: {
            data: {
              json: [
                {
                  chunkCount: 0,
                  chunkingError: null,
                  embeddingError: null,
                  finishEmbedding: false,
                  id: 'file-1',
                  name: 'Roadmap.pdf',
                  size: 12,
                  url: 'https://example.com/f/file-1',
                },
              ],
            },
          },
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { resourceApi } = await import('./lib/api');
    const result = await resourceApi.getRecentFiles(4);

    expect(result[0]?.sourceType).toBe('file');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0] as [string, { method: string }];
    expect(url).toContain('/trpc/mobile/file.recentFiles?input=');
    expect(decodeURIComponent(url)).toContain('"limit":4');
    expect(options.method).toBe('GET');
  });

  it('queries recent pages with the expected tRPC envelope', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          result: {
            data: {
              json: [
                {
                  chunkCount: 0,
                  chunkingError: null,
                  embeddingError: null,
                  finishEmbedding: false,
                  id: 'docs_1',
                  name: 'Spec',
                  size: 0,
                  url: '',
                },
              ],
            },
          },
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { resourceApi } = await import('./lib/api');
    const result = await resourceApi.getRecentPages(5);

    expect(result[0]?.sourceType).toBe('document');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0] as [string, { method: string }];
    expect(url).toContain('/trpc/mobile/file.recentPages?input=');
    expect(decodeURIComponent(url)).toContain('"limit":5');
    expect(options.method).toBe('GET');
  });
});

describe('sessionApi conversation file wrappers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('queries conversation files with the expected tRPC envelope', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          result: {
            data: {
              json: [
                { enabled: true, fileType: 'application/pdf', id: 'file-1', name: 'Roadmap.pdf' },
              ],
            },
          },
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { sessionApi } = await import('./lib/api');
    const result = await sessionApi.getConversationFiles({ sessionId: 'session-1' });

    expect(result[0]?.id).toBe('file-1');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0] as [string, { method: string }];
    expect(url).toContain('/trpc/mobile/session.getConversationFiles?input=');
    expect(decodeURIComponent(url)).toContain('"sessionId":"session-1"');
    expect(options.method).toBe('GET');
  });

  it('creates conversation files with the expected tRPC envelope', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ result: { data: { json: null } } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { sessionApi } = await import('./lib/api');
    await sessionApi.addConversationFiles(['file-1', 'file-2'], { sessionId: 'session-1' });

    const [url, options] = fetchMock.mock.calls[0] as [string, { body: string; method: string }];
    expect(url).toContain('/trpc/mobile/session.createConversationFiles');
    expect(options.method).toBe('POST');
    expect(options.body).toContain('"sessionId":"session-1"');
    expect(options.body).toContain('"fileIds":["file-1","file-2"]');
  });
});

describe('fileApi upload flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCopyAsync.mockReset();
    mockCreateUploadTask.mockClear();
    mockGetApiUrl.mockResolvedValue('https://example.com');
    mockGetAuthHeaders.mockResolvedValue({ 'X-lobe-chat-auth': 'token' });
    mockGetInfoAsync.mockReset();
    mockMakeDirectoryAsync.mockReset();
    mockReadAsStringAsync.mockReset();
    mockUploadAsync.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('uploads files through prepareResourceUpload → presigned PUT → completeResourceUpload → createFile', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            result: {
              data: {
                json: {
                  isExist: false,
                },
              },
            },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            result: {
              data: {
                json: {
                  presignedUrl: 'https://upload.example.com/presigned',
                  sessionId: 'upload-session-1',
                  storageKey: 'v2/files/2026/roadmap.pdf',
                },
              },
            },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ result: { data: { json: null } } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            result: {
              data: {
                json: {
                  id: 'file-1',
                  url: 'https://example.com/f/file-1',
                },
              },
            },
          }),
      });
    vi.stubGlobal('fetch', fetchMock);

    mockGetInfoAsync.mockResolvedValue({ exists: true, size: 3 });
    mockReadAsStringAsync.mockResolvedValue('YWJj');
    mockUploadAsync.mockResolvedValue({ status: 200 });

    const onProgress = vi.fn();
    const { fileApi } = await import('./lib/api');
    const result = await fileApi.upload(
      'file:///tmp/roadmap.pdf',
      'Roadmap.pdf',
      'application/pdf',
      {
        onProgress,
        spaceId: 'space-1',
      },
    );

    expect(result).toEqual({
      id: 'file-1',
      url: 'https://example.com/f/file-1',
    });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/trpc/lambda/file.checkSpaceBlob');
    expect(fetchMock.mock.calls[1]?.[0]).toContain('/trpc/lambda/upload.prepareResourceUpload');
    expect(fetchMock.mock.calls[2]?.[0]).toContain('/trpc/lambda/upload.completeResourceUpload');
    expect(fetchMock.mock.calls[3]?.[0]).toContain('/trpc/lambda/file.createFile');
    const [, createFileOptions] = fetchMock.mock.calls[3] as [
      string,
      { body: string; method: string },
    ];
    expect(JSON.parse(createFileOptions.body)).toMatchObject({
      json: {
        sha256: expect.any(String),
        storageKey: 'v2/files/2026/roadmap.pdf',
      },
    });

    expect(mockCreateUploadTask).toHaveBeenCalledTimes(1);
    const firstUploadTaskCall = mockCreateUploadTask.mock.calls[0] as unknown[] | undefined;
    expect(firstUploadTaskCall?.[0]).toBe('https://upload.example.com/presigned');
    expect(firstUploadTaskCall?.[1]).toBe('file:///tmp/roadmap.pdf');
    expect(onProgress).toHaveBeenCalledWith(5);
  });

  it('falls back to same-origin raw upload session when presigned PUT fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            result: {
              data: {
                json: {
                  isExist: false,
                },
              },
            },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            result: {
              data: {
                json: {
                  presignedUrl: 'https://upload.example.com/presigned',
                  sessionId: 'upload-session-2',
                  storageKey: 'v2/files/2026/fallback.pdf',
                },
              },
            },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ result: { data: { json: null } } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            result: {
              data: {
                json: {
                  id: 'file-2',
                  url: 'https://example.com/f/file-2',
                },
              },
            },
          }),
      });
    vi.stubGlobal('fetch', fetchMock);

    mockGetInfoAsync.mockResolvedValue({ exists: true, size: 3 });
    mockReadAsStringAsync.mockResolvedValue('YWJj');
    mockUploadAsync.mockResolvedValueOnce({ status: 500 }).mockResolvedValueOnce({ status: 200 });

    const { fileApi } = await import('./lib/api');
    const result = await fileApi.upload(
      'file:///tmp/fallback.pdf',
      'fallback.pdf',
      'application/pdf',
      {
        spaceId: 'space-1',
      },
    );

    expect(result).toEqual({
      id: 'file-2',
      url: 'https://example.com/f/file-2',
    });

    expect(mockCreateUploadTask).toHaveBeenCalledTimes(2);

    const presignedCall = mockCreateUploadTask.mock.calls[0] as unknown[] | undefined;
    expect(presignedCall?.[0]).toBe('https://upload.example.com/presigned');
    expect(presignedCall?.[1]).toBe('file:///tmp/fallback.pdf');

    const fallbackCall = mockCreateUploadTask.mock.calls[1] as unknown[] | undefined;
    expect(fallbackCall?.[0]).toBe('https://example.com/api/file/upload-session');
    expect(fallbackCall?.[1]).toBe('file:///tmp/fallback.pdf');
    expect(fallbackCall?.[2]).toMatchObject({
      headers: {
        'Content-Type': 'application/pdf',
        'X-lobe-chat-auth': 'token',
        'x-lobe-upload-session-id': 'upload-session-2',
      },
      httpMethod: 'POST',
      uploadType: 'binary',
    });
  });

  it('continues upload when the deduplication lookup is unavailable', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () =>
          JSON.stringify({
            error: {
              json: {
                message: 'temporary lookup failure',
              },
            },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            result: {
              data: {
                json: {
                  presignedUrl: 'https://upload.example.com/presigned-2',
                  sessionId: 'upload-session-3',
                  storageKey: 'v2/files/2026/no-dedup.pdf',
                },
              },
            },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ result: { data: { json: null } } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            result: {
              data: {
                json: {
                  id: 'file-3',
                  url: 'https://example.com/f/file-3',
                },
              },
            },
          }),
      });
    vi.stubGlobal('fetch', fetchMock);

    mockGetInfoAsync.mockResolvedValue({ exists: true, size: 3 });
    mockReadAsStringAsync.mockResolvedValue('YWJj');
    mockUploadAsync.mockResolvedValue({ status: 200 });

    const { fileApi } = await import('./lib/api');
    const result = await fileApi.upload(
      'file:///tmp/no-dedup.pdf',
      'no-dedup.pdf',
      'application/pdf',
    );

    expect(result).toEqual({
      id: 'file-3',
      url: 'https://example.com/f/file-3',
    });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[1]?.[0]).toContain('/trpc/lambda/upload.prepareResourceUpload');
    expect(fetchMock.mock.calls[2]?.[0]).toContain('/trpc/lambda/upload.completeResourceUpload');
    expect(fetchMock.mock.calls[3]?.[0]).toContain('/trpc/lambda/file.createFile');
    const [, createFileOptions] = fetchMock.mock.calls[3] as [
      string,
      { body: string; method: string },
    ];
    expect(JSON.parse(createFileOptions.body)).toMatchObject({
      json: {
        sha256: expect.any(String),
        storageKey: 'v2/files/2026/no-dedup.pdf',
      },
    });
  });
});
