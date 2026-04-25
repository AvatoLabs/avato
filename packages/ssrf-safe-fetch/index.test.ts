import { lookup } from 'node:dns/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ssrfSafeFetch } from './index';

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(),
}));

const mockLookup = vi.mocked(lookup);
const mockFetch = vi.fn();

vi.spyOn(console, 'error').mockImplementation(() => {});

describe('ssrfSafeFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SSRF_ALLOW_IP_ADDRESS_LIST;
    delete process.env.SSRF_ALLOW_PRIVATE_IP_ADDRESS;
    global.fetch = mockFetch;
    mockLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    mockFetch.mockResolvedValue(new Response('ok', { status: 200, statusText: 'OK' }));
  });

  it('should fetch an external URL with native fetch', async () => {
    const response = await ssrfSafeFetch('https://example.com/api');

    expect(mockLookup).toHaveBeenCalledWith('example.com', { all: true, verbatim: false });
    expect(mockFetch).toHaveBeenCalledWith(
      new URL('https://example.com/api'),
      expect.objectContaining({ redirect: 'manual', signal: expect.any(AbortSignal) }),
    );
    expect(response.status).toBe(200);
  });

  it('should pass through request options', async () => {
    const requestOptions = {
      body: JSON.stringify({ ok: true }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    };

    await ssrfSafeFetch('https://example.com/api', requestOptions);

    expect(mockFetch).toHaveBeenCalledWith(
      new URL('https://example.com/api'),
      expect.objectContaining({
        ...requestOptions,
        redirect: 'manual',
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('should block private DNS results by default', async () => {
    mockLookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);

    await expect(ssrfSafeFetch('https://example.com/api')).rejects.toThrow(
      /SSRF-safe fetch failed/,
    );

    expect(mockFetch).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith('SSRF-safe fetch error:', expect.any(Error));
  });

  it('should append documentation link for SSRF-blocked errors', async () => {
    mockLookup.mockResolvedValue([{ address: '10.0.0.1', family: 4 }]);

    await expect(ssrfSafeFetch('https://example.com/api')).rejects.toThrow(
      /ssrf-allow-private-ip-address/,
    );
  });

  it('should allow private IPs with env override', async () => {
    process.env.SSRF_ALLOW_PRIVATE_IP_ADDRESS = '1';
    mockLookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);

    const response = await ssrfSafeFetch('https://example.com/api');

    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalled();
  });

  it('should allow specific private IPs with allow list', async () => {
    process.env.SSRF_ALLOW_IP_ADDRESS_LIST = '127.0.0.1';
    mockLookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);

    const response = await ssrfSafeFetch('https://example.com/api');

    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalled();
  });

  it('should block private literal IP URLs', async () => {
    await expect(ssrfSafeFetch('http://127.0.0.1:8080/api')).rejects.toThrow(
      /SSRF-safe fetch failed/,
    );

    expect(mockLookup).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should block unsupported protocols', async () => {
    await expect(ssrfSafeFetch('file:///etc/passwd')).rejects.toThrow(
      'SSRF-safe fetch failed: Protocol file: is not allowed',
    );

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should follow safe redirects manually', async () => {
    mockFetch
      .mockResolvedValueOnce(
        new Response(null, {
          headers: { location: 'https://cdn.example.com/registry.json' },
          status: 302,
        }),
      )
      .mockResolvedValueOnce(new Response('done', { status: 200 }));

    const response = await ssrfSafeFetch('https://example.com/api');

    expect(response.status).toBe(200);
    expect(mockLookup).toHaveBeenNthCalledWith(1, 'example.com', {
      all: true,
      verbatim: false,
    });
    expect(mockLookup).toHaveBeenNthCalledWith(2, 'cdn.example.com', {
      all: true,
      verbatim: false,
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should block redirects to private IPs', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(null, {
        headers: { location: 'http://127.0.0.1:3210/internal' },
        status: 302,
      }),
    );

    await expect(ssrfSafeFetch('https://example.com/api')).rejects.toThrow(
      /SSRF-safe fetch failed/,
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should throw a descriptive error when fetch fails', async () => {
    const originalError = new Error('socket hang up');
    mockFetch.mockRejectedValue(originalError);

    await expect(ssrfSafeFetch('https://example.com/api')).rejects.toThrow(
      'SSRF-safe fetch failed: socket hang up',
    );
    expect(console.error).toHaveBeenCalledWith('SSRF-safe fetch error:', originalError);
  });

  it('should respect caller abort signal', async () => {
    const controller = new AbortController();
    controller.abort(new Error('caller aborted'));
    mockFetch.mockImplementation((_url, options) => {
      throw (options as RequestInit).signal?.reason;
    });

    await expect(
      ssrfSafeFetch('https://example.com/api', { signal: controller.signal }),
    ).rejects.toThrow('SSRF-safe fetch failed: caller aborted');
  });

  it('should handle non-Error thrown values', async () => {
    mockFetch.mockRejectedValue('String error');

    await expect(ssrfSafeFetch('https://example.com/api')).rejects.toThrow(
      'SSRF-safe fetch failed: String error',
    );
  });
});
