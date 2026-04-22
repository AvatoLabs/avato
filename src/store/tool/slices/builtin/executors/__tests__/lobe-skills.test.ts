import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  executeToolCallMock,
  getActiveDeviceIdMock,
  getByIdMock,
  getByNameMock,
  getZipUrlMock,
  listMock,
  readResourceMock,
} = vi.hoisted(() => ({
  executeToolCallMock: vi.fn(),
  getActiveDeviceIdMock: vi.fn(),
  getByIdMock: vi.fn(),
  getByNameMock: vi.fn(),
  getZipUrlMock: vi.fn(),
  listMock: vi.fn(),
  readResourceMock: vi.fn(),
}));

vi.mock('@lobechat/builtin-skills', () => ({
  builtinSkills: [],
}));

vi.mock('@/helpers/skillFilters', () => ({
  filterBuiltinSkills: (skills: any[]) => skills,
}));

vi.mock('@/services/remoteDevice', () => ({
  remoteDeviceService: {
    executeToolCall: executeToolCallMock,
    getActiveDeviceId: getActiveDeviceIdMock,
  },
}));

vi.mock('@/services/skill', () => ({
  agentSkillService: {
    getById: getByIdMock,
    getByName: getByNameMock,
    getZipUrl: getZipUrlMock,
    list: listMock,
    readResource: readResourceMock,
  },
}));

const { skillsExecutor } = await import('../lobe-skills');

describe('lobe-skills web executor', () => {
  const ctx = {
    messageId: 'message-1',
    operationId: 'operation-1',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a clear failure when no online desktop device is available', async () => {
    getActiveDeviceIdMock.mockResolvedValue(undefined);

    const result = await skillsExecutor.invoke(
      'execScript',
      {
        command: 'echo ok',
        description: 'Run a command',
      },
      ctx,
    );

    expect(result.success).toBe(false);
    expect(result.content).toContain('No online desktop device found');
    expect(executeToolCallMock).not.toHaveBeenCalled();
  });

  it('returns a command failure when active device lookup fails', async () => {
    getActiveDeviceIdMock.mockRejectedValue(new Error('gateway unavailable'));

    const result = await skillsExecutor.invoke(
      'execScript',
      {
        command: 'echo ok',
        description: 'Run a command',
      },
      ctx,
    );

    expect(result.success).toBe(false);
    expect(result.content).toContain('gateway unavailable');
    expect(executeToolCallMock).not.toHaveBeenCalled();
  });

  it('executes scripts through the selected remote desktop device with skill zip metadata', async () => {
    getActiveDeviceIdMock.mockResolvedValue('device-1');
    getByNameMock.mockResolvedValue({
      id: 'skill-1',
      name: 'demo-skill',
      zipFileHash: 'zip-hash-1',
    });
    getZipUrlMock.mockResolvedValue({
      url: 'https://example.com/demo-skill.zip',
    });
    executeToolCallMock.mockResolvedValue({
      content: JSON.stringify({ exitCode: 0, stdout: 'done', success: true }),
      success: true,
    });

    const result = await skillsExecutor.invoke(
      'execScript',
      {
        command: 'bun run build',
        config: { name: 'demo-skill' },
        description: 'Build skill',
      },
      ctx,
    );

    expect(result).toMatchObject({
      content: 'done',
      success: true,
    });
    expect(getByNameMock).toHaveBeenCalledWith('demo-skill');
    expect(getZipUrlMock).toHaveBeenCalledWith('skill-1');
    expect(executeToolCallMock).toHaveBeenCalledWith(
      expect.objectContaining({
        apiName: 'execScript',
        deviceId: 'device-1',
        identifier: 'lobe-skills',
        timeout: 120_000,
      }),
    );

    const call = executeToolCallMock.mock.calls[0][0];
    expect(JSON.parse(call.arguments)).toMatchObject({
      command: 'bun run build',
      config: { name: 'demo-skill' },
      description: 'Build skill',
      zipHash: 'zip-hash-1',
      zipUrl: 'https://example.com/demo-skill.zip',
    });
  });

  it('treats JSON primitive command output as plain output', async () => {
    getActiveDeviceIdMock.mockResolvedValue('device-1');
    executeToolCallMock.mockResolvedValue({
      content: JSON.stringify('done'),
      success: true,
    });

    const result = await skillsExecutor.invoke(
      'execScript',
      {
        command: 'echo done',
        description: 'Run a command',
      },
      ctx,
    );

    expect(result).toMatchObject({
      content: 'done',
      success: true,
    });
  });

  it('preserves failed desktop command output and stderr', async () => {
    getActiveDeviceIdMock.mockResolvedValue('device-1');
    executeToolCallMock.mockResolvedValue({
      content: JSON.stringify({
        exit_code: 2,
        stderr: 'command failed',
        stdout: 'partial output',
        success: false,
      }),
      success: false,
    });

    const result = await skillsExecutor.invoke(
      'execScript',
      {
        command: 'exit 2',
        description: 'Run command',
      },
      ctx,
    );

    expect(result).toMatchObject({
      content: 'partial output\ncommand failed',
      success: false,
    });
  });

  it('preserves Remote Tool Execution permission failures', async () => {
    getActiveDeviceIdMock.mockResolvedValue('device-1');
    executeToolCallMock.mockResolvedValue({
      content: 'Remote desktop tool execution is disabled on this device',
      error: 'REMOTE_TOOLS_DISABLED',
      success: false,
    });

    const result = await skillsExecutor.invoke(
      'execScript',
      {
        command: 'echo ok',
        description: 'Run command',
      },
      ctx,
    );

    expect(result).toMatchObject({
      content: 'Remote desktop tool execution is disabled on this device\nREMOTE_TOOLS_DISABLED',
      success: false,
    });
  });
});
