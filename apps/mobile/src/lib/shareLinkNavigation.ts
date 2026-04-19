/**
 * Deep links and universal links containing `/share/r/:token` open the in-app public share preview.
 */
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import {
  navigateToChatDetail,
  navigateToContent,
  navigateToMessageDetail,
  navigateToNotebook,
  navigateToThreadDetail,
  navigateToThreadList,
  navigateToToolDetail,
  navigationRef,
} from './navigation';

const SHARE_R_PATH = /\/share\/r\/([^/?#]+)/;
const CHAT_PATH = /^\/chat\/?$/;
const MESSAGE_DETAIL_PATH = /^\/(?:chat\/)?message\/?$/;
const TOOL_DETAIL_PATH = /^\/(?:chat\/)?tool\/?$/;
const NOTEBOOK_PATH = /^\/notebook\/?$/;
const CONTENT_PATH = /^\/(?:content|resources)\/?$/;
const THREAD_LIST_PATH = /^\/(?:chat\/)?threads\/?$/;
const THREAD_DETAIL_PATH = /^\/(?:chat\/)?thread\/?$/;
const DOC_DETAIL_PATH = /\/spaces\/[^/]+\/docs\/([^/?#]+)/;
const DOC_TABLE_DETAIL_PATH = /\/spaces\/[^/]+\/docs\/table\/([^/?#]+)/;
const FILE_ITEM_PATH = /\/spaces\/[^/]+\/files\/item\/([^/?#]+)/;
const NESTED_FILE_ITEM_PATH = /\/spaces\/[^/]+\/files\/.+\/item\/([^/?#]+)/;

type ParsedNavigationTarget =
  | { params: RootStackParamList['ChatDetail']; route: 'ChatDetail' }
  | { params: MainTabParamList['Content']; route: 'Content' }
  | { params: RootStackParamList['MessageDetail']; route: 'MessageDetail' }
  | { params: RootStackParamList['Notebook']; route: 'Notebook' }
  | { params: RootStackParamList['PublicResourceShare']; route: 'PublicResourceShare' }
  | { params: RootStackParamList['ToolDetail']; route: 'ToolDetail' }
  | { params: RootStackParamList['ThreadDetail']; route: 'ThreadDetail' }
  | { params: RootStackParamList['ThreadList']; route: 'ThreadList' };

const createUrl = (url: string) => {
  try {
    return new URL(url);
  } catch {
    return null;
  }
};

const getUrlPath = (url: string) => {
  const parsed = createUrl(url);
  if (!parsed) return url;

  if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
    return parsed.pathname || '/';
  }

  const hostPath = parsed.hostname ? `/${parsed.hostname}${parsed.pathname}` : parsed.pathname || '/';
  return hostPath.replaceAll(/\/{2,}/g, '/');
};

const getSearchParams = (url: string) => {
  const parsed = createUrl(url);
  if (parsed) return parsed.searchParams;

  const queryIndex = url.indexOf('?');
  if (queryIndex < 0) return new URLSearchParams();

  return new URLSearchParams(url.slice(queryIndex + 1).split('#')[0]);
};

export function parseResourceShareUrl(
  url: string,
): RootStackParamList['PublicResourceShare'] | null {
  const match = url.match(SHARE_R_PATH);
  if (!match?.[1]) return null;
  const token = decodeURIComponent(match[1]);
  let initialPassword: string | undefined;
  try {
    const qIndex = url.indexOf('?');
    if (qIndex >= 0) {
      const qs = url.slice(qIndex + 1).split('#')[0];
      initialPassword = new URLSearchParams(qs).get('password') ?? undefined;
    }
  } catch {
    /* ignore */
  }
  return { initialPassword, token };
}

export function navigateToPublicResourceShare(params: RootStackParamList['PublicResourceShare']) {
  if (!navigationRef.isReady()) return;
  navigationRef.navigate('PublicResourceShare', params);
}

export function parseIncomingNavigationUrl(url: string): ParsedNavigationTarget | null {
  const shareParams = parseResourceShareUrl(url);
  if (shareParams) {
    return { params: shareParams, route: 'PublicResourceShare' };
  }

  const path = getUrlPath(url);
  const searchParams = getSearchParams(url);
  const sessionId = searchParams.get('sessionId') ?? undefined;
  const threadId = searchParams.get('threadId') ?? undefined;
  const topicId = searchParams.get('topicId') ?? undefined;

  if (CHAT_PATH.test(path)) {
    if (!sessionId) return null;
    const messageId = searchParams.get('messageId') ?? undefined;

    return {
      params: {
        ...(messageId ? { messageId } : {}),
        sessionId,
        ...(topicId ? { topicId } : {}),
      },
      route: 'ChatDetail',
    };
  }

  if (MESSAGE_DETAIL_PATH.test(path)) {
    const messageId = searchParams.get('messageId');
    if (!sessionId || !messageId) return null;

    const title = searchParams.get('title') ?? undefined;

    return {
      params: {
        messageId,
        sessionId,
        ...(threadId ? { threadId } : {}),
        ...(title ? { title } : {}),
        ...(topicId ? { topicId } : {}),
      },
      route: 'MessageDetail',
    };
  }

  if (TOOL_DETAIL_PATH.test(path)) {
    const identifier = searchParams.get('identifier') ?? undefined;
    const apiName = searchParams.get('apiName') ?? undefined;
    const toolCallId = searchParams.get('toolCallId') ?? undefined;
    const title = searchParams.get('title') ?? undefined;

    if (!identifier && !apiName && !toolCallId && !title) return null;

    return {
      params: {
        ...(apiName ? { apiName } : {}),
        ...(identifier ? { identifier } : {}),
        ...(sessionId ? { sessionId } : {}),
        ...(threadId ? { threadId } : {}),
        ...(title ? { title } : {}),
        ...(topicId ? { topicId } : {}),
        ...(toolCallId ? { toolCallId } : {}),
      },
      route: 'ToolDetail',
    };
  }

  if (NOTEBOOK_PATH.test(path)) {
    const documentId = searchParams.get('documentId') ?? undefined;

    return {
      params:
        sessionId || topicId || threadId || documentId
          ? {
              ...(documentId ? { documentId } : {}),
              ...(sessionId ? { sessionId } : {}),
              ...(threadId ? { threadId } : {}),
              ...(topicId ? { topicId } : {}),
            }
          : undefined,
      route: 'Notebook',
    };
  }

  if (THREAD_LIST_PATH.test(path)) {
    if (!sessionId || !topicId) return null;

    return {
      params: { sessionId, topicId },
      route: 'ThreadList',
    };
  }

  if (THREAD_DETAIL_PATH.test(path)) {
    const threadId = searchParams.get('threadId');
    if (!sessionId || !threadId) return null;

    const title = searchParams.get('title') ?? undefined;

    return {
      params: {
        sessionId,
        threadId,
        ...(title ? { title } : {}),
        ...(topicId ? { topicId } : {}),
      },
      route: 'ThreadDetail',
    };
  }

  const tableDocId = path.match(DOC_TABLE_DETAIL_PATH)?.[1] ?? undefined;
  if (tableDocId) {
    return {
      params: {
        documentId: decodeURIComponent(tableDocId),
        ...(sessionId ? { sessionId } : {}),
        ...(threadId ? { threadId } : {}),
        ...(topicId ? { topicId } : {}),
      },
      route: 'Notebook',
    };
  }

  const docId = path.match(DOC_DETAIL_PATH)?.[1] ?? undefined;
  if (docId) {
    return {
      params: {
        documentId: decodeURIComponent(docId),
        ...(sessionId ? { sessionId } : {}),
        ...(threadId ? { threadId } : {}),
        ...(topicId ? { topicId } : {}),
      },
      route: 'Notebook',
    };
  }

  const fileId =
    path.match(FILE_ITEM_PATH)?.[1] ?? path.match(NESTED_FILE_ITEM_PATH)?.[1] ?? undefined;
  if (fileId) {
    return {
      params: {
        openItemId: decodeURIComponent(fileId),
        openKind: 'file',
        ...(sessionId ? { sessionId } : {}),
        ...(threadId ? { threadId } : {}),
        ...(topicId ? { topicId } : {}),
      },
      route: 'Content',
    };
  }

  if (CONTENT_PATH.test(path)) {
    const openItemId = searchParams.get('id') ?? undefined;
    const kind = searchParams.get('kind');
    const openKind =
      kind === 'document' || kind === 'file' || kind === 'source_set' ? kind : undefined;
    const openSourceSetId = searchParams.get('sourceSetId');

    if (!openItemId && !openSourceSetId) return null;

    return {
      params: {
        ...(openItemId ? { openItemId } : {}),
        ...(openKind ? { openKind } : {}),
        ...(openSourceSetId ? { openSourceSetId } : {}),
        ...(sessionId ? { sessionId } : {}),
        ...(threadId ? { threadId } : {}),
        ...(topicId ? { topicId } : {}),
      },
      route: 'Content',
    };
  }

  return null;
}

export function handleIncomingShareUrl(url: string | null | undefined) {
  if (!url) return;
  const parsed = parseIncomingNavigationUrl(url);
  if (!parsed) return;

  switch (parsed.route) {
    case 'PublicResourceShare': {
      navigateToPublicResourceShare(parsed.params);
      return;
    }
    case 'ChatDetail': {
      navigateToChatDetail(parsed.params);
      return;
    }
    case 'Notebook': {
      navigateToNotebook(parsed.params);
      return;
    }
    case 'MessageDetail': {
      navigateToMessageDetail(parsed.params);
      return;
    }
    case 'ToolDetail': {
      navigateToToolDetail(parsed.params);
      return;
    }
    case 'ThreadList': {
      navigateToThreadList(parsed.params);
      return;
    }
    case 'ThreadDetail': {
      navigateToThreadDetail(parsed.params);
      return;
    }
    case 'Content': {
      navigateToContent(parsed.params);
      return;
    }
  }
}
