// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockParseMemoryExtractionConfig = vi.fn();
const mockRunDirect = vi.fn();
const mockExecutorCreate = vi.fn(async () => ({ runDirect: mockRunDirect }));
const mockNormalizePayload = vi.fn((payload: Record<string, unknown>) => payload);
const mockPayloadParse = vi.fn((payload: Record<string, unknown>) => payload);

vi.mock('@/server/globalConfig/parseMemoryExtractionConfig', () => ({
  parseMemoryExtractionConfig: mockParseMemoryExtractionConfig,
}));

vi.mock('@/server/services/memory/userMemory/extract', () => ({
  MemoryExtractionExecutor: {
    create: mockExecutorCreate,
  },
  memoryExtractionPayloadSchema: {
    parse: mockPayloadParse,
  },
  normalizeMemoryExtractionPayload: mockNormalizePayload,
}));

vi.mock('@/database/models/asyncTask', () => ({
  AsyncTaskModel: vi.fn(),
}));

vi.mock('@/database/server', () => ({
  getServerDB: vi.fn(async () => ({})),
}));

describe('POST /api/webhooks/memory-extraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRunDirect.mockResolvedValue({ processedUsers: 1 });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects unauthenticated requests when insecure dev bypass is disabled', async () => {
    mockParseMemoryExtractionConfig.mockReturnValue({
      webhook: {
        allowInsecureDev: false,
        headers: undefined,
      },
    });

    const { POST } = await import('./route');
    const res = await POST(
      new Request('http://localhost/api/webhooks/memory-extraction', {
        body: JSON.stringify({ userId: 'user-1' }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      }),
    );

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({
      error:
        'Webhook authentication must be configured, or MEMORY_USER_MEMORY_WEBHOOK_ALLOW_INSECURE_DEV=true must be set for local development.',
    });
    expect(mockExecutorCreate).not.toHaveBeenCalled();
  });

  it('allows local webhook requests when insecure dev bypass is enabled', async () => {
    mockParseMemoryExtractionConfig.mockReturnValue({
      webhook: {
        allowInsecureDev: true,
        headers: undefined,
      },
    });

    const { POST } = await import('./route');
    const res = await POST(
      new Request('http://localhost/api/webhooks/memory-extraction', {
        body: JSON.stringify({ userId: 'user-1' }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      message: 'Memory extraction executed successfully.',
      result: { processedUsers: 1 },
    });
    expect(mockPayloadParse).toHaveBeenCalledWith({
      baseUrl: 'http://localhost',
      userId: 'user-1',
    });
    expect(mockExecutorCreate).toHaveBeenCalledTimes(1);
    expect(mockRunDirect).toHaveBeenCalledWith({ baseUrl: 'http://localhost', userId: 'user-1' });
  });
});
