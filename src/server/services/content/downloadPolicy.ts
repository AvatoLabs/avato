import type { FileDownloadVia } from '@/server/modules/file-proxy/serveAuthorizedFileDownload';

export interface FileDownloadPolicy {
  cacheTtlSeconds: number;
  signedUrlExpiresIn: number;
}

const DEFAULT_FILE_URL_EXPIRES_IN = 3600;
const MAX_FILE_URL_EXPIRES_IN = 3600;

const SESSION_DOWNLOAD_POLICY: FileDownloadPolicy = {
  cacheTtlSeconds: 240,
  signedUrlExpiresIn: 300,
};

const SHARE_LINK_DOWNLOAD_POLICY: FileDownloadPolicy = {
  cacheTtlSeconds: 60,
  signedUrlExpiresIn: 120,
};

export const clampFileUrlExpiresIn = (requested?: number) => {
  if (!requested || Number.isNaN(requested) || requested <= 0) {
    return DEFAULT_FILE_URL_EXPIRES_IN;
  }

  return Math.min(Math.floor(requested), MAX_FILE_URL_EXPIRES_IN);
};

export const resolveFileDownloadPolicy = (downloadVia: FileDownloadVia): FileDownloadPolicy => {
  if (downloadVia === 'share_path' || downloadVia === 'share_query') {
    return SHARE_LINK_DOWNLOAD_POLICY;
  }

  return SESSION_DOWNLOAD_POLICY;
};
