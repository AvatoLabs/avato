import type { FileListItem } from '../types';

function shouldAttachRemoteHeaders(apiBaseUrl: string, remoteUrl?: string | null) {
  if (!apiBaseUrl || !remoteUrl) return false;

  try {
    return new URL(remoteUrl).origin === new URL(apiBaseUrl).origin;
  } catch {
    return remoteUrl.startsWith('/');
  }
}

export function resolveRemoteFileUrl(
  apiBaseUrl: string,
  item: Pick<FileListItem, 'id' | 'url'>,
): string {
  const base = apiBaseUrl?.replace(/\/$/, '') || '';

  if (
    item.url?.startsWith('http://') ||
    item.url?.startsWith('https://') ||
    item.url?.startsWith('file://')
  ) {
    return item.url;
  }

  if (item.url?.startsWith('/')) {
    return `${base}${item.url}`;
  }

  return base ? `${base}/f/${item.id}` : '';
}

export function buildRemoteSource(
  apiBaseUrl: string,
  remoteUrl: string | null | undefined,
  remoteHeaders?: Record<string, string>,
) {
  if (!remoteUrl) return undefined;

  if (
    shouldAttachRemoteHeaders(apiBaseUrl, remoteUrl) &&
    remoteHeaders &&
    Object.keys(remoteHeaders).length > 0
  ) {
    return { headers: remoteHeaders, uri: remoteUrl };
  }

  return { uri: remoteUrl };
}

export function buildRemoteFetchInit(
  apiBaseUrl: string,
  remoteUrl: string,
  remoteHeaders?: Record<string, string>,
) {
  const source = buildRemoteSource(apiBaseUrl, remoteUrl, remoteHeaders);
  return source?.headers ? { headers: source.headers } : undefined;
}

export function buildRemoteFileCandidates(
  apiBaseUrl: string,
  item: Pick<FileListItem, 'id' | 'url'>,
) {
  const resolved = resolveRemoteFileUrl(apiBaseUrl, item);
  const proxyUrl = apiBaseUrl ? `${apiBaseUrl.replace(/\/$/, '')}/f/${item.id}` : '';

  return [...new Set([resolved, proxyUrl].filter(Boolean))];
}
