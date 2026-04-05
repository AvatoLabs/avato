import { appEnv } from '@/envs/app';

const isSameOriginAppUrl = (path: string) => {
  try {
    const target = new URL(path);
    const trustedOrigins = [appEnv.APP_URL, appEnv.INTERNAL_APP_URL]
      .filter(Boolean)
      .map((value) => {
        try {
          return new URL(value).origin;
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    return trustedOrigins.includes(target.origin);
  } catch {
    return false;
  }
};

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
