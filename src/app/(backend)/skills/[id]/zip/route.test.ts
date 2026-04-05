// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { auth } from '@/auth';
import { AgentSkillModel } from '@/database/models/agentSkill';
import { ContentModel } from '@/database/models/content';
import { FileModel } from '@/database/models/file';
import { getServerDB } from '@/database/server';
import { FileService } from '@/server/services/file';
import { createSkillZipProxyToken } from '@/server/services/skill/skillZipProxyToken';

import { GET } from './route';

vi.mock('@/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock('@/database/models/agentSkill', () => ({
  AgentSkillModel: vi.fn(),
}));

vi.mock('@/database/models/content', () => ({
  ContentModel: vi.fn(),
}));

vi.mock('@/database/models/file', () => ({
  FileModel: vi.fn(),
}));

vi.mock('@/database/server', () => ({
  getServerDB: vi.fn(),
}));

vi.mock('@/envs/app', () => ({
  appEnv: {
    APP_URL: 'https://app.example.com',
  },
}));

vi.mock('@/server/services/file', () => ({
  FileService: vi.fn(),
}));

describe('GET /skills/[id]/zip', () => {
  const mockDb = {};
  const mockFindSkillById = vi.fn();
  const mockCanAccessGlobalFileByHash = vi.fn();
  const mockCheckHash = vi.fn();
  const mockCreateAccessEvent = vi.fn();
  const mockGetFullFileUrl = vi.fn();

  beforeEach(() => {
    process.env.KEY_VAULTS_SECRET = 'test-secret';
    vi.mocked(getServerDB).mockResolvedValue(mockDb as any);
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: 'user-1' },
    } as Awaited<ReturnType<typeof auth.api.getSession>>);
    vi.mocked(AgentSkillModel).mockImplementation(
      () =>
        ({
          findById: mockFindSkillById,
        }) as any,
    );
    vi.mocked(ContentModel).mockImplementation(
      () =>
        ({
          createAccessEvent: mockCreateAccessEvent,
        }) as any,
    );
    vi.mocked(FileModel).mockImplementation(
      () =>
        ({
          canAccessGlobalFileByHash: mockCanAccessGlobalFileByHash,
          checkHash: mockCheckHash,
        }) as any,
    );
    vi.mocked(FileService).mockImplementation(
      () =>
        ({
          getFullFileUrl: mockGetFullFileUrl,
        }) as any,
    );
    mockFindSkillById.mockReset();
    mockCanAccessGlobalFileByHash.mockReset();
    mockCheckHash.mockReset();
    mockCreateAccessEvent.mockReset();
    mockGetFullFileUrl.mockReset();
  });

  afterEach(() => {
    delete process.env.KEY_VAULTS_SECRET;
    vi.clearAllMocks();
  });

  it('returns 404 when the skill has no downloadable zip', async () => {
    mockFindSkillById.mockResolvedValue({ id: 'skill-1', zipFileHash: null });

    const res = await GET(new Request('https://app.example.com/skills/skill-1/zip'), {
      params: Promise.resolve({ id: 'skill-1' }),
    });

    expect(res.status).toBe(404);
    expect(mockCanAccessGlobalFileByHash).not.toHaveBeenCalled();
  });

  it('returns 404 when the requester cannot access the zip hash', async () => {
    mockFindSkillById.mockResolvedValue({ id: 'skill-1', zipFileHash: 'hash-1' });
    mockCanAccessGlobalFileByHash.mockResolvedValue(false);

    const res = await GET(new Request('https://app.example.com/skills/skill-1/zip'), {
      params: Promise.resolve({ id: 'skill-1' }),
    });

    expect(res.status).toBe(404);
    expect(mockCheckHash).not.toHaveBeenCalled();
  });

  it('redirects through a freshly issued zip URL', async () => {
    mockFindSkillById.mockResolvedValue({ id: 'skill-1', zipFileHash: 'hash-1' });
    mockCanAccessGlobalFileByHash.mockResolvedValue(true);
    mockCheckHash.mockResolvedValue({ isExist: true, url: 'skills/skill-1.zip' });
    mockGetFullFileUrl.mockResolvedValue('https://blob.example.com/skill-1.zip?sig=1');

    const res = await GET(new Request('https://app.example.com/skills/skill-1/zip'), {
      params: Promise.resolve({ id: 'skill-1' }),
    });

    expect(res.status).toBe(307);
    expect(res.headers.get('Location')).toBe('https://blob.example.com/skill-1.zip?sig=1');
    expect(mockCanAccessGlobalFileByHash).toHaveBeenCalledWith('hash-1');
    expect(mockCheckHash).toHaveBeenCalledWith('hash-1');
    expect(mockCreateAccessEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        accessType: 'file_url_issued',
        metadata: expect.objectContaining({
          fileHash: 'hash-1',
          skillId: 'skill-1',
          via: 'skill_zip_proxy',
        }),
      }),
    );
  });

  it('accepts a valid internal token without requiring a session', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null);
    mockFindSkillById.mockResolvedValue({ id: 'skill-1', zipFileHash: 'hash-1' });
    mockCheckHash.mockResolvedValue({ isExist: true, url: 'skills/skill-1.zip' });
    mockGetFullFileUrl.mockResolvedValue('https://blob.example.com/skill-1.zip?sig=1');

    const token = createSkillZipProxyToken('skill-1');

    const res = await GET(
      new Request(`https://app.example.com/skills/skill-1/zip?token=${encodeURIComponent(token!)}`),
      {
        params: Promise.resolve({ id: 'skill-1' }),
      },
    );

    expect(res.status).toBe(307);
    expect(mockCanAccessGlobalFileByHash).not.toHaveBeenCalled();
    expect(mockCheckHash).toHaveBeenCalledWith('hash-1');
  });
});
