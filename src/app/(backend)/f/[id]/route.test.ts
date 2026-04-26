// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { auth } from '@/auth';
import { LOBE_CHAT_AUTH_HEADER, LOBE_CHAT_OIDC_AUTH_HEADER } from '@/envs/auth';
import { validateOIDCJWT } from '@/libs/oidc-provider/jwt';

import { GET } from './route';

vi.mock('@/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock('@/envs/app', () => ({
  appEnv: {
    APP_URL: 'https://app.example.com',
  },
}));

vi.mock('@lobechat/utils/server', () => ({
  getXorPayload: vi.fn(),
}));

vi.mock('@/libs/oidc-provider/jwt', () => ({
  validateOIDCJWT: vi.fn(),
}));

const mockGetServerDB = vi.fn();
vi.mock('@/database/server', () => ({
  getServerDB: () => mockGetServerDB(),
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

describe('GET /f/[id]', () => {
  beforeEach(() => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null);
    vi.mocked(validateOIDCJWT).mockReset();
    mockGetServerDB.mockReset();
    mockGetFileById.mockReset();
    mockServeAuthorizedFileDownload.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('legacy share query (?token=)', () => {
    it('should 307 redirect to /share/f/:token when token is present (no session)', async () => {
      const req = new Request('https://cdn.example.com/f/file-1?token=sharetok&other=strip');
      const res = await GET(req, { params: Promise.resolve({ id: 'file-1' }) });

      expect(res.status).toBe(307);
      expect(res.headers.get('Location')).toBe('https://cdn.example.com/share/f/sharetok');
      expect(mockGetServerDB).not.toHaveBeenCalled();
      expect(mockServeAuthorizedFileDownload).not.toHaveBeenCalled();
    });

    it('should preserve password query on redirect', async () => {
      const req = new Request('https://app.example.com/f/x?token=tok&password=secret&extra=1');
      const res = await GET(req, { params: Promise.resolve({ id: 'x' }) });

      expect(res.status).toBe(307);
      const loc = res.headers.get('Location');
      expect(loc).toContain('/share/f/tok');
      expect(loc).toContain('password=secret');
      expect(loc).not.toContain('extra=1');
      expect(loc).not.toContain('token=');
    });

    it('should resolve relative req.url against APP_URL', async () => {
      const req = {
        headers: new Headers(),
        url: '/f/any-id?token=rel',
      } as Request;

      const res = await GET(req, { params: Promise.resolve({ id: 'any-id' }) });

      expect(res.status).toBe(307);
      expect(res.headers.get('Location')).toBe('https://app.example.com/share/f/rel');
    });

    it('should trim token and encode path segment', async () => {
      const req = new Request('https://h/f/a?token=%20ab%2Fc%20');
      const res = await GET(req, { params: Promise.resolve({ id: 'a' }) });

      expect(res.status).toBe(307);
      expect(res.headers.get('Location')).toBe('https://h/share/f/ab%2Fc');
    });
  });

  describe('session download', () => {
    it('should 404 for document-shaped file ids before lookup', async () => {
      const req = new Request('https://app.example.com/f/docs_1');
      const res = await GET(req, { params: Promise.resolve({ id: 'docs_1' }) });

      expect(res.status).toBe(404);
      expect(mockGetServerDB).not.toHaveBeenCalled();
      expect(mockGetFileById).not.toHaveBeenCalled();
      expect(mockServeAuthorizedFileDownload).not.toHaveBeenCalled();
    });

    it('should 401 when no session and no token', async () => {
      const req = new Request('https://app.example.com/f/file-1');
      const res = await GET(req, { params: Promise.resolve({ id: 'file-1' }) });

      expect(res.status).toBe(401);
      expect(mockGetServerDB).not.toHaveBeenCalled();
    });

    it('should 401 when token is only whitespace (no redirect)', async () => {
      const req = new Request('https://app.example.com/f/file-1?token=%20%20');
      const res = await GET(req, { params: Promise.resolve({ id: 'file-1' }) });

      expect(res.status).toBe(401);
      expect(mockGetServerDB).not.toHaveBeenCalled();
    });

    it('should serve authorized download when session exists and no token', async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: 'user-1' },
      } as Awaited<ReturnType<typeof auth.api.getSession>>);
      mockGetServerDB.mockResolvedValue({});
      mockGetFileById.mockResolvedValue({ id: 'f1', url: 'k' });
      mockServeAuthorizedFileDownload.mockResolvedValue(
        new Response(null, { status: 302, headers: { Location: 'https://s3/presigned' } }),
      );

      const req = new Request('https://app.example.com/f/f1');
      const res = await GET(req, { params: Promise.resolve({ id: 'f1' }) });

      expect(res.status).toBe(302);
      expect(mockGetFileById).toHaveBeenCalledWith({}, 'f1');
      expect(mockServeAuthorizedFileDownload).toHaveBeenCalledWith(
        expect.objectContaining({
          downloadVia: 'session',
          fileId: 'f1',
          shareToken: null,
          userId: 'user-1',
        }),
      );
    });

    it('should serve authorized download when mobile auth header carries a user id', async () => {
      const { getXorPayload } = await import('@lobechat/utils/server');
      vi.mocked(getXorPayload).mockReturnValue({ userId: 'mobile-user-1' });

      mockGetServerDB.mockResolvedValue({});
      mockGetFileById.mockResolvedValue({ id: 'f1', url: 'k' });
      mockServeAuthorizedFileDownload.mockResolvedValue(
        new Response(null, { status: 302, headers: { Location: 'https://s3/presigned' } }),
      );

      const req = new Request('https://app.example.com/f/f1', {
        headers: {
          [LOBE_CHAT_AUTH_HEADER]: 'encrypted-mobile-auth',
        },
      });
      const res = await GET(req, { params: Promise.resolve({ id: 'f1' }) });

      expect(res.status).toBe(302);
      expect(mockServeAuthorizedFileDownload).toHaveBeenCalledWith(
        expect.objectContaining({
          fileId: 'f1',
          userId: 'mobile-user-1',
        }),
      );
    });

    it('should prefer oidc auth header user id when provided by mobile', async () => {
      const { getXorPayload } = await import('@lobechat/utils/server');
      vi.mocked(getXorPayload).mockReturnValue({ userId: 'encrypted-user-id' });
      vi.mocked(validateOIDCJWT).mockResolvedValue({ userId: 'oidc-user-1' } as any);

      mockGetServerDB.mockResolvedValue({});
      mockGetFileById.mockResolvedValue({ id: 'f1', url: 'k' });
      mockServeAuthorizedFileDownload.mockResolvedValue(
        new Response(null, { status: 302, headers: { Location: 'https://s3/presigned' } }),
      );

      const req = new Request('https://app.example.com/f/f1', {
        headers: {
          [LOBE_CHAT_AUTH_HEADER]: 'encrypted-mobile-auth',
          [LOBE_CHAT_OIDC_AUTH_HEADER]: 'oidc-token',
        },
      });
      const res = await GET(req, { params: Promise.resolve({ id: 'f1' }) });

      expect(res.status).toBe(302);
      expect(validateOIDCJWT).toHaveBeenCalledWith('oidc-token');
      expect(mockServeAuthorizedFileDownload).toHaveBeenCalledWith(
        expect.objectContaining({
          fileId: 'f1',
          userId: 'oidc-user-1',
        }),
      );
    });
  });
});
