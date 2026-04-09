/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest';

import { createPdfDocumentSource } from './utils';

describe('createPdfDocumentSource', () => {
  it('returns null when url is missing', () => {
    expect(createPdfDocumentSource(null)).toBeNull();
  });

  it('includes credentials for same-origin file proxy urls', () => {
    expect(createPdfDocumentSource('/f/file_1')).toEqual({
      url: '/f/file_1',
    });
  });

  it('omits credentials for cross-origin presigned urls', () => {
    expect(createPdfDocumentSource('https://storage.example.com/file.pdf')).toEqual({
      url: 'https://storage.example.com/file.pdf',
    });
  });
});
