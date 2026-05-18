import { describe, expect, it } from 'vitest';

import {
  FileAssetClassification,
  FileAssetRenditionKind,
  FileAssetReviewStatus,
  FileAssetUsagePolicy,
} from '@/types/files';

import { buildFileAssetBadges } from './buildFileAssetBadges';

const t = (key: string) => key;

describe('buildFileAssetBadges', () => {
  it('should render compact governance badges for non-default states', () => {
    expect(
      buildFileAssetBadges({
        assetClassification: FileAssetClassification.Brand,
        assetPrimaryRenditionKind: FileAssetRenditionKind.Preview,
        assetPrimaryRenditionLabel: 'Homepage',
        assetReviewStatus: FileAssetReviewStatus.Approved,
        assetRenditionCount: 3,
        assetUsagePolicy: FileAssetUsagePolicy.Restricted,
        assetVersionLabel: 'v2',
        t: t as any,
      }),
    ).toEqual([
      {
        color: 'gold',
        key: 'usage:restricted',
        label: 'detail.asset.usagePolicy.restricted',
        variant: 'outlined',
      },
      {
        color: 'success',
        key: 'review:approved',
        label: 'detail.asset.reviewStatus.approved',
        variant: 'filled',
      },
      {
        color: 'success',
        key: 'version:v2',
        label: 'v2',
        title: undefined,
        variant: 'filled',
      },
      {
        color: 'processing',
        key: 'rendition:preview:Homepage:2',
        label: 'detail.asset.rendition.preview · Homepage · +2',
        title: undefined,
        variant: 'outlined',
      },
      {
        key: 'classification:brand',
        label: 'detail.asset.classification.brand',
        variant: 'outlined',
      },
    ]);
  });

  it('should surface archived review status in compact governance badges', () => {
    expect(
      buildFileAssetBadges({
        assetClassification: FileAssetClassification.General,
        assetPrimaryRenditionKind: null,
        assetPrimaryRenditionLabel: null,
        assetReviewStatus: FileAssetReviewStatus.Archived,
        assetRenditionCount: null,
        assetUsagePolicy: FileAssetUsagePolicy.Internal,
        assetVersionLabel: null,
        t: t as any,
      }),
    ).toEqual([
      {
        color: 'gold',
        key: 'review:archived',
        label: 'detail.asset.reviewStatus.archived',
        variant: 'filled',
      },
    ]);
  });

  it('should hide default governance badges in list surfaces', () => {
    expect(
      buildFileAssetBadges({
        assetClassification: FileAssetClassification.General,
        assetPrimaryRenditionKind: null,
        assetPrimaryRenditionLabel: null,
        assetReviewStatus: FileAssetReviewStatus.Draft,
        assetRenditionCount: null,
        assetUsagePolicy: FileAssetUsagePolicy.Internal,
        assetVersionLabel: null,
        t: t as any,
      }),
    ).toEqual([]);
  });

  it('should keep approved review state visible alongside the primary rendition summary', () => {
    expect(
      buildFileAssetBadges({
        assetClassification: FileAssetClassification.General,
        compact: true,
        assetPrimaryRenditionKind: FileAssetRenditionKind.Preview,
        assetPrimaryRenditionLabel: 'Homepage',
        assetReviewStatus: FileAssetReviewStatus.Approved,
        assetRenditionCount: 2,
        assetUsagePolicy: FileAssetUsagePolicy.Internal,
        assetVersionLabel: null,
        t: t as any,
      }),
    ).toEqual([
      {
        color: 'success',
        key: 'review:approved',
        label: 'detail.asset.reviewStatus.approved',
        variant: 'filled',
      },
      {
        color: 'processing',
        key: 'rendition:preview:Homepage:1',
        label: 'detail.asset.rendition.preview · +1',
        title: 'detail.asset.rendition.preview · Homepage · +1',
        variant: 'outlined',
      },
    ]);
  });

  it('should collapse hidden compact badges into an overflow badge', () => {
    expect(
      buildFileAssetBadges({
        assetClassification: FileAssetClassification.Brand,
        compact: true,
        maxVisible: 3,
        assetPrimaryRenditionKind: null,
        assetPrimaryRenditionLabel: null,
        assetReviewStatus: FileAssetReviewStatus.Archived,
        assetRenditionCount: null,
        assetUsagePolicy: FileAssetUsagePolicy.Restricted,
        assetVersionLabel: 'Version 2026 Launch Candidate',
        t: t as any,
      }),
    ).toEqual([
      {
        color: 'gold',
        key: 'usage:restricted',
        label: 'detail.asset.usagePolicy.restricted',
        variant: 'outlined',
      },
      {
        color: 'gold',
        key: 'review:archived',
        label: 'detail.asset.reviewStatus.archived',
        variant: 'filled',
      },
      {
        key: 'overflow:version:Version 2026 Launch Candidate|classification:brand',
        label: '+2',
        title: 'Version 2026 Launch Candidate · detail.asset.classification.brand',
        variant: 'outlined',
      },
    ]);
  });

  describe('collection badges', () => {
    it('should render named collection badges before governance badges', () => {
      expect(
        buildFileAssetBadges({
          sourceSetIds: ['col-1', 'col-2'],
          getSourceSetNameById: (id: string) =>
            id === 'col-1' ? 'Marketing' : id === 'col-2' ? 'Brand Assets' : undefined,
          t: t as any,
        }),
      ).toEqual([
        { key: 'collection:col-1', label: 'Marketing', variant: 'filled' },
        { key: 'collection:col-2', label: 'Brand Assets', variant: 'filled' },
      ]);
    });

    it('should skip the current scope collection badge as redundant', () => {
      expect(
        buildFileAssetBadges({
          currentSourceSetId: 'col-1',
          sourceSetIds: ['col-1', 'col-2'],
          getSourceSetNameById: (id: string) =>
            id === 'col-1' ? 'Marketing' : id === 'col-2' ? 'Brand Assets' : undefined,
          t: t as any,
        }),
      ).toEqual([{ key: 'collection:col-2', label: 'Brand Assets', variant: 'filled' }]);
    });

    it('should show fallback badge when collection name cannot be resolved', () => {
      expect(
        buildFileAssetBadges({
          sourceSetIds: ['col-unknown'],
          getSourceSetNameById: () => undefined,
          t: t as any,
        }),
      ).toEqual([
        {
          key: 'collection:unnamed:1',
          label: 'collection.badge.assigned',
          variant: 'filled',
        },
      ]);
    });

    it('should not render collection badges when sourceSetIds is empty', () => {
      expect(
        buildFileAssetBadges({
          sourceSetIds: [],
          getSourceSetNameById: (id: string) => id,
          t: t as any,
        }),
      ).toEqual([]);
    });
  });
});
