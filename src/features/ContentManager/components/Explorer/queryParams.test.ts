import { describe, expect, it } from 'vitest';

import { FilesTabs, SortType } from '@/types/files';

import { buildExplorerQueryParams, isSpaceLevelContentFilter } from './queryParams';

describe('buildExplorerQueryParams', () => {
  it('treats typed categories as space-level filters outside source sets', () => {
    const params = buildExplorerQueryParams({
      category: FilesTabs.Documents,
      currentFolderSlug: 'folder-slug',
      sorter: 'createdAt',
      sortType: SortType.Desc,
      spaceId: 'spc_1',
    });

    expect(params.category).toBe(FilesTabs.Documents);
    expect(params.parentId).toBeUndefined();
    expect(params.spaceId).toBe('spc_1');
  });

  it('keeps folder scoping for the default all-content view', () => {
    const params = buildExplorerQueryParams({
      category: FilesTabs.Home,
      currentFolderSlug: 'folder-slug',
      sorter: 'createdAt',
      sortType: SortType.Desc,
      spaceId: 'spc_1',
    });

    expect(params.category).toBe(FilesTabs.Home);
    expect(params.parentId).toBe('folder-slug');
  });

  it('disables category filters inside source sets while keeping folder scope', () => {
    const params = buildExplorerQueryParams({
      category: FilesTabs.Images,
      currentFolderSlug: 'folder-slug',
      sourceSetId: 'ss_1',
      sorter: 'createdAt',
      sortType: SortType.Desc,
      spaceId: 'spc_1',
    });

    expect(params.category).toBeUndefined();
    expect(params.parentId).toBe('folder-slug');
    expect(params.sourceSetId).toBe('ss_1');
  });
});

describe('isSpaceLevelContentFilter', () => {
  it('returns false for root categories', () => {
    expect(isSpaceLevelContentFilter(FilesTabs.Home)).toBe(false);
    expect(isSpaceLevelContentFilter(FilesTabs.All)).toBe(false);
  });

  it('returns true for typed filters', () => {
    expect(isSpaceLevelContentFilter(FilesTabs.Documents)).toBe(true);
    expect(isSpaceLevelContentFilter(FilesTabs.Images)).toBe(true);
  });
});
