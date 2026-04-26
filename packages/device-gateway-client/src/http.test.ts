import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GatewayHttpClient } from './http';

describe('GatewayHttpClient', () => {
  let client: GatewayHttpClient;

  beforeEach(() => {
    client = new GatewayHttpClient({
      gatewayUrl: 'https://gateway.test.com',
      serviceToken: 'test-service-token',
    });
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockFetch(response: Partial<Response>) {
    const res = {
      json: vi.fn().mockResolvedValue(response.json ? response.json() : {}),
      ok: response.ok ?? true,
      status: response.status ?? 200,
      text: vi.fn().mockResolvedValue(''),
      ...response,
    };
    // Re-bind json/text if the response object had them
    if ('json' in response && typeof response.json === 'function') {
      res.json = response.json;
    }
    if ('text' in response && typeof response.text === 'function') {
      res.text = response.text;
    }
    vi.mocked(fetch).mockResolvedValue(res as any);
    return res;
  }

  describe('queryDeviceStatus', () => {
    it('should normalize trailing slashes in gateway url', async () => {
      client = new GatewayHttpClient({
        gatewayUrl: 'https://gateway.test.com///',
        serviceToken: 'test-service-token',
      });
      mockFetch({
        json: vi.fn().mockResolvedValue({ deviceCount: 1, online: true }),
        ok: true,
      });

      await client.queryDeviceStatus('user-1');

      expect(fetch).toHaveBeenCalledWith(
        'https://gateway.test.com/api/device/status',
        expect.any(Object),
      );
    });

    it('should return device status on success', async () => {
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
      mockFetch({
        json: vi.fn().mockResolvedValue({ deviceCount: 2, online: true }),
        ok: true,
      });

      const result = await client.queryDeviceStatus('user-1');

      expect(result).toEqual({ deviceCount: 2, online: true });
      expect(fetch).toHaveBeenCalledWith(
        'https://gateway.test.com/api/device/status',
        expect.objectContaining({
          body: JSON.stringify({ userId: 'user-1' }),
          headers: {
            'Authorization': 'Bearer test-service-token',
            'Content-Type': 'application/json',
          },
          method: 'POST',
          signal: expect.any(AbortSignal),
        }),
      );
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 15_000);
    });

    it('should return defaults on non-ok response', async () => {
      mockFetch({ ok: false, status: 500 });

      const result = await client.queryDeviceStatus('user-1');

      expect(result).toEqual({ deviceCount: 0, online: false });
    });

    it('should handle missing fields in response', async () => {
      mockFetch({
        json: vi.fn().mockResolvedValue({}),
        ok: true,
      });

      const result = await client.queryDeviceStatus('user-1');

      expect(result).toEqual({ deviceCount: 0, online: false });
    });

    it('should return defaults when JSON parsing fails', async () => {
      mockFetch({
        json: vi.fn().mockRejectedValue(new Error('invalid json')),
        ok: true,
      });

      const result = await client.queryDeviceStatus('user-1');

      expect(result).toEqual({ deviceCount: 0, online: false });
    });
  });

  describe('queryDeviceList', () => {
    it('should return device list on success', async () => {
      const devices = [
        {
          allowRemoteComputerUse: true,
          allowRemoteTools: true,
          connectedAt: 1000,
          deviceId: 'd1',
          hostname: 'host1',
          platform: 'darwin',
        },
      ];
      mockFetch({
        json: vi.fn().mockResolvedValue({ devices }),
        ok: true,
      });

      const result = await client.queryDeviceList('user-1');

      expect(result).toEqual(devices);
    });

    it('should filter malformed devices and strip internal fields', async () => {
      mockFetch({
        json: vi.fn().mockResolvedValue({
          devices: [
            {
              authExpiresAt: 4000,
              authenticated: true,
              allowRemoteTools: true,
              connectedAt: 1000,
              deviceId: 'd1',
              hostname: 'host1',
              lastHeartbeat: 2000,
              platform: 'darwin',
            },
            { connectedAt: 'not-number', deviceId: 'd2', hostname: 'host2', platform: 'linux' },
          ],
        }),
        ok: true,
      });

      const result = await client.queryDeviceList('user-1');

      expect(result).toEqual([
        {
          allowRemoteTools: true,
          connectedAt: 1000,
          deviceId: 'd1',
          hostname: 'host1',
          platform: 'darwin',
        },
      ]);
      expect(result[0]).not.toHaveProperty('authenticated');
      expect(result[0]).not.toHaveProperty('authExpiresAt');
      expect(result[0]).not.toHaveProperty('lastHeartbeat');
    });

    it('should return empty array on non-ok response', async () => {
      mockFetch({ ok: false });

      const result = await client.queryDeviceList('user-1');

      expect(result).toEqual([]);
    });

    it('should return empty array when devices is not an array', async () => {
      mockFetch({
        json: vi.fn().mockResolvedValue({ devices: 'not-array' }),
        ok: true,
      });

      const result = await client.queryDeviceList('user-1');

      expect(result).toEqual([]);
    });

    it('should return empty array when devices is missing', async () => {
      mockFetch({
        json: vi.fn().mockResolvedValue({}),
        ok: true,
      });

      const result = await client.queryDeviceList('user-1');

      expect(result).toEqual([]);
    });

    it('should return empty array when JSON parsing fails', async () => {
      mockFetch({
        json: vi.fn().mockRejectedValue(new Error('invalid json')),
        ok: true,
      });

      const result = await client.queryDeviceList('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('executeToolCall', () => {
    it('should return tool call result on success', async () => {
      mockFetch({
        json: vi.fn().mockResolvedValue({ content: 'file contents', success: true }),
        ok: true,
      });

      const result = await client.executeToolCall(
        { userId: 'user-1' },
        { apiName: 'readFile', arguments: '{}', identifier: 'test' },
      );

      expect(result).toEqual({ content: 'file contents', error: undefined, success: true });
    });

    it('should align the default HTTP wait with the gateway tool-call timeout', async () => {
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
      mockFetch({
        json: vi.fn().mockResolvedValue({ content: 'ok', success: true }),
        ok: true,
      });

      await client.executeToolCall(
        { userId: 'user-1' },
        { apiName: 'readFile', arguments: '{}', identifier: 'test' },
      );

      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 35_000);
    });

    it('should sanitize invalid and oversized tool call timeouts', async () => {
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
      mockFetch({
        json: vi.fn().mockResolvedValue({ content: 'ok', success: true }),
        ok: true,
      });

      await client.executeToolCall(
        { timeout: Number.POSITIVE_INFINITY, userId: 'user-1' },
        { apiName: 'readFile', arguments: '{}', identifier: 'test' },
      );

      expect(fetch).toHaveBeenLastCalledWith(
        'https://gateway.test.com/api/device/tool-call',
        expect.objectContaining({
          body: expect.stringContaining('"timeout":30000'),
        }),
      );
      expect(setTimeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), 35_000);

      await client.executeToolCall(
        { timeout: 999_999_999, userId: 'user-1' },
        { apiName: 'readFile', arguments: '{}', identifier: 'test' },
      );

      expect(fetch).toHaveBeenLastCalledWith(
        'https://gateway.test.com/api/device/tool-call',
        expect.objectContaining({
          body: expect.stringContaining('"timeout":600000'),
        }),
      );
      expect(setTimeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), 605_000);
    });

    it('should handle non-string content', async () => {
      mockFetch({
        json: vi.fn().mockResolvedValue({ content: { key: 'value' }, success: true }),
        ok: true,
      });

      const result = await client.executeToolCall(
        { userId: 'user-1' },
        { apiName: 'readFile', arguments: '{}', identifier: 'test' },
      );

      expect(result.content).toBe(JSON.stringify({ key: 'value' }));
    });

    it('should handle null/undefined content', async () => {
      mockFetch({
        json: vi.fn().mockResolvedValue({ success: true }),
        ok: true,
      });

      const result = await client.executeToolCall(
        { userId: 'user-1' },
        { apiName: 'readFile', arguments: '{}', identifier: 'test' },
      );

      // content is undefined, so JSON.stringify(undefined ?? data) -> JSON.stringify(data)
      expect(result.content).toContain('success');
    });

    it('should handle missing success field', async () => {
      mockFetch({
        json: vi.fn().mockResolvedValue({ content: 'ok' }),
        ok: true,
      });

      const result = await client.executeToolCall(
        { userId: 'user-1' },
        { apiName: 'readFile', arguments: '{}', identifier: 'test' },
      );

      expect(result.success).toBe(true);
    });

    it('should return a failure when JSON parsing fails', async () => {
      mockFetch({
        json: vi.fn().mockRejectedValue(new Error('invalid json')),
        ok: true,
      });

      const result = await client.executeToolCall(
        { userId: 'user-1' },
        { apiName: 'readFile', arguments: '{}', identifier: 'test' },
      );

      expect(result).toEqual({
        content: 'Device gateway returned an invalid JSON response',
        error: 'INVALID_JSON_RESPONSE',
        success: false,
      });
    });

    it('should handle non-ok response', async () => {
      mockFetch({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue('Internal Server Error'),
      });

      const result = await client.executeToolCall(
        { userId: 'user-1' },
        { apiName: 'readFile', arguments: '{}', identifier: 'test' },
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Internal Server Error');
      expect(result.content).toContain('HTTP 500');
    });

    it('should truncate oversized non-ok response bodies', async () => {
      mockFetch({
        ok: false,
        status: 502,
        text: vi.fn().mockResolvedValue('x'.repeat(70_000)),
      });

      const result = await client.executeToolCall(
        { userId: 'user-1' },
        { apiName: 'readFile', arguments: '{}', identifier: 'test' },
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('[truncated,');
      expect(result.error!.length).toBeLessThan(70_000);
    });

    it('should surface structured gateway errors on non-ok response', async () => {
      mockFetch({
        ok: false,
        status: 502,
        text: vi
          .fn()
          .mockResolvedValue(
            JSON.stringify({ content: '', error: 'INVALID_DEVICE_RESPONSE', success: false }),
          ),
      });

      const result = await client.executeToolCall(
        { userId: 'user-1' },
        { apiName: 'readFile', arguments: '{}', identifier: 'test' },
      );

      expect(result).toEqual({
        content: '',
        error: 'INVALID_DEVICE_RESPONSE',
        success: false,
      });
    });

    it('should preserve remote tool permission failures from the gateway', async () => {
      mockFetch({
        ok: false,
        status: 403,
        text: vi.fn().mockResolvedValue(
          JSON.stringify({
            content: 'Remote desktop tool execution is disabled on this device',
            error: 'REMOTE_TOOLS_DISABLED',
            success: false,
          }),
        ),
      });

      const result = await client.executeToolCall(
        { deviceId: 'device-1', userId: 'user-1' },
        { apiName: 'runCommand', arguments: '{}', identifier: 'lobe-local-system' },
      );

      expect(result).toEqual({
        content: 'Remote desktop tool execution is disabled on this device',
        error: 'REMOTE_TOOLS_DISABLED',
        success: false,
      });
    });

    it('should reject oversized successful tool call content', async () => {
      mockFetch({
        json: vi.fn().mockResolvedValue({ content: 'x'.repeat(5_000_001), success: true }),
        ok: true,
      });

      const result = await client.executeToolCall(
        { userId: 'user-1' },
        { apiName: 'readFile', arguments: '{}', identifier: 'test' },
      );

      expect(result).toEqual({
        content: 'Device gateway response is too large',
        error: 'DEVICE_GATEWAY_RESPONSE_TOO_LARGE',
        success: false,
      });
    });

    it('should handle non-ok response with text() failure', async () => {
      mockFetch({
        ok: false,
        status: 500,
        text: vi.fn().mockRejectedValue(new Error('read error')),
      });

      const result = await client.executeToolCall(
        { userId: 'user-1' },
        { apiName: 'readFile', arguments: '{}', identifier: 'test' },
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('HTTP 500');
    });

    it('should pass optional deviceId and timeout', async () => {
      mockFetch({
        json: vi.fn().mockResolvedValue({ content: 'ok', success: true }),
        ok: true,
      });

      await client.executeToolCall(
        { deviceId: 'device-1', timeout: 5000, userId: 'user-1' },
        { apiName: 'readFile', arguments: '{}', identifier: 'test' },
      );

      expect(fetch).toHaveBeenCalledWith(
        'https://gateway.test.com/api/device/tool-call',
        expect.objectContaining({
          body: expect.stringContaining('"deviceId":"device-1"'),
          signal: expect.any(AbortSignal),
        }),
      );
    });
  });

  describe('getDeviceSystemInfo', () => {
    it('should return system info on success', async () => {
      const systemInfo = {
        arch: 'x64',
        desktopPath: '/home/test/Desktop',
        documentsPath: '/home/test/Documents',
        downloadsPath: '/home/test/Downloads',
        homePath: '/home/test',
        musicPath: '/home/test/Music',
        picturesPath: '/home/test/Pictures',
        userDataPath: '/home/test/.lobehub',
        videosPath: '/home/test/Videos',
        workingDirectory: '/home/test',
      };
      mockFetch({
        json: vi.fn().mockResolvedValue({ success: true, systemInfo }),
        ok: true,
      });

      const result = await client.getDeviceSystemInfo('user-1', 'device-1');

      expect(result).toEqual({ success: true, systemInfo });
    });

    it('should support gateway response with system info fields at top level', async () => {
      const systemInfo = {
        arch: 'arm64',
        desktopPath: '/Users/test/Desktop',
        documentsPath: '/Users/test/Documents',
        downloadsPath: '/Users/test/Downloads',
        homePath: '/Users/test',
        musicPath: '/Users/test/Music',
        picturesPath: '/Users/test/Pictures',
        userDataPath: '/Users/test/Library/Application Support/LobeHub',
        videosPath: '/Users/test/Movies',
        workingDirectory: '/Users/test',
      };
      mockFetch({
        json: vi.fn().mockResolvedValue({ success: true, ...systemInfo }),
        ok: true,
      });

      const result = await client.getDeviceSystemInfo('user-1', 'device-1');

      expect(result).toEqual({ success: true, systemInfo });
    });

    it('should return failure on non-ok response', async () => {
      mockFetch({ ok: false });

      const result = await client.getDeviceSystemInfo('user-1', 'device-1');

      expect(result).toEqual({ success: false });
    });

    it('should handle missing success field', async () => {
      mockFetch({
        json: vi.fn().mockResolvedValue({}),
        ok: true,
      });

      const result = await client.getDeviceSystemInfo('user-1', 'device-1');

      expect(result.success).toBe(false);
    });

    it('should return failure when JSON parsing fails', async () => {
      mockFetch({
        json: vi.fn().mockRejectedValue(new Error('invalid json')),
        ok: true,
      });

      const result = await client.getDeviceSystemInfo('user-1', 'device-1');

      expect(result).toEqual({ success: false });
    });
  });
});
