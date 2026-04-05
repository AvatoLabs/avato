import type { ChatFileItem, ChatImageItem, ChatVideoItem, UIChatMessage } from '@lobechat/types';

import { appEnv } from '@/envs/app';

const STABLE_APP_FILE_PROXY_PATTERNS = [
  /^\/f\/[^/?#]+$/,
  /^\/share\/f\/[^/?#]+$/,
  /^\/share\/t\/[^/?#]+\/f\/[^/?#]+$/,
  /^\/skills\/[^/?#]+\/zip$/,
  /^\/eval\/records\/[^/?#]+$/,
] as const;

const isSameOriginAppUrl = (url: string) => {
  try {
    return new URL(url).origin === new URL(appEnv.APP_URL).origin;
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

const isStableAppFileProxyUrl = (url?: string) => {
  if (!url) return false;

  const pathname = getUrlPathname(url);
  if (!pathname) return false;

  return STABLE_APP_FILE_PROXY_PATTERNS.some((pattern) => pattern.test(pathname));
};

const shouldUseProxyUrl = (url?: string) => {
  if (!url) return false;
  if (isStableAppFileProxyUrl(url)) return false;

  if (appEnv.APP_URL.startsWith('https://') && url.startsWith('http://')) return true;

  try {
    return new URL(url).origin === new URL(appEnv.APP_URL).origin;
  } catch {
    return false;
  }
};

const withProxyUrl = <T extends { id: string; url: string }>(items?: T[]): T[] | undefined => {
  if (!items || items.length === 0) return items;

  return items.map((item) => {
    if (!shouldUseProxyUrl(item.url)) return item;

    return {
      ...item,
      url: `/f/${item.id}`,
    };
  });
};

export const normalizeMessageFileUrlsForClient = (messages: UIChatMessage[]): UIChatMessage[] => {
  if (!messages || messages.length === 0) return messages;

  return messages.map((message) => ({
    ...message,
    ...(message.children
      ? { children: normalizeMessageFileUrlsForClient(message.children as UIChatMessage[]) }
      : {}),
    fileList: withProxyUrl(message.fileList as ChatFileItem[] | undefined),
    imageList: withProxyUrl(message.imageList as ChatImageItem[] | undefined),
    videoList: withProxyUrl(message.videoList as ChatVideoItem[] | undefined),
  })) as UIChatMessage[];
};
