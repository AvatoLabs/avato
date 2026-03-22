import { beforeEach, describe, expect, it, vi } from 'vitest';

import { lambdaClient } from '@/libs/trpc/client';
import { API_ENDPOINTS } from '@/services/_url';

import { UPLOAD_NETWORK_ERROR, uploadService } from '../upload';

vi.mock('@lobechat/model-runtime', () => ({
  parseDataUri: vi.fn(),
}));

vi.mock('@/libs/trpc/client', () => ({
  lambdaClient: {
    upload: {
      completeResourceUpload: {
        mutate: vi.fn(),
      },
      prepareResourceUpload: {
        mutate: vi.fn(),
      },
    },
  },
}));

vi.mock('js-sha256', () => ({
  sha256: vi.fn((data) => {
    if (data instanceof ArrayBuffer) {
      return 'mock-hash-' + data.byteLength;
    }
    if (data instanceof Uint8Array) {
      return 'mock-hash-' + data.byteLength;
    }
    return 'mock-hash';
  }),
}));

const mockStorageKey = 'uploads/spc_test/sess_1/opq_upload_id';
const mockSessionId = 'ups_sess_1';
const mockPreSignUrl = 'https://example.com/presign';

function mockXhrSuccess() {
  const xhrMock = {
    addEventListener: vi.fn((event, handler) => {
      if (event === 'load') {
        setTimeout(() => handler({ target: { status: 200 } }), 0);
      }
    }),
    open: vi.fn(),
    send: vi.fn(),
    setRequestHeader: vi.fn(),
    status: 200,
    upload: {
      addEventListener: vi.fn(),
    },
  };
  global.XMLHttpRequest = vi.fn(() => xhrMock) as any;
}

