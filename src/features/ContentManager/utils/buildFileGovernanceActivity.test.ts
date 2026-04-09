import { describe, expect, it } from 'vitest';

import { buildFileGovernanceActivity } from './buildFileGovernanceActivity';

describe('buildFileGovernanceActivity', () => {
  const t = (key: string) =>
    ({
      'detail.asset.classification.brand': 'Brand',
      'detail.asset.classification.label': 'Classification',
      'detail.asset.audit.file_asset_approved': 'Approved',
      'detail.asset.audit.file_asset_archived': 'Archived',
      'detail.asset.audit.file_asset_governance_updated': 'Governance updated',
      'detail.asset.none': 'None',
      'detail.asset.reviewStatus.approved': 'Approved',
      'detail.asset.reviewStatus.draft': 'Draft',
      'detail.asset.reviewStatus.label': 'Review status',
      'detail.asset.rightsOwner.label': 'Rights owner',
      'detail.asset.usagePolicy.internal': 'Internal',
      'detail.asset.usagePolicy.label': 'Usage policy',
      'detail.asset.usagePolicy.restricted': 'Restricted',
    })[key] || key;

  it('returns a compact summary and full title for governance activity', () => {
    expect(
      buildFileGovernanceActivity({
        action: 'file_asset_approved',
        actorDisplayName: 'Ops Team',
        createdAt: new Date('2026-04-05T10:00:00.000Z'),
        t: t as any,
      }),
    ).toEqual({
      label: 'Approved · 2026-04-05',
      title: 'Approved · Ops Team · 2026-04-05 18:00',
    });
  });

  it('surfaces the first governance field change in the compact summary', () => {
    expect(
      buildFileGovernanceActivity({
        action: 'file_asset_governance_updated',
        actorDisplayName: 'Legal Team',
        after: { reviewStatus: 'approved' as any, usagePolicy: 'restricted' as any },
        before: { reviewStatus: 'draft' as any, usagePolicy: 'internal' as any },
        changedFields: ['reviewStatus', 'usagePolicy'],
        createdAt: new Date('2026-04-05T10:00:00.000Z'),
        t: t as any,
      }),
    ).toEqual({
      label: 'Governance updated · Review status: Approved',
      title:
        'Governance updated · Legal Team · 2026-04-05 18:00 · Review status: Draft -> Approved · Usage policy: Internal -> Restricted',
    });
  });

  it('returns null when the summary is incomplete', () => {
    expect(buildFileGovernanceActivity({ action: null, createdAt: null, t: t as any })).toBeNull();
  });
});
