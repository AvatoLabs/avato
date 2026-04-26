import { useCallback, useMemo, useState } from 'react';

import type { ResourceQueryParams } from '../lib/api';
import {
  countActiveGovernanceFilters,
  type MobileGovernanceFilterState,
  normalizeGovernanceRightsOwner,
} from '../lib/fileGovernance';
import { haptics } from '../lib/haptics';

interface ResourceGovernanceMessages {
  resourceGovernanceAny: string;
  resourceGovernanceClassificationBrand: string;
  resourceGovernanceClassificationFinance: string;
  resourceGovernanceClassificationGeneral: string;
  resourceGovernanceClassificationHr: string;
  resourceGovernanceClassificationLegal: string;
  resourceGovernanceClassificationProduct: string;
  resourceGovernanceReviewApproved: string;
  resourceGovernanceReviewArchived: string;
  resourceGovernanceReviewDraft: string;
  resourceGovernanceRightsOwnerSummary: string;
  resourceGovernanceSectionClassification: string;
  resourceGovernanceSectionReview: string;
  resourceGovernanceSectionUsage: string;
  resourceGovernanceUsageInternal: string;
  resourceGovernanceUsagePublic: string;
  resourceGovernanceUsageRestricted: string;
}

function normalizeGovernanceFilterState(filters: MobileGovernanceFilterState) {
  const rightsOwner = normalizeGovernanceRightsOwner(filters.assetRightsOwner);

  return {
    ...(filters.assetReviewStatus ? { assetReviewStatus: filters.assetReviewStatus } : {}),
    ...(filters.assetUsagePolicy ? { assetUsagePolicy: filters.assetUsagePolicy } : {}),
    ...(filters.assetClassification ? { assetClassification: filters.assetClassification } : {}),
    ...(rightsOwner ? { assetRightsOwner: rightsOwner } : {}),
  } satisfies MobileGovernanceFilterState;
}

function areGovernanceFilterStatesEqual(
  left: MobileGovernanceFilterState,
  right: MobileGovernanceFilterState,
) {
  const normalizedLeft = normalizeGovernanceFilterState(left);
  const normalizedRight = normalizeGovernanceFilterState(right);

  return (
    normalizedLeft.assetReviewStatus === normalizedRight.assetReviewStatus &&
    normalizedLeft.assetUsagePolicy === normalizedRight.assetUsagePolicy &&
    normalizedLeft.assetClassification === normalizedRight.assetClassification &&
    normalizedLeft.assetRightsOwner === normalizedRight.assetRightsOwner
  );
}

