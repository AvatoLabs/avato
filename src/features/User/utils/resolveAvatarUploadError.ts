import { type TFunction } from 'i18next';

interface AvatarUploadErrorResult {
  errorMessage: string;
  status: number;
}

const NETWORK_ERROR_PATTERNS = [
  'network',
  'failed to fetch',
  'fetch failed',
  'timeout',
  'timed out',
  'abort',
  'connection',
];

const FILE_SIZE_ERROR_PATTERNS = ['413', 'too large', 'payload too large', 'entity too large'];

const includesAny = (input: string, patterns: string[]) => {
  return patterns.some((pattern) => input.includes(pattern));
};

export const resolveAvatarUploadError = (error: unknown, t: TFunction): AvatarUploadErrorResult => {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const normalizedMessage = rawMessage.toLowerCase();

  if (includesAny(normalizedMessage, NETWORK_ERROR_PATTERNS)) {
    return {
      errorMessage: t('upload.networkError', { ns: 'error' }),
      status: 408,
    };
  }

  if (includesAny(normalizedMessage, FILE_SIZE_ERROR_PATTERNS)) {
    return {
      errorMessage: t('settingAgent.avatar.sizeExceeded', { ns: 'setting' }),
      status: 413,
    };
  }

  return {
    errorMessage: t('upload.unknownError', { ns: 'error', reason: rawMessage }),
    status: 500,
  };
};
