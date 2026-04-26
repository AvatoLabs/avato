import type { DeviceAttachment, PublicDeviceAttachment } from './types';

export const MAX_DEVICE_RESULT_CONTENT_LENGTH = 5_000_000;
export const MAX_WS_MESSAGE_BYTES = 6_000_000;

interface AttachedDeviceSocket {
  deserializeAttachment: () => unknown;
}

interface ResolveNextDeviceAlarmOptions {
  heartbeatTimeout: number;
  now: number;
}

export type RemoteToolTargetResult<T> =
  | {
      attachment: DeviceAttachment;
      socket: T;
      type: 'found';
    }
  | {
      attachment?: DeviceAttachment;
      socket?: T;
      type: 'remote_tools_disabled';
    }
  | {
      type: 'not_found';
    };

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === 'object' && !Array.isArray(value);
};

export const toPublicDeviceAttachment = (attachment: DeviceAttachment): PublicDeviceAttachment => ({
  ...(attachment.allowRemoteComputerUse === true ? { allowRemoteComputerUse: true } : {}),
  allowRemoteTools: attachment.allowRemoteTools,
  connectedAt: attachment.connectedAt,
  deviceId: attachment.deviceId,
  hostname: attachment.hostname,
  platform: attachment.platform,
});

export const resolveNextDeviceAlarm = (
  attachments: DeviceAttachment[],
  options: ResolveNextDeviceAlarmOptions,
): number | undefined => {
  let nextAlarm: number | undefined;

  const addCandidate = (candidate?: number) => {
    if (!candidate || !Number.isFinite(candidate)) return;
    nextAlarm = nextAlarm === undefined ? candidate : Math.min(nextAlarm, candidate);
  };

  for (const attachment of attachments) {
    if (!attachment.authenticated) {
      addCandidate(attachment.authDeadline);
      continue;
    }

    addCandidate(attachment.lastHeartbeat + options.heartbeatTimeout);
    addCandidate(attachment.authExpiresAt);
  }

  return nextAlarm === undefined ? undefined : Math.max(nextAlarm, options.now + 1);
};

export const resolveRemoteToolTarget = <T extends AttachedDeviceSocket>(
  sockets: T[],
  deviceId?: string,
): RemoteToolTargetResult<T> => {
  if (deviceId) {
    const socket = sockets.find((ws) => {
      const att = ws.deserializeAttachment() as DeviceAttachment;
      return att.deviceId === deviceId;
    });

    if (!socket) return { type: 'not_found' };

    const attachment = socket.deserializeAttachment() as DeviceAttachment;
    return attachment.allowRemoteTools
      ? { attachment, socket, type: 'found' }
      : { attachment, socket, type: 'remote_tools_disabled' };
  }

  for (const socket of sockets) {
    const attachment = socket.deserializeAttachment() as DeviceAttachment;
    if (attachment.allowRemoteTools) return { attachment, socket, type: 'found' };
  }

  const socket = sockets[0];
  return socket
    ? {
        attachment: socket.deserializeAttachment() as DeviceAttachment,
        socket,
        type: 'remote_tools_disabled',
      }
    : { type: 'not_found' };
};

export const shouldReplaceAuthenticatedDeviceSocket = (
  attachment: DeviceAttachment,
  deviceId: string,
): boolean => {
  return attachment.authenticated && attachment.deviceId === deviceId;
};

export const isActiveAuthenticatedDeviceAttachment = (
  attachment: DeviceAttachment,
  now: number,
): boolean => {
  if (!attachment.authenticated) return false;
  if (attachment.authExpiresAt === undefined) return true;

  return Number.isFinite(attachment.authExpiresAt) && now < attachment.authExpiresAt;
};

export const decodeWebSocketMessage = (message: string | ArrayBuffer): string | undefined => {
  const byteLength =
    typeof message === 'string' ? new TextEncoder().encode(message).byteLength : message.byteLength;
  if (byteLength > MAX_WS_MESSAGE_BYTES) return undefined;

  return typeof message === 'string' ? message : new TextDecoder().decode(message);
};

export const isServiceTokenDeviceAuthEnabled = (value?: string): boolean => {
  return ['1', 'true', 'yes'].includes(String(value || '').toLowerCase());
};

export const normalizeDeviceRpcResult = (result: unknown): unknown => {
  if (!isRecord(result)) return result;

  if (
    typeof result.content === 'string' &&
    result.content.length > MAX_DEVICE_RESULT_CONTENT_LENGTH
  ) {
    return {
      content: 'Device response is too large',
      error: 'DEVICE_RESPONSE_TOO_LARGE',
      success: false,
    };
  }

  return result;
};
