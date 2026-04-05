// @vitest-environment node
import { TRPCError } from '@trpc/server';
import bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { contentShareRouter } from '@/server/routers/lambda/contentShare';

const mockAssertCanDelegateSharing = vi.fn();
const mockAssertCapability = vi.fn();
const mockCreateAccessEvent = vi.fn();
const mockCreateAuditLog = vi.fn();
const mockCreateShareLink = vi.fn();
const mockFindContentRegistryByLocalId = vi.fn();
const mockGetContentSummary = vi.fn();
const mockResolveShareLinkByToken = vi.fn();

vi.mock('@/database/models/content', () => ({
  ContentModel: vi.fn(() => ({
    createAccessEvent: mockCreateAccessEvent,
    createAuditLog: mockCreateAuditLog,
    createShareLink: mockCreateShareLink,
    findContentRegistryByLocalId: mockFindContentRegistryByLocalId,
    getContentSummary: mockGetContentSummary,
    resolveShareLinkByToken: mockResolveShareLinkByToken,
  })),
}));

vi.mock('@/envs/app', () => ({
  appEnv: {
    APP_URL: 'http://localhost:3010',
  },
}));

vi.mock('@/server/services/content', async () => {
  const actual = await vi.importActual('@/server/services/content');

  return {
    ...actual,
    ContentAuthorizer: vi.fn(() => ({
      assertCanDelegateSharing: mockAssertCanDelegateSharing,
      assertCapability: mockAssertCapability,
      explainAccess: vi.fn(),
    })),
  };
});

vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
  },
}));

vi.mock('@lobechat/utils', async () => {
  const actual = await vi.importActual('@lobechat/utils');

  return {
    ...actual,
    nanoid: vi.fn(() => 'share_tok_1'),
  };
});

