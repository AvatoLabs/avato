import { SkillsIdentifier } from '@lobechat/builtin-tool-skills';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  canAccessGlobalFileByHashMock,
  checkHashMock,
  executeToolCallMock,
  findAllMock,
  findByNameMock,
  getFullFileUrlMock,
  getUserSettingsMock,
  resolveAccessibleSkillZipProxyUrlMock,
  runBuildInToolMock,
} = vi.hoisted(() => ({
  canAccessGlobalFileByHashMock: vi.fn(),
  checkHashMock: vi.fn(),
  executeToolCallMock: vi.fn(),
  findAllMock: vi.fn(),
  findByNameMock: vi.fn(),
  getFullFileUrlMock: vi.fn(),
  getUserSettingsMock: vi.fn(),
  resolveAccessibleSkillZipProxyUrlMock: vi.fn(),
  runBuildInToolMock: vi.fn(),
}));

vi.mock('@lobechat/builtin-skills', () => ({
  builtinSkills: [],
}));

vi.mock('@/helpers/skillFilters', () => ({
  filterBuiltinSkills: (skills: any[]) => skills,
}));

vi.mock('@/database/models/agentSkill', () => ({
  AgentSkillModel: vi.fn().mockImplementation(() => ({
    findAll: findAllMock,
    findById: vi.fn(),
    findByName: findByNameMock,
  })),
}));

vi.mock('@/database/models/file', () => ({
  FileModel: vi.fn().mockImplementation(() => ({
    canAccessGlobalFileByHash: canAccessGlobalFileByHashMock,
    checkHash: checkHashMock,
  })),
}));

vi.mock('@/database/models/space', () => ({
  SpaceModel: vi.fn(),
}));

vi.mock('@/database/models/user', () => ({
  UserModel: vi.fn().mockImplementation(() => ({
    getUserSettings: getUserSettingsMock,
  })),
}));

vi.mock('@/server/modules/S3', () => ({
  FileS3: vi.fn(),
}));

vi.mock('@/server/modules/BlobProvider', () => ({
  getBlobProvider: vi.fn(),
}));

vi.mock('@/server/services/file', () => ({
  FileService: vi.fn().mockImplementation(() => ({
    getFullFileUrl: getFullFileUrlMock,
  })),
}));

vi.mock('@/server/services/file/sandboxExport', () => ({
  generateSandboxExportStorageKey: vi.fn(),
  resolveTargetSpaceIdForSandboxExport: vi.fn(),
}));

vi.mock('@/server/services/market', () => ({
  MarketService: vi.fn().mockImplementation(() => ({
    market: {
      plugins: {
        runBuildInTool: runBuildInToolMock,
      },
    },
  })),
}));

vi.mock('@/server/services/skill/resource', () => ({
  SkillResourceService: vi.fn(),
}));

vi.mock('@/server/services/skill/resolveAccessibleSkillZipProxyUrl', () => ({
  resolveAccessibleSkillZipProxyUrl: resolveAccessibleSkillZipProxyUrlMock,
}));

vi.mock('@/server/services/toolExecution/deviceProxy', () => ({
  deviceProxy: {
    executeToolCall: executeToolCallMock,
  },
}));

const { skillsRuntime } = await import('../skills');

describe('skillsRuntime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserSettingsMock.mockResolvedValue({});
    findAllMock.mockResolvedValue({ data: [], total: 0 });
  });

  it('does not fall back to Cloud Sandbox when no active desktop device is selected', async () => {
    const runtime = await skillsRuntime.factory({
      serverDB: {} as any,
      toolManifestMap: {},
      userId: 'user-1',
    });

    const result = await runtime.execScript({
      command: 'echo ok',
      description: 'Run command',
    });

    expect(result.success).toBe(false);
    expect(result.content).toContain('No active desktop device selected');
    expect(executeToolCallMock).not.toHaveBeenCalled();
    expect(runBuildInToolMock).not.toHaveBeenCalled();
  });

  it('runs execScript through the active desktop device and passes skill zip metadata', async () => {
    findByNameMock.mockResolvedValue({
      id: 'skill-1',
      name: 'demo-skill',
      zipSha256: 'zip-hash-1',
    });
    resolveAccessibleSkillZipProxyUrlMock.mockResolvedValue('https://example.com/skills/demo.zip');
    executeToolCallMock.mockResolvedValue({
      content: JSON.stringify({ exitCode: 0, stdout: 'done', success: true }),
      success: true,
    });

    const runtime = await skillsRuntime.factory({
      activeDeviceId: 'device-1',
      serverDB: {} as any,
      toolManifestMap: {},
      userId: 'user-1',
    });

    const result = await runtime.execScript({
      command: 'bun run build',
      config: { name: 'demo-skill' },
      description: 'Build skill',
    });

    expect(result).toMatchObject({
      content: 'done',
      success: true,
    });
    expect(executeToolCallMock).toHaveBeenCalledWith(
      { deviceId: 'device-1', userId: 'user-1' },
      expect.objectContaining({
        apiName: 'execScript',
        identifier: SkillsIdentifier,
      }),
      120_000,
    );
    expect(JSON.parse(executeToolCallMock.mock.calls[0][1].arguments)).toEqual({
      command: 'bun run build',
      config: { name: 'demo-skill' },
      description: 'Build skill',
      zipSha256: 'zip-hash-1',
      zipUrl: 'https://example.com/skills/demo.zip',
    });
    expect(runBuildInToolMock).not.toHaveBeenCalled();
  });

  it('treats JSON primitive command output as plain output', async () => {
    executeToolCallMock.mockResolvedValue({
      content: JSON.stringify('done'),
      success: true,
    });

    const runtime = await skillsRuntime.factory({
      activeDeviceId: 'device-1',
      serverDB: {} as any,
      toolManifestMap: {},
      userId: 'user-1',
    });

    const result = await runtime.execScript({
      command: 'echo done',
      description: 'Run command',
    });

    expect(result).toMatchObject({
      content: 'done',
      success: true,
    });
  });

  it('preserves failed desktop command output and stderr', async () => {
    executeToolCallMock.mockResolvedValue({
      content: JSON.stringify({
        exit_code: 2,
        stderr: 'command failed',
        stdout: 'partial output',
        success: false,
      }),
      success: false,
    });

    const runtime = await skillsRuntime.factory({
      activeDeviceId: 'device-1',
      serverDB: {} as any,
      toolManifestMap: {},
      userId: 'user-1',
    });

    const result = await runtime.execScript({
      command: 'exit 2',
      description: 'Run command',
    });

    expect(result).toMatchObject({
      content: 'partial output\ncommand failed',
      state: {
        exitCode: 2,
        success: false,
      },
      success: false,
    });
  });

  it('preserves Remote Tool Execution permission failures', async () => {
    executeToolCallMock.mockResolvedValue({
      content: 'Remote desktop tool execution is disabled on this device',
      error: 'REMOTE_TOOLS_DISABLED',
      success: false,
    });

    const runtime = await skillsRuntime.factory({
      activeDeviceId: 'device-1',
      serverDB: {} as any,
      toolManifestMap: {},
      userId: 'user-1',
    });

    const result = await runtime.execScript({
      command: 'echo ok',
      description: 'Run command',
    });

    expect(result).toMatchObject({
      content: 'Remote desktop tool execution is disabled on this device\nREMOTE_TOOLS_DISABLED',
      state: {
        exitCode: 1,
        success: false,
      },
      success: false,
    });
    expect(runBuildInToolMock).not.toHaveBeenCalled();
  });
});
