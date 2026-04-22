import { describe, expect, it } from 'vitest';

import {
  decodeWebSocketMessage,
  isServiceTokenDeviceAuthEnabled,
  MAX_DEVICE_RESULT_CONTENT_LENGTH,
  MAX_WS_MESSAGE_BYTES,
  normalizeDeviceRpcResult,
  resolveNextDeviceAlarm,
  resolveRemoteToolTarget,
  toPublicDeviceAttachment,
} from './device';
import type { DeviceAttachment } from './types';

const createSocket = (attachment: DeviceAttachment) => ({
  deserializeAttachment: () => attachment,
});

describe('toPublicDeviceAttachment', () => {
  it('only exposes public device fields', () => {
    const result = toPublicDeviceAttachment({
      allowRemoteTools: true,
      authDeadline: 3000,
      authExpiresAt: 4000,
      authenticated: true,
      connectedAt: 1000,
      deviceId: 'device-1',
      hostname: 'Arthur-MacBook',
      lastHeartbeat: 2000,
      platform: 'darwin',
      routeUserId: 'user-1',
    });

    expect(result).toEqual({
      allowRemoteTools: true,
      connectedAt: 1000,
      deviceId: 'device-1',
      hostname: 'Arthur-MacBook',
      platform: 'darwin',
    });
    expect(result).not.toHaveProperty('authenticated');
    expect(result).not.toHaveProperty('authDeadline');
    expect(result).not.toHaveProperty('authExpiresAt');
    expect(result).not.toHaveProperty('lastHeartbeat');
    expect(result).not.toHaveProperty('routeUserId');
  });
});

describe('resolveNextDeviceAlarm', () => {
  it('schedules unauthenticated sockets at the auth deadline', () => {
    const nextAlarm = resolveNextDeviceAlarm(
      [
        {
          authDeadline: 5000,
          allowRemoteTools: false,
          authenticated: false,
          connectedAt: 1000,
          deviceId: 'device-1',
          hostname: 'desktop',
          lastHeartbeat: 1000,
          platform: 'darwin',
        },
      ],
      { heartbeatTimeout: 90_000, now: 1000 },
    );

    expect(nextAlarm).toBe(5000);
  });

  it('uses token expiry when it is sooner than heartbeat timeout', () => {
    const nextAlarm = resolveNextDeviceAlarm(
      [
        {
          authenticated: true,
          allowRemoteTools: true,
          authExpiresAt: 10_000,
          connectedAt: 1000,
          deviceId: 'device-1',
          hostname: 'desktop',
          lastHeartbeat: 1000,
          platform: 'darwin',
        },
      ],
      { heartbeatTimeout: 90_000, now: 1000 },
    );

    expect(nextAlarm).toBe(10_000);
  });

  it('uses heartbeat timeout when no token expiry exists', () => {
    const nextAlarm = resolveNextDeviceAlarm(
      [
        {
          authenticated: true,
          allowRemoteTools: true,
          connectedAt: 1000,
          deviceId: 'device-1',
          hostname: 'desktop',
          lastHeartbeat: 3000,
          platform: 'darwin',
        },
      ],
      { heartbeatTimeout: 90_000, now: 1000 },
    );

    expect(nextAlarm).toBe(93_000);
  });

  it('does not schedule an alarm in the past', () => {
    const nextAlarm = resolveNextDeviceAlarm(
      [
        {
          authDeadline: 500,
          allowRemoteTools: false,
          authenticated: false,
          connectedAt: 100,
          deviceId: 'device-1',
          hostname: 'desktop',
          lastHeartbeat: 100,
          platform: 'darwin',
        },
      ],
      { heartbeatTimeout: 90_000, now: 1000 },
    );

    expect(nextAlarm).toBe(1001);
  });
});

