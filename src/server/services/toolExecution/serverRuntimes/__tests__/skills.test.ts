import { SkillsIdentifier } from '@lobechat/builtin-tool-skills';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  canAccessGlobalFileByHashMock,
  checkHashMock,
  createFileRecordFromStorageObjectMock,
  createUploadUrlMock,
  executeToolCallMock,
  findAllMock,
  findByNameMock,
  generateSandboxExportStorageKeyMock,
  getObjectMetadataMock,
  getFullFileUrlMock,
  getUserSettingsMock,
  getBlobProviderMock,
  resolveTargetSpaceIdForSandboxExportMock,
  resolveAccessibleSkillZipProxyUrlMock,
  runBuildInToolMock,
} = vi.hoisted(() => ({
  canAccessGlobalFileByHashMock: vi.fn(),
  checkHashMock: vi.fn(),
  createFileRecordFromStorageObjectMock: vi.fn(),
  createUploadUrlMock: vi.fn(),
  executeToolCallMock: vi.fn(),
  findAllMock: vi.fn(),
  findByNameMock: vi.fn(),
  generateSandboxExportStorageKeyMock: vi.fn(),
  getObjectMetadataMock: vi.fn(),
  getFullFileUrlMock: vi.fn(),
  getUserSettingsMock: vi.fn(),
  getBlobProviderMock: vi.fn(),
  resolveTargetSpaceIdForSandboxExportMock: vi.fn(),
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
  getBlobProvider: getBlobProviderMock,
}));

vi.mock('@/server/services/file', () => ({
  FileService: vi.fn().mockImplementation(() => ({
    createFileRecordFromStorageObject: createFileRecordFromStorageObjectMock,
    getFullFileUrl: getFullFileUrlMock,
  })),
}));

vi.mock('@/server/services/file/sandboxExport', () => ({
  generateSandboxExportStorageKey: generateSandboxExportStorageKeyMock,
  resolveTargetSpaceIdForSandboxExport: resolveTargetSpaceIdForSandboxExportMock,
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
    createUploadUrlMock.mockResolvedValue('https://storage.example.com/upload');
    getBlobProviderMock.mockReturnValue({
      createUploadUrl: createUploadUrlMock,
      getObjectMetadata: getObjectMetadataMock,
    });
    getObjectMetadataMock.mockResolvedValue({
      contentLength: 12,
      contentType: 'text/csv',
    });
    generateSandboxExportStorageKeyMock.mockReturnValue(
      'v2/spaces/space-1/blobs/sandbox-exports/key',
    );
    resolveTargetSpaceIdForSandboxExportMock.mockResolvedValue('space-1');
    createFileRecordFromStorageObjectMock.mockResolvedValue({
      fileId: 'file-1',
      sha256: 'sha-1',
      size: 12,
      url: '/f/file-1',
    });
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

    const result = await runtime.execScript(
      {
        command: 'bun run build',
        config: { name: 'demo-skill' },
        description: 'Build skill',
      },
      { operationId: 'operation-1' },
    );

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
      executionContextId: 'operation-1',
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

  it('exports generated skill files through the active desktop device', async () => {
    executeToolCallMock.mockResolvedValue({
      content: JSON.stringify({
        filename: 'result.csv',
        mimeType: 'text/csv',
        size: 12,
        success: true,
      }),
      success: true,
    });

    const runtime = await skillsRuntime.factory({
      activeDeviceId: 'device-1',
      operationId: 'operation-1',
      serverDB: {} as any,
      spaceId: 'space-current',
      toolManifestMap: {},
      topicId: 'topic-1',
      userId: 'user-1',
    });

    const result = await runtime.exportFile(
      {
        filename: 'result.csv',
        path: 'output/result.csv',
      },
      { operationId: 'operation-1' },
    );

    expect(resolveTargetSpaceIdForSandboxExportMock).toHaveBeenCalledWith({
      db: {},
      spaceId: 'space-current',
      topicId: 'topic-1',
      userId: 'user-1',
    });
    expect(createUploadUrlMock).toHaveBeenCalledWith('v2/spaces/space-1/blobs/sandbox-exports/key');
    expect(executeToolCallMock).toHaveBeenCalledWith(
      { deviceId: 'device-1', userId: 'user-1' },
      expect.objectContaining({
        apiName: 'exportFile',
        identifier: SkillsIdentifier,
      }),
      120_000,
    );
    expect(JSON.parse(executeToolCallMock.mock.calls[0][1].arguments)).toEqual({
      executionContextId: 'operation-1',
      filename: 'result.csv',
      path: 'output/result.csv',
      uploadUrl: 'https://storage.example.com/upload',
    });
    expect(createFileRecordFromStorageObjectMock).toHaveBeenCalledWith({
      fileType: 'text/csv',
      name: 'result.csv',
      spaceId: 'space-1',
      storageKey: 'v2/spaces/space-1/blobs/sandbox-exports/key',
    });
    expect(result).toMatchObject({
      content: 'File exported successfully: result.csv\nDownload URL: /f/file-1',
      state: {
        fileId: 'file-1',
        filename: 'result.csv',
        mimeType: 'text/csv',
        size: 12,
        url: '/f/file-1',
      },
      success: true,
    });
    expect(runBuildInToolMock).not.toHaveBeenCalled();
  });

  it('does not fall back to Cloud Sandbox when exporting without an active desktop device', async () => {
    const runtime = await skillsRuntime.factory({
      serverDB: {} as any,
      toolManifestMap: {},
      topicId: 'topic-1',
      userId: 'user-1',
    });

    const result = await runtime.exportFile({
      filename: 'result.csv',
      path: 'output/result.csv',
    });

    expect(result.success).toBe(false);
    expect(executeToolCallMock).not.toHaveBeenCalled();
    expect(createUploadUrlMock).not.toHaveBeenCalled();
    expect(runBuildInToolMock).not.toHaveBeenCalled();
  });
});
