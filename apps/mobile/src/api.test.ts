import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const streamedTool = {
  apiName: 'search',
  arguments: '{}',
  id: 'tool-1',
  identifier: 'lobe-web-browsing',
  type: 'function',
};

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
  cacheDirectory: '/tmp/',
  documentDirectory: '/tmp/',
  readAsStringAsync: vi.fn(),
}));

vi.mock('./lib/auth', () => ({
  clearStoredAuthSession: vi.fn(),
  getAuthHeaders: vi.fn().mockResolvedValue({ 'X-lobe-chat-auth': 'token' }),
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
  getApiUrl: vi.fn().mockResolvedValue('https://example.com'),
  hasConfiguredUrl: vi.fn(),
  setApiUrl: vi.fn(),
  testConnection: vi.fn(),
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

    expect(url).toContain('/trpc/mobile/spaceMemory.listEntries?input=');
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

    expect(url).toContain('/trpc/mobile/spaceMemory.getEntry?input=');
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
    expect(url).toContain('/trpc/mobile/spaceMemory.createCandidate');
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
    expect(url).toContain('/trpc/mobile/spaceMemory.exportAuditBundle?input=');
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
    expect(url).toContain('/trpc/mobile/spaceMemory.exportAuditBundles?input=');
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

    expect(url).toContain('/trpc/mobile/spaceMemory.publishEntry');
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

    expect(url).toContain('/trpc/mobile/spaceMemory.rejectEntry');
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

    expect(url).toContain('/trpc/mobile/spaceMemory.mergeEntry');
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
    expect(url).toContain('/trpc/mobile/spaceMemory.revalidateEntries');
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
    expect(url).toContain('/trpc/mobile/spaceMemory.markEntriesStale');
    expect(options.method).toBe('POST');
    expect(options.body).toContain('"spaceId":"space-team-1"');
    expect(options.body).toContain('"ids":["mem-1"]');
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

    expect(url).toContain('/trpc/mobile/thread.createThread');
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
