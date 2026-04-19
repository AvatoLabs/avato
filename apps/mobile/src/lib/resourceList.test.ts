import { describe, expect, it } from 'vitest';

import type { FileListItem } from '../types';
import {
  areSameFileItems,
  filterFileListByCategory,
  getCanonicalResourceKind,
  isCanonicalDocumentItem,
  isRawFileResourceId,
  sortFileList,
} from './resourceList';

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

describe('areSameFileItems', () => {
  it('returns false when governance badges changed', () => {
    expect(
      areSameFileItems(
        [{ ...baseItem, assetReviewStatus: 'draft' }],
        [{ ...baseItem, assetReviewStatus: 'approved' }],
      ),
    ).toBe(false);
  });

  it('returns false when rights owner changed', () => {
    expect(
      areSameFileItems(
        [{ ...baseItem, assetRightsOwner: 'Brand Team' }],
        [{ ...baseItem, assetRightsOwner: 'Legal Team' }],
      ),
    ).toBe(false);
  });

  it('returns true when compared items are identical', () => {
    expect(areSameFileItems([baseItem], [{ ...baseItem }])).toBe(true);
  });
});

describe('isCanonicalDocumentItem', () => {
  it('treats native documents as canonical documents', () => {
    expect(isCanonicalDocumentItem({ id: 'docs_note_1', sourceType: 'document' })).toBe(true);
    expect(getCanonicalResourceKind({ id: 'docs_note_1', sourceType: 'document' })).toBe(
      'document',
    );
  });

  it('treats file-backed docs as canonical documents by docs_* id', () => {
    expect(isCanonicalDocumentItem({ id: 'docs_file_1', sourceType: 'file' })).toBe(true);
    expect(getCanonicalResourceKind({ id: 'docs_file_1', sourceType: 'file' })).toBe('document');
  });

  it('accepts shared-resource kind hints as canonical document input', () => {
    expect(isCanonicalDocumentItem({ id: 'doc_from_share_1', kind: 'document' })).toBe(true);
    expect(getCanonicalResourceKind({ id: 'doc_from_share_1', kind: 'document' })).toBe(
      'document',
    );
  });

  it('keeps raw files on the file path', () => {
    expect(isCanonicalDocumentItem({ id: 'file_1', sourceType: 'file' })).toBe(false);
    expect(getCanonicalResourceKind({ id: 'file_1', sourceType: 'file' })).toBe('file');
  });

  it('detects raw file ids explicitly', () => {
    expect(isRawFileResourceId('file_1')).toBe(true);
    expect(isRawFileResourceId('docs_1')).toBe(false);
    expect(isRawFileResourceId(undefined)).toBe(false);
  });
});

describe('sortFileList', () => {
  it('sorts names with numeric awareness', () => {
    const sorted = sortFileList(
      [
        { ...baseItem, id: '2', name: 'file-10' },
        { ...baseItem, id: '1', name: 'file-2' },
      ],
      'name',
      'asc',
    );

    expect(sorted.map((item) => item.name)).toEqual(['file-2', 'file-10']);
  });
});

describe('filterFileListByCategory', () => {
  it('filters documents via shared category helpers', () => {
    const filtered = filterFileListByCategory(
      [
        { ...baseItem, id: 'img', fileType: 'image/png', name: 'cover.png' },
        { ...baseItem, id: 'doc', fileType: 'application/pdf', name: 'spec.pdf' },
      ],
      'documents',
    );

    expect(filtered.map((item) => item.id)).toEqual(['doc']);
  });
});
