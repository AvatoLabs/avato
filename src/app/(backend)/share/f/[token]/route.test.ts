// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

const mockResolveShareLinkByToken = vi.fn();
vi.mock('@/database/models/resource', () => ({
  ResourceModel: vi.fn().mockImplementation(() => ({
    resolveShareLinkByToken: mockResolveShareLinkByToken,
  })),
}));

const mockGetFileById = vi.fn();
vi.mock('@/database/models/file', () => ({
  FileModel: {
    getFileById: (...args: unknown[]) => mockGetFileById(...args),
  },
}));

const mockServeAuthorizedFileDownload = vi.fn();
vi.mock('@/server/modules/file-proxy/serveAuthorizedFileDownload', () => ({
  serveAuthorizedFileDownload: (...args: unknown[]) => mockServeAuthorizedFileDownload(...args),
}));

vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
  },
}));

import bcrypt from 'bcryptjs';
import { auth } from '@/auth';
import { getServerDB } from '@/database/server';

import { GET } from './route';

describe('GET /share/f/[token]', () => {
  const mockDb = {
    select: vi.fn(),
  };

  beforeEach(() => {
    vi.mocked(getServerDB).mockResolvedValue(mockDb as any);
    vi.mocked(auth.api.getSession).mockResolvedValue(null);
    mockResolveShareLinkByToken.mockReset();
    mockGetFileById.mockReset();
    mockServeAuthorizedFileDownload.mockReset();
    mockDb.select.mockReset();

    const registryRow = { kind: 'file' as const, localId: 'f1', resourceUid: 'ru1' };
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([registryRow]),
        }),
      }),
    });

    mockResolveShareLinkByToken.mockResolvedValue({
      expiresAt: new Date(),
      id: 'lnk_1',
      passwordHash: null,
      resourceUid: 'ru1',
    });
    mockGetFileById.mockResolvedValue({ id: 'f1', name: 'a.txt', url: 'k', fileType: 'text/plain' });
    mockServeAuthorizedFileDownload.mockResolvedValue(
      new Response(null, { status: 302, headers: { Location: 'https://s3/x' } }),
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when token is empty', async () => {
    const req = new Request('https://app.example.com/share/f/');
    const res = await GET(req, { params: Promise.resolve({ token: '' }) });
    expect(res.status).toBe(404);
    expect(mockResolveShareLinkByToken).not.toHaveBeenCalled();
  });

  it('returns 404 when token is only whitespace', async () => {
    const req = new Request('https://app.example.com/share/f/%20%20');
    const res = await GET(req, { params: Promise.resolve({ token: '  ' }) });
    expect(res.status).toBe(404);
  });

  it('returns 404 when share link cannot be resolved', async () => {
    mockResolveShareLinkByToken.mockResolvedValue(null);
    const req = new Request('https://app.example.com/share/f/bad');
    const res = await GET(req, { params: Promise.resolve({ token: 'bad' }) });
    expect(res.status).toBe(404);
  });

  it('returns 401 when password is required but missing', async () => {
    mockResolveShareLinkByToken.mockResolvedValue({
      expiresAt: new Date(),
      id: 'lnk_1',
      passwordHash: 'hashed',
      resourceUid: 'ru1',
    });
    const req = new Request('https://app.example.com/share/f/tok');
    const res = await GET(req, { params: Promise.resolve({ token: 'tok' }) });
    expect(res.status).toBe(401);
    expect(mockGetFileById).not.toHaveBeenCalled();
  });

  it('returns 404 when password is wrong (same shape as invalid token)', async () => {
    mockResolveShareLinkByToken.mockResolvedValue({
      expiresAt: new Date(),
      id: 'lnk_1',
      passwordHash: 'hashed',
      resourceUid: 'ru1',
    });
    vi.mocked(bcrypt.compare).mockResolvedValue(false as any);
    const req = new Request('https://app.example.com/share/f/tok?password=wrong');
    const res = await GET(req, { params: Promise.resolve({ token: 'tok' }) });
    expect(res.status).toBe(404);
  });

  it('returns 404 when registry row is not a file', async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ kind: 'document', localId: 'd1', resourceUid: 'ru1' }]),
        }),
      }),
    });
    const req = new Request('https://app.example.com/share/f/tok');
    const res = await GET(req, { params: Promise.resolve({ token: 'tok' }) });
    expect(res.status).toBe(404);
    expect(mockServeAuthorizedFileDownload).not.toHaveBeenCalled();
  });

  it('returns 404 when file row is missing', async () => {
    mockGetFileById.mockResolvedValue(null);
    const req = new Request('https://app.example.com/share/f/tok');
    const res = await GET(req, { params: Promise.resolve({ token: 'tok' }) });
    expect(res.status).toBe(404);
  });

  it('calls serveAuthorizedFileDownload on success', async () => {
    const req = new Request('https://app.example.com/share/f/good?x=1');
    const res = await GET(req, { params: Promise.resolve({ token: 'good' }) });

    expect(res.status).toBe(302);
    expect(mockServeAuthorizedFileDownload).toHaveBeenCalledWith(
      expect.objectContaining({
        downloadVia: 'share_path',
        fileId: 'f1',
        shareLinkId: 'lnk_1',
        shareToken: 'good',
        userId: undefined,
      }),
    );
  });

  it('accepts correct password and continues', async () => {
    mockResolveShareLinkByToken.mockResolvedValue({
      expiresAt: new Date(),
      id: 'lnk_1',
      passwordHash: 'hashed',
      resourceUid: 'ru1',
    });
    vi.mocked(bcrypt.compare).mockResolvedValue(true as any);

    const req = new Request('https://app.example.com/share/f/tok?password=secret');
    const res = await GET(req, { params: Promise.resolve({ token: 'tok' }) });

    expect(res.status).toBe(302);
    expect(bcrypt.compare).toHaveBeenCalledWith('secret', 'hashed');
    expect(mockServeAuthorizedFileDownload).toHaveBeenCalled();
  });
});
