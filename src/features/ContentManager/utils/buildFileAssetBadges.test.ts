import { describe, expect, it } from 'vitest';

import { buildFileAssetBadges } from './buildFileAssetBadges';

const t = (key: string) => key;

describe('buildFileAssetBadges', () => {
  it('should render compact governance badges for non-default states', () => {
    expect(
      buildFileAssetBadges({
        assetClassification: 'brand',
        assetPrimaryRenditionKind: 'preview',
        assetPrimaryRenditionLabel: 'Homepage',
        assetReviewStatus: 'approved',
        assetRenditionCount: 3,
        assetUsagePolicy: 'restricted',
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
        assetClassification: 'general',
        assetPrimaryRenditionKind: null,
        assetPrimaryRenditionLabel: null,
        assetReviewStatus: 'archived',
        assetRenditionCount: null,
        assetUsagePolicy: 'internal',
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
        assetClassification: 'general',
        assetPrimaryRenditionKind: null,
        assetPrimaryRenditionLabel: null,
        assetReviewStatus: 'draft',
        assetRenditionCount: null,
        assetUsagePolicy: 'internal',
        assetVersionLabel: null,
        t: t as any,
      }),
    ).toEqual([]);
  });

  it('should keep approved review state visible alongside the primary rendition summary', () => {
    expect(
      buildFileAssetBadges({
        assetClassification: 'general',
        compact: true,
        assetPrimaryRenditionKind: 'preview',
        assetPrimaryRenditionLabel: 'Homepage',
        assetReviewStatus: 'approved',
        assetRenditionCount: 2,
        assetUsagePolicy: 'internal',
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
});
