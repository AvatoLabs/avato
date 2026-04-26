import { isSameOriginAppUrl } from '@/server/services/file/stableAppFileProxy';

export const createTopicShareAttachmentUrlResolver = (shareId: string) => {
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

    return `/share/t/${encodeURIComponent(shareId)}/f/${encodeURIComponent(file.id)}`;
  };
};
