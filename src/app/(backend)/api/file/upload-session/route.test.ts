// @vitest-environment node
import { Readable } from 'node:stream';

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { auth } from '@/auth';
import { getServerDB } from '@/database/server';
import { getPrivateBlobS3 } from '@/server/modules/PrivateBlobS3';

import { POST } from './route';

const mockFindPendingUploadSessionById = vi.fn();
const mockUploadBody = vi.fn();

vi.mock('@/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock('@/database/server', () => ({
  getServerDB: vi.fn(),
}));

vi.mock('@/database/models/content', () => ({
  ContentModel: vi.fn(() => ({
    findPendingUploadSessionById: (...args: unknown[]) => mockFindPendingUploadSessionById(...args),
  })),
}));

vi.mock('@/server/modules/PrivateBlobS3', () => ({
  getPrivateBlobS3: vi.fn(() => ({
    uploadBody: (...args: unknown[]) => mockUploadBody(...args),
  })),
}));

vi.mock('@/libs/oidc-provider/jwt', () => ({
  validateOIDCJWT: vi.fn(),
}));

vi.mock('@/envs/auth', () => ({
  LOBE_CHAT_OIDC_AUTH_HEADER: 'x-lobe-oidc-auth',
}));

const sessionRecord = {
  createdBy: 'user-1',
  expectedSize: 5,
  storageKey: 'uploads/spc_1/ups_1/opq_1',
};

function makeRawUploadRequest({
  body = 'hello',
  contentLength = body.length.toString(),
  contentType = 'text/plain',
  uploadSessionId = 'ups_1',
}: {
  body?: string;
  contentLength?: string;
  contentType?: string;
  uploadSessionId?: string;
} = {}) {
  return new NextRequest('http://localhost/api/file/upload-session', {
    body,
    headers: {
      'content-length': contentLength,
      'content-type': contentType,
      'x-lobe-upload-session-id': uploadSessionId,
    },
    method: 'POST',
  });
}

function makeFormUploadRequest(uploadSessionId = 'ups_1', fileContent: BlobPart = 'hello') {
  const formData = new FormData();
  formData.append('uploadSessionId', uploadSessionId);
  formData.append('file', new File([fileContent], 'blob.txt', { type: 'text/plain' }));

  return new NextRequest('http://localhost/api/file/upload-session', {
    body: formData,
    method: 'POST',
  });
}

describe('POST /api/file/upload-session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindPendingUploadSessionById.mockResolvedValue(sessionRecord);
    mockUploadBody.mockResolvedValue(undefined);
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: 'user-1' },
    } as Awaited<ReturnType<typeof auth.api.getSession>>);
    vi.mocked(getServerDB).mockResolvedValue({} as Awaited<ReturnType<typeof getServerDB>>);
    vi.mocked(getPrivateBlobS3).mockClear();
  });

  it('should stream raw uploads to PrivateBlobS3 with an explicit content length', async () => {
    const response = await POST(makeRawUploadRequest());

    expect(response.status).toBe(200);
    expect(mockUploadBody).toHaveBeenCalledWith(sessionRecord.storageKey, expect.any(Readable), {
      contentLength: sessionRecord.expectedSize,
      contentType: 'text/plain',
    });
  });

  it('should reject raw uploads when the declared size mismatches the session', async () => {
    const response = await POST(makeRawUploadRequest({ contentLength: '4' }));

    expect(response.status).toBe(400);
    expect(mockUploadBody).not.toHaveBeenCalled();
  });

  it('should upload multipart form data with a buffer body and fixed length', async () => {
    const response = await POST(makeFormUploadRequest());

    expect(response.status).toBe(200);
    expect(mockUploadBody).toHaveBeenCalledWith(sessionRecord.storageKey, expect.any(Buffer), {
      contentLength: sessionRecord.expectedSize,
      contentType: 'text/plain',
    });
  });
});
