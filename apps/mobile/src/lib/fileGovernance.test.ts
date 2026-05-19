import { describe, expect, it } from 'vitest';

import {
  buildFileGovernanceBadges,
  buildGovernanceCapabilityHint,
  buildGovernanceFilterSummaryLabels,
  countActiveGovernanceFilters,
} from './fileGovernance';

const t = new Proxy(
  {
    resourceGovernanceRightsOwnerSummary: 'Rights owner: {rightsOwner}',
  },
  {
    get: (target, property) => target[property as keyof typeof target] ?? String(property),
  },
) as never;

describe('buildFileGovernanceBadges', () => {
  it('prioritizes usage and review badges before trailing metadata', () => {
    const badges = buildFileGovernanceBadges(
      {
        assetClassification: 'legal',
        assetPrimaryRenditionKind: 'thumbnail',
        assetReviewStatus: 'approved',
        assetUsagePolicy: 'restricted',
        assetVersionLabel: 'v2.1',
      },
      t as never,
      3,
    );

    expect(badges.map((badge) => badge.key)).toEqual([
      'usage:restricted',
      'review:approved',
      expect.stringMatching(/^overflow:/),
    ]);
  });

  it('creates overflow badge with hidden titles', () => {
    const badges = buildFileGovernanceBadges(
      {
        assetClassification: 'brand',
        assetPrimaryRenditionKind: 'preview',
        assetPrimaryRenditionLabel: 'Homepage hero crop',
        assetRenditionCount: 2,
        assetReviewStatus: 'approved',
        assetUsagePolicy: 'public',
        assetVersionLabel: 'Version 2026 Spring campaign',
      },
      t as never,
      3,
    );

    expect(badges[2]?.label).toBe('+3');
    expect(badges[2]?.title).toContain('resourceGovernanceRenditionPreview');
  });
});

describe('countActiveGovernanceFilters', () => {
  it('counts non-empty filters', () => {
    expect(
      countActiveGovernanceFilters({
        assetClassification: 'legal',
        assetReviewStatus: 'approved',
        assetRightsOwner: 'Legal Team',
      }),
    ).toBe(3);
  });

  it('ignores blank rights owner filters', () => {
    expect(
      countActiveGovernanceFilters({
        assetRightsOwner: '   ',
      }),
    ).toBe(0);
  });
});

describe('buildGovernanceFilterSummaryLabels', () => {
  it('builds human-readable summary labels in stable order', () => {
    expect(
      buildGovernanceFilterSummaryLabels(
        {
          assetClassification: 'brand',
          assetReviewStatus: 'approved',
          assetRightsOwner: 'Brand Team',
          assetUsagePolicy: 'restricted',
        },
        t as never,
      ),
    ).toEqual([
      'resourceGovernanceUsageRestricted',
      'resourceGovernanceReviewApproved',
      'resourceGovernanceClassificationBrand',
      'Rights owner: Brand Team',
    ]);
  });
});

describe('buildGovernanceCapabilityHint', () => {
  it('describes read-only access', () => {
    expect(
      buildGovernanceCapabilityHint(
        { canApprove: false, canArchive: false, canEditGovernance: false },
        t as never,
      ),
    ).toBe('resourceGovernanceCapabilitiesViewerHint');
  });

  it('describes full governance access', () => {
    expect(
      buildGovernanceCapabilityHint(
        { canApprove: true, canArchive: true, canEditGovernance: true },
        t as never,
      ),
    ).toBe('resourceGovernanceCapabilitiesManagerHint');
  });
});
