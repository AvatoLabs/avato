// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { auth } from '@/auth';
import { TopicShareModel } from '@/database/models/topicShare';
import { getServerDB } from '@/database/server';

import { GET } from './route';

vi.mock('@/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock('@/database/models/topicShare', () => ({
  TopicShareModel: {
    findByShareIdWithAccessCheck: vi.fn(),
  },
}));

vi.mock('@/database/server', () => ({
  getServerDB: vi.fn(),
}));

const mockServeAuthorizedFileDownload = vi.fn();
vi.mock('@/server/modules/file-proxy/serveAuthorizedFileDownload', () => ({
  serveAuthorizedFileDownload: (...args: unknown[]) => mockServeAuthorizedFileDownload(...args),
}));

describe('GET /share/t/[shareId]/f/[fileId]', () => {
  const mockDb = {
    select: vi.fn(),
  };

  beforeEach(() => {
    vi.mocked(getServerDB).mockResolvedValue(mockDb as any);
    vi.mocked(auth.api.getSession).mockResolvedValue(null);
    vi.mocked(TopicShareModel.findByShareIdWithAccessCheck).mockResolvedValue({
      ownerId: 'user-owner',
      shareId: 'share-1',
      topicId: 'topic-1',
      visibility: 'link',
    } as any);
    mockServeAuthorizedFileDownload.mockReset();
    mockServeAuthorizedFileDownload.mockResolvedValue(
      new Response(null, { status: 302, headers: { Location: 'https://s3/topic-share-file' } }),
    );
    mockDb.select.mockReset();
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([
                  {
                    authzEpoch: 7,
                    contentUid: 'res_file_1',
                    fileId: 'file-1',
                    fileType: 'image/png',
                    name: 'image.png',
                    spaceId: 'spc_1',
                    url: 'internal://image.png',
                  },
                ]),
              }),
            }),
          }),
        }),
      }),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when params are empty', async () => {
    const req = new Request('https://app.example.com/share/t//f/');
    const res = await GET(req, { params: Promise.resolve({ fileId: '', shareId: '' }) });
    expect(res.status).toBe(404);
    expect(TopicShareModel.findByShareIdWithAccessCheck).not.toHaveBeenCalled();
  });

  it('returns 404 for document-shaped topic attachment ids before share lookup', async () => {
    const req = new Request('https://app.example.com/share/t/share-1/f/docs_1');
    const res = await GET(req, {
      params: Promise.resolve({ fileId: 'docs_1', shareId: 'share-1' }),
    });

    expect(res.status).toBe(404);
    expect(TopicShareModel.findByShareIdWithAccessCheck).not.toHaveBeenCalled();
    expect(mockServeAuthorizedFileDownload).not.toHaveBeenCalled();
  });

  it('returns 404 when the shared file does not belong to the topic', async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      }),
    });

    const req = new Request('https://app.example.com/share/t/share-1/f/file-1');
    const res = await GET(req, {
      params: Promise.resolve({ fileId: 'file-1', shareId: 'share-1' }),
    });

    expect(res.status).toBe(404);
    expect(mockServeAuthorizedFileDownload).not.toHaveBeenCalled();
  });

  it('proxies shared topic attachments through serveAuthorizedFileDownload', async () => {
    const req = new Request('https://app.example.com/share/t/share-1/f/file-1');
    const res = await GET(req, {
      params: Promise.resolve({ fileId: 'file-1', shareId: 'share-1' }),
    });

    expect(res.status).toBe(302);
    expect(TopicShareModel.findByShareIdWithAccessCheck).toHaveBeenCalledWith(
      mockDb,
      'share-1',
      undefined,
    );
    expect(mockServeAuthorizedFileDownload).toHaveBeenCalledWith(
      expect.objectContaining({
        accessOverride: {
          authzEpoch: 7,
          canAccess: true,
          contentUid: 'res_file_1',
          matchedBy: 'share_link',
          spaceId: 'spc_1',
        },
        cacheIdentity: 'topic-share:share-1',
        downloadVia: 'share_path',
        eventVia: 'topic_share',
        fileId: 'file-1',
        shareLinkId: null,
        shareToken: null,
        userId: undefined,
      }),
    );
  });
});
