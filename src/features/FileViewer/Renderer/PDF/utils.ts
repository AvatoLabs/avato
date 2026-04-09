import { type DocumentProps } from '@/libs/pdfjs';

export const createPdfDocumentSource = (url: string | null): DocumentProps['file'] => {
  if (!url) return null;

  return { url };
};
