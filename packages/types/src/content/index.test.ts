import { describe, expect, it } from 'vitest';

import {
  getCanonicalContentKind,
  getCanonicalSharedContentKind,
  isCanonicalDocumentResource,
  isRawFileContentId,
  isRawFileContentResource,
} from './index';

describe('content canonical helpers', () => {
  it('treats docs_* ids as canonical documents', () => {
    expect(isCanonicalDocumentResource({ id: 'docs_1', sourceType: 'file' })).toBe(true);
    expect(getCanonicalContentKind({ id: 'docs_1', sourceType: 'file' })).toBe('document');
  });

  it('preserves raw file identities', () => {
    expect(isCanonicalDocumentResource({ id: 'file_1', sourceType: 'file' })).toBe(false);
    expect(getCanonicalContentKind({ id: 'file_1', sourceType: 'file' })).toBe('file');
    expect(isRawFileContentResource({ id: 'file_1', sourceType: 'file' })).toBe(true);
    expect(isRawFileContentId('file_1')).toBe(true);
    expect(isRawFileContentId('docs_1')).toBe(false);
  });

  it('preserves source set identity for shared resources', () => {
    expect(getCanonicalSharedContentKind({ kind: 'source_set', localId: 'ss_1' })).toBe(
      'source_set',
    );
  });

  it('canonicalizes shared file-backed docs to document', () => {
    expect(getCanonicalSharedContentKind({ kind: 'file', localId: 'docs_1' })).toBe('document');
  });
});
