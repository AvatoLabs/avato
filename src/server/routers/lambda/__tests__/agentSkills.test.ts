import { beforeEach, describe, expect, it, vi } from 'vitest';

import { agentSkillsRouter } from '@/server/routers/lambda/agentSkills';

const mockFileModelCanAccessGlobalFileBySha256 = vi.fn();
const mockFileModelCheckHash = vi.fn();
const mockSkillModelFindById = vi.fn();

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: vi.fn(async () => ({})),
}));

vi.mock('@/database/models/agentSkill', () => ({
  AgentSkillModel: vi.fn(() => ({
    findById: mockSkillModelFindById,
  })),
}));

vi.mock('@/database/models/file', () => ({
  FileModel: vi.fn(() => ({
    canAccessGlobalFileBySha256: mockFileModelCanAccessGlobalFileBySha256,
    checkHash: mockFileModelCheckHash,
  })),
}));

vi.mock('@/envs/app', () => ({
  appEnv: {
    APP_URL: 'https://app.example.com',
  },
}));

vi.mock('@/server/services/file', () => ({
  FileService: vi.fn(() => ({
    getFullFileUrl: vi.fn(),
  })),
}));

vi.mock('@/server/services/market', () => ({
  MarketService: vi.fn(() => ({})),
}));

vi.mock('@/server/services/skill', () => ({
  SkillImporter: vi.fn(() => ({})),
  SkillImportError: class extends Error {
    code = 'BAD_REQUEST';
  },
  SkillResourceError: class extends Error {
    code = 'NOT_FOUND';
  },
  SkillResourceService: vi.fn(() => ({})),
}));

const createCaller = (ctxOverrides: Partial<any> = {}) =>
  agentSkillsRouter.createCaller(
    {
      serverDB: {} as any,
      userId: 'user-1',
      ...ctxOverrides,
    } as any,
  );

describe('agentSkillsRouter.getByIdWithZipUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the stable skill zip proxy URL when the user can access the zip hash', async () => {
    mockSkillModelFindById.mockResolvedValue({
      id: 'skill-1',
      name: 'Skill One',
      zipSha256: 'hash-1',
    });
    mockFileModelCanAccessGlobalFileBySha256.mockResolvedValue(true);

    const caller = createCaller();
    const result = await caller.getByIdWithZipUrl({ id: 'skill-1' });

    expect(result).toEqual({
      name: 'Skill One',
      url: 'https://app.example.com/skills/skill-1/zip',
    });
    expect(mockFileModelCheckHash).not.toHaveBeenCalled();
  });

  it('returns null when the caller cannot access the backing zip hash', async () => {
    mockSkillModelFindById.mockResolvedValue({
      id: 'skill-1',
      name: 'Skill One',
      zipSha256: 'hash-1',
    });
    mockFileModelCanAccessGlobalFileBySha256.mockResolvedValue(false);

    const caller = createCaller();
    const result = await caller.getByIdWithZipUrl({ id: 'skill-1' });

    expect(result).toEqual({
      name: 'Skill One',
      url: null,
    });
    expect(mockFileModelCheckHash).not.toHaveBeenCalled();
  });
});
