'use client';

import { type ComponentProps } from 'react';
import { type Page as PdfPage } from 'react-pdf';
import { Document as PdfDocument, pdfjs } from 'react-pdf';

export const pdfWorkerSrc = `https://registry.npmmirror.com/pdfjs-dist/${pdfjs.version}/files/build/pdf.worker.min.mjs`;

type PdfJsWorkerConfig = Pick<typeof pdfjs, 'GlobalWorkerOptions'>;

export function configurePdfJsWorker(instance: PdfJsWorkerConfig = pdfjs) {
  if (instance.GlobalWorkerOptions.workerSrc !== pdfWorkerSrc) {
    instance.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
  }
}

configurePdfJsWorker();

export type DocumentProps = ComponentProps<typeof PdfDocument>;
export type PageProps = ComponentProps<typeof PdfPage>;

export const Document = (props: DocumentProps) => {
  configurePdfJsWorker();
  return <PdfDocument {...props} />;
};

export { Page, pdfjs } from 'react-pdf';
