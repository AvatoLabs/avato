import { describe, expect, it } from 'vitest';

import {
  getCanonicalSharedResourceKind,
  normalizeContentShareTarget,
  normalizePublicSharedContent,
  normalizeSharedWithMeItem,
} from './resourceShare';

describe('resourceShare', () => {
  it('canonicalizes file-backed docs to document kind', () => {
    expect(
      getCanonicalSharedResourceKind({
        kind: 'file',
        localId: 'docs_file_1',
      }),
    ).toBe('document');
  });

  it('preserves source set kind', () => {
    expect(
      getCanonicalSharedResourceKind({
        kind: 'source_set',
        localId: 'ss_1',
      }),
    ).toBe('source_set');
  });

  it('normalizes share targets before mutation calls', () => {
    expect(
      normalizeContentShareTarget({
        id: 'docs_file_1',
        kind: 'file',
      }),
    ).toEqual({
      id: 'docs_file_1',
      kind: 'document',
    });
  });

  it('normalizes public shared content payloads', () => {
    expect(
      normalizePublicSharedContent({
        kind: 'file',
        localId: 'docs_file_1',
        name: 'Spec',
      }),
    ).toEqual({
      kind: 'document',
      localId: 'docs_file_1',
      name: 'Spec',
    });
  });

  it('normalizes shared-with-me list items', () => {
    expect(
      normalizeSharedWithMeItem({
        kind: 'file',
        localId: 'docs_file_1',
        name: 'Spec',
      }),
    ).toEqual({
      kind: 'document',
      localId: 'docs_file_1',
      name: 'Spec',
    });
  });
});
