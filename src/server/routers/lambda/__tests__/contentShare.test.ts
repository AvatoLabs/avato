// @vitest-environment node
import { TRPCError } from '@trpc/server';
import bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { contentShareRouter } from '@/server/routers/lambda/contentShare';

const mockAssertCanDelegateSharing = vi.fn();
const mockAssertCapability = vi.fn();
const mockCreateAuditLog = vi.fn();
const mockCreateShareLink = vi.fn();
const mockFindContentRegistryByLocalId = vi.fn();
const mockGetContentSummary = vi.fn();
const mockResolveShareLinkByToken = vi.fn();

vi.mock('@/database/models/content', () => ({
  ContentModel: vi.fn(() => ({
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
      passwordHash: null,
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
      passwordHash: null,
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
  });

  it('requires the correct password for protected shares', async () => {
    const caller = contentShareRouter.createCaller({
      serverDB: {} as any,
      userId: 'anonymous',
    } as any);

    mockResolveShareLinkByToken.mockResolvedValue({
      contentUid: 'cnt_1',
      expiresAt: new Date('2026-04-20T00:00:00.000Z'),
      passwordHash: 'hashed-password',
    });
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

    await expect(
      caller.getSharedContentByToken({ password: 'wrong', token: 'share_tok_1' }),
    ).rejects.toThrow(new TRPCError({ code: 'NOT_FOUND', message: 'SHARE_NOT_FOUND' }));
  });
});
