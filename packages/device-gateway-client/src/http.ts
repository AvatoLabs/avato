import type { DeviceAttachment, DeviceSystemInfo } from './types';

export type { DeviceAttachment, DeviceSystemInfo } from './types';

export interface DeviceStatusResult {
  deviceCount: number;
  online: boolean;
}

export interface DeviceToolCallResult {
  content: string;
  error?: string;
  success: boolean;
}

export interface GatewayHttpClientOptions {
  gatewayUrl: string;
  serviceToken: string;
}

const DEFAULT_HTTP_TIMEOUT = 15_000;
const DEFAULT_TOOL_CALL_TIMEOUT = 30_000;
const HTTP_TIMEOUT_BUFFER = 5000;
const MIN_RPC_TIMEOUT = 1000;
const MAX_RPC_TIMEOUT = 600_000;
const MAX_HTTP_TIMEOUT = MAX_RPC_TIMEOUT + HTTP_TIMEOUT_BUFFER;
const MAX_ERROR_BODY_LENGTH = 64_000;
const MAX_RESULT_CONTENT_LENGTH = 5_000_000;

const systemInfoFields = [
  'arch',
  'desktopPath',
  'documentsPath',
  'downloadsPath',
  'homePath',
  'musicPath',
  'picturesPath',
  'userDataPath',
  'videosPath',
  'workingDirectory',
] as const;

const hasSystemInfoShape = (data: unknown): data is DeviceSystemInfo => {
  if (!data || typeof data !== 'object') return false;

  return systemInfoFields.every(
    (field) => typeof (data as Record<string, unknown>)[field] === 'string',
  );
};

const pickSystemInfo = (data: DeviceSystemInfo): DeviceSystemInfo => {
  return {
    arch: data.arch,
    desktopPath: data.desktopPath,
    documentsPath: data.documentsPath,
    downloadsPath: data.downloadsPath,
    homePath: data.homePath,
    musicPath: data.musicPath,
    picturesPath: data.picturesPath,
    userDataPath: data.userDataPath,
    videosPath: data.videosPath,
    workingDirectory: data.workingDirectory,
  };
};

const isRecord = (data: unknown): data is Record<string, unknown> => {
  return !!data && typeof data === 'object' && !Array.isArray(data);
};

const readJsonObject = async (response: Response): Promise<Record<string, unknown> | undefined> => {
  try {
    const data: unknown = await response.json();
    return isRecord(data) ? data : undefined;
  } catch {
    return undefined;
  }
};

const truncateText = (text: string, maxLength: number) => {
  if (text.length <= maxLength) return text;

  return `${text.slice(0, maxLength)}\n... [truncated, ${text.length - maxLength} more characters]`;
};

const resolveRpcTimeout = (value: unknown, defaultTimeout: number) => {
  const rawTimeout = typeof value === 'number' && Number.isFinite(value) ? value : defaultTimeout;
  const timeout = Math.trunc(rawTimeout);

  return Math.min(Math.max(timeout, MIN_RPC_TIMEOUT), MAX_RPC_TIMEOUT);
};

const resolveHttpTimeout = (value: unknown, defaultTimeout: number) => {
  const rawTimeout = typeof value === 'number' && Number.isFinite(value) ? value : defaultTimeout;
  const timeout = Math.trunc(rawTimeout);

  return Math.min(Math.max(timeout, MIN_RPC_TIMEOUT), MAX_HTTP_TIMEOUT);
};

const readErrorBody = async (
  response: Response,
): Promise<Record<string, unknown> | string | undefined> => {
  const text = await response.text().catch(() => '');
  if (!text) return undefined;
  if (text.length > MAX_ERROR_BODY_LENGTH) return truncateText(text, MAX_ERROR_BODY_LENGTH);

  try {
    const data: unknown = JSON.parse(text);
    return isRecord(data) ? data : text;
  } catch {
    return text;
  }
};

const isDeviceAttachment = (data: unknown): data is DeviceAttachment => {
  if (!isRecord(data)) return false;

  return (
    (data.allowRemoteComputerUse === undefined ||
      typeof data.allowRemoteComputerUse === 'boolean') &&
    (data.allowRemoteTools === undefined || typeof data.allowRemoteTools === 'boolean') &&
    typeof data.connectedAt === 'number' &&
    typeof data.deviceId === 'string' &&
    typeof data.hostname === 'string' &&
    typeof data.platform === 'string'
  );
};

