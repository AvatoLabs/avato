import { t } from 'i18next';

import { notification } from '@/components/AntdStaticMethods';
import { UPLOAD_NETWORK_ERROR } from '@/services/upload';

interface UploadErrorOptions {
  description?: string;
  message?: string;
}

const isNetworkUploadError = (error: unknown): boolean => {
  if (error === UPLOAD_NETWORK_ERROR) return true;

  const rawMessage =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : String(error ?? '');

  const message = rawMessage.toLowerCase();

  return (
    message.includes('network') ||
    message.includes('failed to fetch') ||
    message.includes('timeout') ||
    message.includes('connection')
  );
};

const getUploadErrorDescription = (error: unknown): string => {
  if (isNetworkUploadError(error)) {
    return t('upload.networkError', { ns: 'error' });
  }

  if (typeof error === 'string') return error;

  return t('upload.unknownError', {
    ns: 'error',
    reason: error instanceof Error ? error.message : String(error),
  });
};

export const uploadErrorNotification = {
  error: (error: unknown, options?: UploadErrorOptions) => {
    notification.error({
      description: options?.description ?? getUploadErrorDescription(error),
      message: options?.message ?? t('upload.title', { ns: 'error' }),
    });
  },
};
