// @vitest-environment node
import { type LobeChatDatabase } from '@lobechat/database';
import { type FileItem } from '@lobechat/database/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { serveAuthorizedFileDownload } from './serveAuthorizedFileDownload';

const mockGetAccessMatch = vi.fn();

vi.mock('@/server/services/content', () => ({
  ResourceAuthorizer: vi.fn().mockImplementation(() => ({
    getAccessMatch: mockGetAccessMatch,
  })),
}));

const minimalFile = {
  fileType: 'text/plain',
  id: 'file-1',
  name: 'a.txt',
  url: 'files/a.txt',
} as FileItem;

const minimalReq = new Request('https://app.example.com/share/f/tok');

describe('serveAuthorizedFileDownload', () => {
  beforeEach(() => {
    mockGetAccessMatch.mockReset();
  });

  describe('access denied', () => {
    it('returns 404 when shareToken is set (Phase 5 single failure shape)', async () => {
      mockGetAccessMatch.mockResolvedValue(null);

      const res = await serveAuthorizedFileDownload({
        db: {} as LobeChatDatabase,
        downloadVia: 'share_path',
        file: minimalFile,
        fileId: 'file-1',
        req: minimalReq,
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
});
