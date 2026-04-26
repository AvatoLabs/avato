// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadMock = vi.fn();
const PDFLoaderMock = vi.fn();

vi.mock('@langchain/community/document_loaders/fs/pdf', () => ({
  PDFLoader: PDFLoaderMock,
}));

vi.mock('@napi-rs/canvas', () => ({
  DOMMatrix: class DOMMatrix {},
  DOMPoint: class DOMPoint {},
  DOMRect: class DOMRect {},
  Path2D: class Path2D {},
}));

vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
  getDocument: vi.fn(),
  version: '5.4.530',
}));

describe('PdfLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    PDFLoaderMock.mockImplementation(() => ({
      load: loadMock.mockResolvedValue([{ pageContent: 'page-1' }]),
    }));

    Reflect.deleteProperty(globalThis, 'DOMMatrix');
    Reflect.deleteProperty(globalThis, 'DOMPoint');
    Reflect.deleteProperty(globalThis, 'DOMRect');
    Reflect.deleteProperty(globalThis, 'Path2D');
  });

  it('should create the langchain loader with the custom pdfjs backend', async () => {
    const { PdfLoader } = await import('./index');
    const blob = new Blob(['test']);

    const result = await PdfLoader(blob);

    expect(PDFLoaderMock).toHaveBeenCalledWith(
      blob,
      expect.objectContaining({
        pdfjs: expect.any(Function),
        splitPages: true,
      }),
    );
    expect(result).toEqual([{ pageContent: 'page-1' }]);
  });

  it('should load pdfjs-dist and install node polyfills before parsing', async () => {
    const { PdfLoader } = await import('./index');

    await PdfLoader(new Blob(['test']));

    const options = PDFLoaderMock.mock.calls[0][1] as { pdfjs: () => Promise<{ version: string }> };
    const pdfjs = await options.pdfjs();

    expect(pdfjs.version).toBe('5.4.530');
    expect(globalThis.DOMMatrix).toBeDefined();
    expect(globalThis.DOMPoint).toBeDefined();
    expect(globalThis.DOMRect).toBeDefined();
    expect(globalThis.Path2D).toBeDefined();
    expect(typeof URL.createObjectURL).toBe('function');
    expect(typeof URL.revokeObjectURL).toBe('function');
  });
});
