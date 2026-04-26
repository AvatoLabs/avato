import { beforeEach, describe, expect, it, vi } from 'vitest';

import app from './app';
import type { Env } from './types';

describe('device gateway worker entry', () => {
  const idFromNameMock = vi.fn((name: string) => ({ name }));
  const durableObjectFetchMock = vi.fn();
  const getDurableObjectMock = vi.fn(() => ({ fetch: durableObjectFetchMock }));

  const env = {
    DEVICE_GATEWAY: {
      get: getDurableObjectMock,
      idFromName: idFromNameMock,
    } as unknown as DurableObjectNamespace,
    JWKS_PUBLIC_KEY: '{"keys":[]}',
    SERVICE_TOKEN: 'service-token',
  } satisfies Env;

  beforeEach(() => {
    vi.clearAllMocks();
    durableObjectFetchMock.mockResolvedValue(Response.json({ forwarded: true }));
  });

  it('responds to health checks without service auth', async () => {
    const response = await app.request('/health', undefined, env);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('OK');
    expect(getDurableObjectMock).not.toHaveBeenCalled();
  });

  it('rejects service API calls without the service token', async () => {
    const response = await app.request(
      '/api/device/status',
      {
        body: JSON.stringify({ userId: 'user-1' }),
        method: 'POST',
      },
      env,
    );

    expect(response.status).toBe(401);
    expect(await response.text()).toBe('Unauthorized');
    expect(getDurableObjectMock).not.toHaveBeenCalled();
  });

  it('rejects service API calls when the worker service token is not configured', async () => {
    const response = await app.request(
      '/api/device/status',
      {
        body: JSON.stringify({ userId: 'user-1' }),
        headers: { Authorization: 'Bearer undefined' },
        method: 'POST',
      },
      { ...env, SERVICE_TOKEN: '' },
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: 'SERVICE_TOKEN_NOT_CONFIGURED',
      success: false,
    });
    expect(getDurableObjectMock).not.toHaveBeenCalled();
  });

  it('rejects service API calls when the worker service token is blank', async () => {
    const response = await app.request(
      '/api/device/status',
      {
        body: JSON.stringify({ userId: 'user-1' }),
        headers: { Authorization: 'Bearer service-token' },
        method: 'POST',
      },
      { ...env, SERVICE_TOKEN: '   ' },
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: 'SERVICE_TOKEN_NOT_CONFIGURED',
      success: false,
    });
    expect(getDurableObjectMock).not.toHaveBeenCalled();
  });

  it('rejects malformed service JSON bodies before routing to a durable object', async () => {
    const response = await app.request(
      '/api/device/status',
      {
        body: '{',
        headers: { Authorization: 'Bearer service-token' },
        method: 'POST',
      },
      env,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'INVALID_JSON_BODY', success: false });
    expect(getDurableObjectMock).not.toHaveBeenCalled();
  });

  it('rejects service API calls without userId', async () => {
    const response = await app.request(
      '/api/device/status',
      {
        body: JSON.stringify({ deviceId: 'device-1' }),
        headers: { Authorization: 'Bearer service-token' },
        method: 'POST',
      },
      env,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'MISSING_USERID', success: false });
    expect(getDurableObjectMock).not.toHaveBeenCalled();
  });

  it('rejects service API calls with blank userId', async () => {
    const response = await app.request(
      '/api/device/status',
      {
        body: JSON.stringify({ userId: '   ' }),
        headers: { Authorization: 'Bearer service-token' },
        method: 'POST',
      },
      env,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'MISSING_USERID', success: false });
    expect(getDurableObjectMock).not.toHaveBeenCalled();
  });

  it('routes authenticated service API calls to the user durable object', async () => {
    const response = await app.request(
      '/api/device/status',
      {
        body: JSON.stringify({ userId: 'user-1' }),
        headers: {
          'Authorization': 'Bearer service-token',
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
      env,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ forwarded: true });
    expect(idFromNameMock).toHaveBeenCalledWith('user:user-1');
    expect(getDurableObjectMock).toHaveBeenCalledWith({ name: 'user:user-1' });
    expect(durableObjectFetchMock).toHaveBeenCalledTimes(1);
  });

  it('forwards desktop websocket upgrades with the routed user header', async () => {
    await app.request('/ws?userId=%20user-1%20&deviceId=device-1', { method: 'GET' }, env);

    expect(idFromNameMock).toHaveBeenCalledWith('user:user-1');
    const forwardedRequest = durableObjectFetchMock.mock.calls[0][0] as Request;
    expect(forwardedRequest.headers.get('X-User-Id')).toBe('user-1');
  });

  it('rejects desktop websocket upgrades without deviceId', async () => {
    const response = await app.request('/ws?userId=user-1', { method: 'GET' }, env);

    expect(response.status).toBe(400);
    expect(await response.text()).toBe('Missing deviceId');
    expect(getDurableObjectMock).not.toHaveBeenCalled();
  });

  it('rejects desktop websocket upgrades with oversized route fields', async () => {
    const longValue = 'x'.repeat(513);

    const longUserResponse = await app.request(
      `/ws?userId=${longValue}&deviceId=device-1`,
      { method: 'GET' },
      env,
    );
    expect(longUserResponse.status).toBe(400);
    expect(await longUserResponse.text()).toBe('Invalid userId');

    const longDeviceResponse = await app.request(
      `/ws?userId=user-1&deviceId=${longValue}`,
      { method: 'GET' },
      env,
    );
    expect(longDeviceResponse.status).toBe(400);
    expect(await longDeviceResponse.text()).toBe('Invalid deviceId');
    expect(getDurableObjectMock).not.toHaveBeenCalled();
  });

  it('rejects desktop websocket upgrades with oversized metadata fields', async () => {
    const longValue = 'x'.repeat(257);

    const longHostnameResponse = await app.request(
      `/ws?userId=user-1&deviceId=device-1&hostname=${longValue}`,
      { method: 'GET' },
      env,
    );
    expect(longHostnameResponse.status).toBe(400);
    expect(await longHostnameResponse.text()).toBe('Invalid hostname');

    const longPlatformResponse = await app.request(
      `/ws?userId=user-1&deviceId=device-1&platform=${longValue}`,
      { method: 'GET' },
      env,
    );
    expect(longPlatformResponse.status).toBe(400);
    expect(await longPlatformResponse.text()).toBe('Invalid platform');
    expect(getDurableObjectMock).not.toHaveBeenCalled();
  });
});
