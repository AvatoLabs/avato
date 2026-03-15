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

const isStorageSetupError = (error: unknown): boolean => {
  const rawMessage =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : String(error ?? '');

  const message = rawMessage.toLowerCase();

  return (
    message.includes('s3 environment variables are not set') ||
    message.includes('s3 bucket is not set') ||
    message.includes('file storage is not configured') ||
    message.includes('nosuchbucket') ||
    message.includes('specified bucket does not exist')
  );
};

const getUploadErrorDescription = (error: unknown): string => {
  if (isStorageSetupError(error)) {
    return t('upload.storageNotConfigured', { ns: 'error' });
  }

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