const pickDeviceAttachment = (data: DeviceAttachment): DeviceAttachment => ({
  ...(data.allowRemoteComputerUse === true ? { allowRemoteComputerUse: true } : {}),
  allowRemoteTools: data.allowRemoteTools === true,
  connectedAt: data.connectedAt,
  deviceId: data.deviceId,
  hostname: data.hostname,
  platform: data.platform,
});

export class GatewayHttpClient {
  private gatewayUrl: string;
  private serviceToken: string;

  constructor(options: GatewayHttpClientOptions) {
    this.gatewayUrl = options.gatewayUrl.replace(/\/+$/, '');
    this.serviceToken = options.serviceToken;
  }

  async queryDeviceStatus(userId: string): Promise<DeviceStatusResult> {
    const res = await this.post('/api/device/status', { userId });
    if (!res.ok) return { deviceCount: 0, online: false };

    const data = await readJsonObject(res);
    return {
      deviceCount: typeof data?.deviceCount === 'number' ? data.deviceCount : 0,
      online: typeof data?.online === 'boolean' ? data.online : false,
    };
  }

  async queryDeviceList(userId: string): Promise<DeviceAttachment[]> {
    const res = await this.post('/api/device/devices', { userId });
    if (!res.ok) return [];

    const data = await readJsonObject(res);
    return Array.isArray(data?.devices)
      ? data.devices.filter(isDeviceAttachment).map(pickDeviceAttachment)
      : [];
  }

  async executeToolCall(
    params: { deviceId?: string; timeout?: number; userId: string },
    toolCall: { apiName: string; arguments: string; identifier: string },
  ): Promise<DeviceToolCallResult> {
    const timeout = resolveRpcTimeout(params.timeout, DEFAULT_TOOL_CALL_TIMEOUT);
    const res = await this.post(
      '/api/device/tool-call',
      {
        deviceId: params.deviceId,
        timeout,
        toolCall,
        userId: params.userId,
      },
      {
        timeout: timeout + HTTP_TIMEOUT_BUFFER,
      },
    );

    if (!res.ok) {
      const errorBody = await readErrorBody(res);
      if (isRecord(errorBody)) {
        return {
          content:
            typeof errorBody.content === 'string'
              ? truncateText(errorBody.content, MAX_ERROR_BODY_LENGTH)
              : `Device tool call failed (HTTP ${res.status})`,
          error:
            typeof errorBody.error === 'string'
              ? truncateText(errorBody.error, MAX_ERROR_BODY_LENGTH)
              : `HTTP ${res.status}`,
          success: false,
        };
      }

      return {
        content: `Device tool call failed (HTTP ${res.status})`,
        error: errorBody || `HTTP ${res.status}`,
        success: false,
      };
    }

    const data = await readJsonObject(res);
    if (!data) {
      return {
        content: 'Device gateway returned an invalid JSON response',
        error: 'INVALID_JSON_RESPONSE',
        success: false,
      };
    }

    const content =
      typeof data.content === 'string' ? data.content : JSON.stringify(data.content ?? data);
    if (content.length > MAX_RESULT_CONTENT_LENGTH) {
      return {
        content: 'Device gateway response is too large',
        error: 'DEVICE_GATEWAY_RESPONSE_TOO_LARGE',
        success: false,
      };
    }

    return {
      content,
      error: typeof data.error === 'string' ? data.error : undefined,
      success: typeof data.success === 'boolean' ? data.success : true,
    };
  }

  async getDeviceSystemInfo(
    userId: string,
    deviceId: string,
  ): Promise<{ success: boolean; systemInfo?: DeviceSystemInfo }> {
    const res = await this.post('/api/device/system-info', { deviceId, userId });
    if (!res.ok) {
      return { success: false };
    }

    const data = await readJsonObject(res);
    if (!data) return { success: false };

    const systemInfo = hasSystemInfoShape(data.systemInfo)
      ? data.systemInfo
      : hasSystemInfoShape(data)
        ? pickSystemInfo(data)
        : undefined;

    return {
      success: typeof data.success === 'boolean' ? data.success : false,
      systemInfo,
    };
  }

  private async post(
    path: string,
    body: unknown,
    options: { timeout?: number } = {},
  ): Promise<Response> {
    const timeout = resolveHttpTimeout(options.timeout, DEFAULT_HTTP_TIMEOUT);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      return await fetch(`${this.gatewayUrl}${path}`, {
        body: JSON.stringify(body),
        headers: {
          'Authorization': `Bearer ${this.serviceToken}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }
}
