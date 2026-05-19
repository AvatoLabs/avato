import { describe, expect, it } from 'vitest';

import type { MobileSpaceItem, MobileSpaceMemorySummary } from '../types';
import {
  buildMobileTeamSpaceMemorySummaryCard,
  canReviewMobileSpaceMemorySummary,
  getMobilePendingGovernanceCountFromSummary,
  getMobilePendingGovernanceTargetFromSummary,
  getMobileSpaceMemoryInitialSection,
  getMobileSpaceMemoryRecallTarget,
  getMobileSpaceMemorySectionTarget,
  isMobileTeamSpace,
} from './spaceMemorySummary';

const teamSpace: MobileSpaceItem = {
  id: 'spc_team',
  kind: 'team',
  membershipRole: 'editor',
  name: 'Ops',
};

const summary: MobileSpaceMemorySummary = {
  canCreate: true,
  canPublish: true,
  canReview: true,
  contract: {
    canAccessAudit: true,
    canCreate: true,
    canManageRecall: true,
    canViewInbox: true,
    detailViews: ['overview', 'audit'],
    recallFilters: ['all', 'active', 'disabled', 'expired', 'stale'],
    sections: ['inbox', 'published', 'playbooks', 'policies'],
  },
  id: 'spc_team',
  kind: 'team',
  membershipRole: 'editor',
  name: 'Ops',
  sections: {
    inbox: { count: 3, recall: { active: 0, disabled: 0, expired: 0, stale: 0 } },
    playbooks: { count: 2, recall: { active: 1, disabled: 1, expired: 0, stale: 0 } },
    policies: { count: 4, recall: { active: 2, disabled: 0, expired: 1, stale: 1 } },
    published: { count: 5, recall: { active: 3, disabled: 1, expired: 1, stale: 0 } },
  },
  surface: 'reviewer',
};

describe('isMobileTeamSpace', () => {
  it('returns true for team spaces only', () => {
    expect(isMobileTeamSpace(teamSpace)).toBe(true);
    expect(isMobileTeamSpace({ ...teamSpace, kind: 'personal' })).toBe(false);
  });
});

describe('buildMobileTeamSpaceMemorySummaryCard', () => {
  it('aggregates reviewed recall metrics across published sections', () => {
    expect(buildMobileTeamSpaceMemorySummaryCard(teamSpace, summary)).toMatchObject({
      counts: {
        playbooks: 2,
        policies: 4,
        published: 5,
      },
      recall: {
        active: 6,
        disabled: 2,
        expired: 2,
        stale: 1,
      },
    });
  });
});

describe('mobile governance helpers', () => {
  it('recognizes review access from the summary contract', () => {
    expect(canReviewMobileSpaceMemorySummary(summary)).toBe(true);
    expect(
      canReviewMobileSpaceMemorySummary({
        ...summary,
        contract: {
          ...summary.contract,
          canManageRecall: false,
        },
      }),
    ).toBe(false);
  });

  it('counts pending governance work across reviewed sections only for reviewers', () => {
    expect(getMobilePendingGovernanceCountFromSummary(summary)).toBe(5);
    expect(
      getMobilePendingGovernanceCountFromSummary({
        ...summary,
        contract: {
          ...summary.contract,
          canManageRecall: false,
        },
      }),
    ).toBe(0);
  });

  it('selects the first pending governance target in stale > expired > disabled order', () => {
    expect(getMobilePendingGovernanceTargetFromSummary(summary)).toEqual({
      recallFilter: 'stale',
      section: 'policies',
    });
  });
});

describe('getMobileSpaceMemoryInitialSection', () => {
  it('prefers published guidance before inbox when multiple sections are available', () => {
    expect(
      getMobileSpaceMemoryInitialSection({
        sections: ['inbox', 'published', 'playbooks', 'policies'],
      }),
    ).toBe('published');
  });

  it('falls back to the first available section when published guidance is unavailable', () => {
    expect(
      getMobileSpaceMemoryInitialSection({
        sections: ['inbox'],
      }),
    ).toBe('inbox');
  });
});

describe('drilldown targets', () => {
  const card = buildMobileTeamSpaceMemorySummaryCard(teamSpace, summary);

  it('opens section counts in the matching section without forcing a recall filter', () => {
    expect(getMobileSpaceMemorySectionTarget(card, 'inbox')).toEqual({
      recallFilter: 'all',
      section: 'inbox',
    });
    expect(getMobileSpaceMemorySectionTarget(card, 'policies')).toEqual({
      recallFilter: 'all',
      section: 'policies',
    });
  });

  it('maps recall counts to the first reviewed section that actually has matches', () => {
    expect(getMobileSpaceMemoryRecallTarget(card, 'stale')).toEqual({
      recallFilter: 'stale',
      section: 'policies',
    });
    expect(getMobileSpaceMemoryRecallTarget(card, 'disabled')).toEqual({
      recallFilter: 'disabled',
      section: 'published',
    });
  });
});