export function useResourceGovernanceFilters({
  enabled,
  messages,
}: {
  enabled: boolean;
  messages: ResourceGovernanceMessages;
}) {
  const [governanceSheetVisible, setGovernanceSheetVisible] = useState(false);
  const [governanceFilters, setGovernanceFilters] = useState<MobileGovernanceFilterState>({});
  const [governanceDraft, setGovernanceDraft] = useState<MobileGovernanceFilterState>({});

  const normalizedGovernanceFilters = useMemo(
    () => ({
      ...governanceFilters,
      assetRightsOwner: normalizeGovernanceRightsOwner(governanceFilters.assetRightsOwner),
    }),
    [governanceFilters],
  );
  const releasedGovernanceFilters = useMemo(
    () =>
      enabled
        ? normalizedGovernanceFilters
        : ({} satisfies Pick<
            ResourceQueryParams,
            'assetClassification' | 'assetReviewStatus' | 'assetRightsOwner' | 'assetUsagePolicy'
          >),
    [enabled, normalizedGovernanceFilters],
  );

  const activeGovernanceFilterCount = useMemo(
    () => countActiveGovernanceFilters(governanceFilters),
    [governanceFilters],
  );
  const draftGovernanceFilterCount = useMemo(
    () => countActiveGovernanceFilters(governanceDraft),
    [governanceDraft],
  );
  const normalizedGovernanceDraft = useMemo(
    () => normalizeGovernanceFilterState(governanceDraft),
    [governanceDraft],
  );
  const hasGovernanceDraftChanges = useMemo(
    () => !areGovernanceFilterStatesEqual(governanceFilters, governanceDraft),
    [governanceDraft, governanceFilters],
  );
  const governanceFilterSummaryLabels = useMemo(() => {
    const labels: string[] = [];

    if (governanceFilters.assetUsagePolicy) {
      labels.push(
        governanceFilters.assetUsagePolicy === 'public'
          ? messages.resourceGovernanceUsagePublic
          : governanceFilters.assetUsagePolicy === 'restricted'
            ? messages.resourceGovernanceUsageRestricted
            : messages.resourceGovernanceUsageInternal,
      );
    }

    if (governanceFilters.assetReviewStatus) {
      labels.push(
        governanceFilters.assetReviewStatus === 'approved'
          ? messages.resourceGovernanceReviewApproved
          : governanceFilters.assetReviewStatus === 'archived'
            ? messages.resourceGovernanceReviewArchived
            : messages.resourceGovernanceReviewDraft,
      );
    }

    if (governanceFilters.assetClassification) {
      labels.push(
        governanceFilters.assetClassification === 'brand'
          ? messages.resourceGovernanceClassificationBrand
          : governanceFilters.assetClassification === 'finance'
            ? messages.resourceGovernanceClassificationFinance
            : governanceFilters.assetClassification === 'hr'
              ? messages.resourceGovernanceClassificationHr
              : governanceFilters.assetClassification === 'legal'
                ? messages.resourceGovernanceClassificationLegal
                : governanceFilters.assetClassification === 'product'
                  ? messages.resourceGovernanceClassificationProduct
                  : messages.resourceGovernanceClassificationGeneral,
      );
    }

    const rightsOwner = normalizeGovernanceRightsOwner(governanceFilters.assetRightsOwner);
    if (rightsOwner) {
      labels.push(
        messages.resourceGovernanceRightsOwnerSummary.replace('{rightsOwner}', rightsOwner),
      );
    }

    return labels;
  }, [governanceFilters, messages]);

  const buildGovernanceFilterTokens = useCallback(
    (filters: MobileGovernanceFilterState) => {
      const normalized = normalizeGovernanceFilterState(filters);
      const tokens: Array<{
        key: keyof MobileGovernanceFilterState;
        label: string;
        tone: 'accent' | 'neutral' | 'success';
      }> = [];

      if (normalized.assetReviewStatus) {
        tokens.push({
          key: 'assetReviewStatus',
          label:
            normalized.assetReviewStatus === 'approved'
              ? messages.resourceGovernanceReviewApproved
              : normalized.assetReviewStatus === 'archived'
                ? messages.resourceGovernanceReviewArchived
                : messages.resourceGovernanceReviewDraft,
          tone: normalized.assetReviewStatus === 'approved' ? 'success' : 'neutral',
        });
      }

      if (normalized.assetUsagePolicy) {
        tokens.push({
          key: 'assetUsagePolicy',
          label:
            normalized.assetUsagePolicy === 'public'
              ? messages.resourceGovernanceUsagePublic
              : normalized.assetUsagePolicy === 'restricted'
                ? messages.resourceGovernanceUsageRestricted
                : messages.resourceGovernanceUsageInternal,
          tone: normalized.assetUsagePolicy === 'restricted' ? 'neutral' : 'accent',
        });
      }

      if (normalized.assetClassification) {
        tokens.push({
          key: 'assetClassification',
          label:
            normalized.assetClassification === 'brand'
              ? messages.resourceGovernanceClassificationBrand
              : normalized.assetClassification === 'finance'
                ? messages.resourceGovernanceClassificationFinance
                : normalized.assetClassification === 'hr'
                  ? messages.resourceGovernanceClassificationHr
                  : normalized.assetClassification === 'legal'
                    ? messages.resourceGovernanceClassificationLegal
                    : normalized.assetClassification === 'product'
                      ? messages.resourceGovernanceClassificationProduct
                      : messages.resourceGovernanceClassificationGeneral,
          tone: 'neutral',
        });
      }

      if (normalized.assetRightsOwner) {
        tokens.push({
          key: 'assetRightsOwner',
          label: messages.resourceGovernanceRightsOwnerSummary.replace(
            '{rightsOwner}',
            normalized.assetRightsOwner,
          ),
          tone: 'accent',
        });
      }

      return tokens;
    },
    [messages],
  );

  const governanceActiveTokens = useMemo(
    () => buildGovernanceFilterTokens(governanceFilters),
    [buildGovernanceFilterTokens, governanceFilters],
  );
  const governanceDraftTokens = useMemo(
    () => buildGovernanceFilterTokens(normalizedGovernanceDraft),
    [buildGovernanceFilterTokens, normalizedGovernanceDraft],
  );

  const governanceSections = useMemo(
    () =>
      [
        {
          key: 'assetReviewStatus',
          label: messages.resourceGovernanceSectionReview,
          options: [
            { label: messages.resourceGovernanceAny, value: undefined },
            { label: messages.resourceGovernanceReviewDraft, value: 'draft' },
            { label: messages.resourceGovernanceReviewApproved, value: 'approved' },
            { label: messages.resourceGovernanceReviewArchived, value: 'archived' },
          ],
        },
        {
          key: 'assetUsagePolicy',
          label: messages.resourceGovernanceSectionUsage,
          options: [
            { label: messages.resourceGovernanceAny, value: undefined },
            { label: messages.resourceGovernanceUsageInternal, value: 'internal' },
            { label: messages.resourceGovernanceUsagePublic, value: 'public' },
            { label: messages.resourceGovernanceUsageRestricted, value: 'restricted' },
          ],
        },
        {
          key: 'assetClassification',
          label: messages.resourceGovernanceSectionClassification,
          options: [
            { label: messages.resourceGovernanceAny, value: undefined },
            { label: messages.resourceGovernanceClassificationGeneral, value: 'general' },
            { label: messages.resourceGovernanceClassificationBrand, value: 'brand' },
            { label: messages.resourceGovernanceClassificationFinance, value: 'finance' },
            { label: messages.resourceGovernanceClassificationHr, value: 'hr' },
            { label: messages.resourceGovernanceClassificationLegal, value: 'legal' },
            { label: messages.resourceGovernanceClassificationProduct, value: 'product' },
          ],
        },
      ] as const,
    [messages],
  );

  const governanceQuickFilters = useMemo(
    () =>
      [
        {
          key: 'assetReviewStatus',
          label: messages.resourceGovernanceReviewDraft,
          value: 'draft',
        },
        {
          key: 'assetReviewStatus',
          label: messages.resourceGovernanceReviewApproved,
          value: 'approved',
        },
        {
          key: 'assetUsagePolicy',
          label: messages.resourceGovernanceUsageRestricted,
          value: 'restricted',
        },
        {
          key: 'assetUsagePolicy',
          label: messages.resourceGovernanceUsagePublic,
          value: 'public',
        },
      ] as const,
    [messages],
  );

  const openGovernanceSheet = useCallback(() => {
    setGovernanceDraft(governanceFilters);
    setGovernanceSheetVisible(true);
  }, [governanceFilters]);

  const closeGovernanceSheet = useCallback(() => setGovernanceSheetVisible(false), []);

  const clearGovernanceDraft = useCallback(() => {
    setGovernanceDraft({});
  }, []);

  const clearGovernanceFilters = useCallback(() => {
    haptics.selection();
    setGovernanceFilters({});
  }, []);

  const toggleQuickGovernanceFilter = useCallback(
    (
      key: 'assetReviewStatus' | 'assetUsagePolicy',
      value: 'approved' | 'draft' | 'internal' | 'public' | 'restricted',
    ) => {
      haptics.selection();
      setGovernanceFilters((prev) =>
        normalizeGovernanceFilterState({
          ...prev,
          [key]: prev[key] === value ? undefined : value,
        } as MobileGovernanceFilterState),
      );
    },
    [],
  );

  const removeGovernanceFilter = useCallback((key: keyof MobileGovernanceFilterState) => {
    haptics.selection();
    setGovernanceFilters((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const removeGovernanceDraftFilter = useCallback((key: keyof MobileGovernanceFilterState) => {
    haptics.selection();
    setGovernanceDraft((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const applyGovernanceFilters = useCallback(() => {
    haptics.selection();
    setGovernanceFilters(normalizedGovernanceDraft);
    setGovernanceSheetVisible(false);
  }, [normalizedGovernanceDraft]);

  return {
    activeGovernanceFilterCount,
    applyGovernanceFilters,
    clearGovernanceDraft,
    clearGovernanceFilters,
    closeGovernanceSheet,
    draftGovernanceFilterCount,
    governanceActiveTokens,
    governanceDraft,
    governanceDraftTokens,
    governanceFilterSummaryLabels,
    governanceFilters,
    governanceQuickFilters,
    governanceSections,
    governanceSheetVisible,
    hasGovernanceDraftChanges,
    openGovernanceSheet,
    removeGovernanceDraftFilter,
    removeGovernanceFilter,
    releasedGovernanceFilters,
    setGovernanceDraft,
    toggleQuickGovernanceFilter,
  };
}
