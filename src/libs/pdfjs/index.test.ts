/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest';

import { configurePdfJsWorker, pdfWorkerSrc } from './index';

describe('configurePdfJsWorker', () => {
  it('overrides react-pdf default worker path', () => {
    const mockPdfjs = {
      GlobalWorkerOptions: {
        workerSrc: 'pdf.worker.mjs',
      },
    };

    configurePdfJsWorker(mockPdfjs as any);

    expect(mockPdfjs.GlobalWorkerOptions.workerSrc).toBe(pdfWorkerSrc);
  });

  it('keeps the configured worker path stable', () => {
    const mockPdfjs = {
      GlobalWorkerOptions: {
        workerSrc: pdfWorkerSrc,
      },
    };

    configurePdfJsWorker(mockPdfjs as any);

    expect(mockPdfjs.GlobalWorkerOptions.workerSrc).toBe(pdfWorkerSrc);
  });
});
