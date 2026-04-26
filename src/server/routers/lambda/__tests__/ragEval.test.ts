import { EvalEvaluationStatus } from '@lobechat/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ragEvalRouter } from '@/server/routers/lambda/ragEval';

const mockEvalEvaluationFindById = vi.fn();
const mockEvalEvaluationQueryBySourceSetId = vi.fn();
const mockEvalEvaluationUpdate = vi.fn();
const mockEvaluationRecordFindByEvaluationId = vi.fn();
const mockFileServiceUploadContent = vi.fn();
const mockFileServiceGetFullFileUrl = vi.fn();
const mockFileServiceCreateOpaqueUserBlobPath = vi.fn();
const mockSourceSetFindByIdAny = vi.fn();

vi.mock('@/database/models/file', () => ({
  FileModel: vi.fn(() => ({})),
}));

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: vi.fn(async () => ({})),
}));

vi.mock('@/database/models/ragEval', () => ({
  EvalDatasetModel: vi.fn(() => ({})),
  EvalDatasetRecordModel: vi.fn(() => ({})),
  EvalEvaluationModel: vi.fn(() => ({
    findById: mockEvalEvaluationFindById,
    queryBySourceSetId: mockEvalEvaluationQueryBySourceSetId,
    update: mockEvalEvaluationUpdate,
  })),
  EvaluationRecordModel: vi.fn(() => ({
    findByEvaluationId: mockEvaluationRecordFindByEvaluationId,
  })),
}));

vi.mock('@/database/models/sourceSet', () => ({
  SourceSetModel: vi.fn(() => ({
    findByIdAny: mockSourceSetFindByIdAny,
  })),
}));

vi.mock('@/server/routers/async', () => ({
  createAsyncCaller: vi.fn(),
}));

vi.mock('@/server/services/file', () => ({
  FileService: vi.fn(() => ({
    createOpaqueUserBlobPath: mockFileServiceCreateOpaqueUserBlobPath,
    getFullFileUrl: mockFileServiceGetFullFileUrl,
    uploadContent: mockFileServiceUploadContent,
  })),
}));

vi.mock('@lobechat/utils/server', () => ({
  getXorPayload: vi.fn(() => ({ apiKey: 'test-key' })),
}));

const createCaller = (ctxOverrides: Partial<any> = {}) =>
  ragEvalRouter.createCaller({
    authorizationHeader: 'Bearer test',
    userId: 'user-1',
    ...ctxOverrides,
  });

describe('ragEvalRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFileServiceCreateOpaqueUserBlobPath.mockResolvedValue({
      key: 'v2/spaces/spc_eval/blobs/rag-eval-records/test-id.jsonl',
      spaceId: 'spc_eval',
    });
    mockSourceSetFindByIdAny.mockResolvedValue({ id: 'ss-1', spaceId: 'spc_eval' });
  });

  it('persists the raw eval record storage key instead of a presigned URL', async () => {
    mockEvalEvaluationFindById.mockResolvedValue({
      id: 'eval-1',
      name: 'Bench',
      sourceSetId: 'ss-1',
    });
    mockEvaluationRecordFindByEvaluationId.mockResolvedValue([
      {
        answer: 'answer',
        context: ['ctx'],
        ideal: 'ideal',
        question: 'question',
        status: EvalEvaluationStatus.Success,
      },
    ]);

    const caller = createCaller();
    const result = await caller.checkEvaluationStatus({ id: 'eval-1' });

    expect(result).toEqual({ success: true });
    expect(mockFileServiceUploadContent).toHaveBeenCalledWith(
      'v2/spaces/spc_eval/blobs/rag-eval-records/test-id.jsonl',
      expect.any(String),
    );
    expect(mockFileServiceCreateOpaqueUserBlobPath).toHaveBeenCalledWith(
      'rag-eval-records',
      'jsonl',
      'spc_eval',
    );
    expect(mockEvalEvaluationUpdate).toHaveBeenCalledWith(
      'eval-1',
      expect.objectContaining({
        evalRecordsUrl: 'v2/spaces/spc_eval/blobs/rag-eval-records/test-id.jsonl',
        status: EvalEvaluationStatus.Success,
      }),
    );
    expect(mockFileServiceGetFullFileUrl).not.toHaveBeenCalled();
  });

  it('maps stored eval record paths to the stable download route', async () => {
    mockEvalEvaluationQueryBySourceSetId.mockResolvedValue([
      {
        createdAt: new Date('2026-04-05T00:00:00Z'),
        dataset: { id: 'dataset-1', name: 'Dataset' },
        evalRecordsUrl: 'v2/spaces/spc_eval/blobs/rag-eval-records/records.jsonl',
        id: 'eval-1',
        name: 'Bench',
        recordsStats: { success: 1, total: 1 },
        status: EvalEvaluationStatus.Success,
        updatedAt: new Date('2026-04-05T00:00:00Z'),
      },
      {
        createdAt: new Date('2026-04-05T00:00:00Z'),
        dataset: { id: 'dataset-2', name: 'Dataset 2' },
        evalRecordsUrl: undefined,
        id: 'eval-2',
        name: 'Bench 2',
        recordsStats: { success: 0, total: 0 },
        status: EvalEvaluationStatus.Pending,
        updatedAt: new Date('2026-04-05T00:00:00Z'),
      },
    ]);

    const caller = createCaller();
    const result = await caller.getEvaluationList({ sourceSetId: 'ss-1' });

    expect(result[0].evalRecordsUrl).toBe('/eval/records/eval-1');
    expect(result[1].evalRecordsUrl).toBeUndefined();
  });
});
