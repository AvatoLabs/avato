// @vitest-environment node
import { type LobeChatDatabase } from '@lobechat/database';
import { type FileItem } from '@lobechat/database/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { serveAuthorizedFileDownload } from './serveAuthorizedFileDownload';

const mockGetAccessMatch = vi.fn();
const mockCreateAccessEvent = vi.fn();
const mockCreatePreSignedUrlForPreview = vi.fn();

vi.mock('@/database/models/content', () => ({
  ContentModel: vi.fn().mockImplementation(() => ({
    createAccessEvent: mockCreateAccessEvent,
  })),
}));

vi.mock('@/envs/redis', () => ({
  getRedisConfig: vi.fn(() => ({})),
}));

vi.mock('@/libs/redis', () => ({
  initializeRedis: vi.fn(),
  isRedisEnabled: vi.fn(() => false),
}));

vi.mock('@/server/services/content', () => ({
  ContentAuthorizer: vi.fn().mockImplementation(() => ({
    getAccessMatch: mockGetAccessMatch,
  })),
}));

vi.mock('@/server/services/file', () => ({
  FileService: vi.fn().mockImplementation(() => ({
    createPreSignedUrlForPreview: mockCreatePreSignedUrlForPreview,
  })),
}));

const minimalFile = {
  fileType: 'text/plain',
  id: 'file-1',
  name: 'a.txt',
  url: 'files/a.txt',
} as FileItem;

describe('serveAuthorizedFileDownload', () => {
  beforeEach(() => {
    mockCreateAccessEvent.mockReset();
    mockCreatePreSignedUrlForPreview.mockReset();
    mockGetAccessMatch.mockReset();
    mockCreatePreSignedUrlForPreview.mockResolvedValue('https://storage.example.com/files/a.txt');
  });

  describe('access denied', () => {
    it('returns 404 when shareToken is set (Phase 5 single failure shape)', async () => {
      mockGetAccessMatch.mockResolvedValue(null);

      const res = await serveAuthorizedFileDownload({
        db: {} as LobeChatDatabase,
        downloadVia: 'share_path',
        file: minimalFile,
        fileId: 'file-1',
        req: new Request('https://app.example.com/share/f/tok'),
        shareLinkId: 'lnk_1',
        shareToken: 'raw-token',
        userId: undefined,
      });

      expect(res.status).toBe(404);
      expect(mockGetAccessMatch).toHaveBeenCalledWith(
        expect.objectContaining({
          capability: 'download_blob',
          id: 'file-1',
          kind: 'file',
          shareToken: 'raw-token',
        }),
      );
    });

    it('returns 403 when no shareToken (session download)', async () => {
      mockGetAccessMatch.mockResolvedValue({ canAccess: false });

      const res = await serveAuthorizedFileDownload({
        db: {} as LobeChatDatabase,
        downloadVia: 'session',
        file: minimalFile,
        fileId: 'file-1',
        req: new Request('https://app.example.com/f/file-1'),
        shareLinkId: null,
        shareToken: null,
        userId: 'user-1',
      });

      expect(res.status).toBe(403);
      expect(mockGetAccessMatch).toHaveBeenCalledWith(
        expect.objectContaining({
          shareToken: null,
        }),
      );
    });
  });

  describe('access events', () => {
    it('records share downloads with share_download accessType', async () => {
      mockGetAccessMatch.mockResolvedValue({
        authzEpoch: 3,
        canAccess: true,
        contentUid: 'cnt_1',
        matchedBy: 'share_link',
        spaceId: 'spc_1',
      });

      const res = await serveAuthorizedFileDownload({
        db: {} as LobeChatDatabase,
        downloadVia: 'share_path',
        file: minimalFile,
        fileId: 'file-1',
        req: new Request('https://app.example.com/share/f/tok', {
          headers: {
            'user-agent': 'Vitest',
            'x-forwarded-for': '203.0.113.8',
          },
        }),
        shareLinkId: 'lnk_1',
        shareToken: 'raw-token',
        userId: undefined,
      });

      expect(res.status).toBe(302);
      expect(mockCreateAccessEvent).toHaveBeenCalledWith({
        accessType: 'share_download',
        contentUid: 'cnt_1',
        metadata: {
          downloadVia: 'share_path',
          fileId: 'file-1',
          matchedBy: 'share_link',
          via: 'share_link',
        },
        shareLinkId: 'lnk_1',
        sourceIp: '203.0.113.8',
        spaceId: 'spc_1',
        userAgent: 'Vitest',
      });
    });

    it('keeps session downloads under file_download accessType', async () => {
      mockGetAccessMatch.mockResolvedValue({
        authzEpoch: 2,
        canAccess: true,
        contentUid: 'cnt_2',
        matchedBy: 'session_permission',
        spaceId: 'spc_2',
      });

      const res = await serveAuthorizedFileDownload({
        db: {} as LobeChatDatabase,
        downloadVia: 'session',
        file: minimalFile,
        fileId: 'file-1',
        req: new Request('https://app.example.com/f/file-1', {
          headers: {
            'user-agent': 'Vitest',
            'x-real-ip': '198.51.100.9',
          },
        }),
        shareLinkId: null,
        shareToken: null,
        userId: 'user-1',
      });

      expect(res.status).toBe(302);
      expect(mockCreateAccessEvent).toHaveBeenCalledWith({
        accessType: 'file_download',
        contentUid: 'cnt_2',
        metadata: {
          downloadVia: 'session',
          fileId: 'file-1',
          matchedBy: 'session_permission',
          via: 'session',
        },
        shareLinkId: null,
        sourceIp: '198.51.100.9',
        spaceId: 'spc_2',
        userAgent: 'Vitest',
      });
    });

    it('does not record a download event when signed URL generation fails', async () => {
      mockGetAccessMatch.mockResolvedValue({
        authzEpoch: 2,
        canAccess: true,
        contentUid: 'cnt_3',
        matchedBy: 'share_link',
        spaceId: 'spc_3',
      });
      mockCreatePreSignedUrlForPreview.mockRejectedValue(new Error('storage unavailable'));

      await expect(
        serveAuthorizedFileDownload({
          db: {} as LobeChatDatabase,
          downloadVia: 'share_path',
          file: minimalFile,
          fileId: 'file-1',
          req: new Request('https://app.example.com/share/f/tok'),
          shareLinkId: 'lnk_3',
          shareToken: 'raw-token',
          userId: undefined,
        }),
      ).rejects.toThrow('storage unavailable');

      expect(mockCreateAccessEvent).not.toHaveBeenCalled();
    });
  });
});
