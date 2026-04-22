import type { DeviceAttachment } from '@lobechat/builtin-tool-remote-device';
import type { DeviceSystemInfo } from '@lobechat/device-gateway-client/types';

import { lambdaClient } from '@/libs/trpc/client';

interface ExecuteToolCallParams {
  apiName: string;
  arguments: string;
  deviceId?: string;
  identifier: 'lobe-local-system' | 'lobe-skills';
  timeout?: number;
}

class RemoteDeviceService {
  private readonly activeDeviceStorageKey = 'lobehub.remoteDevice.activeDeviceId';

  async executeToolCall(params: ExecuteToolCallParams) {
    return lambdaClient.remoteDevice.executeToolCall.mutate(params);
  }

  async getActiveDeviceId(): Promise<string | undefined> {
    const stored = this.readActiveDeviceId();
    const devices = await this.list();
    if (
      stored &&
      devices.some(
        (device) => device.deviceId === stored && device.online && device.allowRemoteTools,
      )
    ) {
      return stored;
    }

    const onlineDevices = devices.filter((device) => device.online && device.allowRemoteTools);
    const activeDeviceId = onlineDevices.length === 1 ? onlineDevices[0].deviceId : undefined;
    if (activeDeviceId) {
      this.setActiveDeviceId(activeDeviceId);
    } else if (stored) {
      this.clearActiveDeviceId();
    }

    return activeDeviceId;
  }

  async getSystemInfo(deviceId: string): Promise<DeviceSystemInfo | undefined> {
    return lambdaClient.remoteDevice.getSystemInfo.query({ deviceId });
  }

  async list(): Promise<DeviceAttachment[]> {
    return lambdaClient.remoteDevice.list.query();
  }

  setActiveDeviceId(deviceId: string) {
    if (typeof localStorage === 'undefined') return;
    const normalizedDeviceId = deviceId.trim();
    if (!normalizedDeviceId) {
      this.clearActiveDeviceId();
      return;
    }

    localStorage.setItem(this.activeDeviceStorageKey, normalizedDeviceId);
  }

  async status() {
    return lambdaClient.remoteDevice.status.query();
  }

  private readActiveDeviceId() {
    if (typeof localStorage === 'undefined') return undefined;
    return localStorage.getItem(this.activeDeviceStorageKey) || undefined;
  }

  private clearActiveDeviceId() {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(this.activeDeviceStorageKey);
  }
}

export const remoteDeviceService = new RemoteDeviceService();
