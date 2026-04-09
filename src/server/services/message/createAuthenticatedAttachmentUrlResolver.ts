import { isSameOriginAppUrl } from '@/server/services/file/stableAppFileProxy';

export const createAuthenticatedAttachmentUrlResolver = () => {
  return async (
    path: string | null,
    file: {
      id: string;
      fileType: string;
    },
  ) => {
    if (!path) return '';

    if ((path.startsWith('http://') || path.startsWith('https://')) && !isSameOriginAppUrl(path)) {
      return path;
    }

    return `/f/${file.id}`;
  };
};