describe('contentShareRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockFindContentRegistryByLocalId.mockResolvedValue({
      contentUid: 'cnt_1',
      kind: 'file',
      localId: 'file_1',
      spaceId: 'spc_1',
    });
    mockAssertCapability.mockResolvedValue(undefined);
    mockAssertCanDelegateSharing.mockResolvedValue(undefined);
    mockCreateShareLink.mockResolvedValue({
      id: 'shl_1',
    });
    mockResolveShareLinkByToken.mockResolvedValue({
      contentUid: 'cnt_1',
      expiresAt: new Date('2026-04-20T00:00:00.000Z'),
      id: 'shl_1',
      passwordHash: null,
      spaceId: 'spc_1',
    });
    mockGetContentSummary.mockResolvedValue({
      contentUid: 'cnt_1',
      createdBy: 'user-1',
      kind: 'file',
      localId: 'file_1',
      name: 'a.txt',
      parentId: null,
      spaceId: 'spc_1',
    });
    vi.mocked(bcrypt.hash).mockResolvedValue('hashed-password' as never);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
  });

  it('creates a file share link and returns both share URLs', async () => {
    const caller = contentShareRouter.createCaller({
      serverDB: {} as any,
      userId: 'user-1',
    } as any);

    const result = await caller.createContentShareLink({
      expiresInDays: 7,
      id: 'file_1',
      kind: 'file',
    });

    expect(mockAssertCapability).toHaveBeenCalledWith({
      capability: 'share_link',
      contentUid: 'cnt_1',
    });
    expect(mockAssertCanDelegateSharing).toHaveBeenCalledWith('cnt_1');
    expect(mockCreateShareLink).toHaveBeenCalledWith({
      contentUid: 'cnt_1',
      createdBy: 'user-1',
      expiresAt: expect.any(Date),
      passwordHash: undefined,
      rawToken: 'share_tok_1',
      spaceId: 'spc_1',
    });
    expect(result).toMatchObject({
      fileShareDownloadUrl: 'http://localhost:3010/share/f/share_tok_1',
      id: 'shl_1',
      shareUrl: 'http://localhost:3010/share/r/share_tok_1',
    });
    expect(mockCreateAuditLog).toHaveBeenCalledWith({
      action: 'content.share_link.create',
      contentUid: 'cnt_1',
      metadata: {
        expiresAt: expect.any(String),
        shareLinkId: 'shl_1',
      },
      spaceId: 'spc_1',
    });
  });

  it('hashes the password before creating a protected share link', async () => {
    const caller = contentShareRouter.createCaller({
      serverDB: {} as any,
      userId: 'user-1',
    } as any);

    await caller.createContentShareLink({
      expiresInDays: 1,
      id: 'file_1',
      kind: 'file',
      password: 'secret',
    });

    expect(bcrypt.hash).toHaveBeenCalledWith('secret', 10);
    expect(mockCreateShareLink).toHaveBeenCalledWith(
      expect.objectContaining({
        passwordHash: 'hashed-password',
      }),
    );
  });

  it('returns a file payload for a valid shared file token', async () => {
    const caller = contentShareRouter.createCaller({
      serverDB: {} as any,
      userId: 'anonymous',
    } as any);

    mockResolveShareLinkByToken.mockResolvedValue({
      contentUid: 'cnt_1',
      expiresAt: new Date('2026-04-20T00:00:00.000Z'),
      id: 'shl_1',
      passwordHash: null,
      spaceId: 'spc_1',
    });
    mockGetContentSummary.mockResolvedValue({
      contentUid: 'cnt_1',
      kind: 'file',
      localId: 'file_1',
      name: 'a.txt',
      parentId: null,
      spaceId: 'spc_1',
    });

    const result = await caller.getSharedContentByToken({ token: 'share_tok_1' });

    expect(result).toMatchObject({
      contentUid: 'cnt_1',
      fileType: 'application/octet-stream',
      kind: 'file',
      localId: 'file_1',
      name: 'a.txt',
      role: 'viewer',
    });
    expect(mockCreateAccessEvent).toHaveBeenCalledWith({
      accessType: 'share_view',
      contentUid: 'cnt_1',
      metadata: {
        kind: 'file',
        localId: 'file_1',
        via: 'share_page',
      },
      shareLinkId: 'shl_1',
      sourceIp: null,
      spaceId: 'spc_1',
      userAgent: null,
    });
  });

  it('requires the correct password for protected shares', async () => {
    const caller = contentShareRouter.createCaller({
      serverDB: {} as any,
      userId: 'anonymous',
    } as any);

    mockResolveShareLinkByToken.mockResolvedValue({
      contentUid: 'cnt_1',
      expiresAt: new Date('2026-04-20T00:00:00.000Z'),
      id: 'shl_1',
      passwordHash: 'hashed-password',
      spaceId: 'spc_1',
    });
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

    await expect(
      caller.getSharedContentByToken({ password: 'wrong', token: 'share_tok_1' }),
    ).rejects.toThrow(new TRPCError({ code: 'NOT_FOUND', message: 'SHARE_NOT_FOUND' }));
    expect(mockCreateAccessEvent).not.toHaveBeenCalled();
  });

  it('records authenticated public share access with request metadata', async () => {
    const caller = contentShareRouter.createCaller({
      clientIp: '203.0.113.10',
      serverDB: {} as any,
      userAgent: 'Vitest',
      userId: 'user-1',
    } as any);

    await caller.getSharedContentByToken({ token: 'share_tok_1' });

    expect(mockCreateAccessEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        shareLinkId: 'shl_1',
        sourceIp: '203.0.113.10',
        userAgent: 'Vitest',
      }),
    );
  });

  it('records table export access for shared resources', async () => {
    const caller = contentShareRouter.createCaller({
      clientIp: '203.0.113.20',
      serverDB: {} as any,
      userAgent: 'Vitest Export',
      userId: 'user-1',
    } as any);

    await caller.recordSharedContentExport({ format: 'csv', token: 'share_tok_1' });

    expect(mockCreateAccessEvent).toHaveBeenCalledWith({
      accessType: 'share_export',
      contentUid: 'cnt_1',
      metadata: {
        format: 'csv',
        kind: 'file',
        localId: 'file_1',
        via: 'share_page',
      },
      shareLinkId: 'shl_1',
      sourceIp: '203.0.113.20',
      spaceId: 'spc_1',
      userAgent: 'Vitest Export',
    });
  });

  it('records authenticated member exports for content resources', async () => {
    const caller = contentShareRouter.createCaller({
      clientIp: '203.0.113.30',
      serverDB: {} as any,
      userAgent: 'Vitest Member Export',
      userId: 'user-1',
    } as any);

    await caller.recordContentExport({
      format: 'markdown',
      id: 'file_1',
      kind: 'file',
    });

    expect(mockAssertCapability).toHaveBeenCalledWith({
      capability: 'preview_content',
      contentUid: 'cnt_1',
    });
    expect(mockCreateAccessEvent).toHaveBeenCalledWith({
      accessType: 'content_export',
      contentUid: 'cnt_1',
      metadata: {
        format: 'markdown',
        kind: 'file',
        localId: 'file_1',
        via: 'member_export',
      },
      spaceId: 'spc_1',
      sourceIp: '203.0.113.30',
      userAgent: 'Vitest Member Export',
    });
  });
});
