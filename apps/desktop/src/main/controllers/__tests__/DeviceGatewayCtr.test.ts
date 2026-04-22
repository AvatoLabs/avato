import { GatewayClient } from '@lobechat/device-gateway-client';
import superjson from 'superjson';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { App } from '@/core/App';

import DeviceGatewayCtr from '../DeviceGatewayCtr';
import LocalFileCtr from '../LocalFileCtr';
import McpCtr from '../McpCtr';
import RemoteServerConfigCtr from '../RemoteServerConfigCtr';
import ShellCommandCtr from '../ShellCommandCtr';

const { ipcMainHandleMock } = vi.hoisted(() => ({
  ipcMainHandleMock: vi.fn(),
}));

vi.mock('electron', () => ({
  app: {
    getAppPath: vi.fn(() => '/mock/app'),
    getPath: vi.fn((name: string) => `/mock/${name}`),
    isPackaged: false,
  },
  ipcMain: {
    handle: ipcMainHandleMock,
  },
}));

vi.mock('@lobechat/device-gateway-client', () => ({
  GatewayClient: vi.fn(),
}));

vi.mock('@/const/env', () => ({
  DEVICE_GATEWAY_URL: 'https://gateway.test',
}));

vi.mock('@/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  }),
}));

const createAccessToken = (payload: Record<string, unknown>) => {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `header.${encodedPayload}.signature`;
};

