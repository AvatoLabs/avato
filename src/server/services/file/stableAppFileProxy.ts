import { appEnv } from '@/envs/app';

const STABLE_APP_FILE_PROXY_PATTERNS = [
  /^\/f\/[^/?#]+$/,
  /^\/share\/f\/[^/?#]+$/,
  /^\/share\/t\/[^/?#]+\/f\/[^/?#]+$/,
  /^\/skills\/[^/?#]+\/zip$/,
  /^\/eval\/records\/[^/?#]+$/,
] as const;

const isNonEmptyString = (value: string | undefined | null): value is string => Boolean(value);

const getTrustedAppOrigins = () =>
  [appEnv.APP_URL, appEnv.INTERNAL_APP_URL]
    .filter(isNonEmptyString)
    .flatMap((value) => {
      try {
        return [new URL(value).origin];
      } catch {
        return [];
      }
    });

export const isSameOriginAppUrl = (url: string) => {
  try {
    const parsedUrl = new URL(url);
    return getTrustedAppOrigins().includes(parsedUrl.origin);
  } catch {
    return false;
  }
};

const getUrlPathname = (url: string) => {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    if (!isSameOriginAppUrl(url)) return null;

    try {
      return new URL(url).pathname;
    } catch {
      return null;
    }
  }

  return url.split(/[?#]/, 1)[0];
};

export const isStableAppFileProxyUrl = (url?: string | null): boolean => {
  if (!url) return false;

  const pathname = getUrlPathname(url);
  if (!pathname) return false;

  return STABLE_APP_FILE_PROXY_PATTERNS.some((pattern) => pattern.test(pathname));
};

export const toAbsoluteStableAppFileProxyUrl = (url: string): string => {
  if (url.startsWith('http://') || url.startsWith('https://') || !appEnv.APP_URL) {
    return url;
  }

  return new URL(url, appEnv.APP_URL).toString();
};

export const resolveStableAppFileProxyUrl = (url?: string | null): string | null => {
  if (!url || !isStableAppFileProxyUrl(url)) return null;

  if (url.startsWith('/')) {
    try {
      const parsedUrl = new URL(url, appEnv.APP_URL || 'https://app.local');
      return `${parsedUrl.pathname}${parsedUrl.search}`;
    } catch {
      return null;
    }
  }

  try {
    const parsedUrl = new URL(url);
    return `${parsedUrl.pathname}${parsedUrl.search}`;
  } catch {
    return null;
  }
};
