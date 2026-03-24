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
