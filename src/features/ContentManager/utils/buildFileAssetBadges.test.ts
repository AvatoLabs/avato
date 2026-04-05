import { describe, expect, it } from 'vitest';

import { buildFileAssetBadges } from './buildFileAssetBadges';

const t = (key: string) => key;

describe('buildFileAssetBadges', () => {
  it('should render compact governance badges for non-default states', () => {
    expect(
      buildFileAssetBadges({
        assetClassification: 'brand',
        assetReviewStatus: 'approved',
        assetUsagePolicy: 'restricted',
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
        key: 'classification:brand',
        label: 'detail.asset.classification.brand',
        variant: 'outlined',
      },
    ]);
  });

  it('should hide default governance badges in list surfaces', () => {
    expect(
      buildFileAssetBadges({
        assetClassification: 'general',
        assetReviewStatus: 'draft',
        assetUsagePolicy: 'internal',
        t: t as any,
      }),
    ).toEqual([]);
  });
});
