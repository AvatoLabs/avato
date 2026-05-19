import type {
  MobileSpaceItem,
  MobileSpaceMemoryRecallFilter,
  MobileSpaceMemorySection,
  MobileSpaceMemorySummary,
  MobileSpaceMemorySurfaceContract,
} from '../types';

export interface MobileTeamSpaceMemorySummaryCard {
  counts: Record<Exclude<MobileSpaceMemorySection, 'inbox'>, number>;
  recall: {
    active: number;
    disabled: number;
    expired: number;
    stale: number;
  };
  space: MobileSpaceItem;
  summary: MobileSpaceMemorySummary;
}

export interface MobileSpaceMemoryDrilldownTarget {
  recallFilter: MobileSpaceMemoryRecallFilter;
  section: MobileSpaceMemorySection;
}

const REVIEWED_MEMORY_SECTIONS: Array<Exclude<MobileSpaceMemorySection, 'inbox'>> = [
  'published',
  'playbooks',
  'policies',
];
const PENDING_GOVERNANCE_FILTERS: Array<Exclude<MobileSpaceMemoryRecallFilter, 'active' | 'all'>> = [
  'stale',
  'expired',
  'disabled',
];

const MOBILE_SPACE_MEMORY_SECTION_PRIORITY: MobileSpaceMemorySection[] = [
  'published',
  'playbooks',
  'policies',
  'inbox',
];

export const isMobileTeamSpace = (space: MobileSpaceItem) => space.kind === 'team';

export const canReviewMobileSpaceMemorySummary = (summary?: MobileSpaceMemorySummary | null) =>
  !!summary?.contract.canManageRecall;

export const getMobileSpaceMemoryInitialSection = (
  contract?: Pick<MobileSpaceMemorySurfaceContract, 'sections'> | null,
): MobileSpaceMemorySection =>
  MOBILE_SPACE_MEMORY_SECTION_PRIORITY.find((section) => contract?.sections.includes(section)) ||
  contract?.sections[0] ||
  'published';

export const getMobileSpaceMemorySectionTarget = (
  card: MobileTeamSpaceMemorySummaryCard,
  section: MobileSpaceMemorySection,
): MobileSpaceMemoryDrilldownTarget => ({
  recallFilter: 'all',
  section,
});

export const getMobileSpaceMemoryRecallTarget = (
  card: MobileTeamSpaceMemorySummaryCard,
  recallFilter: MobileSpaceMemoryRecallFilter,
): MobileSpaceMemoryDrilldownTarget => {
  const availableSections = REVIEWED_MEMORY_SECTIONS.filter((section) =>
    card.summary.contract.sections.includes(section),
  );
  const fallbackSection = getMobileSpaceMemoryInitialSection(card.summary.contract);
  const targetSection =
    availableSections.find((section) =>
      recallFilter === 'all'
        ? card.summary.sections[section].count > 0
        : card.summary.sections[section].recall[recallFilter] > 0,
    ) || fallbackSection;

  return {
    recallFilter:
      targetSection === 'inbox' || !card.summary.contract.recallFilters.includes(recallFilter)
        ? 'all'
        : recallFilter,
    section: targetSection,
  };
};

export const getMobilePendingGovernanceCountFromSummary = (
  summary?: MobileSpaceMemorySummary | null,
) => {
  if (!summary || !canReviewMobileSpaceMemorySummary(summary)) return 0;

  return REVIEWED_MEMORY_SECTIONS.reduce((total, section) => {
    const recall = summary.sections[section].recall;

    return total + recall.disabled + recall.expired + recall.stale;
  }, 0);
};

export const getMobilePendingGovernanceTargetFromSummary = (
  summary?: MobileSpaceMemorySummary | null,
): MobileSpaceMemoryDrilldownTarget | null => {
  if (!summary || !canReviewMobileSpaceMemorySummary(summary)) return null;

  for (const recallFilter of PENDING_GOVERNANCE_FILTERS) {
    for (const section of REVIEWED_MEMORY_SECTIONS) {
      if (summary.sections[section].recall[recallFilter] > 0) {
        return { recallFilter, section };
      }
    }
  }

  return null;
};

export function buildMobileTeamSpaceMemorySummaryCard(
  space: MobileSpaceItem,
  summary: MobileSpaceMemorySummary,
): MobileTeamSpaceMemorySummaryCard {
  const counts = {
    playbooks: summary.sections.playbooks.count,
    policies: summary.sections.policies.count,
    published: summary.sections.published.count,
  };

  const recall = REVIEWED_MEMORY_SECTIONS.reduce(
    (acc, section) => {
      const current = summary.sections[section].recall;

      return {
        active: acc.active + current.active,
        disabled: acc.disabled + current.disabled,
        expired: acc.expired + current.expired,
        stale: acc.stale + current.stale,
      };
    },
    { active: 0, disabled: 0, expired: 0, stale: 0 },
  );

  return {
    counts,
    recall,
    space,
    summary,
  };
}
