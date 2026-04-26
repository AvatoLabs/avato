import { describe, expect, it, vi } from 'vitest';

// Import after mocks are set up
import { DeviceProxy } from '../deviceProxy';

const mockEnv = vi.hoisted(() => ({
  DEVICE_GATEWAY_SERVICE_TOKEN: undefined as string | undefined,
  DEVICE_GATEWAY_URL: undefined as string | undefined,
}));

const mockClient = vi.hoisted(() => ({
  executeToolCall: vi.fn(),
  getDeviceSystemInfo: vi.fn(),
  queryDeviceList: vi.fn(),
  queryDeviceStatus: vi.fn(),
}));

const MockGatewayHttpClient = vi.hoisted(() => vi.fn(() => mockClient));

vi.mock('@/envs/gateway', () => ({
  gatewayEnv: mockEnv,
}));

vi.mock('@lobechat/device-gateway-client/http', () => ({
  GatewayHttpClient: MockGatewayHttpClient,
}));

describe('DeviceProxy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    mockEnv.DEVICE_GATEWAY_URL = undefined;
    mockEnv.DEVICE_GATEWAY_SERVICE_TOKEN = undefined;
  });

  describe('isConfigured', () => {
    it('should return false when DEVICE_GATEWAY_URL is not set', () => {
      const proxy = new DeviceProxy();
      expect(proxy.isConfigured).toBe(false);
    });

    it('should return false when DEVICE_GATEWAY_SERVICE_TOKEN is not set', () => {
      mockEnv.DEVICE_GATEWAY_URL = 'https://gateway.example.com';
      const proxy = new DeviceProxy();
      expect(proxy.isConfigured).toBe(false);
    });

    it('should return false when DEVICE_GATEWAY_SERVICE_TOKEN is blank', () => {
      mockEnv.DEVICE_GATEWAY_URL = 'https://gateway.example.com';
      mockEnv.DEVICE_GATEWAY_SERVICE_TOKEN = '   ';
      const proxy = new DeviceProxy();
      expect(proxy.isConfigured).toBe(false);
    });

    it('should return false when DEVICE_GATEWAY_URL is invalid', () => {
      mockEnv.DEVICE_GATEWAY_URL = 'file:///tmp/gateway';
      mockEnv.DEVICE_GATEWAY_SERVICE_TOKEN = 'token';
      const proxy = new DeviceProxy();
      expect(proxy.isConfigured).toBe(false);
    });

    it('should return true when DEVICE_GATEWAY_URL and DEVICE_GATEWAY_SERVICE_TOKEN are set', () => {
      mockEnv.DEVICE_GATEWAY_URL = 'https://gateway.example.com';
      mockEnv.DEVICE_GATEWAY_SERVICE_TOKEN = 'token';
      const proxy = new DeviceProxy();
      expect(proxy.isConfigured).toBe(true);
    });
  });

  describe('queryDeviceStatus', () => {
    it('should return offline status when not configured', async () => {
      const proxy = new DeviceProxy();
      const result = await proxy.queryDeviceStatus('user-1');
      expect(result).toEqual({ deviceCount: 0, online: false });
    });

    it('should return status from client on success', async () => {
      mockEnv.DEVICE_GATEWAY_URL = 'https://gateway.example.com';
      mockEnv.DEVICE_GATEWAY_SERVICE_TOKEN = 'token';
      const expected = { deviceCount: 2, online: true };
      mockClient.queryDeviceStatus.mockResolvedValue(expected);

      const proxy = new DeviceProxy();
      const result = await proxy.queryDeviceStatus('user-1');

      expect(result).toEqual(expected);
      expect(mockClient.queryDeviceStatus).toHaveBeenCalledWith('user-1');
    });

    it('should return offline status on error', async () => {
      mockEnv.DEVICE_GATEWAY_URL = 'https://gateway.example.com';
      mockEnv.DEVICE_GATEWAY_SERVICE_TOKEN = 'token';
      mockClient.queryDeviceStatus.mockRejectedValue(new Error('network error'));

      const proxy = new DeviceProxy();
      const result = await proxy.queryDeviceStatus('user-1');

      expect(result).toEqual({ deviceCount: 0, online: false });
    });
  });

  describe('queryDeviceList', () => {
    it('should return empty array when not configured', async () => {
      const proxy = new DeviceProxy();
      const result = await proxy.queryDeviceList('user-1');
      expect(result).toEqual([]);
    });

    it('should transform connectedAt to lastSeen and set online: true', async () => {
      mockEnv.DEVICE_GATEWAY_URL = 'https://gateway.example.com';
      mockEnv.DEVICE_GATEWAY_SERVICE_TOKEN = 'token';
      const connectedAt = Date.parse('2025-01-15T10:30:00Z');
      mockClient.queryDeviceList.mockResolvedValue([
        {
          allowRemoteTools: true,
          connectedAt,
          deviceId: 'dev-1',
          hostname: 'my-laptop',
          platform: 'darwin',
        },
        {
          allowRemoteTools: false,
          connectedAt,
          deviceId: 'dev-2',
          hostname: 'my-desktop',
          platform: 'win32',
        },
      ]);

      const proxy = new DeviceProxy();
      const result = await proxy.queryDeviceList('user-1');

      expect(result).toEqual([
        {
          allowRemoteTools: true,
          deviceId: 'dev-1',
          hostname: 'my-laptop',
          lastSeen: '2025-01-15T10:30:00.000Z',
          online: true,
          platform: 'darwin',
        },
        {
          allowRemoteTools: false,
          deviceId: 'dev-2',
          hostname: 'my-desktop',
          lastSeen: '2025-01-15T10:30:00.000Z',
          online: true,
          platform: 'win32',
        },
      ]);
      expect(mockClient.queryDeviceList).toHaveBeenCalledWith('user-1');
    });

    it('falls back to the current time when connectedAt is invalid', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T11:00:00Z'));
      mockEnv.DEVICE_GATEWAY_URL = 'https://gateway.example.com';
      mockEnv.DEVICE_GATEWAY_SERVICE_TOKEN = 'token';
      mockClient.queryDeviceList.mockResolvedValue([
        {
          connectedAt: Number.NaN,
          deviceId: 'dev-1',
          hostname: 'my-laptop',
          platform: 'darwin',
        },
      ]);

      const proxy = new DeviceProxy();
      const result = await proxy.queryDeviceList('user-1');

      expect(result).toEqual([
        {
          allowRemoteTools: false,
          deviceId: 'dev-1',
          hostname: 'my-laptop',
          lastSeen: '2025-01-15T11:00:00.000Z',
          online: true,
          platform: 'darwin',
        },
      ]);
    });

    it('falls back to the current time when connectedAt cannot be converted to an ISO date', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
      mockEnv.DEVICE_GATEWAY_URL = 'https://gateway.example.com';
      mockEnv.DEVICE_GATEWAY_SERVICE_TOKEN = 'token';
      mockClient.queryDeviceList.mockResolvedValue([
        {
          connectedAt: 1e20,
          deviceId: 'dev-1',
          hostname: 'my-laptop',
          platform: 'darwin',
        },
      ]);

      const proxy = new DeviceProxy();
      const result = await proxy.queryDeviceList('user-1');

      expect(result).toEqual([
        {
          allowRemoteTools: false,
          deviceId: 'dev-1',
          hostname: 'my-laptop',
          lastSeen: '2025-01-15T12:00:00.000Z',
          online: true,
          platform: 'darwin',
        },
      ]);
    });

    it('should return empty array on error', async () => {
      mockEnv.DEVICE_GATEWAY_URL = 'https://gateway.example.com';
      mockEnv.DEVICE_GATEWAY_SERVICE_TOKEN = 'token';
      mockClient.queryDeviceList.mockRejectedValue(new Error('fail'));

      const proxy = new DeviceProxy();
      const result = await proxy.queryDeviceList('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('queryDeviceSystemInfo', () => {
    it('should return undefined when not configured', async () => {
      const proxy = new DeviceProxy();
      const result = await proxy.queryDeviceSystemInfo('user-1', 'dev-1');
      expect(result).toBeUndefined();
    });

    it('should return systemInfo on success', async () => {
      mockEnv.DEVICE_GATEWAY_URL = 'https://gateway.example.com';
      mockEnv.DEVICE_GATEWAY_SERVICE_TOKEN = 'token';
      const systemInfo = { cpuModel: 'Apple M1', os: 'macOS', totalMemory: 16384 };
      mockClient.getDeviceSystemInfo.mockResolvedValue({ success: true, systemInfo });

      const proxy = new DeviceProxy();
      const result = await proxy.queryDeviceSystemInfo('user-1', 'dev-1');

      expect(result).toEqual(systemInfo);
      expect(mockClient.getDeviceSystemInfo).toHaveBeenCalledWith('user-1', 'dev-1');
    });

    it('should return undefined when result is not successful', async () => {
      mockEnv.DEVICE_GATEWAY_URL = 'https://gateway.example.com';
      mockEnv.DEVICE_GATEWAY_SERVICE_TOKEN = 'token';
      mockClient.getDeviceSystemInfo.mockResolvedValue({ success: false });

      const proxy = new DeviceProxy();
      const result = await proxy.queryDeviceSystemInfo('user-1', 'dev-1');

      expect(result).toBeUndefined();
    });

    it('should return undefined on error', async () => {
      mockEnv.DEVICE_GATEWAY_URL = 'https://gateway.example.com';
      mockEnv.DEVICE_GATEWAY_SERVICE_TOKEN = 'token';
      mockClient.getDeviceSystemInfo.mockRejectedValue(new Error('timeout'));

      const proxy = new DeviceProxy();
      const result = await proxy.queryDeviceSystemInfo('user-1', 'dev-1');

      expect(result).toBeUndefined();
    });
  });

  describe('executeToolCall', () => {
    const params = { deviceId: 'dev-1', userId: 'user-1' };
    const toolCall = { apiName: 'listFiles', arguments: '{}', identifier: 'file-manager' };

    it('should return error when not configured', async () => {
      const proxy = new DeviceProxy();
      const result = await proxy.executeToolCall(params, toolCall);

      expect(result).toEqual({
        content: 'Device Gateway is not configured',
        error: 'GATEWAY_NOT_CONFIGURED',
        success: false,
      });
    });

    it('should execute tool call with default timeout', async () => {
      mockEnv.DEVICE_GATEWAY_URL = 'https://gateway.example.com';
      mockEnv.DEVICE_GATEWAY_SERVICE_TOKEN = 'token';
      const expected = { content: 'file list', success: true };
      mockClient.executeToolCall.mockResolvedValue(expected);

      const proxy = new DeviceProxy();
      const result = await proxy.executeToolCall(params, toolCall);

      expect(result).toEqual(expected);
      expect(mockClient.executeToolCall).toHaveBeenCalledWith(
        { deviceId: 'dev-1', timeout: 30_000, userId: 'user-1' },
        toolCall,
      );
    });

    it('should use custom timeout', async () => {
      mockEnv.DEVICE_GATEWAY_URL = 'https://gateway.example.com';
      mockEnv.DEVICE_GATEWAY_SERVICE_TOKEN = 'token';
      mockClient.executeToolCall.mockResolvedValue({ content: 'ok', success: true });

      const proxy = new DeviceProxy();
      await proxy.executeToolCall(params, toolCall, 60_000);

      expect(mockClient.executeToolCall).toHaveBeenCalledWith(
        { deviceId: 'dev-1', timeout: 60_000, userId: 'user-1' },
        toolCall,
      );
    });

    it('should omit deviceId when no explicit target is provided', async () => {
      mockEnv.DEVICE_GATEWAY_URL = 'https://gateway.example.com';
      mockEnv.DEVICE_GATEWAY_SERVICE_TOKEN = 'token';
      mockClient.executeToolCall.mockResolvedValue({ content: 'ok', success: true });

      const proxy = new DeviceProxy();
      await proxy.executeToolCall({ userId: 'user-1' }, toolCall);

      expect(mockClient.executeToolCall).toHaveBeenCalledWith(
        { deviceId: undefined, timeout: 30_000, userId: 'user-1' },
        toolCall,
      );
    });

    it('should preserve remote tool permission failures from the gateway client', async () => {
      mockEnv.DEVICE_GATEWAY_URL = 'https://gateway.example.com';
      mockEnv.DEVICE_GATEWAY_SERVICE_TOKEN = 'token';
      mockClient.executeToolCall.mockResolvedValue({
        content: 'Remote desktop tool execution is disabled on this device',
        error: 'REMOTE_TOOLS_DISABLED',
        success: false,
      });

      const proxy = new DeviceProxy();
      const result = await proxy.executeToolCall(params, toolCall);

      expect(result).toEqual({
        content: 'Remote desktop tool execution is disabled on this device',
        error: 'REMOTE_TOOLS_DISABLED',
        success: false,
      });
    });

    it('should return error result on Error exception', async () => {
      mockEnv.DEVICE_GATEWAY_URL = 'https://gateway.example.com';
      mockEnv.DEVICE_GATEWAY_SERVICE_TOKEN = 'token';
      mockClient.executeToolCall.mockRejectedValue(new Error('connection refused'));

      const proxy = new DeviceProxy();
      const result = await proxy.executeToolCall(params, toolCall);

      expect(result).toEqual({
        content: 'Device tool call error: connection refused',
        error: 'connection refused',
        success: false,
      });
    });

    it('should handle non-Error exceptions', async () => {
      mockEnv.DEVICE_GATEWAY_URL = 'https://gateway.example.com';
      mockEnv.DEVICE_GATEWAY_SERVICE_TOKEN = 'token';
      mockClient.executeToolCall.mockRejectedValue('string error');

      const proxy = new DeviceProxy();
      const result = await proxy.executeToolCall(params, toolCall);

      expect(result).toEqual({
        content: 'Device tool call error: string error',
        error: 'string error',
        success: false,
      });
    });
  });

  describe('getClient (lazy initialization)', () => {
    it('should return null when URL is missing', async () => {
      mockEnv.DEVICE_GATEWAY_SERVICE_TOKEN = 'token';
      const proxy = new DeviceProxy();
      const result = await proxy.queryDeviceStatus('user-1');

      expect(result).toEqual({ deviceCount: 0, online: false });
      expect(MockGatewayHttpClient).not.toHaveBeenCalled();
    });

    it('should return null when token is missing', async () => {
      mockEnv.DEVICE_GATEWAY_URL = 'https://gateway.example.com';
      const proxy = new DeviceProxy();
      const result = await proxy.queryDeviceStatus('user-1');

      expect(result).toEqual({ deviceCount: 0, online: false });
      expect(MockGatewayHttpClient).not.toHaveBeenCalled();
    });

    it('should return null when token is blank', async () => {
      mockEnv.DEVICE_GATEWAY_URL = 'https://gateway.example.com';
      mockEnv.DEVICE_GATEWAY_SERVICE_TOKEN = '   ';
      const proxy = new DeviceProxy();
      const result = await proxy.queryDeviceStatus('user-1');

      expect(result).toEqual({ deviceCount: 0, online: false });
      expect(MockGatewayHttpClient).not.toHaveBeenCalled();
    });

    it('should create client only once across multiple calls', async () => {
      mockEnv.DEVICE_GATEWAY_URL = ' https://gateway.example.com/ ';
      mockEnv.DEVICE_GATEWAY_SERVICE_TOKEN = 'token';
      mockClient.queryDeviceStatus.mockResolvedValue({ deviceCount: 1, online: true });

      const proxy = new DeviceProxy();
      await proxy.queryDeviceStatus('user-1');
      await proxy.queryDeviceStatus('user-2');

      expect(MockGatewayHttpClient).toHaveBeenCalledTimes(1);
      expect(MockGatewayHttpClient).toHaveBeenCalledWith({
        gatewayUrl: 'https://gateway.example.com',
        serviceToken: 'token',
      });
    });

    it('should recreate the client when gateway env changes', async () => {
      mockEnv.DEVICE_GATEWAY_URL = 'https://gateway-a.example.com';
      mockEnv.DEVICE_GATEWAY_SERVICE_TOKEN = 'token-a';
      mockClient.queryDeviceStatus.mockResolvedValue({ deviceCount: 1, online: true });

      const proxy = new DeviceProxy();
      await proxy.queryDeviceStatus('user-1');

      mockEnv.DEVICE_GATEWAY_URL = 'https://gateway-b.example.com';
      mockEnv.DEVICE_GATEWAY_SERVICE_TOKEN = 'token-b';
      await proxy.queryDeviceStatus('user-1');

      expect(MockGatewayHttpClient).toHaveBeenCalledTimes(2);
      expect(MockGatewayHttpClient).toHaveBeenNthCalledWith(1, {
        gatewayUrl: 'https://gateway-a.example.com',
        serviceToken: 'token-a',
      });
      expect(MockGatewayHttpClient).toHaveBeenNthCalledWith(2, {
        gatewayUrl: 'https://gateway-b.example.com',
        serviceToken: 'token-b',
      });
    });
  });
});
