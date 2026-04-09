'use client';

import {
  canManageSpaceMemoryFromContract,
  type SpaceMemorySummary,
} from '@lobechat/types';
import { useMemo } from 'react';
import useSWR from 'swr';

import { lambdaClient } from '@/libs/trpc/client';

import { buildSpaceMemoryPath } from './paths';

export const SPACE_MEMORY_SCOPE_SUMMARIES_KEY = 'space-memory-scope-summaries';

export const REVIEWED_MEMORY_SECTIONS = ['published', 'playbooks', 'policies'] as const;
const PENDING_GOVERNANCE_FILTERS = ['stale', 'expired', 'disabled'] as const;

export type PendingGovernanceFilter = (typeof PENDING_GOVERNANCE_FILTERS)[number];

export interface PendingGovernanceTarget {
  recallFilter: PendingGovernanceFilter;
  section: (typeof REVIEWED_MEMORY_SECTIONS)[number];
}

export const canReviewSpaceMemorySummary = (summary?: SpaceMemorySummary | null) =>
  canManageSpaceMemoryFromContract(summary?.contract);

export const buildPendingGovernancePath = (spaceId: string, target: PendingGovernanceTarget) =>
  `${buildSpaceMemoryPath(spaceId, target.section)}&recallFilter=${encodeURIComponent(target.recallFilter)}`;

export const getPendingGovernanceCountFromSummary = (summary?: SpaceMemorySummary | null) => {
  if (!summary || !canReviewSpaceMemorySummary(summary)) return 0;

  return REVIEWED_MEMORY_SECTIONS.reduce((total, section) => {
    const recall = summary.sections[section].recall;

    return total + recall.disabled + recall.expired + recall.stale;
  }, 0);
};

export const getPendingGovernanceTargetFromSummary = (
  summary?: SpaceMemorySummary | null,
): PendingGovernanceTarget | null => {
  if (!summary || !canReviewSpaceMemorySummary(summary)) return null;

  for (const recallFilter of PENDING_GOVERNANCE_FILTERS) {
    for (const section of REVIEWED_MEMORY_SECTIONS) {
      if (summary.sections[section].recall[recallFilter] > 0) {
        return { recallFilter, section };
      }
    }
  }

  return null;
};

export const useTeamSpaceMemoryScopeSummaries = (
  spaces?: Array<{ id: string; kind?: 'personal' | 'team' | string | null }>,
) => {
  const teamSpaces = useMemo(
    () => spaces?.filter((space) => space.kind === 'team') ?? [],
    [spaces],
  );
  const teamSpaceIds = useMemo(() => teamSpaces.map((space) => space.id), [teamSpaces]);
  const { data, isLoading } = useSWR(
    teamSpaceIds.length > 0 ? [SPACE_MEMORY_SCOPE_SUMMARIES_KEY, ...teamSpaceIds] : null,
    () =>
      Promise.all(
        teamSpaces.map(
          async (space) =>
            [
              space.id,
              await lambdaClient.spaceMemory.getSummary.query({ spaceId: space.id }),
            ] as const,
        ),
      ),
    {
      revalidateOnFocus: false,
    },
  );

  const spaceSummaryMap = useMemo(() => new Map(data ?? []), [data]);
  const pendingGovernanceCountBySpaceId = useMemo(
    () =>
      new Map(
        teamSpaceIds.map((spaceId) => [
          spaceId,
          getPendingGovernanceCountFromSummary(spaceSummaryMap.get(spaceId)),
        ]),
      ),
    [spaceSummaryMap, teamSpaceIds],
  );
  const pendingGovernanceTargetBySpaceId = useMemo(
    () =>
      new Map(
        teamSpaceIds.map((spaceId) => [
          spaceId,
          getPendingGovernanceTargetFromSummary(spaceSummaryMap.get(spaceId)),
        ]),
      ),
    [spaceSummaryMap, teamSpaceIds],
  );

  return {
    isLoading,
    pendingGovernanceCountBySpaceId,
    pendingGovernanceTargetBySpaceId,
    spaceSummaryMap,
  };
};
