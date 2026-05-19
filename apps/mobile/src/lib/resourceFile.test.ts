import { describe, expect, it } from 'vitest';

import type { FileListItem } from '../types';
import {
  formatBytes,
  isDocument,
  isImage,
  isMarkdownFile,
  isTextLikeFile,
  matchesCategory,
} from './resourceFile';

const baseItem: FileListItem = {
  chunkCount: null,
  chunkingError: null,
  content: null,
  createdAt: '2026-04-06T09:00:00.000Z',
  embeddingError: null,
  fileType: 'image/png',
  finishEmbedding: false,
  id: 'file-1',
  name: 'brand.png',
  size: 1024,
  sourceType: 'file',
  url: '/f/file-1',
};

describe('formatBytes', () => {
  it('formats bytes by unit', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});

describe('resource file type guards', () => {
  it('detects images from extension fallback', () => {
    expect(isImage('application/octet-stream', 'cover.webp')).toBe(true);
  });

  it('detects documents from extension fallback', () => {
    expect(isDocument('application/octet-stream', 'slides.pdf')).toBe(true);
  });

  it('detects markdown and text-like authored documents', () => {
    expect(isMarkdownFile('text/plain', 'README.md')).toBe(true);
    expect(isTextLikeFile('application/custom', 'notes.custom', 'document')).toBe(true);
  });
});

describe('matchesCategory', () => {
  it('keeps folders visible across categories', () => {
    expect(matchesCategory({ ...baseItem, fileType: 'custom/folder' }, 'documents')).toBe(true);
  });

  it('filters items by category', () => {
    expect(matchesCategory(baseItem, 'images')).toBe(true);
    expect(
      matchesCategory({ ...baseItem, fileType: 'application/pdf', name: 'spec.pdf' }, 'documents'),
    ).toBe(true);
    expect(
      matchesCategory({ ...baseItem, fileType: 'application/zip', name: 'archive.zip' }, 'others'),
    ).toBe(true);
  });
});
