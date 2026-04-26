import { LocalSystemIdentifier, LocalSystemManifest } from '@lobechat/builtin-tool-local-system';
import { describe, expect, it, vi } from 'vitest';

import { type ToolExecutionContext } from '../../types';

// Mock deviceProxy
const mockExecuteToolCall = vi.fn();
vi.mock('../../deviceProxy', () => ({
  deviceProxy: {
    executeToolCall: (...args: any[]) => mockExecuteToolCall(...args),
  },
}));

// Import after mock setup
const { localSystemRuntime } = await import('../localSystem');

describe('localSystemRuntime', () => {
  it('should have the correct identifier', () => {
    expect(localSystemRuntime.identifier).toBe(LocalSystemIdentifier);
  });

  describe('factory', () => {
    it('should throw when userId is missing', () => {
      const context: ToolExecutionContext = {
        activeDeviceId: 'device-1',
        toolManifestMap: {},
      };

      expect(() => localSystemRuntime.factory(context)).toThrow(
        'userId is required for Local System device proxy execution',
      );
    });

    it('should throw when activeDeviceId is missing', () => {
      const context: ToolExecutionContext = {
        toolManifestMap: {},
        userId: 'user-1',
      };

      expect(() => localSystemRuntime.factory(context)).toThrow(
        'activeDeviceId is required for Local System device proxy execution',
      );
    });

    it('should create a proxy with a function for each API in LocalSystemManifest', () => {
      const context: ToolExecutionContext = {
        activeDeviceId: 'device-1',
        toolManifestMap: {},
        userId: 'user-1',
      };

      const proxy = localSystemRuntime.factory(context);

      for (const api of LocalSystemManifest.api) {
        expect(proxy[api.name]).toBeDefined();
        expect(typeof proxy[api.name]).toBe('function');
      }
    });

    it('should call deviceProxy.executeToolCall with correct arguments when a proxy function is invoked', async () => {
      const context: ToolExecutionContext = {
        activeDeviceId: 'device-1',
        toolManifestMap: {},
        userId: 'user-1',
      };

      mockExecuteToolCall.mockResolvedValue({
        content: JSON.stringify({ files: [], totalCount: 0 }),
        success: true,
      });

      const proxy = localSystemRuntime.factory(context);
      const apiName = 'listLocalFiles';
      const args = { path: '/tmp/test' };

      const result = await proxy[apiName](args);

      expect(mockExecuteToolCall).toHaveBeenCalledWith(
        { deviceId: 'device-1', userId: 'user-1' },
        {
          apiName,
          arguments: JSON.stringify(args),
          identifier: LocalSystemIdentifier,
        },
      );
      expect(result).toMatchObject({
        content: 'Directory /tmp/test is empty',
        state: { listResults: [], totalCount: 0 },
        success: true,
      });
    });

    it('should format and preserve failed device execution results', async () => {
      const context: ToolExecutionContext = {
        activeDeviceId: 'device-1',
        toolManifestMap: {},
        userId: 'user-1',
      };

      mockExecuteToolCall.mockResolvedValue({
        content: JSON.stringify({ stderr: 'command failed', success: false }),
        success: false,
      });

      const proxy = localSystemRuntime.factory(context);
      const result = await proxy.runCommand({ command: 'exit 1' });

      expect(result).toMatchObject({
        content: 'Command failed: command failed\n\nStderr:\ncommand failed',
        error: {
          message: 'command failed',
          type: 'PluginServerError',
        },
        success: false,
      });
    });

    it('formats successful command results like the local executor', async () => {
      const context: ToolExecutionContext = {
        activeDeviceId: 'device-1',
        toolManifestMap: {},
        userId: 'user-1',
      };

      mockExecuteToolCall.mockResolvedValue({
        content: JSON.stringify({ exit_code: 0, stdout: 'ok', success: true }),
        success: true,
      });

      const proxy = localSystemRuntime.factory(context);
      const result = await proxy.runCommand({ command: 'echo ok' });

      expect(result).toMatchObject({
        content: 'Command completed successfully.\n\nOutput:\nok\n\nExit code: 0',
        state: {
          message: 'Command completed successfully.',
          result: { exit_code: 0, stdout: 'ok', success: true },
        },
        success: true,
      });
    });

    it('formats remote batch file reads like the local executor', async () => {
      const context: ToolExecutionContext = {
        activeDeviceId: 'device-1',
        toolManifestMap: {},
        userId: 'user-1',
      };

      const filesContent = [{ content: 'const value = 1;', filename: 'a.ts' }];
      mockExecuteToolCall.mockResolvedValue({
        content: JSON.stringify(filesContent),
        success: true,
      });

      const proxy = localSystemRuntime.factory(context);
      const result = await proxy.readLocalFiles({ paths: ['/tmp/a.ts'] });

      expect(mockExecuteToolCall).toHaveBeenCalledWith(
        { deviceId: 'device-1', userId: 'user-1' },
        {
          apiName: 'readLocalFiles',
          arguments: JSON.stringify({ paths: ['/tmp/a.ts'] }),
          identifier: LocalSystemIdentifier,
        },
      );
      expect(result).toEqual({
        content: 'Read 1 file(s):\n\n=== a.ts ===\nconst value = 1;',
        state: { filesContent },
        success: true,
      });
    });

    it('uses the Local System command timeout default for remote runCommand calls', async () => {
      const context: ToolExecutionContext = {
        activeDeviceId: 'device-1',
        toolManifestMap: {},
        userId: 'user-1',
      };

      mockExecuteToolCall.mockResolvedValue({
        content: JSON.stringify({ exit_code: 0, stdout: 'ok', success: true }),
        success: true,
      });

      const proxy = localSystemRuntime.factory(context);
      await proxy.runCommand({ command: 'sleep 60' });

      expect(mockExecuteToolCall).toHaveBeenCalledWith(
        { deviceId: 'device-1', userId: 'user-1' },
        {
          apiName: 'runCommand',
          arguments: JSON.stringify({ command: 'sleep 60' }),
          identifier: LocalSystemIdentifier,
        },
        120_000,
      );
    });

    it('passes a clamped custom command timeout to the device gateway', async () => {
      const context: ToolExecutionContext = {
        activeDeviceId: 'device-1',
        toolManifestMap: {},
        userId: 'user-1',
      };

      mockExecuteToolCall.mockResolvedValue({
        content: JSON.stringify({ exit_code: 0, stdout: 'ok', success: true }),
        success: true,
      });

      const proxy = localSystemRuntime.factory(context);
      await proxy.runCommand({ command: 'sleep 600', timeout: 900_000 });

      expect(mockExecuteToolCall).toHaveBeenCalledWith(
        { deviceId: 'device-1', userId: 'user-1' },
        {
          apiName: 'runCommand',
          arguments: JSON.stringify({ command: 'sleep 600', timeout: 900_000 }),
          identifier: LocalSystemIdentifier,
        },
        600_000,
      );
    });

    it('formats failed write results with a plugin error', async () => {
      const context: ToolExecutionContext = {
        activeDeviceId: 'device-1',
        toolManifestMap: {},
        userId: 'user-1',
      };

      mockExecuteToolCall.mockResolvedValue({
        content: JSON.stringify({ error: 'permission denied', success: false }),
        success: false,
      });

      const proxy = localSystemRuntime.factory(context);
      const result = await proxy.writeLocalFile({ content: 'data', path: '/root/a.txt' });

      expect(result).toMatchObject({
        content: 'Failed to write file: permission denied',
        error: { message: 'permission denied', type: 'PluginServerError' },
        success: false,
      });
    });

    it('preserves failed file operation errors as plugin errors', async () => {
      const context: ToolExecutionContext = {
        activeDeviceId: 'device-1',
        toolManifestMap: {},
        userId: 'user-1',
      };

      mockExecuteToolCall.mockResolvedValue({
        content: JSON.stringify({ error: 'directory not found', success: false }),
        success: false,
      });

      const proxy = localSystemRuntime.factory(context);
      const result = await proxy.listLocalFiles({ path: '/missing' });

      expect(result).toMatchObject({
        content: 'directory not found',
        error: { message: 'directory not found', type: 'PluginServerError' },
        success: false,
      });
    });

    it('should JSON.stringify the arguments passed to the proxy function', async () => {
      const context: ToolExecutionContext = {
        activeDeviceId: 'device-2',
        toolManifestMap: {},
        userId: 'user-2',
      };

      mockExecuteToolCall.mockResolvedValue({ content: '', success: true });

      const proxy = localSystemRuntime.factory(context);
      const apiName = LocalSystemManifest.api[0].name;
      const complexArgs = { keywords: 'test', fileTypes: ['txt', 'md'], limit: 10 };

      await proxy[apiName](complexArgs);

      expect(mockExecuteToolCall).toHaveBeenCalledWith(
        { deviceId: 'device-2', userId: 'user-2' },
        expect.objectContaining({
          arguments: JSON.stringify(complexArgs),
        }),
      );
    });
  });
});
