import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const SSRF_DOC_LINK =
  'https://lobehub.com/docs/self-hosting/environment-variables/basic#ssrf-allow-private-ip-address';

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 10;

const isSSRFBlockedMessage = (message: string) =>
  message.includes('is not allowed. Because, It is private IP address.') ||
  message.includes('is not allowed. Because, It is meta IP address.');

const parseIPv4 = (ip: string) => {
  const parts = ip.split('.').map(Number);

  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255))
    return;

  return parts;
};

const isPrivateIPv4 = (ip: string) => {
  const parts = parseIPv4(ip);
  if (!parts) return false;

  const [a, b] = parts;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
};

const isPrivateIPv6 = (ip: string) => {
  const normalized = ip.toLowerCase();

  if (normalized === '::1') return true;
  if (normalized.startsWith('fe80:')) return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;

  const mappedIPv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  return mappedIPv4 ? isPrivateIPv4(mappedIPv4) : false;
};

const isPrivateIPAddress = (ip: string) => {
  const family = isIP(ip);

  if (family === 4) return isPrivateIPv4(ip);
  if (family === 6) return isPrivateIPv6(ip);

  return false;
};

const getAllowedIPAddresses = (ssrfOptions?: SSRFOptions) =>
  new Set(
    (
      ssrfOptions?.allowIPAddressList ??
      process.env.SSRF_ALLOW_IP_ADDRESS_LIST?.split(',').map((item) => item.trim()) ??
      []
    ).filter(Boolean),
  );

const assertSafeUrl = async (url: URL, ssrfOptions?: SSRFOptions) => {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Protocol ${url.protocol} is not allowed`);
  }

  const allowPrivate =
    ssrfOptions?.allowPrivateIPAddress ?? process.env.SSRF_ALLOW_PRIVATE_IP_ADDRESS === '1';
  const allowedIPAddresses = getAllowedIPAddresses(ssrfOptions);
  const addresses = isIP(url.hostname)
    ? [{ address: url.hostname }]
    : await lookup(url.hostname, { all: true, verbatim: false });

  for (const { address } of addresses) {
    if (allowedIPAddresses.has(address)) continue;
    if (allowPrivate) continue;
    if (!isPrivateIPAddress(address)) continue;

    throw new Error(
      `DNS lookup ${address}(host:${url.hostname}) is not allowed. Because, It is private IP address.`,
    );
  }
};

const isRedirectResponse = (response: Response) =>
  response.status === 301 ||
  response.status === 302 ||
  response.status === 303 ||
  response.status === 307 ||
  response.status === 308;

const createTimeoutSignal = (options?: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error('Request timeout')), timeoutMs);

  if (options?.signal) {
    if (options.signal.aborted) {
      controller.abort(options.signal.reason);
    } else {
      options.signal.addEventListener('abort', () => controller.abort(options.signal?.reason), {
        once: true,
      });
    }
  }

  return {
    cleanup: () => clearTimeout(timeout),
    signal: controller.signal,
  };
};

const fetchWithSafeRedirects = async (
  url: URL,
  options: RequestInit | undefined,
  ssrfOptions: SSRFOptions | undefined,
) => {
  let currentUrl = url;
  let currentOptions = { ...options, redirect: 'manual' as RequestRedirect };

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    await assertSafeUrl(currentUrl, ssrfOptions);

    const { cleanup, signal } = createTimeoutSignal(currentOptions);

    const response = await fetch(currentUrl, { ...currentOptions, signal }).finally(cleanup);
    if (!isRedirectResponse(response)) return response;

    const location = response.headers.get('location');
    if (!location) return response;
    if (redirectCount === MAX_REDIRECTS) throw new Error('Maximum redirect count exceeded');

    currentUrl = new URL(location, currentUrl);

    if (response.status === 303) {
      const { body: _body, method: _method, ...restOptions } = currentOptions;
      currentOptions = { ...restOptions, method: 'GET' };
    }
  }

  throw new Error('Maximum redirect count exceeded');
};

/**
 * Options for per-call SSRF configuration overrides
 */
export interface SSRFOptions {
  /** List of IP addresses to allow */
  allowIPAddressList?: string[];
  /** Whether to allow private/local IP addresses */
  allowPrivateIPAddress?: boolean;
}

/**
 * SSRF-safe fetch implementation for server-side use.
 * It validates the target host before each request and before each followed redirect.
 *
 * @param url - The URL to fetch
 * @param options - Standard fetch options
 * @param ssrfOptions - Optional per-call SSRF configuration overrides
 * @see https://lobehub.com/docs/self-hosting/environment-variables/basic#ssrf-allow-private-ip-address
 */
export const ssrfSafeFetch = async (
  url: string,
  options?: RequestInit,
  ssrfOptions?: SSRFOptions,
): Promise<Response> => {
  try {
    return await fetchWithSafeRedirects(new URL(url), options, ssrfOptions);
  } catch (error) {
    console.error('SSRF-safe fetch error:', error);
    const message = error instanceof Error ? error.message : String(error);

    throw new Error(
      isSSRFBlockedMessage(message)
        ? `SSRF-safe fetch failed: ${message}. See: ${SSRF_DOC_LINK}`
        : `SSRF-safe fetch failed: ${message}`,
      { cause: error },
    );
  }
};
