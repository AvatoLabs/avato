import type { ChatFileItem, ChatImageItem, ChatVideoItem, UIChatMessage } from '@lobechat/types';

import { appEnv } from '@/envs/app';
import {
  isSameOriginAppUrl,
  isStableAppFileProxyUrl,
} from '@/server/services/file/stableAppFileProxy';

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
