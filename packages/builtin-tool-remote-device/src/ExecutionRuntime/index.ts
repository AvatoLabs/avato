import { type BuiltinServerRuntimeOutput } from '@lobechat/types';

import { type DeviceAttachment, type DeviceSystemInfo } from './types';

export interface RemoteDeviceRuntimeService {
  queryDeviceList: () => Promise<DeviceAttachment[]>;
  queryDeviceSystemInfo?: (deviceId: string) => Promise<DeviceSystemInfo | undefined>;
}

export class RemoteDeviceExecutionRuntime {
  private service: RemoteDeviceRuntimeService;

  constructor(service: RemoteDeviceRuntimeService) {
    this.service = service;
  }

  async listOnlineDevices(): Promise<BuiltinServerRuntimeOutput> {
    try {
      const devices = await this.service.queryDeviceList();
      const onlineDevices = devices.filter((d) => d.online);
      const eligibleDevices = onlineDevices.filter((d) => d.allowRemoteTools);

      return {
        content:
          onlineDevices.length > 0
            ? JSON.stringify(onlineDevices)
            : 'No online devices found. Please make sure your desktop application is running and connected.',
        state: { devices: onlineDevices, eligibleDevices },
        success: true,
      };
    } catch (error) {
      return {
        content: `Failed to list devices: ${error instanceof Error ? error.message : String(error)}`,
        error,
        success: false,
      };
    }
  }

  async activateDevice(args: { deviceId: string }): Promise<BuiltinServerRuntimeOutput> {
    try {
      const devices = await this.service.queryDeviceList();
      const target = devices.find((d) => d.deviceId === args.deviceId && d.online);

      if (!target) {
        return {
          content: `Device "${args.deviceId}" is not online or does not exist.`,
          success: false,
        };
      }

      if (!target.allowRemoteTools) {
        return {
          content: `Device "${target.hostname}" is online, but Remote Tool Execution is disabled in Avato Desktop.`,
          success: false,
        };
      }

      let systemInfo: DeviceSystemInfo | undefined;
      try {
        systemInfo = await this.service.queryDeviceSystemInfo?.(args.deviceId);
      } catch {
        systemInfo = undefined;
      }

      const deviceSystemInfo = systemInfo
        ? {
            arch: systemInfo.arch,
            desktopPath: systemInfo.desktopPath,
            documentsPath: systemInfo.documentsPath,
            downloadsPath: systemInfo.downloadsPath,
            homePath: systemInfo.homePath,
            musicPath: systemInfo.musicPath,
            picturesPath: systemInfo.picturesPath,
            platform: target.platform,
            userDataPath: systemInfo.userDataPath,
            videosPath: systemInfo.videosPath,
            workingDirectory: systemInfo.workingDirectory,
          }
        : undefined;

      return {
        content: `Device "${target.hostname}" (${target.platform}) activated successfully. Local System, Skills, and local/private MCP tools are now available.`,
        state: {
          activatedDevice: target,
          metadata: {
            activeDeviceId: args.deviceId,
            activeDeviceComputerUseReady: target.allowRemoteComputerUse === true,
            devicePlatform: target.platform,
            deviceSystemInfo,
          },
        },
        success: true,
      };
    } catch (error) {
      return {
        content: `Failed to activate device: ${error instanceof Error ? error.message : String(error)}`,
        error,
        success: false,
      };
    }
  }
}
