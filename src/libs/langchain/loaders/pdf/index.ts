import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';

const ensurePdfJsPolyfills = async () => {
  if (typeof globalThis.DOMMatrix === 'undefined') {
    const canvas = await import('@napi-rs/canvas');

    Object.assign(globalThis, {
      DOMMatrix: canvas.DOMMatrix,
      DOMPoint: canvas.DOMPoint,
      DOMRect: canvas.DOMRect,
      Path2D: canvas.Path2D,
    });
  }

  const globalUrl = globalThis.URL as typeof URL & {
    createObjectURL?: (obj: Blob) => string;
    revokeObjectURL?: (url: string) => void;
  };

  if (typeof globalUrl.createObjectURL === 'undefined') {
    globalUrl.createObjectURL = () => 'blob:http://localhost/pdfjs-loader';
  }

  if (typeof globalUrl.revokeObjectURL === 'undefined') {
    globalUrl.revokeObjectURL = () => {
      /* no-op */
    };
  }
};

const loadPdfJs = async () => {
  await ensurePdfJsPolyfills();

  const { getDocument, version } = await import('pdfjs-dist/legacy/build/pdf.mjs');

  return { getDocument, version };
};

export const PdfLoader = async (fileBlob: Blob) => {
  const loader = new PDFLoader(fileBlob, {
    pdfjs: loadPdfJs,
    splitPages: true,
  });

  return await loader.load();
};