describe('UploadService', () => {
  const mockFile = new File(['test'], 'test.png', { type: 'image/png' });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, 'now').mockImplementation(() => 3_600_000);

    vi.mocked(lambdaClient.upload.prepareResourceUpload.mutate).mockResolvedValue({
      expiresAt: new Date().toISOString(),
      presignedUrl: mockPreSignUrl,
      sessionId: mockSessionId,
      storageKey: mockStorageKey,
    });
    vi.mocked(lambdaClient.upload.completeResourceUpload.mutate).mockResolvedValue({
      blobId: 'blob_1',
      etag: 'etag',
      size: mockFile.size,
      storageKey: mockStorageKey,
    });
  });

  describe('uploadFileToS3', () => {
    beforeEach(() => {
      mockXhrSuccess();
    });

    it('should prepare session, PUT upload, and complete', async () => {
      const result = await uploadService.uploadFileToS3(mockFile, {});

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        date: '1',
        dirname: 'uploads/spc_test/sess_1',
        filename: 'test.png',
        path: mockStorageKey,
      });
      expect(lambdaClient.upload.prepareResourceUpload.mutate).toHaveBeenCalled();
      expect(lambdaClient.upload.completeResourceUpload.mutate).toHaveBeenCalledWith({
        uploadSessionId: mockSessionId,
      });
    });

    it('should forward space context to prepareResourceUpload', async () => {
      await uploadService.uploadFileToS3(mockFile, {
        knowledgeBaseId: 'kb_1',
        parentId: 'doc_1',
        sha256: 'prefixed',
        spaceId: 'spc_x',
      });

      expect(lambdaClient.upload.prepareResourceUpload.mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          knowledgeBaseId: 'kb_1',
          parentId: 'doc_1',
          sha256: 'prefixed',
          spaceId: 'spc_x',
        }),
      );
    });
  });

  describe('uploadBase64ToS3', () => {
    beforeEach(() => {
      mockXhrSuccess();
    });

    it('should upload base64 data successfully', async () => {
      const { parseDataUri } = await import('@lobechat/model-runtime');
      vi.mocked(parseDataUri).mockReturnValueOnce({
        base64: 'dGVzdA==',
        mimeType: 'image/png',
        type: 'base64',
      });

      const { sha256 } = await import('js-sha256');
      vi.mocked(sha256).mockReturnValue('base64-hash');

      const base64Data = 'data:image/png;base64,dGVzdA==';
      const result = await uploadService.uploadBase64ToS3(base64Data);

      expect(result).toMatchObject({
        fileType: 'image/png',
        hash: expect.any(String),
        metadata: expect.objectContaining({
          path: mockStorageKey,
        }),
        size: expect.any(Number),
      });
    });

    it('should throw error for invalid base64 data', async () => {
      const { parseDataUri } = await import('@lobechat/model-runtime');
      vi.mocked(parseDataUri).mockReturnValueOnce({
        base64: null,
        mimeType: null,
        type: 'url',
      });

      await expect(uploadService.uploadBase64ToS3('not-a-base64-string')).rejects.toThrow(
        'Invalid base64 data for image',
      );
    });

    it('should use custom filename base when provided', async () => {
      const { parseDataUri } = await import('@lobechat/model-runtime');
      vi.mocked(parseDataUri).mockReturnValueOnce({
        base64: 'dGVzdA==',
        mimeType: 'image/png',
        type: 'base64',
      });

      const base64Data = 'data:image/png;base64,dGVzdA==';
      await uploadService.uploadBase64ToS3(base64Data, {
        filename: 'custom-image',
      });

      expect(lambdaClient.upload.prepareResourceUpload.mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: 'custom-image.png',
        }),
      );
    });
  });

  describe('uploadDataToS3', () => {
    beforeEach(() => {
      mockXhrSuccess();
    });

    it('should upload JSON data successfully', async () => {
      vi.mocked(lambdaClient.upload.prepareResourceUpload.mutate).mockResolvedValueOnce({
        expiresAt: new Date().toISOString(),
        presignedUrl: mockPreSignUrl,
        sessionId: mockSessionId,
        storageKey: 'uploads/spc_test/sess_1/opq_json',
      });

      const data = { key: 'value', number: 123 };
      const result = await uploadService.uploadDataToS3(data);

      expect(result.success).toBe(true);
      expect(result.data.filename).toBe('data.json');
    });

    it('should use custom filename when provided', async () => {
      vi.mocked(lambdaClient.upload.prepareResourceUpload.mutate).mockResolvedValueOnce({
        expiresAt: new Date().toISOString(),
        presignedUrl: mockPreSignUrl,
        sessionId: mockSessionId,
        storageKey: 'uploads/spc_test/sess_1/opq_custom',
      });

      const data = { test: true };
      const result = await uploadService.uploadDataToS3(data, {
        filename: 'custom.json',
      });

      expect(result.success).toBe(true);
      expect(lambdaClient.upload.prepareResourceUpload.mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: 'custom.json',
        }),
      );
    });
  });

  describe('uploadToServerS3', () => {
    beforeEach(() => {
      const xhrMock = {
        addEventListener: vi.fn(),
        open: vi.fn(),
        send: vi.fn(),
        setRequestHeader: vi.fn(),
        status: 200,
        upload: {
          addEventListener: vi.fn(),
        },
      };
      global.XMLHttpRequest = vi.fn(() => xhrMock) as any;
    });

    it('should upload file successfully with progress', async () => {
      const onProgress = vi.fn();
      const xhr = new XMLHttpRequest();

      vi.spyOn(xhr, 'addEventListener').mockImplementation((event, handler) => {
        if (event === 'load') {
          // @ts-expect-error - mock implementation
          handler({ target: { status: 200 } });
        }
      });

      const result = await uploadService.uploadToServerS3(mockFile, { onProgress });

      expect(result).toEqual({
        date: '1',
        dirname: 'uploads/spc_test/sess_1',
        filename: 'test.png',
        path: mockStorageKey,
      });
    });

    it('should report progress during upload', async () => {
      const onProgress = vi.fn();
      const xhr = new XMLHttpRequest();

      vi.spyOn(xhr.upload, 'addEventListener').mockImplementation((event, handler) => {
        if (event === 'progress') {
          // @ts-expect-error - mock implementation
          handler({
            lengthComputable: true,
            loaded: 500,
            total: 1000,
          });
        }
      });

      vi.spyOn(xhr, 'addEventListener').mockImplementation((event, handler) => {
        if (event === 'load') {
          // @ts-expect-error - mock implementation
          handler({ target: { status: 200 } });
        }
      });

      await uploadService.uploadToServerS3(mockFile, { onProgress });

      expect(onProgress).toHaveBeenCalledWith(
        'uploading',
        expect.objectContaining({
          progress: expect.any(Number),
          restTime: expect.any(Number),
          speed: expect.any(Number),
        }),
      );
    });

    it('should handle network error', async () => {
      const xhr = new XMLHttpRequest();

      vi.spyOn(xhr, 'addEventListener').mockImplementation((event, handler) => {
        if (event === 'error') {
          Object.assign(xhr, { status: 0 });
          // @ts-expect-error - mock implementation
          handler({});
        }
      });

      await expect(uploadService.uploadToServerS3(mockFile, {})).rejects.toBe(UPLOAD_NETWORK_ERROR);
    });

    it('should handle upload error', async () => {
      const xhr = new XMLHttpRequest();

      vi.spyOn(xhr, 'addEventListener').mockImplementation((event, handler) => {
        if (event === 'load') {
          Object.assign(xhr, { status: 400, statusText: 'Bad Request' });

          // @ts-expect-error - mock implementation
          handler({});
        }
      });

      await expect(uploadService.uploadToServerS3(mockFile, {})).rejects.toBe('Bad Request');
    });
  });

  describe('getImageFileByUrlWithCORS', () => {
    beforeEach(() => {
      global.fetch = vi.fn();
    });

    it('should fetch and create file from URL', async () => {
      const url = 'https://example.com/image.png';
      const filename = 'test.png';
      const mockArrayBuffer = new ArrayBuffer(8);

      vi.mocked(global.fetch).mockResolvedValue({
        arrayBuffer: () => Promise.resolve(mockArrayBuffer),
      } as Response);

      const result = await uploadService.getImageFileByUrlWithCORS(url, filename);

      expect(global.fetch).toHaveBeenCalledWith(API_ENDPOINTS.proxy, {
        body: url,
        method: 'POST',
      });
      expect(result).toBeInstanceOf(File);
      expect(result.name).toBe(filename);
      expect(result.type).toBe('image/png');
    });

    it('should handle custom file type', async () => {
      const url = 'https://example.com/image.jpg';
      const filename = 'test.jpg';
      const fileType = 'image/jpeg';
      const mockArrayBuffer = new ArrayBuffer(8);

      vi.mocked(global.fetch).mockResolvedValue({
        arrayBuffer: () => Promise.resolve(mockArrayBuffer),
      } as Response);

      const result = await uploadService.getImageFileByUrlWithCORS(url, filename, fileType);

      expect(result.type).toBe(fileType);
    });
  });
});
