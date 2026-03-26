import { getMediaFetchInit } from '@lobechat/utils/client';

import { type DocumentProps } from '@/libs/pdfjs';

export const createPdfDocumentSource = (url: string | null): DocumentProps['file'] => {
  if (!url) return null;

  const { credentials } = getMediaFetchInit(url);

  return {
    url,
    withCredentials: credentials === 'include',
  };
};
