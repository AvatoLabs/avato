import { describe, expect, it } from 'vitest';

import {
  FileAssetClassification,
  FileAssetReviewStatus,
  FileAssetUsagePolicy,
  FilesTabs,
  SortType,
} from '@/types/files';

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
      scope: 'all',
      sorter: 'createdAt',
      sortType: SortType.Desc,
      spaceId: 'spc_1',
    });

    expect(params.category).toBe(FilesTabs.Home);
    expect(params.parentId).toBe('folder-slug');
    expect(params.showFilesInSourceSet).toBe(true);
  });

  it('uses the unassigned scope for personal space root files', () => {
    const params = buildExplorerQueryParams({
      category: FilesTabs.Home,
      scope: 'unassigned',
      sorter: 'createdAt',
      sortType: SortType.Desc,
      spaceId: 'spc_1',
    });

    expect(params.category).toBe(FilesTabs.Home);
    expect(params.parentId).toBe(null);
    expect(params.showFilesInSourceSet).toBe(false);
  });

  it('passes through asset classification filters', () => {
    const params = buildExplorerQueryParams({
      assetClassification: FileAssetClassification.Brand,
      category: FilesTabs.Home,
      sorter: 'createdAt',
      sortType: SortType.Desc,
      spaceId: 'spc_1',
    });

    expect(params.assetClassification).toBe(FileAssetClassification.Brand);
  });

  it('passes through asset usage policy filters', () => {
    const params = buildExplorerQueryParams({
      assetUsagePolicy: FileAssetUsagePolicy.Restricted,
      category: FilesTabs.Home,
      sorter: 'createdAt',
      sortType: SortType.Desc,
      spaceId: 'spc_1',
    });

    expect(params.assetUsagePolicy).toBe(FileAssetUsagePolicy.Restricted);
  });

  it('passes through asset rights owner filters', () => {
    const params = buildExplorerQueryParams({
      assetRightsOwner: 'Brand Team',
      category: FilesTabs.Home,
      sorter: 'createdAt',
      sortType: SortType.Desc,
      spaceId: 'spc_1',
    });

    expect(params.assetRightsOwner).toBe('Brand Team');
  });

  it('passes through asset review status filters', () => {
    const params = buildExplorerQueryParams({
      assetReviewStatus: FileAssetReviewStatus.Approved,
      category: FilesTabs.Home,
      sorter: 'createdAt',
      sortType: SortType.Desc,
      spaceId: 'spc_1',
    });

    expect(params.assetReviewStatus).toBe(FileAssetReviewStatus.Approved);
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

  it('prefers URL scope over store sourceSetId to avoid stale-key race', () => {
    // Simulates the one-frame race: URL already changed to collection B
    // but the store still holds the old sourceSetId for collection A.
    const params = buildExplorerQueryParams({
      scope: 'source-set:ss_new',
      sourceSetId: 'ss_old',
      sorter: 'createdAt',
      sortType: SortType.Desc,
      spaceId: 'spc_1',
    });

    // URL scope wins — effectiveSourceSetId should be ss_new, not ss_old
    expect(params.sourceSetId).toBe('ss_new');
  });

  it('falls back to store sourceSetId when URL scope has no collection id', () => {
    const params = buildExplorerQueryParams({
      scope: 'all',
      sourceSetId: 'ss_1',
      sorter: 'createdAt',
      sortType: SortType.Desc,
      spaceId: 'spc_1',
    });

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
