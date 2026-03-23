// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { auth } from '@/auth';
import { getPrivateBlobS3 } from '@/server/modules/PrivateBlobS3';

import { getLegacyUploadPathnameValidationError, POST } from './route';

vi.mock('@/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

const mockUploadBuffer = vi.fn();
vi.mock('@/server/modules/PrivateBlobS3', () => ({
  getPrivateBlobS3: vi.fn(() => ({
    uploadBuffer: (...args: unknown[]) => mockUploadBuffer(...args),
  })),
}));

vi.mock('@/libs/oidc-provider/jwt', () => ({
  validateOIDCJWT: vi.fn(),
}));

vi.mock('@/envs/auth', () => ({
  LOBE_CHAT_OIDC_AUTH_HEADER: 'x-lobe-oidc-auth',
}));

function makeUploadRequest(pathname: string, fileContent: BlobPart = 'hi') {
  const fd = new FormData();
  fd.append('pathname', pathname);
  fd.append('file', new File([fileContent], 'blob.bin', { type: 'application/octet-stream' }));
  return new NextRequest('http://localhost/api/file/upload', { method: 'POST', body: fd });
}

describe('getLegacyUploadPathnameValidationError', () => {
  it('should accept a normal relative key', () => {
    expect(getLegacyUploadPathnameValidationError('files/bucket/u/f.bin')).toBeNull();
  });

  it('should reject empty, non-string, absolute, traversal, NUL, and overlong', () => {
    expect(getLegacyUploadPathnameValidationError('')).toBe('Invalid pathname.');
    expect(getLegacyUploadPathnameValidationError(null)).toBe('Invalid pathname.');
    expect(getLegacyUploadPathnameValidationError('/abs')).toBe('Invalid pathname.');
    expect(getLegacyUploadPathnameValidationError('a/../b')).toBe('Invalid pathname.');
    expect(getLegacyUploadPathnameValidationError('..')).toBe('Invalid pathname.');
    expect(getLegacyUploadPathnameValidationError('ok\\..\\x')).toBe('Invalid pathname.');
    expect(getLegacyUploadPathnameValidationError('a\0b')).toBe('Invalid pathname.');
    expect(getLegacyUploadPathnameValidationError('x'.repeat(2049))).toBe('Invalid pathname.');
  });
});

describe('POST /api/file/upload', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    mockUploadBuffer.mockReset();
    mockUploadBuffer.mockResolvedValue(undefined);
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: 'user-1' },
    } as Awaited<ReturnType<typeof auth.api.getSession>>);
    vi.mocked(getPrivateBlobS3).mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should 401 when unauthenticated', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null);
    const res = await POST(makeUploadRequest('files/b/k/x.bin'));
    expect(res.status).toBe(401);
    expect(mockUploadBuffer).not.toHaveBeenCalled();
  });

  it('should 400 on path traversal pathname', async () => {
    const res = await POST(makeUploadRequest('files/../evil'));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe('Invalid pathname.');
    expect(mockUploadBuffer).not.toHaveBeenCalled();
  });

  it('should 400 when file field is missing', async () => {
    const fd = new FormData();
    fd.append('pathname', 'files/b/k/x.bin');
    const req = new NextRequest('http://localhost/api/file/upload', { method: 'POST', body: fd });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe('Invalid file payload.');
    expect(mockUploadBuffer).not.toHaveBeenCalled();
  });

  it('should upload with PrivateBlobS3 when pathname is valid', async () => {
    const res = await POST(makeUploadRequest('files/bucket/u/key.bin', new Uint8Array([1, 2, 3])));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok?: boolean };
    expect(body.ok).toBe(true);
    expect(mockUploadBuffer).toHaveBeenCalledTimes(1);
    expect(mockUploadBuffer).toHaveBeenCalledWith(
      'files/bucket/u/key.bin',
      expect.any(Buffer),
      'application/octet-stream',
    );
    const buf = mockUploadBuffer.mock.calls[0][1] as Buffer;
    expect([...buf]).toEqual([1, 2, 3]);
  });
});
