import { describe, expect, it } from 'vitest';

import { resolveSharedResourcePath } from './resolveSharedResourcePath';

describe('resolveSharedResourcePath', () => {
  it('should resolve shared documents to space-scoped docs routes', () => {
    expect(
      resolveSharedResourcePath({
        kind: 'document',
        localId: 'docs_1',
        metadata: null,
        spaceId: 'spc_1',
      }),
    ).toBe('/spaces/spc_1/docs/1');
  });

  it('should preserve table page kind for shared table documents', () => {
    expect(
      resolveSharedResourcePath({
        kind: 'document',
        localId: 'docs_2',
        metadata: { pageKind: 'table' },
        spaceId: 'spc_1',
      }),
    ).toBe('/spaces/spc_1/docs/table/2');
  });

  it('should resolve shared files to files preview routes', () => {
    expect(
      resolveSharedResourcePath({
        kind: 'file',
        localId: 'file_1',
        spaceId: 'spc_1',
      }),
    ).toBe('/spaces/spc_1/files/item/file_1');
  });

  it('should resolve shared source sets to source-set scoped files routes', () => {
    expect(
      resolveSharedResourcePath({
        kind: 'source_set',
        localId: 'ss_1',
        spaceId: 'spc_1',
      }),
    ).toBe('/spaces/spc_1/files?scope=source-set%3Ass_1');
  });
});
