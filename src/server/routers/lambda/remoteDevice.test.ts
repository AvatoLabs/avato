// @vitest-environment node
import { LocalSystemIdentifier } from '@lobechat/builtin-tool-local-system';
import { SkillsIdentifier } from '@lobechat/builtin-tool-skills';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  executeToolCallMock,
  queryDeviceListMock,
  queryDeviceStatusMock,
  queryDeviceSystemInfoMock,
} = vi.hoisted(() => ({
  executeToolCallMock: vi.fn(),
  queryDeviceListMock: vi.fn(),
  queryDeviceStatusMock: vi.fn(),
  queryDeviceSystemInfoMock: vi.fn(),
}));

vi.mock('@/server/services/toolExecution/deviceProxy', () => ({
  deviceProxy: {
    executeToolCall: executeToolCallMock,
    queryDeviceList: queryDeviceListMock,
    queryDeviceStatus: queryDeviceStatusMock,
    queryDeviceSystemInfo: queryDeviceSystemInfoMock,
  },
}));

const { remoteDeviceRouter } = await import('./remoteDevice');

describe('remoteDeviceRouter', () => {
  const caller = remoteDeviceRouter.createCaller({ userId: 'user-1' } as any);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('forwards Local System tool calls through deviceProxy', async () => {
    executeToolCallMock.mockResolvedValue({
      content: 'ok',
      success: true,
    });

    const result = await caller.executeToolCall({
      apiName: 'runCommand',
      arguments: JSON.stringify({ command: 'echo ok' }),
      deviceId: 'device-1',
      identifier: LocalSystemIdentifier,
      timeout: 120_000,
    });

    expect(result).toEqual({ content: 'ok', success: true });
    expect(executeToolCallMock).toHaveBeenCalledWith(
      { deviceId: 'device-1', userId: 'user-1' },
      {
        apiName: 'runCommand',
        arguments: JSON.stringify({ command: 'echo ok' }),
        identifier: LocalSystemIdentifier,
      },
      120_000,
    );
  });

  it('allows Skills execScript tool calls', async () => {
    executeToolCallMock.mockResolvedValue({
      content: JSON.stringify({ stdout: 'done', success: true }),
      success: true,
    });

    const result = await caller.executeToolCall({
      apiName: 'execScript',
      arguments: JSON.stringify({ command: 'bun run build' }),
      deviceId: 'device-1',
      identifier: SkillsIdentifier,
    });

    expect(result.success).toBe(true);
    expect(executeToolCallMock).toHaveBeenCalledWith(
      { deviceId: 'device-1', userId: 'user-1' },
      {
        apiName: 'execScript',
        arguments: JSON.stringify({ command: 'bun run build' }),
        identifier: SkillsIdentifier,
      },
      undefined,
    );
  });

  it('keeps deviceId optional for tool calls so the gateway can choose a target', async () => {
    executeToolCallMock.mockResolvedValue({
      content: 'ok',
      success: true,
    });

    await caller.executeToolCall({
      apiName: 'runCommand',
      arguments: JSON.stringify({ command: 'pwd' }),
      identifier: LocalSystemIdentifier,
    });

    expect(executeToolCallMock).toHaveBeenCalledWith(
      { deviceId: undefined, userId: 'user-1' },
      {
        apiName: 'runCommand',
        arguments: JSON.stringify({ command: 'pwd' }),
        identifier: LocalSystemIdentifier,
      },
      120_000,
    );
  });

  it('derives remote runCommand RPC timeout from tool arguments and clamps it', async () => {
    executeToolCallMock.mockResolvedValue({
      content: 'ok',
      success: true,
    });

    await caller.executeToolCall({
      apiName: 'runCommand',
      arguments: JSON.stringify({ command: 'sleep 600', timeout: 900_000 }),
      deviceId: 'device-1',
      identifier: LocalSystemIdentifier,
    });

    expect(executeToolCallMock).toHaveBeenCalledWith(
      { deviceId: 'device-1', userId: 'user-1' },
      {
        apiName: 'runCommand',
        arguments: JSON.stringify({ command: 'sleep 600', timeout: 900_000 }),
        identifier: LocalSystemIdentifier,
      },
      600_000,
    );
  });

  it('keeps non-command Local System tool calls on the gateway default timeout', async () => {
    executeToolCallMock.mockResolvedValue({
      content: 'ok',
      success: true,
    });

    await caller.executeToolCall({
      apiName: 'listLocalFiles',
      arguments: JSON.stringify({ path: '/tmp' }),
      deviceId: 'device-1',
      identifier: LocalSystemIdentifier,
    });

    expect(executeToolCallMock).toHaveBeenCalledWith(
      { deviceId: 'device-1', userId: 'user-1' },
      {
        apiName: 'listLocalFiles',
        arguments: JSON.stringify({ path: '/tmp' }),
        identifier: LocalSystemIdentifier,
      },
      undefined,
    );
  });

  it('rejects blank deviceId for tool calls instead of treating it as an implicit target', async () => {
    await expect(
      caller.executeToolCall({
        apiName: 'runCommand',
        arguments: JSON.stringify({ command: 'pwd' }),
        deviceId: '  ',
        identifier: LocalSystemIdentifier,
      }),
    ).rejects.toThrow();

    expect(executeToolCallMock).not.toHaveBeenCalled();
  });

  it('rejects oversized tool call route fields before hitting deviceProxy', async () => {
    const oversizedField = 'x'.repeat(513);

    await expect(
      caller.executeToolCall({
        apiName: oversizedField,
        arguments: '{}',
        identifier: LocalSystemIdentifier,
      }),
    ).rejects.toThrow();
    await expect(
      caller.executeToolCall({
        apiName: 'runCommand',
        arguments: '{}',
        deviceId: oversizedField,
        identifier: LocalSystemIdentifier,
      }),
    ).rejects.toThrow();
    await expect(
      caller.executeToolCall({
        apiName: 'runCommand',
        arguments: 'x'.repeat(2_000_001),
        identifier: LocalSystemIdentifier,
      }),
    ).rejects.toThrow();

    expect(executeToolCallMock).not.toHaveBeenCalled();
  });

  it('rejects direct MCP tool calls because MCP routing is handled by server tool execution', async () => {
    await expect(
      caller.executeToolCall({
        apiName: 'callTool',
        arguments: '{}',
        identifier: 'lobe-mcp' as any,
      }),
    ).rejects.toThrow();

    expect(executeToolCallMock).not.toHaveBeenCalled();
  });

  it('rejects unsupported Local System APIs before hitting deviceProxy', async () => {
    await expect(
      caller.executeToolCall({
        apiName: 'deleteEverything',
        arguments: '{}',
        identifier: LocalSystemIdentifier,
      }),
    ).rejects.toThrow();

    expect(executeToolCallMock).not.toHaveBeenCalled();
  });

  it('does not expose Skills exportFile as a direct browser-to-device call', async () => {
    await expect(
      caller.executeToolCall({
        apiName: 'exportFile',
        arguments: JSON.stringify({
          filename: 'result.txt',
          path: 'output.txt',
          uploadUrl: 'https://storage.example.com/upload',
        }),
        deviceId: 'device-1',
        identifier: SkillsIdentifier,
      }),
    ).rejects.toThrow();

    expect(executeToolCallMock).not.toHaveBeenCalled();
  });

  it('queries device list, status, and system info for the authenticated user', async () => {
    queryDeviceListMock.mockResolvedValue([{ deviceId: 'device-1', online: true }]);
    queryDeviceStatusMock.mockResolvedValue({ deviceCount: 1, online: true });
    queryDeviceSystemInfoMock.mockResolvedValue({ homePath: '/Users/demo' });

    await expect(caller.list()).resolves.toEqual([{ deviceId: 'device-1', online: true }]);
    await expect(caller.status()).resolves.toEqual({ deviceCount: 1, online: true });
    await expect(caller.getSystemInfo({ deviceId: 'device-1' })).resolves.toEqual({
      homePath: '/Users/demo',
    });

    expect(queryDeviceListMock).toHaveBeenCalledWith('user-1');
    expect(queryDeviceStatusMock).toHaveBeenCalledWith('user-1');
    expect(queryDeviceSystemInfoMock).toHaveBeenCalledWith('user-1', 'device-1');
  });

  it('rejects empty deviceId for system info queries', async () => {
    await expect(caller.getSystemInfo({ deviceId: '' })).rejects.toThrow();

    expect(queryDeviceSystemInfoMock).not.toHaveBeenCalled();
  });

  it('rejects oversized deviceId for system info queries', async () => {
    await expect(caller.getSystemInfo({ deviceId: 'x'.repeat(513) })).rejects.toThrow();

    expect(queryDeviceSystemInfoMock).not.toHaveBeenCalled();
  });
});
