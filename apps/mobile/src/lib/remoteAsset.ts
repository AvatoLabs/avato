import { useEffect, useState } from 'react';

import { useConnectionStore } from '../store/connection';
import { getApiUrl } from './server';

let cachedBaseUrl: string | null = null;

const isAbsoluteUri = (value: string) =>
  value.startsWith('http://') ||
  value.startsWith('https://') ||
  value.startsWith('file://') ||
  value.startsWith('data:') ||
  value.startsWith('content://');

export const resolveRemoteAssetUrl = (baseUrl: string, value?: string | null) => {
  if (!value) return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (isAbsoluteUri(trimmed)) return trimmed;

  if (trimmed.startsWith('/')) {
    return `${baseUrl}${trimmed}`;
  }

  return `${baseUrl}/${trimmed.replace(/^\/+/, '')}`;
};

const getInitialResolvedUri = (value?: string | null) => {
  if (!value?.trim()) return undefined;
  if (isAbsoluteUri(value)) return value;
  const serverUrl = useConnectionStore.getState().serverUrl;
  if (serverUrl) return resolveRemoteAssetUrl(serverUrl, value);
  if (cachedBaseUrl) return resolveRemoteAssetUrl(cachedBaseUrl, value);
  return undefined;
};

export const useResolvedRemoteAsset = (value?: string | null) => {
  const serverUrl = useConnectionStore((s) => s.serverUrl);
  const [resolvedUri, setResolvedUri] = useState<string | undefined>(() =>
    getInitialResolvedUri(value),
  );

  useEffect(() => {
    let cancelled = false;

    if (!value?.trim()) {
      setResolvedUri(undefined);
      return;
    }

    if (isAbsoluteUri(value)) {
      setResolvedUri(value);
      return;
    }

    if (serverUrl) {
      cachedBaseUrl = serverUrl;
      setResolvedUri(resolveRemoteAssetUrl(serverUrl, value));
      return;
    }

    if (cachedBaseUrl) {
      setResolvedUri(resolveRemoteAssetUrl(cachedBaseUrl, value));
      return;
    }

    getApiUrl()
      .then((baseUrl) => {
        if (cancelled) return;
        cachedBaseUrl = baseUrl;
        setResolvedUri(resolveRemoteAssetUrl(baseUrl, value));
      })
      .catch(() => {
        if (cancelled) return;
        setResolvedUri(undefined);
      });

    return () => {
      cancelled = true;
    };
  }, [serverUrl, value]);

  return resolvedUri;
};
