import {
  RemoteDeviceExecutionRuntime,
  RemoteDeviceIdentifier,
} from '@lobechat/builtin-tool-remote-device';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type ToolExecutionContext } from '../../types';

// Mock deviceProxy
const mockQueryDeviceList = vi.fn();
const mockQueryDeviceSystemInfo = vi.fn();
vi.mock('../../deviceProxy', () => ({
  deviceProxy: {
    queryDeviceList: (...args: any[]) => mockQueryDeviceList(...args),
    queryDeviceSystemInfo: (...args: any[]) => mockQueryDeviceSystemInfo(...args),
  },
}));

// Import after mock setup
const { remoteDeviceRuntime } = await import('../remoteDevice');

describe('remoteDeviceRuntime', () => {
  it('should have the correct identifier', () => {
    expect(remoteDeviceRuntime.identifier).toBe(RemoteDeviceIdentifier);
  });

  describe('factory', () => {
    beforeEach(() => {
      mockQueryDeviceList.mockReset();
      mockQueryDeviceSystemInfo.mockReset();
    });

    it('should throw when userId is missing', () => {
      const context: ToolExecutionContext = {
        toolManifestMap: {},
      };

      expect(() => remoteDeviceRuntime.factory(context)).toThrow(
        'userId is required for Remote Device execution',
      );
    });

    it('should return a RemoteDeviceExecutionRuntime instance', () => {
      const context: ToolExecutionContext = {
        toolManifestMap: {},
        userId: 'user-1',
      };

      const runtime = remoteDeviceRuntime.factory(context);

      expect(runtime).toBeInstanceOf(RemoteDeviceExecutionRuntime);
    });

    it('should pass queryDeviceList that calls deviceProxy with the userId', async () => {
      const context: ToolExecutionContext = {
        toolManifestMap: {},
        userId: 'user-1',
      };

      const mockDevices = [
        {
          allowRemoteTools: true,
          deviceId: 'd1',
          hostname: 'host1',
          lastSeen: '2024-01-01',
          online: true,
          platform: 'darwin',
        },
      ];
      mockQueryDeviceList.mockResolvedValue(mockDevices);

      const runtime = remoteDeviceRuntime.factory(context) as RemoteDeviceExecutionRuntime;

      // Call listOnlineDevices which internally calls queryDeviceList
      const result = await runtime.listOnlineDevices();

      expect(mockQueryDeviceList).toHaveBeenCalledWith('user-1');
      expect(result.success).toBe(true);
    });

    it('should not activate an online device when remote tools are disabled', async () => {
      const context: ToolExecutionContext = {
        toolManifestMap: {},
        userId: 'user-1',
      };

      mockQueryDeviceList.mockResolvedValue([
        {
          allowRemoteTools: false,
          deviceId: 'd1',
          hostname: 'host1',
          lastSeen: '2024-01-01',
          online: true,
          platform: 'darwin',
        },
      ]);

      const runtime = remoteDeviceRuntime.factory(context) as RemoteDeviceExecutionRuntime;
      const result = await runtime.activateDevice({ deviceId: 'd1' });

      expect(result).toMatchObject({
        content:
          'Device "host1" is online, but Remote Tool Execution is disabled in Avato Desktop.',
        success: false,
      });
    });

    it('should include device platform and system info metadata when activating a device', async () => {
      const context: ToolExecutionContext = {
        toolManifestMap: {},
        userId: 'user-1',
      };

      mockQueryDeviceList.mockResolvedValue([
        {
          allowRemoteTools: true,
          deviceId: 'd1',
          hostname: 'host1',
          lastSeen: '2024-01-01',
          online: true,
          platform: 'darwin',
        },
      ]);
      mockQueryDeviceSystemInfo.mockResolvedValue({
        arch: 'arm64',
        desktopPath: '/Users/test/Desktop',
        documentsPath: '/Users/test/Documents',
        downloadsPath: '/Users/test/Downloads',
        homePath: '/Users/test',
        musicPath: '/Users/test/Music',
        picturesPath: '/Users/test/Pictures',
        userDataPath: '/Users/test/Library/Application Support/LobeHub',
        videosPath: '/Users/test/Movies',
        workingDirectory: '/Users/test/project',
      });

      const runtime = remoteDeviceRuntime.factory(context) as RemoteDeviceExecutionRuntime;
      const result = await runtime.activateDevice({ deviceId: 'd1' });

      expect(mockQueryDeviceSystemInfo).toHaveBeenCalledWith('user-1', 'd1');
      expect(result).toMatchObject({
        state: {
          metadata: {
            activeDeviceId: 'd1',
            devicePlatform: 'darwin',
            deviceSystemInfo: {
              desktopPath: '/Users/test/Desktop',
              homePath: '/Users/test',
              platform: 'darwin',
              workingDirectory: '/Users/test/project',
            },
          },
        },
        success: true,
      });
    });

    it('should still activate a device when system info lookup fails', async () => {
      const context: ToolExecutionContext = {
        toolManifestMap: {},
        userId: 'user-1',
      };

      mockQueryDeviceList.mockResolvedValue([
        {
          allowRemoteTools: true,
          deviceId: 'd1',
          hostname: 'host1',
          lastSeen: '2024-01-01',
          online: true,
          platform: 'linux',
        },
      ]);
      mockQueryDeviceSystemInfo.mockRejectedValue(new Error('system info unavailable'));

      const runtime = remoteDeviceRuntime.factory(context) as RemoteDeviceExecutionRuntime;
      const result = await runtime.activateDevice({ deviceId: 'd1' });

      expect(result).toMatchObject({
        state: {
          metadata: {
            activeDeviceId: 'd1',
            devicePlatform: 'linux',
            deviceSystemInfo: undefined,
          },
        },
        success: true,
      });
    });
  });
});
