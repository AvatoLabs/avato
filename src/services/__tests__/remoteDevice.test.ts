import { beforeEach, describe, expect, it, vi } from 'vitest';

import { lambdaClient } from '@/libs/trpc/client';
import { remoteDeviceService } from '@/services/remoteDevice';

vi.mock('@/libs/trpc/client', () => ({
  lambdaClient: {
    remoteDevice: {
      executeToolCall: {
        mutate: vi.fn(),
      },
      getSystemInfo: {
        query: vi.fn(),
      },
      list: {
        query: vi.fn(),
      },
      status: {
        query: vi.fn(),
      },
    },
  },
}));

describe('remoteDeviceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('clamps explicit tool-call timeouts before sending them to lambda', async () => {
    vi.mocked(lambdaClient.remoteDevice.executeToolCall.mutate).mockResolvedValue({
      content: 'ok',
      success: true,
    } as any);

    await remoteDeviceService.executeToolCall({
      apiName: 'runCommand',
      arguments: JSON.stringify({ command: 'sleep 600', timeout: 900_000 }),
      deviceId: 'device-1',
      identifier: 'lobe-local-system',
      timeout: 900_000,
    });

    expect(lambdaClient.remoteDevice.executeToolCall.mutate).toHaveBeenCalledWith({
      apiName: 'runCommand',
      arguments: JSON.stringify({ command: 'sleep 600', timeout: 900_000 }),
      deviceId: 'device-1',
      identifier: 'lobe-local-system',
      timeout: 600_000,
    });
  });

  it('omits invalid tool-call timeouts before sending them to lambda', async () => {
    vi.mocked(lambdaClient.remoteDevice.executeToolCall.mutate).mockResolvedValue({
      content: 'ok',
      success: true,
    } as any);

    await remoteDeviceService.executeToolCall({
      apiName: 'runCommand',
      arguments: JSON.stringify({ command: 'pwd' }),
      identifier: 'lobe-local-system',
      timeout: Number.POSITIVE_INFINITY,
    });

    expect(lambdaClient.remoteDevice.executeToolCall.mutate).toHaveBeenCalledWith({
      apiName: 'runCommand',
      arguments: JSON.stringify({ command: 'pwd' }),
      identifier: 'lobe-local-system',
    });
  });

  it('uses the stored active device when it is still online', async () => {
    localStorage.setItem('lobehub.remoteDevice.activeDeviceId', 'device-1');
    vi.mocked(lambdaClient.remoteDevice.list.query).mockResolvedValue([
      { allowRemoteTools: true, deviceId: 'device-1', hostname: 'desktop', online: true },
    ] as any);

    await expect(remoteDeviceService.getActiveDeviceId()).resolves.toBe('device-1');
  });

  it('falls back to the only online device when the stored device is offline', async () => {
    localStorage.setItem('lobehub.remoteDevice.activeDeviceId', 'offline-device');
    vi.mocked(lambdaClient.remoteDevice.list.query).mockResolvedValue([
      {
        allowRemoteTools: true,
        deviceId: 'offline-device',
        hostname: 'old desktop',
        online: false,
      },
      { allowRemoteTools: true, deviceId: 'device-2', hostname: 'new desktop', online: true },
    ] as any);

    await expect(remoteDeviceService.getActiveDeviceId()).resolves.toBe('device-2');
    expect(localStorage.getItem('lobehub.remoteDevice.activeDeviceId')).toBe('device-2');
  });

  it('does not auto-select a device when multiple devices are online and no stored device is valid', async () => {
    localStorage.setItem('lobehub.remoteDevice.activeDeviceId', 'offline-device');
    vi.mocked(lambdaClient.remoteDevice.list.query).mockResolvedValue([
      {
        allowRemoteTools: true,
        deviceId: 'offline-device',
        hostname: 'old desktop',
        online: false,
      },
      { allowRemoteTools: true, deviceId: 'device-2', hostname: 'new desktop', online: true },
      { allowRemoteTools: true, deviceId: 'device-3', hostname: 'workstation', online: true },
    ] as any);

    await expect(remoteDeviceService.getActiveDeviceId()).resolves.toBeUndefined();
    expect(localStorage.getItem('lobehub.remoteDevice.activeDeviceId')).toBeNull();
  });

  it('auto-selects the only online device with remote tool execution enabled', async () => {
    vi.mocked(lambdaClient.remoteDevice.list.query).mockResolvedValue([
      { allowRemoteTools: false, deviceId: 'device-1', hostname: 'desktop', online: true },
      { allowRemoteTools: true, deviceId: 'device-2', hostname: 'workstation', online: true },
    ] as any);

    await expect(remoteDeviceService.getActiveDeviceId()).resolves.toBe('device-2');
    expect(localStorage.getItem('lobehub.remoteDevice.activeDeviceId')).toBe('device-2');
  });

  it('returns undefined when no online device exists', async () => {
    localStorage.setItem('lobehub.remoteDevice.activeDeviceId', 'device-1');
    vi.mocked(lambdaClient.remoteDevice.list.query).mockResolvedValue([
      { allowRemoteTools: true, deviceId: 'device-1', hostname: 'desktop', online: false },
    ] as any);

    await expect(remoteDeviceService.getActiveDeviceId()).resolves.toBeUndefined();
    expect(localStorage.getItem('lobehub.remoteDevice.activeDeviceId')).toBeNull();
  });

  it('clears the stored active device when setting an empty id', () => {
    localStorage.setItem('lobehub.remoteDevice.activeDeviceId', 'device-1');

    remoteDeviceService.setActiveDeviceId('  ');

    expect(localStorage.getItem('lobehub.remoteDevice.activeDeviceId')).toBeNull();
  });

  it('does not select online devices when remote tool execution is disabled', async () => {
    localStorage.setItem('lobehub.remoteDevice.activeDeviceId', 'device-1');
    vi.mocked(lambdaClient.remoteDevice.list.query).mockResolvedValue([
      { allowRemoteTools: false, deviceId: 'device-1', hostname: 'desktop', online: true },
    ] as any);

    await expect(remoteDeviceService.getActiveDeviceId()).resolves.toBeUndefined();
    expect(localStorage.getItem('lobehub.remoteDevice.activeDeviceId')).toBeNull();
  });
});