describe('resolveRemoteToolTarget', () => {
  it('selects the requested device when remote tools are enabled', () => {
    const socket = createSocket({
      allowRemoteTools: true,
      authenticated: true,
      connectedAt: 1000,
      deviceId: 'device-1',
      hostname: 'desktop',
      lastHeartbeat: 1000,
      platform: 'darwin',
    });

    expect(resolveRemoteToolTarget([socket], 'device-1')).toMatchObject({
      socket,
      type: 'found',
    });
  });

  it('rejects the requested device when remote tools are disabled', () => {
    const socket = createSocket({
      allowRemoteTools: false,
      authenticated: true,
      connectedAt: 1000,
      deviceId: 'device-1',
      hostname: 'desktop',
      lastHeartbeat: 1000,
      platform: 'darwin',
    });

    expect(resolveRemoteToolTarget([socket], 'device-1')).toMatchObject({
      socket,
      type: 'remote_tools_disabled',
    });
  });

  it('selects the first remote-tool-enabled device when no target device is specified', () => {
    const disabledSocket = createSocket({
      allowRemoteTools: false,
      authenticated: true,
      connectedAt: 1000,
      deviceId: 'device-disabled',
      hostname: 'desktop-disabled',
      lastHeartbeat: 1000,
      platform: 'darwin',
    });
    const enabledSocket = createSocket({
      allowRemoteTools: true,
      authenticated: true,
      connectedAt: 1000,
      deviceId: 'device-enabled',
      hostname: 'desktop-enabled',
      lastHeartbeat: 1000,
      platform: 'linux',
    });

    expect(resolveRemoteToolTarget([disabledSocket, enabledSocket])).toMatchObject({
      socket: enabledSocket,
      type: 'found',
    });
  });

  it('returns remote_tools_disabled when every online device has remote tools disabled', () => {
    const socket = createSocket({
      allowRemoteTools: false,
      authenticated: true,
      connectedAt: 1000,
      deviceId: 'device-1',
      hostname: 'desktop',
      lastHeartbeat: 1000,
      platform: 'darwin',
    });

    expect(resolveRemoteToolTarget([socket])).toMatchObject({
      socket,
      type: 'remote_tools_disabled',
    });
  });
});

describe('decodeWebSocketMessage', () => {
  it('decodes string and ArrayBuffer websocket messages', () => {
    const encoded = new TextEncoder().encode('{"type":"heartbeat"}');
    const buffer = encoded.buffer.slice(
      encoded.byteOffset,
      encoded.byteOffset + encoded.byteLength,
    ) as ArrayBuffer;

    expect(decodeWebSocketMessage('{"type":"heartbeat"}')).toBe('{"type":"heartbeat"}');
    expect(decodeWebSocketMessage(buffer)).toBe('{"type":"heartbeat"}');
  });

  it('rejects oversized websocket messages', () => {
    expect(decodeWebSocketMessage('x'.repeat(MAX_WS_MESSAGE_BYTES + 1))).toBeUndefined();
  });
});

describe('isServiceTokenDeviceAuthEnabled', () => {
  it('only enables service token device auth for explicit truthy values', () => {
    expect(isServiceTokenDeviceAuthEnabled()).toBe(false);
    expect(isServiceTokenDeviceAuthEnabled('')).toBe(false);
    expect(isServiceTokenDeviceAuthEnabled('false')).toBe(false);
    expect(isServiceTokenDeviceAuthEnabled('true')).toBe(true);
    expect(isServiceTokenDeviceAuthEnabled('1')).toBe(true);
    expect(isServiceTokenDeviceAuthEnabled('yes')).toBe(true);
  });
});

describe('normalizeDeviceRpcResult', () => {
  it('passes through normal device results', () => {
    const result = { content: 'ok', success: true };

    expect(normalizeDeviceRpcResult(result)).toBe(result);
  });

  it('rejects oversized device response content', () => {
    expect(
      normalizeDeviceRpcResult({
        content: 'x'.repeat(MAX_DEVICE_RESULT_CONTENT_LENGTH + 1),
        success: true,
      }),
    ).toEqual({
      content: 'Device response is too large',
      error: 'DEVICE_RESPONSE_TOO_LARGE',
      success: false,
    });
  });
});
