// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { auth } from '@/auth';
import { ContentModel } from '@/database/models/content';
import { EvalEvaluationModel } from '@/database/models/ragEval';
import { getServerDB } from '@/database/server';
import { FileService } from '@/server/services/file';

import { GET } from './route';

vi.mock('@/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock('@/database/models/ragEval', () => ({
  EvalEvaluationModel: vi.fn(),
}));

vi.mock('@/database/models/content', () => ({
  ContentModel: vi.fn(),
}));

vi.mock('@/database/server', () => ({
  getServerDB: vi.fn(),
}));

vi.mock('@/envs/app', () => ({
  appEnv: {
    APP_URL: 'https://app.example.com',
  },
}));

vi.mock('@/server/services/file', () => ({
  FileService: vi.fn(),
}));

describe('GET /eval/records/[evaluationId]', () => {
  const mockDb = {};
  const mockCreateAccessEvent = vi.fn();
  const mockFindById = vi.fn();
  const mockGetFullFileUrl = vi.fn();

  beforeEach(() => {
    vi.mocked(getServerDB).mockResolvedValue(mockDb as any);
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: 'user-1' },
    } as Awaited<ReturnType<typeof auth.api.getSession>>);
    vi.mocked(EvalEvaluationModel).mockImplementation(
      () =>
        ({
          findById: mockFindById,
        }) as any,
    );
    vi.mocked(ContentModel).mockImplementation(
      () =>
        ({
          createAccessEvent: mockCreateAccessEvent,
        }) as any,
    );
    vi.mocked(FileService).mockImplementation(
      () =>
        ({
          getFullFileUrl: mockGetFullFileUrl,
        }) as any,
    );
    mockFindById.mockReset();
    mockCreateAccessEvent.mockReset();
    mockGetFullFileUrl.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without a session', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null);

    const res = await GET(new Request('https://app.example.com/eval/records/eval-1'), {
      params: Promise.resolve({ evaluationId: 'eval-1' }),
    });

    expect(res.status).toBe(401);
    expect(mockFindById).not.toHaveBeenCalled();
  });

  it('returns 404 when the evaluation has no stored records file', async () => {
    mockFindById.mockResolvedValue({
      evalRecordsUrl: null,
      id: 'eval-1',
    });

    const res = await GET(new Request('https://app.example.com/eval/records/eval-1'), {
      params: Promise.resolve({ evaluationId: 'eval-1' }),
    });

    expect(res.status).toBe(404);
    expect(mockGetFullFileUrl).not.toHaveBeenCalled();
  });

  it('redirects through a freshly issued file URL', async () => {
    mockFindById.mockResolvedValue({
      evalRecordsUrl: 'v2/spaces/spc_eval/blobs/rag-eval-records/2026-eval.jsonl',
      id: 'eval-1',
    });
    mockGetFullFileUrl.mockResolvedValue('https://blob.example.com/eval.jsonl?sig=1');

    const res = await GET(new Request('https://app.example.com/eval/records/eval-1'), {
      params: Promise.resolve({ evaluationId: 'eval-1' }),
    });

    expect(res.status).toBe(307);
    expect(res.headers.get('Location')).toBe('https://blob.example.com/eval.jsonl?sig=1');
    expect(mockFindById).toHaveBeenCalledWith('eval-1');
    expect(mockGetFullFileUrl).toHaveBeenCalledWith(
      'v2/spaces/spc_eval/blobs/rag-eval-records/2026-eval.jsonl',
    );
    expect(mockCreateAccessEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        accessType: 'file_url_issued',
        metadata: expect.objectContaining({
          evaluationId: 'eval-1',
          fileKey: 'v2/spaces/spc_eval/blobs/rag-eval-records/2026-eval.jsonl',
          via: 'rag_eval_records_proxy',
        }),
      }),
    );
  });
});