describe('DeviceGatewayCtr', () => {
  const localFileCtr = {
    handlePrepareSkillDirectory: vi.fn(),
    handleReadFileAsBase64: vi.fn(),
  };
  const shellCommandCtr = {
    handleRunCommand: vi.fn(),
  };
  const remoteServerConfigCtr = {
    getRemoteServerConfig: vi.fn(),
    getAccessToken: vi.fn(),
    isRemoteServerConfigured: vi.fn(),
    isTokenExpiringSoon: vi.fn(),
    refreshAccessToken: vi.fn(),
  };
  const mcpCtr = {
    callTool: vi.fn(),
  };
  const storeManager = {
    get: vi.fn(),
    set: vi.fn(),
  };
  const browserManager = {
    broadcastToAllWindows: vi.fn(),
  };

  const app = {
    browserManager,
    getController: vi.fn((controller) => {
      if (controller === LocalFileCtr) return localFileCtr;
      if (controller === McpCtr) return mcpCtr;
      if (controller === ShellCommandCtr) return shellCommandCtr;
      if (controller === RemoteServerConfigCtr) return remoteServerConfigCtr;
      throw new Error(`Unexpected controller: ${controller.name}`);
    }),
    storeManager,
  } as unknown as App;

  let controller: DeviceGatewayCtr;
  let gatewayClient: {
    connect: ReturnType<typeof vi.fn>;
    connectionStatus: string;
    currentDeviceId: string;
    disconnect: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    setAllowRemoteTools: ReturnType<typeof vi.fn>;
    sendSystemInfoResponse: ReturnType<typeof vi.fn>;
    sendToolCallResponse: ReturnType<typeof vi.fn>;
  };
  let gatewayEventHandlers: Record<string, (...args: any[]) => void>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    ipcMainHandleMock.mockClear();
    storeManager.get.mockReturnValue({ allowRemoteTools: true, enabled: true });
    remoteServerConfigCtr.getRemoteServerConfig.mockResolvedValue({
      active: true,
      storageMode: 'cloud',
    });
    remoteServerConfigCtr.getAccessToken.mockResolvedValue(createAccessToken({ sub: 'user-1' }));
    remoteServerConfigCtr.isRemoteServerConfigured.mockResolvedValue(true);
    remoteServerConfigCtr.isTokenExpiringSoon.mockReturnValue(false);
    remoteServerConfigCtr.refreshAccessToken.mockResolvedValue({ success: true });
    mcpCtr.callTool.mockResolvedValue(
      superjson.serialize({
        content: 'mcp result',
        state: { content: [{ text: 'mcp result', type: 'text' }] },
        success: true,
      }),
    );
    localFileCtr.handleReadFileAsBase64.mockResolvedValue({
      base64: Buffer.from('hello').toString('base64'),
      filename: 'output.txt',
      mimeType: 'text/plain',
      path: '/tmp/skill-dir/output.txt',
      sha256: 'sha-1',
      size: 5,
      success: true,
    });
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
    });
    vi.stubGlobal('fetch', fetchMock);

    gatewayClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      connectionStatus: 'connecting',
      currentDeviceId: 'generated-device-id',
      disconnect: vi.fn().mockResolvedValue(undefined),
      on: vi.fn((event: string, handler: (...args: any[]) => void) => {
        gatewayEventHandlers[event] = handler;
        return gatewayClient;
      }),
      setAllowRemoteTools: vi.fn(),
      sendSystemInfoResponse: vi.fn(),
      sendToolCallResponse: vi.fn(),
    };
    gatewayEventHandlers = {};
    vi.mocked(GatewayClient).mockImplementation((options: any) => {
      gatewayClient.currentDeviceId = options.deviceId || 'generated-device-id';
      return gatewayClient as any;
    });
    controller = new DeviceGatewayCtr(app);
  });

  it('starts the gateway client with the logged-in user and configured gateway', async () => {
    storeManager.get.mockReturnValue({
      allowRemoteTools: true,
      deviceId: 'stored-device-id',
      enabled: true,
      gatewayUrl: '  https://gateway.example.com///  ',
    });
    const token = createAccessToken({ sub: 'user-1' });
    remoteServerConfigCtr.getAccessToken.mockResolvedValue(token);

    const result = await controller.startAgent();

    expect(result.success).toBe(true);
    expect(GatewayClient).toHaveBeenCalledWith(
      expect.objectContaining({
        allowRemoteTools: true,
        deviceId: 'stored-device-id',
        gatewayUrl: 'https://gateway.example.com',
        token,
        userId: 'user-1',
      }),
    );
    expect(gatewayClient.connect).toHaveBeenCalledWith({ timeoutMs: 15_000, waitForAuth: true });
    expect(browserManager.broadcastToAllWindows).toHaveBeenCalledWith(
      'deviceGatewayStatusChanged',
      expect.objectContaining({
        allowRemoteTools: true,
        deviceId: 'stored-device-id',
        enabled: true,
        gatewayUrl: 'https://gateway.example.com',
        userId: 'user-1',
      }),
    );
  });

  it('starts the gateway client with remote tool execution disabled when configured that way', async () => {
    storeManager.get.mockReturnValue({
      allowRemoteTools: false,
      deviceId: 'stored-device-id',
      enabled: true,
      gatewayUrl: 'https://gateway.example.com',
    });

    const result = await controller.startAgent();

    expect(result.success).toBe(true);
    expect(GatewayClient).toHaveBeenCalledWith(
      expect.objectContaining({
        allowRemoteTools: false,
        deviceId: 'stored-device-id',
      }),
    );
    expect(result.status).toMatchObject({
      allowRemoteTools: false,
      deviceId: 'stored-device-id',
    });
  });

  it('persists generated device id on first start', async () => {
    const result = await controller.startAgent();

    expect(result.success).toBe(true);
    expect(storeManager.set).toHaveBeenCalledWith('deviceGateway', {
      allowRemoteTools: true,
      deviceId: 'generated-device-id',
      enabled: true,
    });
  });

  it('clears a custom gateway URL and reconnects to the default gateway', async () => {
    let storedConfig = {
      allowRemoteTools: true,
      deviceId: 'stored-device-id',
      enabled: true,
      gatewayUrl: 'https://custom-gateway.example.com',
    };
    storeManager.get.mockImplementation(() => storedConfig);
    storeManager.set.mockImplementation((_key, nextConfig) => {
      storedConfig = nextConfig;
    });

    const result = await controller.setAgentConfig({ gatewayUrl: '' });

    expect(result.success).toBe(true);
    expect(storedConfig).toEqual({
      allowRemoteTools: true,
      deviceId: 'stored-device-id',
      enabled: true,
    });
    expect(GatewayClient).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: 'stored-device-id',
        gatewayUrl: 'https://gateway.test',
      }),
    );
  });

  it('updates remote tool permission without reconnecting the gateway client', async () => {
    await controller.startAgent();
    vi.clearAllMocks();
    storeManager.get.mockReturnValue({ allowRemoteTools: false, enabled: true });

    const result = await controller.setAgentConfig({ allowRemoteTools: false });

    expect(result.success).toBe(true);
    expect(gatewayClient.setAllowRemoteTools).toHaveBeenCalledWith(false);
    expect(gatewayClient.connect).not.toHaveBeenCalled();
    expect(browserManager.broadcastToAllWindows).toHaveBeenCalledWith(
      'deviceGatewayStatusChanged',
      expect.objectContaining({ allowRemoteTools: false }),
    );
  });

  it('returns a clear error when gateway authentication does not complete', async () => {
    gatewayClient.connect.mockRejectedValueOnce(new Error('invalid token'));

    const result = await controller.startAgent();

    expect(result).toMatchObject({
      error: 'invalid token',
      success: false,
    });
    expect(result.status).toMatchObject({
      connectionStatus: 'disconnected',
      lastError: 'invalid token',
    });
    expect(gatewayClient.disconnect).toHaveBeenCalled();
    expect(browserManager.broadcastToAllWindows).toHaveBeenCalledWith(
      'deviceGatewayStatusChanged',
      expect.objectContaining({
        connectionStatus: 'disconnected',
        lastError: 'invalid token',
      }),
    );
  });

  it('silently skips auto-start before remote server sync is configured', async () => {
    remoteServerConfigCtr.isRemoteServerConfigured.mockResolvedValue(false);

    controller.afterAppReady();
    await vi.waitFor(() => {
      expect(browserManager.broadcastToAllWindows).toHaveBeenCalledWith(
        'deviceGatewayStatusChanged',
        expect.objectContaining({
          connectionStatus: 'disconnected',
          enabled: true,
          lastError: undefined,
        }),
      );
    });

    expect(GatewayClient).not.toHaveBeenCalled();
  });

  it('returns a clear error when manually started before remote server sync is configured', async () => {
    remoteServerConfigCtr.isRemoteServerConfigured.mockResolvedValue(false);

    const result = await controller.startAgent();

    expect(result).toMatchObject({
      error: 'Remote server sync is not active or configured',
      success: false,
    });
    expect(result.status.lastError).toBe('Remote server sync is not active or configured');
    expect(GatewayClient).not.toHaveBeenCalled();
  });

  it('refreshes the access token and reconnects when gateway auth expires', async () => {
    const refreshedToken = createAccessToken({ sub: 'user-1' });
    remoteServerConfigCtr.getAccessToken
      .mockResolvedValueOnce(createAccessToken({ sub: 'user-1' }))
      .mockResolvedValueOnce(refreshedToken);
    remoteServerConfigCtr.refreshAccessToken.mockResolvedValue({ success: true });

    await controller.startAgent();
    gatewayEventHandlers.auth_expired();

    await vi.waitFor(() => {
      expect(GatewayClient).toHaveBeenCalledTimes(2);
    });
    expect(remoteServerConfigCtr.refreshAccessToken).toHaveBeenCalled();
    expect(gatewayClient.disconnect).toHaveBeenCalled();
    expect(GatewayClient).toHaveBeenLastCalledWith(
      expect.objectContaining({
        token: refreshedToken,
        userId: 'user-1',
      }),
    );
  });

  it('coalesces duplicate auth expiry events into one refresh and reconnect', async () => {
    const refreshedToken = createAccessToken({ sub: 'user-1' });
    remoteServerConfigCtr.getAccessToken
      .mockResolvedValueOnce(createAccessToken({ sub: 'user-1' }))
      .mockResolvedValueOnce(refreshedToken);

    await controller.startAgent();
    gatewayEventHandlers.auth_expired();
    gatewayEventHandlers.auth_expired();

    await vi.waitFor(() => {
      expect(GatewayClient).toHaveBeenCalledTimes(2);
    });
    expect(remoteServerConfigCtr.refreshAccessToken).toHaveBeenCalledTimes(1);
  });

  it('refreshes and reconnects once when reconnect auth fails because the token expired', async () => {
    const refreshedToken = createAccessToken({ sub: 'user-1' });
    remoteServerConfigCtr.getAccessToken
      .mockResolvedValueOnce(createAccessToken({ sub: 'user-1' }))
      .mockResolvedValueOnce(refreshedToken);

    await controller.startAgent();
    gatewayEventHandlers.connected();
    gatewayEventHandlers.auth_failed('"exp" claim timestamp check failed');

    await vi.waitFor(() => {
      expect(GatewayClient).toHaveBeenCalledTimes(2);
    });
    expect(remoteServerConfigCtr.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(GatewayClient).toHaveBeenLastCalledWith(
      expect.objectContaining({
        token: refreshedToken,
        userId: 'user-1',
      }),
    );

    gatewayEventHandlers.auth_failed('"exp" claim timestamp check failed');
    await Promise.resolve();

    expect(remoteServerConfigCtr.refreshAccessToken).toHaveBeenCalledTimes(1);
  });

  it('does not refresh on non-expiry gateway auth failures', async () => {
    await controller.startAgent();
    gatewayEventHandlers.connected();
    vi.clearAllMocks();

    gatewayEventHandlers.auth_failed('userId mismatch');
    await Promise.resolve();

    expect(remoteServerConfigCtr.refreshAccessToken).not.toHaveBeenCalled();
    expect(GatewayClient).not.toHaveBeenCalled();
    expect(browserManager.broadcastToAllWindows).toHaveBeenCalledWith(
      'deviceGatewayStatusChanged',
      expect.objectContaining({ lastError: 'userId mismatch' }),
    );
  });

  it('disconnects after remote server reset without disabling the gateway preference', async () => {
    await controller.startAgent();
    await controller.disconnectForRemoteServerReset();

    expect(gatewayClient.disconnect).toHaveBeenCalled();
    expect(storeManager.set).not.toHaveBeenCalledWith(
      'deviceGateway',
      expect.objectContaining({ enabled: false }),
    );
    await expect(controller.getAgentStatus()).resolves.toMatchObject({
      connectionStatus: 'disconnected',
      enabled: true,
      lastConnectedAt: undefined,
      lastError: undefined,
      userId: undefined,
    });
  });

  it('responds to system info requests with the gateway protocol wrapper', () => {
    (controller as any).handleSystemInfoRequest(gatewayClient, { requestId: 'req-1' });

    expect(gatewayClient.sendSystemInfoResponse).toHaveBeenCalledWith({
      requestId: 'req-1',
      result: {
        success: true,
        systemInfo: expect.objectContaining({
          arch: expect.any(String),
          desktopPath: '/mock/desktop',
          homePath: '/mock/home',
          userDataPath: '/mock/userData',
        }),
      },
    });
  });

  it('rejects system info requests when remote tool execution is disabled', () => {
    storeManager.get.mockReturnValue({ allowRemoteTools: false, enabled: true });

    (controller as any).handleSystemInfoRequest(gatewayClient, { requestId: 'req-1' });

    expect(gatewayClient.sendSystemInfoResponse).toHaveBeenCalledWith({
      requestId: 'req-1',
      result: {
        error: 'REMOTE_TOOLS_DISABLED',
        success: false,
      },
    });
  });

  it('rejects remote tool calls when remote tool execution is disabled', async () => {
    storeManager.get.mockReturnValue({ allowRemoteTools: false, enabled: true });

    const result = await (controller as any).executeToolCall({
      apiName: 'runCommand',
      arguments: JSON.stringify({ command: 'echo ok' }),
      identifier: 'lobe-local-system',
    });

    expect(result).toEqual({
      content: 'Remote desktop tool execution is disabled on this device',
      error: 'REMOTE_TOOLS_DISABLED',
      success: false,
    });
    expect(shellCommandCtr.handleRunCommand).not.toHaveBeenCalled();
  });

  it('executes Local System tool calls through existing desktop controllers', async () => {
    shellCommandCtr.handleRunCommand.mockResolvedValue({
      exit_code: 0,
      stdout: 'ok',
      success: true,
    });

    const result = await (controller as any).executeToolCall({
      apiName: 'runCommand',
      arguments: JSON.stringify({ command: 'echo ok' }),
      identifier: 'lobe-local-system',
    });

    expect(result.success).toBe(true);
    expect(JSON.parse(result.content)).toMatchObject({ stdout: 'ok', success: true });
    expect(shellCommandCtr.handleRunCommand).toHaveBeenCalledWith({ command: 'echo ok' });
  });

  it('propagates failed Local System controller results to the gateway response', async () => {
    shellCommandCtr.handleRunCommand.mockResolvedValue({
      exit_code: 1,
      stderr: 'command failed',
      stdout: '',
      success: false,
    });

    const result = await (controller as any).executeToolCall({
      apiName: 'runCommand',
      arguments: JSON.stringify({ command: 'exit 1' }),
      identifier: 'lobe-local-system',
    });

    expect(result.success).toBe(false);
    expect(JSON.parse(result.content)).toMatchObject({
      exit_code: 1,
      stderr: 'command failed',
      success: false,
    });
  });

  it('rejects oversized gateway tool responses before sending them back to the relay', async () => {
    shellCommandCtr.handleRunCommand.mockResolvedValue({
      stdout: 'x'.repeat(5_000_001),
      success: true,
    });

    const result = await (controller as any).executeToolCall({
      apiName: 'runCommand',
      arguments: JSON.stringify({ command: 'cat large.log' }),
      identifier: 'lobe-local-system',
    });

    expect(result).toEqual({
      content: 'Device response is too large',
      error: 'DEVICE_RESPONSE_TOO_LARGE',
      success: false,
    });
  });

  it('prepares skill resources before executing skill scripts', async () => {
    localFileCtr.handlePrepareSkillDirectory.mockResolvedValue({
      extractedDir: '/tmp/skill-dir',
      success: true,
      zipPath: '/tmp/skill.zip',
    });
    shellCommandCtr.handleRunCommand.mockResolvedValue({
      exit_code: 0,
      stdout: 'done',
      success: true,
    });

    const result = await (controller as any).executeToolCall({
      apiName: 'execScript',
      arguments: JSON.stringify({
        command: 'bun run build',
        description: 'Build skill project',
        executionContextId: 'operation-1',
        zipSha256: 'hash-1',
        zipUrl: 'https://example.com/skill.zip',
      }),
      identifier: 'lobe-skills',
    });

    expect(result.success).toBe(true);
    expect(localFileCtr.handlePrepareSkillDirectory).toHaveBeenCalledWith({
      url: 'https://example.com/skill.zip',
      zipSha256: 'hash-1',
    });
    expect(shellCommandCtr.handleRunCommand).toHaveBeenCalledWith({
      command: 'bun run build',
      cwd: '/tmp/skill-dir',
      description: 'Build skill project',
      timeout: undefined,
    });
  });

  it('uploads skill export files from the remembered execution directory', async () => {
    localFileCtr.handlePrepareSkillDirectory.mockResolvedValue({
      extractedDir: '/tmp/skill-dir',
      success: true,
      zipPath: '/tmp/skill.zip',
    });
    shellCommandCtr.handleRunCommand.mockResolvedValue({
      exit_code: 0,
      stdout: 'done',
      success: true,
    });

    await (controller as any).executeToolCall({
      apiName: 'execScript',
      arguments: JSON.stringify({
        command: 'node build.js',
        executionContextId: 'operation-1',
        zipSha256: 'hash-1',
        zipUrl: 'https://example.com/skill.zip',
      }),
      identifier: 'lobe-skills',
    });

    const result = await (controller as any).executeToolCall({
      apiName: 'exportFile',
      arguments: JSON.stringify({
        executionContextId: 'operation-1',
        filename: 'result.txt',
        path: 'output.txt',
        uploadUrl: 'https://storage.example.com/upload',
      }),
      identifier: 'lobe-skills',
    });

    expect(result.success).toBe(true);
    expect(JSON.parse(result.content)).toMatchObject({
      filename: 'result.txt',
      mimeType: 'text/plain',
      path: '/tmp/skill-dir/output.txt',
      sha256: 'sha-1',
      size: 5,
      success: true,
    });
    expect(localFileCtr.handleReadFileAsBase64).toHaveBeenCalledWith({
      baseDir: '/tmp/skill-dir',
      path: 'output.txt',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://storage.example.com/upload',
      expect.objectContaining({
        headers: { 'content-type': 'text/plain' },
        method: 'PUT',
      }),
    );
  });

  it('rejects skill export files when no execution directory is active', async () => {
    const result = await (controller as any).executeToolCall({
      apiName: 'exportFile',
      arguments: JSON.stringify({
        filename: 'result.txt',
        path: 'output.txt',
        uploadUrl: 'https://storage.example.com/upload',
      }),
      identifier: 'lobe-skills',
    });

    expect(result).toMatchObject({
      error: 'No skill execution directory is available for export',
      success: false,
    });
    expect(localFileCtr.handleReadFileAsBase64).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('executes MCP tool calls through the desktop MCP controller', async () => {
    const result = await (controller as any).executeToolCall({
      apiName: 'callTool',
      arguments: JSON.stringify({
        args: JSON.stringify({ query: 'hello' }),
        params: {
          args: ['server'],
          command: 'npx',
          name: 'demo-mcp',
          type: 'stdio',
        },
        toolName: 'search',
      }),
      identifier: 'lobe-mcp',
    });

    expect(result.success).toBe(true);
    expect(JSON.parse(result.content)).toMatchObject({
      content: 'mcp result',
      success: true,
    });
    expect(mcpCtr.callTool).toHaveBeenCalledTimes(1);
    const serialized = mcpCtr.callTool.mock.calls[0][0];
    expect(superjson.deserialize(serialized)).toMatchObject({
      params: {
        args: ['server'],
        command: 'npx',
        name: 'demo-mcp',
        type: 'stdio',
      },
      toolName: 'search',
    });
  });

  it('executes local HTTP MCP tool calls through the desktop MCP controller', async () => {
    const result = await (controller as any).executeToolCall({
      apiName: 'callTool',
      arguments: JSON.stringify({
        args: JSON.stringify({ path: '/tmp/a.txt' }),
        params: {
          auth: { token: 'token-1', type: 'bearer' },
          headers: { Authorization: 'Bearer token-1' },
          name: 'local-http-mcp',
          type: 'http',
          url: 'http://localhost:8787/mcp',
        },
        toolName: 'readLocal',
      }),
      identifier: 'lobe-mcp',
    });

    expect(result.success).toBe(true);
    expect(mcpCtr.callTool).toHaveBeenCalledTimes(1);
    const serialized = mcpCtr.callTool.mock.calls[0][0];
    expect(superjson.deserialize(serialized)).toMatchObject({
      params: {
        auth: { token: 'token-1', type: 'bearer' },
        headers: { Authorization: 'Bearer token-1' },
        name: 'local-http-mcp',
        type: 'http',
        url: 'http://localhost:8787/mcp',
      },
      toolName: 'readLocal',
    });
  });

  it('rejects remote public HTTP MCP urls received from the gateway', async () => {
    const result = await (controller as any).executeToolCall({
      apiName: 'callTool',
      arguments: JSON.stringify({
        args: '{}',
        params: {
          name: 'public-http-mcp',
          type: 'http',
          url: 'https://example.com/mcp',
        },
        toolName: 'readRemote',
      }),
      identifier: 'lobe-mcp',
    });

    expect(result).toMatchObject({
      error: 'Remote MCP HTTP url must be local or private',
      success: false,
    });
    expect(mcpCtr.callTool).not.toHaveBeenCalled();
  });

  it('rejects non-http MCP urls even when they point at a private host', async () => {
    const result = await (controller as any).executeToolCall({
      apiName: 'callTool',
      arguments: JSON.stringify({
        args: '{}',
        params: {
          name: 'ftp-local-mcp',
          type: 'http',
          url: 'ftp://127.0.0.1/mcp',
        },
        toolName: 'readLocal',
      }),
      identifier: 'lobe-mcp',
    });

    expect(result).toMatchObject({
      error: 'Remote MCP HTTP url must be local or private',
      success: false,
    });
    expect(mcpCtr.callTool).not.toHaveBeenCalled();
  });

  it('rejects unsupported gateway tool identifiers', async () => {
    const result = await (controller as any).executeToolCall({
      apiName: 'runCommand',
      arguments: '{}',
      identifier: 'unknown-tool',
    });

    expect(result).toMatchObject({
      error: 'Unsupported device tool: unknown-tool/runCommand',
      success: false,
    });
  });

  it('rejects non-object tool arguments before dispatching to desktop controllers', async () => {
    const result = await (controller as any).executeToolCall({
      apiName: 'runCommand',
      arguments: JSON.stringify(['echo ok']),
      identifier: 'lobe-local-system',
    });

    expect(result).toMatchObject({
      error: 'Tool arguments must be a JSON object',
      success: false,
    });
    expect(shellCommandCtr.handleRunCommand).not.toHaveBeenCalled();
  });

  it('rejects malformed tool arguments before dispatching to desktop controllers', async () => {
    const result = await (controller as any).executeToolCall({
      apiName: 'runCommand',
      arguments: '{',
      identifier: 'lobe-local-system',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('JSON');
    expect(shellCommandCtr.handleRunCommand).not.toHaveBeenCalled();
  });
});
