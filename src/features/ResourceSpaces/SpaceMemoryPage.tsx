'use client';

import {
  canManageSpaceMemoryFromContract,
  getSpaceMemorySurfaceContract,
  spaceMemoryCategories,
  type SpaceMemoryCategory,
  type SpaceMemoryEntryResult,
  type SpaceMemoryEntryPreview,
  type SpaceMemorySection,
  spaceMemorySections,
} from '@lobechat/types';
import { exportFile, exportJSONFile } from '@lobechat/utils/client';
import { Block, Button, Flexbox, Segmented, Tag, Text } from '@lobehub/ui';
import { App, Checkbox, Drawer, Input } from 'antd';
import { createStyles } from 'antd-style';
import { InboxIcon, LibraryBigIcon, ScrollTextIcon, ShieldCheckIcon } from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import useSWR, { useSWRConfig } from 'swr';

import Loading from '@/components/Loading/BrandTextLoading';
import { useIsMobile } from '@/hooks/useIsMobile';
import { lambdaClient } from '@/libs/trpc/client';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/slices/auth/selectors';
import { sanitizeFileName } from '@/utils/sanitizeFileName';

import MemoryScopeSection from './MemoryScopeSection';
import { buildSpaceMemoryAuditPath, buildSpaceMemoryPath, buildSpaceRootPath } from './paths';
import { resolveSpaceDisplayName } from './resolveSpaceDisplayName';
import SurfaceBreadcrumb from './SurfaceBreadcrumb';

const useStyles = createStyles(({ css, token }) => ({
  entryHistoryStrip: css`
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 10px 12px;
    border-radius: ${token.borderRadius}px;
    background: ${token.colorFillSecondary};
  `,
  entryHistoryList: css`
    display: grid;
    gap: 8px;
    margin-top: 8px;
  `,
  entryHistoryItem: css`
    padding-inline-start: 12px;
    border-inline-start: 2px solid ${token.colorBorderSecondary};
  `,
  compareBlock: css`
    display: grid;
    gap: 10px;
    margin-top: 8px;
    padding: 12px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorFillQuaternary};
  `,
  compareColumns: css`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;

    @media (max-width: 640px) {
      grid-template-columns: minmax(0, 1fr);
    }
  `,
  compareLabel: css`
    color: ${token.colorTextSecondary};
    font-size: 12px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  `,
  compareValue: css`
    white-space: pre-wrap;
    word-break: break-word;
  `,
  memoryEntry: css`
    min-width: 0;
    padding: 16px 18px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorBgContainer};
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease,
      background 0.2s ease;
  `,
  memoryEntryFocused: css`
    border-color: ${token.colorPrimaryBorder};
    box-shadow: 0 0 0 2px ${token.colorPrimaryBorderHover};
    background: ${token.colorPrimaryBg};
  `,
  memoryEntryList: css`
    display: grid;
    gap: 12px;
  `,
  sourceRefList: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  `,
  detailBlock: css`
    display: grid;
    gap: 10px;
    padding: 14px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorBgContainer};
  `,
  detailLabel: css`
    color: ${token.colorTextSecondary};
    font-size: 12px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  `,
  page: css`
    overflow: auto;
    flex: 1;
    min-width: 0;
    height: 100%;
    padding: 28px;

    @media (max-width: 640px) {
      padding: 20px 16px;
    }
  `,
  scopeRail: css`
    position: sticky;
    inset-block-start: 0;
    flex: none;
    width: 248px;
    align-self: flex-start;
  `,
}));

interface BatchActionResult {
  id: string;
  reason?: 'already_reviewed' | 'already_stale' | 'not_found' | 'not_published' | 'outside_space';
  reviewedBy?: string;
  status: 'archived' | 'published' | 'revalidated' | 'skipped' | 'stale';
}

interface MergeResolutionState {
  appendSources: boolean;
  applyContent: boolean;
  applySummary: boolean;
  applyTitle: boolean;
}

type SpaceMemoryDetailView = 'audit' | 'overview';
type RecallFilterMode = 'active' | 'all' | 'disabled' | 'expired' | 'stale';

interface RecallPolicyDraftState {
  expiresAt: string;
  lastVerifiedAt: string | null;
  recallEnabled: boolean;
  staleAt: string | null;
}

const emptyRecallSummary = {
  active: 0,
  disabled: 0,
  expired: 0,
  stale: 0,
};

const padDateSegment = (value: number) => String(value).padStart(2, '0');

const toDateTimeLocalInput = (value?: string | null) => {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return `${date.getFullYear()}-${padDateSegment(date.getMonth() + 1)}-${padDateSegment(
    date.getDate(),
  )}T${padDateSegment(date.getHours())}:${padDateSegment(date.getMinutes())}`;
};

const fromDateTimeLocalInput = (value: string) => {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
};

const parseRecallFilterMode = (value?: string | null): RecallFilterMode => {
  switch (value) {
    case 'active':
    case 'disabled':
    case 'expired':
    case 'stale': {
      return value;
    }
    default: {
      return 'all';
    }
  }
};

const matchesRecallFilter = (entry: SpaceMemoryEntryPreview, filter: RecallFilterMode) => {
  if (filter === 'all') return true;
  if (filter === 'active') return !entry.recall?.recallBlockedReason;

  return entry.recall?.recallBlockedReason === filter;
};

const getAuditRecallFilter = (
  entry: SpaceMemoryEntryPreview,
  recallFilter: RecallFilterMode,
): RecallFilterMode => {
  if (getSectionForEntry(entry) === 'inbox') return 'all';

  return recallFilter;
};

const getSectionForCategory = (category: SpaceMemoryCategory): SpaceMemorySection => {
  switch (category) {
    case 'playbook': {
      return 'playbooks';
    }
    case 'policy': {
      return 'policies';
    }
    default: {
      return 'published';
    }
  }
};

const getSectionForEntry = (entry: SpaceMemoryEntryPreview): SpaceMemorySection => {
  if (entry.kind === 'candidate') return 'inbox';

  return getSectionForCategory(entry.category);
};

const SpaceMemoryPage = memo(() => {
  const { t } = useTranslation(['common', 'file']);
  const { styles } = useStyles();
  const { message } = App.useApp();
  const { mutate } = useSWRConfig();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [mergingId, setMergingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [exportingAudit, setExportingAudit] = useState(false);
  const [exportingSelectedAudits, setExportingSelectedAudits] = useState(false);
  const [exportingSelectedAuditSummary, setExportingSelectedAuditSummary] = useState(false);
  const [batchAction, setBatchAction] = useState<
    'publish' | 'reject' | 'revalidate' | 'stale' | null
  >(null);
  const [expandedHistoryEntryIds, setExpandedHistoryEntryIds] = useState<string[]>([]);
  const [mergeResolutions, setMergeResolutions] = useState<Record<string, MergeResolutionState>>(
    {},
  );
  const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [savingRecallPolicy, setSavingRecallPolicy] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftSummary, setDraftSummary] = useState('');
  const [draftCategory, setDraftCategory] = useState<SpaceMemoryCategory>('general');
  const [recallPolicyDraft, setRecallPolicyDraft] = useState<RecallPolicyDraftState | null>(null);
  const { entryId: routeEntryId, spaceId } = useParams<{ entryId?: string; spaceId?: string }>();
  const username = useUserStore(userProfileSelectors.username);
  const fullName = useUserStore(userProfileSelectors.fullName);
  const isMobile = useIsMobile();
  const entryRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const { data: summary, isLoading } = useSWR(
    spaceId ? ['space-memory-summary', spaceId] : null,
    () => lambdaClient.spaceMemory.getSummary.query({ spaceId: spaceId! }),
    { revalidateOnFocus: false },
  );

  const sections = [
    {
      description: t('space.memory.sections.inbox.description', { ns: 'file' }),
      icon: InboxIcon,
      key: 'inbox',
      title: t('space.memory.sections.inbox.title', { ns: 'file' }),
    },
    {
      description: t('space.memory.sections.published.description', { ns: 'file' }),
      icon: LibraryBigIcon,
      key: 'published',
      title: t('space.memory.sections.published.title', { ns: 'file' }),
    },
    {
      description: t('space.memory.sections.playbooks.description', { ns: 'file' }),
      icon: ScrollTextIcon,
      key: 'playbooks',
      title: t('space.memory.sections.playbooks.title', { ns: 'file' }),
    },
    {
      description: t('space.memory.sections.policies.description', { ns: 'file' }),
      icon: ShieldCheckIcon,
      key: 'policies',
      title: t('space.memory.sections.policies.title', { ns: 'file' }),
    },
  ] as {
    description: string;
    icon: typeof InboxIcon;
    key: SpaceMemorySection;
    title: string;
  }[];
  const sectionParam = searchParams.get('section');
  const requestedSection = spaceMemorySections.includes(sectionParam as SpaceMemorySection)
    ? (sectionParam as SpaceMemorySection)
    : 'inbox';
  const summaryContract = summary
    ? (summary.contract ?? getSpaceMemorySurfaceContract(summary.surface))
    : undefined;
  const visibleSections = !summary
    ? sections
    : sections.filter((item) => summaryContract?.sections.includes(item.key) ?? true);
  const fallbackSection = visibleSections[0]?.key ?? 'published';
  const section = visibleSections.some((item) => item.key === requestedSection)
    ? requestedSection
    : fallbackSection;
  const activeSection = visibleSections.find((item) => item.key === section) ?? sections[0];
  const detailEntryId = routeEntryId ?? searchParams.get('detail');
  const detailView = routeEntryId
    ? 'audit'
    : searchParams.get('detailView') === 'audit'
      ? 'audit'
      : 'overview';
  const focusedEntryId = searchParams.get('focus');
  const recallFilter: RecallFilterMode = parseRecallFilterMode(searchParams.get('recallFilter'));
  const { data: sectionEntries } = useSWR(
    spaceId && summary ? ['space-memory-section', spaceId, section] : null,
    () =>
      lambdaClient.spaceMemory.listEntries.query({
        section,
        spaceId: spaceId!,
      }),
    { revalidateOnFocus: false },
  );
  const sectionSurface = sectionEntries?.surface ?? summary?.surface;
  const sectionContract =
    (sectionEntries?.contract ??
      (sectionSurface ? getSpaceMemorySurfaceContract(sectionSurface) : undefined)) ??
    summaryContract;
  const sectionEntryList = sectionEntries?.items ?? [];
  const sectionDetailEntry = detailEntryId
    ? (sectionEntryList.find((entry) => entry.id === detailEntryId) ?? null)
    : null;
  const { data: fetchedDetailResult, error: detailEntryError } = useSWR<SpaceMemoryEntryResult>(
    spaceId && detailEntryId && !sectionDetailEntry
      ? ['space-memory-entry', spaceId, detailEntryId]
      : null,
    () =>
      lambdaClient.spaceMemory.getEntry.query({
        id: detailEntryId!,
        spaceId: spaceId!,
      }),
    { revalidateOnFocus: false },
  );
  const fetchedDetailEntry = fetchedDetailResult?.entry;
  const detailSurface =
    fetchedDetailResult?.surface ?? (sectionDetailEntry ? sectionSurface : summary?.surface);
  const detailContract =
    fetchedDetailResult?.contract ??
    (detailSurface ? getSpaceMemorySurfaceContract(detailSurface) : undefined);

  useEffect(() => {
    if (!summary) return;
    if (sectionParam === section) return;

    const next = new URLSearchParams(searchParams);
    next.set('section', section);
    setSearchParams(next, { replace: true });
  }, [searchParams, section, sectionParam, setSearchParams, summary]);

  useEffect(() => {
    setSelectedEntryIds([]);
  }, [recallFilter, section, spaceId]);

  useEffect(() => {
    if (!summary) return;
    if (summaryContract?.detailViews.includes('audit') && summaryContract.recallFilters.length > 1)
      return;

    const next = new URLSearchParams(searchParams);
    let changed = false;

    if (next.has('recallFilter') && !(summaryContract?.recallFilters.includes(recallFilter) ?? true)) {
      next.delete('recallFilter');
      changed = true;
    }

    if (
      next.get('detailView') === 'audit' &&
      !(summaryContract?.detailViews.includes('audit') ?? false)
    ) {
      next.delete('detailView');
      changed = true;
    }

    if (!changed) return;

    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, summary]);

  useEffect(() => {
    const entries = sectionEntries?.items ?? [];

    if (!focusedEntryId) return;
    if (!entries.some((entry) => entry.id === focusedEntryId)) return;

    const element = entryRefs.current[focusedEntryId];
    if (!element) return;

    element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [focusedEntryId, sectionEntries]);

  useEffect(() => {
    if (!detailEntryId) return;
    if (sectionDetailEntry || fetchedDetailEntry) return;
    if (!detailEntryError) return;

    const next = new URLSearchParams(searchParams);
    next.delete('detail');
    setSearchParams(next, { replace: true });
  }, [
    detailEntryError,
    detailEntryId,
    fetchedDetailEntry,
    searchParams,
    sectionDetailEntry,
    setSearchParams,
  ]);

  const entryList = sectionEntryList;
  const detailEntry = sectionDetailEntry ?? fetchedDetailEntry ?? null;
  const supportsRecallFilter = section !== 'inbox' && (sectionContract?.recallFilters.length ?? 0) > 1;
  const effectiveRecallFilter: RecallFilterMode =
    supportsRecallFilter && (sectionContract?.recallFilters.includes(recallFilter) ?? false)
      ? recallFilter
      : 'all';
  const visibleEntryList = supportsRecallFilter
    ? entryList.filter((entry) => matchesRecallFilter(entry, effectiveRecallFilter))
    : entryList;

  useEffect(() => {
    if (!detailEntry) return;

    const targetSection = getSectionForEntry(detailEntry);
    if (section === targetSection) return;

    const next = new URLSearchParams(searchParams);
    next.set('detail', detailEntry.id);
    next.set('section', targetSection);
    setSearchParams(next, { replace: true });
  }, [detailEntry, searchParams, section, setSearchParams]);

  useEffect(() => {
    if (detailEntry?.kind !== 'memory') {
      setRecallPolicyDraft(null);
      return;
    }

    setRecallPolicyDraft({
      expiresAt: toDateTimeLocalInput(detailEntry.recall?.expiresAt),
      lastVerifiedAt: detailEntry.recall?.lastVerifiedAt ?? detailEntry.publishedAt ?? null,
      recallEnabled: detailEntry.recall?.recallEnabled ?? true,
      staleAt: detailEntry.recall?.staleAt ?? null,
    });
  }, [
    detailEntry?.id,
    detailEntry?.kind,
    detailEntry?.publishedAt,
    detailEntry?.recall?.expiresAt,
    detailEntry?.recall?.lastVerifiedAt,
    detailEntry?.recall?.recallEnabled,
    detailEntry?.recall?.staleAt,
  ]);

  if (!spaceId) return null;
  if (isLoading) return <Loading debugId="SpaceMemoryPage" />;
  if (!summary) return null;

  const isTeamSpace = summary.kind === 'team';
  const canReview = canManageSpaceMemoryFromContract(summaryContract);
  const sectionCanReview = canManageSpaceMemoryFromContract(sectionContract);
  const detailCanReview = canManageSpaceMemoryFromContract(detailContract);
  const canCreate = summary.canCreate;
  const displayName = resolveSpaceDisplayName(summary, t, { fullName, username });
  const getSectionRecallSummary = (targetSection: SpaceMemorySection) =>
    summary.sections[targetSection].recall ?? emptyRecallSummary;
  const recallOverview = supportsRecallFilter && sectionCanReview
    ? [
        {
          count: getSectionRecallSummary(section).active,
          label: t('space.memory.filters.recall.active', { ns: 'file' }),
          value: 'active' as RecallFilterMode,
        },
        {
          count: getSectionRecallSummary(section).disabled,
          label: t('space.memory.filters.recall.disabled', { ns: 'file' }),
          value: 'disabled' as RecallFilterMode,
        },
        {
          count: getSectionRecallSummary(section).expired,
          label: t('space.memory.filters.recall.expired', { ns: 'file' }),
          value: 'expired' as RecallFilterMode,
        },
        {
          count: getSectionRecallSummary(section).stale,
          label: t('space.memory.filters.recall.stale', { ns: 'file' }),
          value: 'stale' as RecallFilterMode,
        },
      ]
    : [];
  const reviewedSectionRecallSummaries = visibleSections
    .filter((item) => item.key !== 'inbox')
    .map((item) => ({
      count: summary.sections[item.key].count,
      key: item.key,
      recall: getSectionRecallSummary(item.key),
      title: item.title,
    }));
  const workspaceRecallOverview =
    canReview && reviewedSectionRecallSummaries.length > 0
      ? [
          {
            count: reviewedSectionRecallSummaries.reduce(
              (total, item) => total + item.recall.active,
              0,
            ),
            label: t('space.memory.filters.recall.active', { ns: 'file' }),
            value: 'active' as RecallFilterMode,
          },
          {
            count: reviewedSectionRecallSummaries.reduce(
              (total, item) => total + item.recall.disabled,
              0,
            ),
            label: t('space.memory.filters.recall.disabled', { ns: 'file' }),
            value: 'disabled' as RecallFilterMode,
          },
          {
            count: reviewedSectionRecallSummaries.reduce(
              (total, item) => total + item.recall.expired,
              0,
            ),
            label: t('space.memory.filters.recall.expired', { ns: 'file' }),
            value: 'expired' as RecallFilterMode,
          },
          {
            count: reviewedSectionRecallSummaries.reduce(
              (total, item) => total + item.recall.stale,
              0,
            ),
            label: t('space.memory.filters.recall.stale', { ns: 'file' }),
            value: 'stale' as RecallFilterMode,
          },
        ]
      : [];

  const focusReviewedEntry = (params: {
    category: SpaceMemoryCategory;
    detailView?: SpaceMemoryDetailView;
    entryId: string;
    openDetail?: boolean;
  }) => {
    const next = new URLSearchParams(searchParams);
    if (params.openDetail) {
      next.set('detail', params.entryId);
      if (params.detailView) next.set('detailView', params.detailView);
      else next.delete('detailView');
    }
    next.set('focus', params.entryId);
    next.set('section', getSectionForCategory(params.category));
    setSearchParams(next, { replace: true });
  };

  const openDetailEntry = (entryId: string, options?: { view?: SpaceMemoryDetailView }) => {
    const next = new URLSearchParams(searchParams);
    next.set('detail', entryId);
    if (options?.view) next.set('detailView', options.view);
    else next.delete('detailView');
    setSearchParams(next, { replace: true });
  };

  const closeDetailDrawer = () => {
    if (routeEntryId) {
      navigate(
        buildSpaceMemoryPath(summary!.id, detailEntry ? getSectionForEntry(detailEntry) : section),
      );
      return;
    }

    const next = new URLSearchParams(searchParams);
    next.delete('detail');
    next.delete('detailView');
    setSearchParams(next, { replace: true });
  };

  const setDetailView = (nextView: SpaceMemoryDetailView) => {
    const next = new URLSearchParams(searchParams);
    next.set('detailView', nextView);
    setSearchParams(next, { replace: true });
  };

  const setRecallFilter = (nextFilter: RecallFilterMode) => {
    const next = new URLSearchParams(searchParams);

    if (nextFilter === 'all') next.delete('recallFilter');
    else next.set('recallFilter', nextFilter);

    setSearchParams(next, { replace: true });
  };

  const navigateToSection = (
    nextSection: SpaceMemorySection,
    nextFilter: RecallFilterMode = 'all',
  ) => {
    const next = new URLSearchParams(searchParams);
    next.set('section', nextSection);

    if (nextSection === 'inbox' || nextFilter === 'all') next.delete('recallFilter');
    else next.set('recallFilter', nextFilter);

    setSearchParams(next, { replace: true });
  };
  const findFirstSectionForRecallFilter = (targetFilter: Exclude<RecallFilterMode, 'all'>) =>
    reviewedSectionRecallSummaries.find((item) => item.recall[targetFilter] > 0)?.key ??
    reviewedSectionRecallSummaries[0]?.key ??
    'published';

  const buildAuditUrl = (entry: SpaceMemoryEntryPreview) => {
    const auditPath = buildSpaceMemoryAuditPath(summary!.id, entry.id, getSectionForEntry(entry));
    const auditRecallFilter = getAuditRecallFilter(entry, recallFilter);

    return auditRecallFilter !== 'all'
      ? `${window.location.origin}${auditPath}&recallFilter=${auditRecallFilter}`
      : `${window.location.origin}${auditPath}`;
  };

  const handleCopyAuditLink = async (entry: SpaceMemoryEntryPreview) => {
    const url = buildAuditUrl(entry);

    try {
      await navigator.clipboard.writeText(url);
      message.success(t('space.memory.actions.copyAuditLinkSuccess', { ns: 'file' }));
    } catch {
      message.error(t('space.memory.actions.copyAuditLinkError', { ns: 'file' }));
    }
  };

  const handleExportAuditJson = async (entry: SpaceMemoryEntryPreview) => {
    const fileName = `${sanitizeFileName(`${entry.title}-audit`, `space-memory-${entry.id}-audit`)}.json`;

    try {
      setExportingAudit(true);
      const bundle = await lambdaClient.spaceMemory.exportAuditBundle.query({
        id: entry.id,
        recallFilter: getAuditRecallFilter(entry, recallFilter),
        spaceId,
      });

      exportJSONFile(
        {
          ...bundle,
          auditUrl: `${window.location.origin}${bundle.auditPath}`,
          space: {
            ...bundle.space,
            displayName,
          },
        },
        fileName,
      );
      message.success(t('space.memory.actions.exportAuditSuccess', { ns: 'file' }));
    } catch {
      message.error(t('space.memory.actions.exportAuditError', { ns: 'file' }));
    } finally {
      setExportingAudit(false);
    }
  };

  const handleExportSelectedAudits = async () => {
    if (!spaceId || selectedEntryIds.length === 0) return;

    const currentRecallFilter: RecallFilterMode = supportsRecallFilter ? recallFilter : 'all';
    const fileName = `${sanitizeFileName(
      `${displayName}-space-memory-audit-bundle`,
      `space-memory-audit-bundle-${summary.id}`,
    )}.json`;

    try {
      setExportingSelectedAudits(true);
      const bundle = await lambdaClient.spaceMemory.exportAuditBundles.query({
        ids: [...selectedEntryIds],
        recallFilter: currentRecallFilter,
        spaceId,
      });

      exportJSONFile(
        {
          ...bundle,
          items: bundle.items.map((bundleItem) => ({
            ...bundleItem,
            auditUrl: `${window.location.origin}${bundleItem.auditPath}`,
            space: {
              ...bundleItem.space,
              displayName,
            },
          })),
          space: {
            ...bundle.space,
            displayName,
          },
          spaceId: summary.id,
        },
        fileName,
      );
      message.success(t('space.memory.actions.exportSelectedAuditsSuccess', { ns: 'file' }));
    } catch {
      message.error(t('space.memory.actions.exportSelectedAuditsError', { ns: 'file' }));
    } finally {
      setExportingSelectedAudits(false);
    }
  };

  const handleExportSelectedAuditSummary = async () => {
    if (!spaceId || selectedEntryIds.length === 0) return;

    const currentRecallFilter: RecallFilterMode = supportsRecallFilter ? recallFilter : 'all';
    const fileName = `${sanitizeFileName(
      `${displayName}-space-memory-audit-index`,
      `space-memory-audit-index-${summary.id}`,
    )}.csv`;

    const escapeCsvCell = (value?: string | number | null) => {
      const normalized = value == null ? '' : String(value);
      const escaped = normalized.replaceAll('"', '""');

      return `"${escaped}"`;
    };

    try {
      setExportingSelectedAuditSummary(true);
      const bundle = await lambdaClient.spaceMemory.exportAuditBundles.query({
        ids: [...selectedEntryIds],
        recallFilter: currentRecallFilter,
        spaceId,
      });

      const header = [
        'Entry ID',
        'Title',
        'Category',
        'Section',
        'Recall Filter',
        'Published At',
        'Last Verified At',
        'Stale At',
        'Expires At',
        'Source Count',
        'Audit Path',
        'Audit URL',
      ];

      const rows = bundle.items.map((item) => [
        item.entry.id,
        item.entry.title,
        item.entry.category,
        item.section,
        item.recallFilter,
        item.entry.publishedAt ?? '',
        item.entry.recall?.lastVerifiedAt ?? '',
        item.entry.recall?.staleAt ?? '',
        item.entry.recall?.expiresAt ?? '',
        item.entry.sourceCount,
        item.auditPath,
        `${window.location.origin}${item.auditPath}`,
      ]);

      const csv = [header, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\n');

      exportFile(csv, fileName);
      message.success(t('space.memory.actions.exportSelectedAuditSummarySuccess', { ns: 'file' }));
    } catch {
      message.error(t('space.memory.actions.exportSelectedAuditSummaryError', { ns: 'file' }));
    } finally {
      setExportingSelectedAuditSummary(false);
    }
  };

  if (!isTeamSpace) {
    return (
      <Flexbox className={styles.page} gap={24} horizontal={!isMobile}>
        {!isMobile && (
          <Block className={styles.scopeRail} padding={12} variant={'outlined'}>
            <MemoryScopeSection currentScope="personal" />
          </Block>
        )}

        <Flexbox flex={1} gap={24} style={{ minWidth: 0 }}>
          <SurfaceBreadcrumb
            segments={[
              {
                key: 'space',
                label: displayName,
                onClick: () => navigate(buildSpaceRootPath(summary.id)),
              },
              {
                current: true,
                key: 'memory',
                label: t('space.memory.title', { ns: 'file' }),
              },
            ]}
          />

          <Flexbox gap={10}>
            <Flexbox horizontal align={'center'} gap={8} wrap={'wrap'}>
              <Text as={'h1'} fontSize={32} style={{ margin: 0 }} weight={700}>
                {t('space.memory.title', { ns: 'file' })}
              </Text>
              <Tag size={'small'} variant={'filled'}>
                {displayName}
              </Tag>
              <Tag size={'small'} variant={'outlined'}>
                {t('space.home.badges.personal', { ns: 'file' })}
              </Tag>
            </Flexbox>
            <Text type={'secondary'}>
              {t('space.memory.personalOnly.subtitle', { ns: 'file' })}
            </Text>
          </Flexbox>

          <Block padding={18} variant={'outlined'}>
            <Flexbox gap={8}>
              <Text strong>{t('space.memory.personalOnly.title', { ns: 'file' })}</Text>
              <Text type={'secondary'}>{t('space.memory.personalOnly.body', { ns: 'file' })}</Text>
              <Text type={'secondary'}>{t('space.memory.personalOnly.hint', { ns: 'file' })}</Text>
              <Flexbox horizontal gap={8} wrap={'wrap'}>
                <Button type={'primary'} onClick={() => navigate('/memory')}>
                  {t('space.memory.actions.openPersonal', { ns: 'file' })}
                </Button>
                <Button onClick={() => navigate(buildSpaceRootPath(summary.id))}>
                  {t('space.settings.back', { ns: 'file' })}
                </Button>
              </Flexbox>
            </Flexbox>
          </Block>
        </Flexbox>
      </Flexbox>
    );
  }

  const refreshMemory = async (sectionsToRefresh: SpaceMemorySection[]) => {
    const keys = new Set(sectionsToRefresh);

    keys.add(section);

    await Promise.all([
      mutate(['space-memory-summary', spaceId]),
      ...[...keys].map((value) => mutate(['space-memory-section', spaceId, value])),
    ]);
  };

  const handlePublish = async (entry: (typeof entryList)[number]) => {
    if (!spaceId) return;

    try {
      setPublishingId(entry.id);
      const published = await lambdaClient.spaceMemory.publishEntry.mutate({
        id: entry.id,
        spaceId,
      });
      message.success(t('space.memory.actions.publishSuccess', { ns: 'file' }));
      focusReviewedEntry({
        category: published.category as SpaceMemoryCategory,
        detailView: 'audit',
        entryId: published.id,
        openDetail: true,
      });
      await refreshMemory(['inbox', 'playbooks', 'policies', 'published']);
    } catch {
      message.error(t('space.memory.actions.publishError', { ns: 'file' }));
    } finally {
      setPublishingId(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!spaceId) return;

    try {
      setRejectingId(id);
      await lambdaClient.spaceMemory.rejectEntry.mutate({ id, spaceId });
      message.success(t('space.memory.actions.rejectSuccess', { ns: 'file' }));
      await refreshMemory(['inbox']);
    } catch {
      message.error(t('space.memory.actions.rejectError', { ns: 'file' }));
    } finally {
      setRejectingId(null);
    }
  };

  const handleMerge = async (entry: (typeof entryList)[number], targetEntryId: string) => {
    if (!spaceId) return;

    try {
      setMergingId(entry.id);
      const merged = await lambdaClient.spaceMemory.mergeEntry.mutate({
        candidateId: entry.id,
        merge: getMergeResolution(entry),
        spaceId,
        targetEntryId,
      });
      message.success(t('space.memory.actions.mergeSuccess', { ns: 'file' }));
      focusReviewedEntry({
        category: merged.updatedTarget.category as SpaceMemoryCategory,
        detailView: 'audit',
        entryId: merged.updatedTarget.id,
        openDetail: true,
      });
      setMergeResolutions((current) => {
        if (!(entry.id in current)) return current;

        const next = { ...current };
        delete next[entry.id];
        return next;
      });
      await refreshMemory(['inbox', 'published', 'playbooks', 'policies']);
    } catch {
      message.error(t('space.memory.actions.mergeError', { ns: 'file' }));
    } finally {
      setMergingId(null);
    }
  };

  const resetDraft = () => {
    setDraftCategory('general');
    setDraftSummary('');
    setDraftTitle('');
  };

  const toggleEntrySelection = (id: string, checked: boolean) => {
    setSelectedEntryIds((current) => {
      if (checked) return current.includes(id) ? current : [...current, id];

      return current.filter((item) => item !== id);
    });
  };

  const clearSelection = () => {
    setSelectedEntryIds([]);
  };

  const toggleHistoryExpansion = (entryId: string) => {
    setExpandedHistoryEntryIds((current) =>
      current.includes(entryId) ? current.filter((id) => id !== entryId) : [...current, entryId],
    );
  };

  const selectableEntryIds =
    section === 'inbox' && sectionCanReview
      ? visibleEntryList.map((entry) => entry.id)
      : supportsRecallFilter && sectionCanReview && recallFilter === 'stale'
        ? visibleEntryList.map((entry) => entry.id)
        : supportsRecallFilter &&
            sectionCanReview &&
            (recallFilter === 'active' || recallFilter === 'all')
          ? visibleEntryList
              .filter((entry) => entry.kind === 'memory' && !entry.recall?.recallBlockedReason)
              .map((entry) => entry.id)
          : supportsRecallFilter && sectionCanReview
            ? visibleEntryList.map((entry) => entry.id)
            : [];
  const selectionEnabled = selectableEntryIds.length > 0;
  const selectableEntryIdSet = new Set(selectableEntryIds);
  const allVisibleSelected =
    selectableEntryIds.length > 0 &&
    selectableEntryIds.every((id) => selectedEntryIds.includes(id));

  const selectAllVisible = () => {
    setSelectedEntryIds(selectableEntryIds);
  };

  const formatBatchFailureMessage = (
    action: 'publish' | 'reject' | 'revalidate' | 'stale',
    results: BatchActionResult[],
  ) => {
    if (!results.length) return '';

    const counts = results.reduce<Record<string, number>>((acc, item) => {
      if (!item.reason) return acc;
      acc[item.reason] = (acc[item.reason] ?? 0) + 1;
      return acc;
    }, {});

    const details = Object.entries(counts)
      .map(([reason, count]) =>
        t(`space.memory.actions.batchFailureReason.${reason}`, {
          count,
          ns: 'file',
        }),
      )
      .join(' ');

    return details
      ? t(`space.memory.actions.${action}BatchFailureDetails`, {
          details,
          ns: 'file',
        })
      : '';
  };

  const buildDefaultMergeResolution = (
    entry: (typeof entryList)[number],
  ): MergeResolutionState => ({
    appendSources: (entry.reviewHint?.mergePreview.addedSourceCount ?? 1) > 0,
    applyContent: entry.reviewHint?.mergePreview.updatesContent ?? true,
    applySummary: entry.reviewHint?.mergePreview.updatesSummary ?? true,
    applyTitle: entry.reviewHint?.mergePreview.updatesTitle ?? true,
  });

  const getMergeResolution = (entry: (typeof entryList)[number]) =>
    mergeResolutions[entry.id] ?? buildDefaultMergeResolution(entry);

  const updateMergeResolution = (
    entry: (typeof entryList)[number],
    key: keyof MergeResolutionState,
    checked: boolean,
  ) => {
    setMergeResolutions((current) => ({
      ...current,
      [entry.id]: {
        ...getMergeResolution(entry),
        [key]: checked,
      },
    }));
  };

  const handleBatchPublish = async () => {
    if (!spaceId || !selectedEntryIds.length) return;

    const ids = [...selectedEntryIds];

    try {
      setBatchAction('publish');
      const result = await lambdaClient.spaceMemory.publishEntries.mutate({
        ids,
        spaceId,
      });

      const succeededIds = new Set(
        result.filter((item) => item.status === 'published').map((item) => item.id),
      );
      const succeededCount = succeededIds.size;
      const failedResults = result.filter((item) => item.status === 'skipped');

      if (succeededCount === 0) {
        message.error(
          formatBatchFailureMessage('publish', failedResults) ||
            t('space.memory.actions.publishBatchError', { ns: 'file' }),
        );
        return;
      }

      if (succeededCount === ids.length) {
        message.success(
          t('space.memory.actions.publishBatchSuccess', {
            count: succeededCount,
            ns: 'file',
          }),
        );
        clearSelection();
      } else {
        setSelectedEntryIds(ids.filter((id) => !succeededIds.has(id)));
        message.warning(
          [
            t('space.memory.actions.publishBatchPartial', {
              failed: ids.length - succeededCount,
              ns: 'file',
              succeeded: succeededCount,
            }),
            formatBatchFailureMessage('publish', failedResults),
          ]
            .filter(Boolean)
            .join(' '),
        );
      }

      await refreshMemory(['inbox', 'playbooks', 'policies', 'published']);
    } catch {
      message.error(t('space.memory.actions.publishBatchError', { ns: 'file' }));
    } finally {
      setBatchAction(null);
    }
  };

  const handleBatchReject = async () => {
    if (!spaceId || !selectedEntryIds.length) return;

    const ids = [...selectedEntryIds];

    try {
      setBatchAction('reject');
      const result = await lambdaClient.spaceMemory.rejectEntries.mutate({
        ids,
        spaceId,
      });

      const succeededIds = new Set(
        result.filter((item) => item.status === 'archived').map((item) => item.id),
      );
      const succeededCount = succeededIds.size;
      const failedResults = result.filter((item) => item.status === 'skipped');

      if (succeededCount === 0) {
        message.error(
          formatBatchFailureMessage('reject', failedResults) ||
            t('space.memory.actions.rejectBatchError', { ns: 'file' }),
        );
        return;
      }

      if (succeededCount === ids.length) {
        message.success(
          t('space.memory.actions.rejectBatchSuccess', {
            count: succeededCount,
            ns: 'file',
          }),
        );
        clearSelection();
      } else {
        setSelectedEntryIds(ids.filter((id) => !succeededIds.has(id)));
        message.warning(
          [
            t('space.memory.actions.rejectBatchPartial', {
              failed: ids.length - succeededCount,
              ns: 'file',
              succeeded: succeededCount,
            }),
            formatBatchFailureMessage('reject', failedResults),
          ]
            .filter(Boolean)
            .join(' '),
        );
      }

      await refreshMemory(['inbox']);
    } catch {
      message.error(t('space.memory.actions.rejectBatchError', { ns: 'file' }));
    } finally {
      setBatchAction(null);
    }
  };

  const handleBatchRevalidate = async () => {
    if (!spaceId || !selectedEntryIds.length) return;

    const ids = [...selectedEntryIds];

    try {
      setBatchAction('revalidate');
      const result = await lambdaClient.spaceMemory.revalidateEntries.mutate({
        ids,
        spaceId,
      });

      const succeededIds = new Set(
        result.filter((item) => item.status === 'revalidated').map((item) => item.id),
      );
      const succeededCount = succeededIds.size;
      const failedResults = result.filter((item) => item.status === 'skipped');

      if (succeededCount === 0) {
        message.error(
          formatBatchFailureMessage('revalidate', failedResults) ||
            t('space.memory.actions.revalidateBatchError', { ns: 'file' }),
        );
        return;
      }

      if (succeededCount === ids.length) {
        message.success(
          t('space.memory.actions.revalidateBatchSuccess', {
            count: succeededCount,
            ns: 'file',
          }),
        );
        clearSelection();
      } else {
        setSelectedEntryIds(ids.filter((id) => !succeededIds.has(id)));
        message.warning(
          [
            t('space.memory.actions.revalidateBatchPartial', {
              failed: ids.length - succeededCount,
              ns: 'file',
              succeeded: succeededCount,
            }),
            formatBatchFailureMessage('revalidate', failedResults),
          ]
            .filter(Boolean)
            .join(' '),
        );
      }

      await Promise.all([
        ...(detailEntryId ? [mutate(['space-memory-entry', spaceId, detailEntryId])] : []),
        refreshMemory(['playbooks', 'policies', 'published']),
      ]);
    } catch {
      message.error(t('space.memory.actions.revalidateBatchError', { ns: 'file' }));
    } finally {
      setBatchAction(null);
    }
  };

  const handleBatchMarkStale = async () => {
    if (!spaceId || !selectedEntryIds.length) return;

    const ids = [...selectedEntryIds];

    try {
      setBatchAction('stale');
      const result = await lambdaClient.spaceMemory.markEntriesStale.mutate({
        ids,
        spaceId,
      });

      const succeededIds = new Set(
        result.filter((item) => item.status === 'stale').map((item) => item.id),
      );
      const succeededCount = succeededIds.size;
      const failedResults = result.filter((item) => item.status === 'skipped');

      if (succeededCount === 0) {
        message.error(
          formatBatchFailureMessage('stale', failedResults) ||
            t('space.memory.actions.staleBatchError', { ns: 'file' }),
        );
        return;
      }

      if (succeededCount === ids.length) {
        message.success(
          t('space.memory.actions.staleBatchSuccess', {
            count: succeededCount,
            ns: 'file',
          }),
        );
        clearSelection();
      } else {
        setSelectedEntryIds(ids.filter((id) => !succeededIds.has(id)));
        message.warning(
          [
            t('space.memory.actions.staleBatchPartial', {
              failed: ids.length - succeededCount,
              ns: 'file',
              succeeded: succeededCount,
            }),
            formatBatchFailureMessage('stale', failedResults),
          ]
            .filter(Boolean)
            .join(' '),
        );
      }

      await Promise.all([
        ...(detailEntryId ? [mutate(['space-memory-entry', spaceId, detailEntryId])] : []),
        refreshMemory(['playbooks', 'policies', 'published']),
      ]);
    } catch {
      message.error(t('space.memory.actions.staleBatchError', { ns: 'file' }));
    } finally {
      setBatchAction(null);
    }
  };

  const handleCreateCandidate = async () => {
    if (!spaceId) return;

    const nextTitle = draftTitle.trim();
    if (!nextTitle) {
      message.warning(t('space.memory.actions.createTitleRequired', { ns: 'file' }));
      return;
    }

    try {
      setCreating(true);
      await lambdaClient.spaceMemory.ingestCandidates.mutate({
        drafts: [
          {
            category: draftCategory,
            summary: draftSummary.trim() || undefined,
            title: nextTitle,
          },
        ],
        origin: 'manual',
        spaceId,
      });
      message.success(t('space.memory.actions.createSuccess', { ns: 'file' }));
      resetDraft();
      await refreshMemory(['inbox']);
    } catch {
      message.error(t('space.memory.actions.createError', { ns: 'file' }));
    } finally {
      setCreating(false);
    }
  };

  const handleMarkVerifiedNow = () => {
    setRecallPolicyDraft((current) =>
      current
        ? {
            ...current,
            lastVerifiedAt: new Date().toISOString(),
            staleAt: null,
          }
        : current,
    );
  };

  const handleMarkStaleNow = () => {
    setRecallPolicyDraft((current) =>
      current
        ? {
            ...current,
            staleAt: new Date().toISOString(),
          }
        : current,
    );
  };

  const handleRevalidateNow = () => {
    setRecallPolicyDraft((current) =>
      current
        ? {
            ...current,
            lastVerifiedAt: new Date().toISOString(),
            staleAt: null,
          }
        : current,
    );
  };

  const handleSaveRecallPolicy = async () => {
    if (!spaceId || !detailEntry || detailEntry.kind !== 'memory' || !recallPolicyDraft) return;

    try {
      setSavingRecallPolicy(true);
      await lambdaClient.spaceMemory.updateRecallPolicy.mutate({
        expiresAt: fromDateTimeLocalInput(recallPolicyDraft.expiresAt),
        id: detailEntry.id,
        lastVerifiedAt: recallPolicyDraft.lastVerifiedAt,
        recallEnabled: recallPolicyDraft.recallEnabled,
        staleAt: recallPolicyDraft.staleAt,
        spaceId,
      });
      message.success(t('space.memory.actions.saveRecallPolicySuccess', { ns: 'file' }));
      await Promise.all([
        mutate(['space-memory-entry', spaceId, detailEntry.id]),
        refreshMemory(['playbooks', 'policies', 'published']),
      ]);
    } catch {
      message.error(t('space.memory.actions.saveRecallPolicyError', { ns: 'file' }));
    } finally {
      setSavingRecallPolicy(false);
    }
  };

  const renderSourceLabel = (source: { kind: string; title?: string }) => {
    if (source.title?.trim()) return source.title;

    return t(`space.memory.sources.${source.kind}`, {
      defaultValue: source.kind,
      ns: 'file',
    });
  };

  const renderTimelineLabel = (entry: (typeof entryList)[number]) => {
    const time = new Date(entry.publishedAt ?? entry.updatedAt).toLocaleString();

    if (entry.kind === 'memory' && entry.publishedAt) {
      return t('space.memory.entries.publishedAt', {
        ns: 'file',
        time,
      });
    }

    return t('space.memory.entries.updatedAt', {
      ns: 'file',
      time,
    });
  };

  const renderRecallStatusLabel = (entry: (typeof entryList)[number]) => {
    if (entry.kind !== 'memory') return null;

    switch (entry.recall?.recallBlockedReason) {
      case 'disabled': {
        return t('space.memory.entries.recall.disabled', { ns: 'file' });
      }
      case 'stale': {
        return t('space.memory.entries.recall.stale', { ns: 'file' });
      }
      case 'expired': {
        return t('space.memory.entries.recall.expired', { ns: 'file' });
      }
      default: {
        return t('space.memory.entries.recall.active', { ns: 'file' });
      }
    }
  };

  const renderIntakeOriginLabel = (entry: (typeof entryList)[number]) => {
    if (!entry.intake?.origin) return null;

    return t(`space.memory.entries.intake.origin.${entry.intake.origin}`, {
      ns: 'file',
    });
  };

  const renderProducerLabel = (entry: (typeof entryList)[number]) => {
    if (!entry.intake?.producer) return null;

    return t('space.memory.entries.intake.producer', {
      name: entry.intake.producer,
      ns: 'file',
    });
  };

  const renderTraceLabel = (entry: (typeof entryList)[number]) => {
    if (!entry.intake?.traceId) return null;

    return t('space.memory.entries.intake.trace', {
      id: entry.intake.traceId,
      ns: 'file',
    });
  };

  const renderActorLabel = (entry: (typeof entryList)[number]) => {
    const actorName = entry.actor?.name || entry.actor?.username;

    if (!actorName) return null;

    return t(
      entry.kind === 'candidate'
        ? 'space.memory.entries.createdBy'
        : 'space.memory.entries.publishedBy',
      {
        name: actorName,
        ns: 'file',
      },
    );
  };

  const renderReviewHint = (entry: (typeof entryList)[number]) => {
    if (!entry.reviewHint) return null;

    if (entry.reviewHint.kind === 'duplicate_published') {
      const publishedTime = entry.reviewHint.match.publishedAt
        ? new Date(entry.reviewHint.match.publishedAt).toLocaleString()
        : null;
      const hasSummary = Boolean(entry.reviewHint.match.summary || entry.summary);
      const hasContent = Boolean(entry.reviewHint.match.content || entry.content);
      const mergeResolution = getMergeResolution(entry);

      return (
        <Flexbox gap={8}>
          <Flexbox horizontal align={'center'} gap={8} wrap={'wrap'}>
            <Tag size={'small'} variant={'outlined'}>
              {t('space.memory.entries.reviewHint.duplicatePublished', { ns: 'file' })}
            </Tag>
            <Text size={'small'} type={'secondary'}>
              {t('space.memory.entries.reviewHint.mergeHint', { ns: 'file' })}
            </Text>
            <Text size={'small'} type={'secondary'}>
              {t('space.memory.entries.reviewHint.matchTitle', {
                name: entry.reviewHint.match.title,
                ns: 'file',
              })}
            </Text>
            {publishedTime && (
              <Text size={'small'} type={'secondary'}>
                {t('space.memory.entries.reviewHint.matchPublishedAt', {
                  ns: 'file',
                  time: publishedTime,
                })}
              </Text>
            )}
          </Flexbox>

          <div className={styles.compareBlock}>
            <Text strong size={'small'}>
              {t('space.memory.entries.reviewHint.compareTitle', { ns: 'file' })}
            </Text>

            <div className={styles.compareColumns}>
              <Flexbox gap={6}>
                <Text className={styles.compareLabel}>
                  {t('space.memory.entries.reviewHint.comparePublished', { ns: 'file' })}
                </Text>
                <Text strong size={'small'}>
                  {t('space.memory.entries.reviewHint.compareTitleField', { ns: 'file' })}:&nbsp;
                  {entry.reviewHint.match.title}
                </Text>
                {hasSummary && (
                  <Text className={styles.compareValue} size={'small'} type={'secondary'}>
                    {t('space.memory.entries.reviewHint.compareSummaryField', {
                      ns: 'file',
                    })}
                    : {entry.reviewHint.match.summary || '—'}
                  </Text>
                )}
                {hasContent && (
                  <Text className={styles.compareValue} size={'small'} type={'secondary'}>
                    {t('space.memory.entries.reviewHint.compareContentField', {
                      ns: 'file',
                    })}
                    : {entry.reviewHint.match.content || '—'}
                  </Text>
                )}
              </Flexbox>

              <Flexbox gap={6}>
                <Text className={styles.compareLabel}>
                  {t('space.memory.entries.reviewHint.compareCandidate', { ns: 'file' })}
                </Text>
                <Text strong size={'small'}>
                  {t('space.memory.entries.reviewHint.compareTitleField', { ns: 'file' })}:&nbsp;
                  {entry.title}
                </Text>
                {hasSummary && (
                  <Text className={styles.compareValue} size={'small'} type={'secondary'}>
                    {t('space.memory.entries.reviewHint.compareSummaryField', {
                      ns: 'file',
                    })}
                    : {entry.summary || '—'}
                  </Text>
                )}
                {hasContent && (
                  <Text className={styles.compareValue} size={'small'} type={'secondary'}>
                    {t('space.memory.entries.reviewHint.compareContentField', {
                      ns: 'file',
                    })}
                    : {entry.content || '—'}
                  </Text>
                )}
              </Flexbox>
            </div>

            <Flexbox horizontal align={'center'} gap={8} wrap={'wrap'}>
              <Text className={styles.compareLabel}>
                {t('space.memory.entries.reviewHint.compareImpact', { ns: 'file' })}
              </Text>
              {entry.reviewHint.mergePreview.updatesTitle && (
                <Checkbox
                  checked={mergeResolution.applyTitle}
                  onChange={(e) => updateMergeResolution(entry, 'applyTitle', e.target.checked)}
                >
                  {t('space.memory.entries.reviewHint.updatesTitle', { ns: 'file' })}
                </Checkbox>
              )}
              {entry.reviewHint.mergePreview.updatesSummary && (
                <Checkbox
                  checked={mergeResolution.applySummary}
                  onChange={(e) => updateMergeResolution(entry, 'applySummary', e.target.checked)}
                >
                  {t('space.memory.entries.reviewHint.updatesSummary', { ns: 'file' })}
                </Checkbox>
              )}
              {entry.reviewHint.mergePreview.updatesContent && (
                <Checkbox
                  checked={mergeResolution.applyContent}
                  onChange={(e) => updateMergeResolution(entry, 'applyContent', e.target.checked)}
                >
                  {t('space.memory.entries.reviewHint.updatesContent', { ns: 'file' })}
                </Checkbox>
              )}
              {entry.reviewHint.mergePreview.addedSourceCount > 0 && (
                <Checkbox
                  checked={mergeResolution.appendSources}
                  onChange={(e) => updateMergeResolution(entry, 'appendSources', e.target.checked)}
                >
                  {t('space.memory.entries.reviewHint.addsSources', {
                    count: entry.reviewHint.mergePreview.addedSourceCount,
                    ns: 'file',
                  })}
                </Checkbox>
              )}
            </Flexbox>
          </div>
        </Flexbox>
      );
    }

    return null;
  };

  const renderHistoryMessage = (
    item: NonNullable<SpaceMemoryEntryPreview['history']>[number],
    includeTime = false,
  ) => {
    const body =
      item.action === 'merged'
        ? t('space.memory.entries.history.merge', {
            name: item.sourceTitle || t('space.memory.entries.candidate', { ns: 'file' }),
            ns: 'file',
          })
        : item.action === 'policy_updated'
          ? t('space.memory.entries.history.policyUpdated', { ns: 'file' })
          : t('space.memory.entries.history.publish', { ns: 'file' });

    if (!includeTime) return body;

    return `${body} · ${new Date(item.at).toLocaleString()}`;
  };

  const renderHistoryActor = (item: NonNullable<SpaceMemoryEntryPreview['history']>[number]) => {
    const actorName = item.actor?.name || item.actor?.username;

    if (!actorName) return null;

    return t('space.memory.entries.history.by', {
      name: actorName,
      ns: 'file',
    });
  };

  const renderHistoryResolution = (
    item: NonNullable<SpaceMemoryEntryPreview['history']>[number],
  ) => {
    if (item.action !== 'merged' || !item.resolution) return null;

    const labels = [
      item.resolution.applyTitle
        ? t('space.memory.entries.history.resolution.title', { ns: 'file' })
        : null,
      item.resolution.applySummary
        ? t('space.memory.entries.history.resolution.summary', { ns: 'file' })
        : null,
      item.resolution.applyContent
        ? t('space.memory.entries.history.resolution.content', { ns: 'file' })
        : null,
      item.resolution.appendSources
        ? t('space.memory.entries.history.resolution.sources', { ns: 'file' })
        : null,
    ].filter(Boolean) as string[];

    if (labels.length === 0) return null;

    return (
      <Flexbox horizontal gap={6} wrap={'wrap'}>
        {labels.map((label) => (
          <Tag key={`${item.at}-${label}`} size={'small'} variant={'outlined'}>
            {label}
          </Tag>
        ))}
      </Flexbox>
    );
  };

  const renderHistoryChanges = (item: NonNullable<SpaceMemoryEntryPreview['history']>[number]) => {
    if (!item.changes) return null;

    const formatHistoryChangeValue = (value?: boolean | string | null) => {
      if (typeof value === 'boolean') {
        return value
          ? t('space.memory.detail.recall.enabled', { ns: 'file' })
          : t('space.memory.detail.recall.disabled', { ns: 'file' });
      }

      if (!value) return '—';

      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) return value;

      return parsed.toLocaleString();
    };

    const changeRows = [
      item.changes.title
        ? {
            key: 'title',
            label: t('space.memory.entries.reviewHint.compareTitleField', { ns: 'file' }),
            value: item.changes.title,
          }
        : null,
      item.changes.summary
        ? {
            key: 'summary',
            label: t('space.memory.entries.reviewHint.compareSummaryField', { ns: 'file' }),
            value: item.changes.summary,
          }
        : null,
      item.changes.content
        ? {
            key: 'content',
            label: t('space.memory.entries.reviewHint.compareContentField', { ns: 'file' }),
            value: item.changes.content,
          }
        : null,
      item.changes.recallEnabled
        ? {
            key: 'recallEnabled',
            label: t('space.memory.detail.recall.toggle', { ns: 'file' }),
            value: item.changes.recallEnabled,
          }
        : null,
      item.changes.expiresAt
        ? {
            key: 'expiresAt',
            label: t('space.memory.detail.recall.expiresAt', { ns: 'file' }),
            value: item.changes.expiresAt,
          }
        : null,
      item.changes.lastVerifiedAt
        ? {
            key: 'lastVerifiedAt',
            label: t('space.memory.detail.recall.lastVerifiedAt', { ns: 'file' }),
            value: item.changes.lastVerifiedAt,
          }
        : null,
      item.changes.staleAt
        ? {
            key: 'staleAt',
            label: t('space.memory.detail.recall.staleAt', { ns: 'file' }),
            value: item.changes.staleAt,
          }
        : null,
    ].filter(Boolean) as {
      key: string;
      label: string;
      value: { after?: boolean | string | null; before?: boolean | string | null };
    }[];

    if (changeRows.length === 0) return null;

    return (
      <div className={styles.compareBlock}>
        <Text strong size={'small'}>
          {t('space.memory.entries.history.changeSet', { ns: 'file' })}
        </Text>
        <div className={styles.compareColumns}>
          <Flexbox gap={8}>
            <Text className={styles.compareLabel}>
              {t('space.memory.entries.history.before', { ns: 'file' })}
            </Text>
            {changeRows.map((row) => (
              <Flexbox gap={4} key={`before-${item.at}-${row.key}`}>
                <Text strong size={'small'}>
                  {row.label}
                </Text>
                <Text className={styles.compareValue} size={'small'} type={'secondary'}>
                  {formatHistoryChangeValue(row.value.before)}
                </Text>
              </Flexbox>
            ))}
          </Flexbox>
          <Flexbox gap={8}>
            <Text className={styles.compareLabel}>
              {t('space.memory.entries.history.after', { ns: 'file' })}
            </Text>
            {changeRows.map((row) => (
              <Flexbox gap={4} key={`after-${item.at}-${row.key}`}>
                <Text strong size={'small'}>
                  {row.label}
                </Text>
                <Text className={styles.compareValue} size={'small'} type={'secondary'}>
                  {formatHistoryChangeValue(row.value.after)}
                </Text>
              </Flexbox>
            ))}
          </Flexbox>
        </div>
      </div>
    );
  };

  const renderGovernanceHistory = (entry: (typeof entryList)[number]) => {
    if (entry.kind !== 'memory' || !sectionCanReview) return null;
    const history = entry.history ?? [];
    const latestHistory = history[0];
    if (!latestHistory) return null;

    const isExpanded = focusedEntryId === entry.id || expandedHistoryEntryIds.includes(entry.id);
    const extraHistory = history.slice(1);

    return (
      <Flexbox gap={8}>
        <div className={styles.entryHistoryStrip}>
          <Tag size={'small'} variant={'filled'}>
            {t('space.memory.entries.history.label', { ns: 'file' })}
          </Tag>
          <Text size={'small'}>{renderHistoryMessage(latestHistory)}</Text>
          {renderHistoryActor(latestHistory) && (
            <Text size={'small'} type={'secondary'}>
              {renderHistoryActor(latestHistory)}
            </Text>
          )}
          <Text size={'small'} type={'secondary'}>
            {new Date(latestHistory.at).toLocaleString()}
          </Text>
          <Button
            size={'small'}
            type={'text'}
            onClick={() => openDetailEntry(entry.id, { view: 'audit' })}
          >
            {t('space.memory.actions.viewAudit', { ns: 'file' })}
          </Button>
          {extraHistory.length > 0 && (
            <Button size={'small'} type={'text'} onClick={() => toggleHistoryExpansion(entry.id)}>
              {isExpanded
                ? t('space.memory.entries.history.hide', { ns: 'file' })
                : t('space.memory.entries.history.showMore', {
                    count: extraHistory.length,
                    ns: 'file',
                  })}
            </Button>
          )}
        </div>
        {isExpanded && extraHistory.length > 0 && (
          <div className={styles.entryHistoryList}>
            {extraHistory.map((item, index) => (
              <div className={styles.entryHistoryItem} key={`${entry.id}-${item.at}-${index}`}>
                <Flexbox gap={6}>
                  <Text size={'small'} type={'secondary'}>
                    {renderHistoryMessage(item, true)}
                  </Text>
                  {renderHistoryActor(item) && (
                    <Text size={'small'} type={'secondary'}>
                      {renderHistoryActor(item)}
                    </Text>
                  )}
                  {renderHistoryResolution(item)}
                  {renderHistoryChanges(item)}
                </Flexbox>
              </div>
            ))}
          </div>
        )}
      </Flexbox>
    );
  };

  const renderDetailDrawer = () => {
    if (!detailEntry) return null;

    const history = detailEntry.history ?? [];
    const showAuditTab =
      detailEntry.kind === 'memory' && (detailContract?.detailViews.includes('audit') ?? false);
    const activeDetailView = showAuditTab ? detailView : 'overview';
    const draftExpiresAt =
      detailEntry.kind === 'memory' && recallPolicyDraft
        ? fromDateTimeLocalInput(recallPolicyDraft.expiresAt)
        : (detailEntry.recall?.expiresAt ?? null);
    const draftStaleAt =
      detailEntry.kind === 'memory' && recallPolicyDraft
        ? recallPolicyDraft.staleAt
        : (detailEntry.recall?.staleAt ?? null);
    const draftRecallBlockedReason =
      detailEntry.kind === 'memory' && recallPolicyDraft
        ? !recallPolicyDraft.recallEnabled
          ? 'disabled'
          : draftStaleAt
            ? 'stale'
            : draftExpiresAt && new Date(draftExpiresAt).getTime() <= Date.now()
              ? 'expired'
              : undefined
        : detailEntry.recall?.recallBlockedReason;
    const recallPolicyDirty =
      detailEntry.kind === 'memory' && recallPolicyDraft
        ? (detailEntry.recall?.recallEnabled ?? true) !== recallPolicyDraft.recallEnabled ||
          (detailEntry.recall?.lastVerifiedAt ?? detailEntry.publishedAt ?? null) !==
            (recallPolicyDraft.lastVerifiedAt ?? null) ||
          (detailEntry.recall?.staleAt ?? null) !== (recallPolicyDraft.staleAt ?? null) ||
          (detailEntry.recall?.expiresAt ?? null) !==
            fromDateTimeLocalInput(recallPolicyDraft.expiresAt)
        : false;

    return (
      <Drawer
        open={Boolean(detailEntry)}
        width={isMobile ? '100%' : 520}
        title={t('space.memory.detail.title', {
          name: detailEntry.title,
          ns: 'file',
        })}
        onClose={closeDetailDrawer}
      >
        <Flexbox gap={12}>
          {showAuditTab && (
            <Flexbox gap={8}>
              <Segmented
                block
                value={activeDetailView}
                options={[
                  {
                    label: t('space.memory.detail.tabs.overview', { ns: 'file' }),
                    value: 'overview',
                  },
                  {
                    label: t('space.memory.detail.tabs.audit', { ns: 'file' }),
                    value: 'audit',
                  },
                ]}
                onChange={(value) => setDetailView(value as SpaceMemoryDetailView)}
              />
              {activeDetailView === 'audit' && (
                <Flexbox horizontal gap={8} wrap={'wrap'}>
                  <Button onClick={() => handleCopyAuditLink(detailEntry)}>
                    {t('space.memory.actions.copyAuditLink', { ns: 'file' })}
                  </Button>
                  <Button
                    loading={exportingAudit}
                    onClick={() => handleExportAuditJson(detailEntry)}
                  >
                    {t('space.memory.actions.exportAudit', { ns: 'file' })}
                  </Button>
                </Flexbox>
              )}
            </Flexbox>
          )}

          {activeDetailView === 'overview' ? (
            <>
              <div className={styles.detailBlock}>
                <Flexbox gap={6}>
                  <Text className={styles.detailLabel}>
                    {t('space.memory.detail.summary', { ns: 'file' })}
                  </Text>
                  <Text>{detailEntry.summary || '—'}</Text>
                </Flexbox>
                <Flexbox gap={6}>
                  <Text className={styles.detailLabel}>
                    {t('space.memory.detail.content', { ns: 'file' })}
                  </Text>
                  <Text>{detailEntry.content || '—'}</Text>
                </Flexbox>
              </div>

              <div className={styles.detailBlock}>
                <Text className={styles.detailLabel}>
                  {t('space.memory.detail.sources', { ns: 'file' })}
                </Text>
                {detailEntry.sourceRefs.length === 0 ? (
                  <Text type={'secondary'}>{t('space.memory.detail.empty', { ns: 'file' })}</Text>
                ) : (
                  <div className={styles.sourceRefList}>
                    {detailEntry.sourceRefs.map((source) => (
                      <Tag
                        key={`${detailEntry.id}-detail-${source.kind}-${source.id}`}
                        size={'small'}
                        variant={'filled'}
                      >
                        {renderSourceLabel(source)}
                      </Tag>
                    ))}
                  </div>
                )}
              </div>

              {detailEntry.kind === 'memory' && detailCanReview && (
                <div className={styles.detailBlock}>
                  <Text className={styles.detailLabel}>
                    {t('space.memory.detail.recall.title', { ns: 'file' })}
                  </Text>
                  <Flexbox gap={8}>
                    <Tag size={'small'} variant={'outlined'}>
                      {draftRecallBlockedReason === 'disabled'
                        ? t('space.memory.detail.recall.disabled', { ns: 'file' })
                        : draftRecallBlockedReason === 'stale'
                          ? t('space.memory.detail.recall.stale', { ns: 'file' })
                          : draftRecallBlockedReason === 'expired'
                            ? t('space.memory.detail.recall.expired', { ns: 'file' })
                            : t('space.memory.detail.recall.active', { ns: 'file' })}
                    </Tag>
                    <Text type={'secondary'}>
                      {t('space.memory.detail.recall.lastVerifiedValue', {
                        date: new Date(
                          recallPolicyDraft?.lastVerifiedAt ??
                            detailEntry.publishedAt ??
                            Date.now(),
                        ).toLocaleString(),
                        ns: 'file',
                      })}
                    </Text>
                    <Text type={'secondary'}>
                      {draftStaleAt
                        ? t('space.memory.detail.recall.staleAtValue', {
                            date: new Date(draftStaleAt).toLocaleString(),
                            ns: 'file',
                          })
                        : t('space.memory.detail.recall.notStale', { ns: 'file' })}
                    </Text>
                    <Text type={'secondary'}>
                      {recallPolicyDraft?.expiresAt
                        ? t('space.memory.detail.recall.expiresAtValue', {
                            date: new Date(
                              fromDateTimeLocalInput(recallPolicyDraft.expiresAt) ?? Date.now(),
                            ).toLocaleString(),
                            ns: 'file',
                          })
                        : detailEntry.recall?.expiresAt
                          ? t('space.memory.detail.recall.expiresAtValue', {
                              date: new Date(detailEntry.recall.expiresAt).toLocaleString(),
                              ns: 'file',
                            })
                          : t('space.memory.detail.recall.noExpiry', { ns: 'file' })}
                    </Text>
                  </Flexbox>

                  {detailCanReview && recallPolicyDraft && (
                    <Flexbox gap={10}>
                      <Checkbox
                        checked={recallPolicyDraft.recallEnabled}
                        onChange={(event) =>
                          setRecallPolicyDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  recallEnabled: event.target.checked,
                                }
                              : current,
                          )
                        }
                      >
                        {t('space.memory.detail.recall.toggle', { ns: 'file' })}
                      </Checkbox>

                      <Flexbox gap={4}>
                        <Text size={'small'} type={'secondary'}>
                          {t('space.memory.detail.recall.expiresAt', { ns: 'file' })}
                        </Text>
                        <Input
                          aria-label={t('space.memory.detail.recall.expiresAt', { ns: 'file' })}
                          type={'datetime-local'}
                          value={recallPolicyDraft.expiresAt}
                          onChange={(event) =>
                            setRecallPolicyDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    expiresAt: event.target.value,
                                  }
                                : current,
                            )
                          }
                        />
                      </Flexbox>

                      <Flexbox horizontal gap={8} wrap={'wrap'}>
                        <Button size={'small'} onClick={handleMarkVerifiedNow}>
                          {t('space.memory.actions.markVerifiedNow', { ns: 'file' })}
                        </Button>
                        {recallPolicyDraft.staleAt ? (
                          <Button size={'small'} onClick={handleRevalidateNow}>
                            {t('space.memory.actions.revalidateNow', { ns: 'file' })}
                          </Button>
                        ) : (
                          <Button size={'small'} onClick={handleMarkStaleNow}>
                            {t('space.memory.actions.markStale', { ns: 'file' })}
                          </Button>
                        )}
                        <Button
                          disabled={!recallPolicyDraft.expiresAt}
                          size={'small'}
                          onClick={() =>
                            setRecallPolicyDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    expiresAt: '',
                                  }
                                : current,
                            )
                          }
                        >
                          {t('space.memory.actions.clearExpiry', { ns: 'file' })}
                        </Button>
                        <Button
                          disabled={!recallPolicyDirty}
                          loading={savingRecallPolicy}
                          size={'small'}
                          type={'primary'}
                          onClick={handleSaveRecallPolicy}
                        >
                          {t('space.memory.actions.saveRecallPolicy', { ns: 'file' })}
                        </Button>
                      </Flexbox>
                    </Flexbox>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <div className={styles.detailBlock}>
                <Text className={styles.detailLabel}>
                  {t('space.memory.detail.provenance', { ns: 'file' })}
                </Text>
                <Flexbox gap={6}>
                  {renderIntakeOriginLabel(detailEntry) && (
                    <Text>{renderIntakeOriginLabel(detailEntry)}</Text>
                  )}
                  {renderProducerLabel(detailEntry) && (
                    <Text type={'secondary'}>{renderProducerLabel(detailEntry)}</Text>
                  )}
                  {renderTraceLabel(detailEntry) && (
                    <Text type={'secondary'}>{renderTraceLabel(detailEntry)}</Text>
                  )}
                  {renderActorLabel(detailEntry) && (
                    <Text type={'secondary'}>{renderActorLabel(detailEntry)}</Text>
                  )}
                  <Text type={'secondary'}>{renderTimelineLabel(detailEntry)}</Text>
                </Flexbox>
              </div>

              <div className={styles.detailBlock}>
                <Text className={styles.detailLabel}>
                  {t('space.memory.detail.history', { ns: 'file' })}
                </Text>
                {history.length === 0 ? (
                  <Text type={'secondary'}>{t('space.memory.detail.empty', { ns: 'file' })}</Text>
                ) : (
                  <div className={styles.entryHistoryList}>
                    {history.map((item, index) => (
                      <div
                        className={styles.entryHistoryItem}
                        key={`${detailEntry.id}-${item.at}-${index}`}
                      >
                        <Flexbox gap={6}>
                          <Text size={'small'} type={'secondary'}>
                            {renderHistoryMessage(item, true)}
                          </Text>
                          {renderHistoryActor(item) && (
                            <Text size={'small'} type={'secondary'}>
                              {renderHistoryActor(item)}
                            </Text>
                          )}
                          {renderHistoryResolution(item)}
                          {renderHistoryChanges(item)}
                        </Flexbox>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </Flexbox>
      </Drawer>
    );
  };

  return (
    <Flexbox className={styles.page} gap={24} horizontal={!isMobile}>
      {!isMobile && (
        <Block className={styles.scopeRail} padding={12} variant={'outlined'}>
          <MemoryScopeSection activeSpaceId={summary.id} currentScope="space" />
        </Block>
      )}

      <Flexbox flex={1} gap={24} style={{ minWidth: 0 }}>
        <SurfaceBreadcrumb
          segments={[
            {
              key: 'space',
              label: displayName,
              onClick: () => navigate(buildSpaceRootPath(summary.id)),
            },
            {
              current: true,
              key: 'memory',
              label: t('space.memory.title', { ns: 'file' }),
            },
          ]}
        />

        <Flexbox gap={10}>
          <Flexbox horizontal align={'center'} gap={8} wrap={'wrap'}>
            <Text as={'h1'} fontSize={32} style={{ margin: 0 }} weight={700}>
              {t('space.memory.title', { ns: 'file' })}
            </Text>
            <Tag size={'small'} variant={'filled'}>
              {displayName}
            </Tag>
            <Tag size={'small'} variant={'outlined'}>
              {t(isTeamSpace ? 'space.home.badges.team' : 'space.home.badges.personal', {
                ns: 'file',
              })}
            </Tag>
          </Flexbox>
          <Text type={'secondary'}>
            {t(isTeamSpace ? 'space.memory.subtitle.team' : 'space.memory.subtitle.personal', {
              ns: 'file',
            })}
          </Text>
        </Flexbox>

        <Block padding={18} variant={'outlined'}>
          <Flexbox gap={8}>
            <Text strong>{t('space.memory.overview.title', { ns: 'file' })}</Text>
            <Text type={'secondary'}>
              <Trans i18nKey={'space.memory.overview.body'} ns={'file'} />
            </Text>
            <Text type={'secondary'}>
              {t(
                !isTeamSpace
                  ? 'space.memory.overview.mode.personal'
                  : canReview
                    ? 'space.memory.overview.mode.reviewer'
                    : 'space.memory.overview.mode.viewer',
                { ns: 'file' },
              )}
            </Text>
            {!isTeamSpace && (
              <Flexbox horizontal gap={8}>
                <Button type={'primary'} onClick={() => navigate('/memory')}>
                  {t('space.memory.actions.openPersonal', { ns: 'file' })}
                </Button>
              </Flexbox>
            )}
          </Flexbox>
        </Block>

        {isTeamSpace && canReview && workspaceRecallOverview.length > 0 && (
          <Block padding={18} variant={'outlined'}>
            <Flexbox gap={10}>
              <Text strong>{t('space.memory.overview.recallStatus', { ns: 'file' })}</Text>
              <Flexbox horizontal gap={8} wrap={'wrap'}>
                {workspaceRecallOverview.map((item) => (
                  <Button
                    aria-label={`Workspace ${item.label} ${item.count}`}
                    disabled={item.count === 0}
                    key={item.value}
                    size={'small'}
                    type={'default'}
                    onClick={() =>
                      navigateToSection(findFirstSectionForRecallFilter(item.value), item.value)
                    }
                  >
                    {`${item.label} ${item.count}`}
                  </Button>
                ))}
              </Flexbox>
            </Flexbox>
          </Block>
        )}

        <Flexbox gap={12}>
          <Segmented
            block
            value={section}
            variant={'filled'}
            options={visibleSections.map((item) => ({
              label: `${item.title} · ${summary.sections[item.key].count}`,
              value: item.key,
            }))}
            onChange={(value) => navigateToSection(value as SpaceMemorySection)}
          />

          {isTeamSpace && canReview && reviewedSectionRecallSummaries.length > 0 && (
            <Block padding={18} variant={'outlined'}>
              <Flexbox gap={10}>
                <Text strong>{t('space.memory.sections.recallSummary', { ns: 'file' })}</Text>
                <Flexbox horizontal gap={8} wrap={'wrap'}>
                  {reviewedSectionRecallSummaries.map((item) => (
                    <Block key={item.key} padding={12} variant={'outlined'}>
                      <Flexbox gap={8}>
                        <Flexbox horizontal align={'center'} gap={8} justify={'space-between'}>
                          <Button
                            aria-label={`${item.title} ${item.count}`}
                            size={'small'}
                            type={
                              section === item.key && recallFilter === 'all' ? 'primary' : 'default'
                            }
                            onClick={() => navigateToSection(item.key)}
                          >
                            {item.title}
                          </Button>
                          <Tag size={'small'} variant={'outlined'}>
                            {item.count}
                          </Tag>
                        </Flexbox>
                        <Flexbox horizontal gap={8} wrap={'wrap'}>
                          {[
                            {
                              count: item.recall.active,
                              label: t('space.memory.filters.recall.active', { ns: 'file' }),
                              value: 'active' as RecallFilterMode,
                            },
                            {
                              count: item.recall.disabled,
                              label: t('space.memory.filters.recall.disabled', { ns: 'file' }),
                              value: 'disabled' as RecallFilterMode,
                            },
                            {
                              count: item.recall.expired,
                              label: t('space.memory.filters.recall.expired', { ns: 'file' }),
                              value: 'expired' as RecallFilterMode,
                            },
                            {
                              count: item.recall.stale,
                              label: t('space.memory.filters.recall.stale', { ns: 'file' }),
                              value: 'stale' as RecallFilterMode,
                            },
                          ].map((status) => (
                            <Button
                              aria-label={`${item.title} ${status.label} ${status.count}`}
                              key={status.value}
                              size={'small'}
                              type={
                                section === item.key && recallFilter === status.value
                                  ? 'primary'
                                  : 'default'
                              }
                              onClick={() => navigateToSection(item.key, status.value)}
                            >
                              {`${status.label} ${status.count}`}
                            </Button>
                          ))}
                        </Flexbox>
                      </Flexbox>
                    </Block>
                  ))}
                </Flexbox>
              </Flexbox>
            </Block>
          )}

          <Block padding={18} variant={'outlined'}>
            <Flexbox gap={10}>
              <Flexbox horizontal align={'center'} gap={10}>
                <activeSection.icon size={20} strokeWidth={2.1} />
                <Text fontSize={18} weight={600}>
                  {activeSection.title}
                </Text>
                <Tag size={'small'} variant={'outlined'}>
                  {summary.sections[section].count}
                </Tag>
              </Flexbox>
              <Text type={'secondary'}>{activeSection.description}</Text>
            </Flexbox>
          </Block>
        </Flexbox>

        <Block padding={18} variant={'outlined'}>
          <Flexbox gap={12}>
            {section === 'inbox' && canCreate && (
              <Block padding={16} variant={'outlined'}>
                <Flexbox gap={12}>
                  <Flexbox gap={4}>
                    <Text fontSize={16} weight={600}>
                      {t('space.memory.actions.create', { ns: 'file' })}
                    </Text>
                    <Text type={'secondary'}>
                      {t('space.memory.composer.description', { ns: 'file' })}
                    </Text>
                  </Flexbox>

                  <Text size={'small'} type={'secondary'}>
                    {t('space.memory.composer.titleLabel', { ns: 'file' })}
                  </Text>
                  <Input
                    aria-label={t('space.memory.composer.titleLabel', { ns: 'file' })}
                    maxLength={255}
                    name={'space-memory-candidate-title'}
                    placeholder={t('space.memory.composer.titlePlaceholder', { ns: 'file' })}
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                  />

                  <Text size={'small'} type={'secondary'}>
                    {t('space.memory.composer.summaryLabel', { ns: 'file' })}
                  </Text>
                  <Input.TextArea
                    aria-label={t('space.memory.composer.summaryLabel', { ns: 'file' })}
                    autoSize={{ maxRows: 5, minRows: 3 }}
                    maxLength={1000}
                    name={'space-memory-candidate-summary'}
                    placeholder={t('space.memory.composer.summaryPlaceholder', { ns: 'file' })}
                    value={draftSummary}
                    onChange={(e) => setDraftSummary(e.target.value)}
                  />

                  <Flexbox gap={8}>
                    <Text size={'small'} type={'secondary'}>
                      {t('space.memory.composer.categoryLabel', { ns: 'file' })}
                    </Text>
                    <Segmented
                      block
                      value={draftCategory}
                      options={spaceMemoryCategories.map((category) => ({
                        label: t(`space.memory.categories.${category}`, { ns: 'file' }),
                        value: category,
                      }))}
                      onChange={(value) => setDraftCategory(value as SpaceMemoryCategory)}
                    />
                  </Flexbox>

                  <Flexbox horizontal justify={'flex-end'}>
                    <Button loading={creating} type={'primary'} onClick={handleCreateCandidate}>
                      {t('space.memory.actions.create', { ns: 'file' })}
                    </Button>
                  </Flexbox>
                </Flexbox>
              </Block>
            )}

            <Flexbox horizontal align={'center'} gap={10} justify={'space-between'}>
              <Text fontSize={18} weight={600}>
                {t('space.memory.entries.title', { ns: 'file', section: activeSection.title })}
              </Text>
              <Flexbox horizontal align={'center'} gap={8} wrap={'wrap'}>
                {supportsRecallFilter && sectionCanReview && (
                  <Segmented
                    size={'small'}
                    value={effectiveRecallFilter}
                    options={[
                      {
                        label: t('space.memory.filters.recall.all', { ns: 'file' }),
                        value: 'all',
                      },
                      {
                        label: t('space.memory.filters.recall.active', { ns: 'file' }),
                        value: 'active',
                      },
                      {
                        label: t('space.memory.filters.recall.disabled', { ns: 'file' }),
                        value: 'disabled',
                      },
                      {
                        label: t('space.memory.filters.recall.expired', { ns: 'file' }),
                        value: 'expired',
                      },
                      {
                        label: t('space.memory.filters.recall.stale', { ns: 'file' }),
                        value: 'stale',
                      },
                    ]}
                    onChange={(value) => setRecallFilter(value as RecallFilterMode)}
                  />
                )}
                <Tag size={'small'} variant={'outlined'}>
                  {visibleEntryList.length}
                </Tag>
              </Flexbox>
            </Flexbox>

            {supportsRecallFilter && sectionCanReview && entryList.length > 0 && (
              <Block padding={12} variant={'outlined'}>
                <Flexbox gap={8}>
                  <Text size={'small'} type={'secondary'}>
                    {t('space.memory.filters.recall.summary', { ns: 'file' })}
                  </Text>
                  <Flexbox horizontal gap={8} wrap={'wrap'}>
                    {recallOverview.map((item) => (
                      <Button
                        key={item.value}
                        size={'small'}
                        type={effectiveRecallFilter === item.value ? 'primary' : 'default'}
                        onClick={() => setRecallFilter(item.value)}
                      >
                        {`${item.label} ${item.count}`}
                      </Button>
                    ))}
                  </Flexbox>
                </Flexbox>
              </Block>
            )}

            {section === 'inbox' && sectionCanReview && visibleEntryList.length > 0 && (
              <Block padding={12} variant={'outlined'}>
                <Flexbox
                  horizontal
                  align={'center'}
                  gap={10}
                  justify={'space-between'}
                  wrap={'wrap'}
                >
                  <Text size={'small'} type={'secondary'}>
                    {t('space.memory.entries.selection', {
                      count: selectedEntryIds.length,
                      ns: 'file',
                    })}
                  </Text>
                  <Flexbox horizontal gap={8} wrap={'wrap'}>
                    <Button
                      disabled={selectedEntryIds.length === 0}
                      loading={batchAction === 'reject'}
                      size={'small'}
                      onClick={handleBatchReject}
                    >
                      {t('space.memory.actions.rejectSelected', { ns: 'file' })}
                    </Button>
                    <Button
                      disabled={selectedEntryIds.length === 0}
                      loading={batchAction === 'publish'}
                      size={'small'}
                      type={'primary'}
                      onClick={handleBatchPublish}
                    >
                      {t('space.memory.actions.publishSelected', { ns: 'file' })}
                    </Button>
                    <Button disabled={allVisibleSelected} size={'small'} onClick={selectAllVisible}>
                      {t('space.memory.actions.selectAll', { ns: 'file' })}
                    </Button>
                    <Button
                      disabled={selectedEntryIds.length === 0}
                      size={'small'}
                      onClick={clearSelection}
                    >
                      {t('space.memory.actions.clearSelection', { ns: 'file' })}
                    </Button>
                  </Flexbox>
                </Flexbox>
              </Block>
            )}

            {supportsRecallFilter &&
              effectiveRecallFilter === 'stale' &&
              sectionCanReview &&
              visibleEntryList.length > 0 && (
                <Block padding={12} variant={'outlined'}>
                  <Flexbox
                    horizontal
                    align={'center'}
                    gap={10}
                    justify={'space-between'}
                    wrap={'wrap'}
                  >
                    <Text size={'small'} type={'secondary'}>
                      {t('space.memory.entries.selection', {
                        count: selectedEntryIds.length,
                        ns: 'file',
                      })}
                    </Text>
                    <Flexbox horizontal gap={8} wrap={'wrap'}>
                      <Button
                        disabled={selectedEntryIds.length === 0}
                        loading={exportingSelectedAuditSummary}
                        size={'small'}
                        onClick={handleExportSelectedAuditSummary}
                      >
                        {t('space.memory.actions.exportSelectedAuditSummary', { ns: 'file' })}
                      </Button>
                      <Button
                        disabled={selectedEntryIds.length === 0}
                        loading={exportingSelectedAudits}
                        size={'small'}
                        onClick={handleExportSelectedAudits}
                      >
                        {t('space.memory.actions.exportSelectedAudits', { ns: 'file' })}
                      </Button>
                      <Button
                        disabled={selectedEntryIds.length === 0}
                        loading={batchAction === 'revalidate'}
                        size={'small'}
                        type={'primary'}
                        onClick={handleBatchRevalidate}
                      >
                        {t('space.memory.actions.revalidateSelected', { ns: 'file' })}
                      </Button>
                      <Button
                        disabled={allVisibleSelected}
                        size={'small'}
                        onClick={selectAllVisible}
                      >
                        {t('space.memory.actions.selectAll', { ns: 'file' })}
                      </Button>
                      <Button
                        disabled={selectedEntryIds.length === 0}
                        size={'small'}
                        onClick={clearSelection}
                      >
                        {t('space.memory.actions.clearSelection', { ns: 'file' })}
                      </Button>
                    </Flexbox>
                  </Flexbox>
                </Block>
              )}

            {supportsRecallFilter &&
              (effectiveRecallFilter === 'disabled' || effectiveRecallFilter === 'expired') &&
              sectionCanReview &&
              visibleEntryList.length > 0 && (
                <Block padding={12} variant={'outlined'}>
                  <Flexbox
                    horizontal
                    align={'center'}
                    gap={10}
                    justify={'space-between'}
                    wrap={'wrap'}
                  >
                    <Text size={'small'} type={'secondary'}>
                      {t('space.memory.entries.selection', {
                        count: selectedEntryIds.length,
                        ns: 'file',
                      })}
                    </Text>
                    <Flexbox horizontal gap={8} wrap={'wrap'}>
                      <Button
                        disabled={selectedEntryIds.length === 0}
                        loading={exportingSelectedAuditSummary}
                        size={'small'}
                        onClick={handleExportSelectedAuditSummary}
                      >
                        {t('space.memory.actions.exportSelectedAuditSummary', { ns: 'file' })}
                      </Button>
                      <Button
                        disabled={selectedEntryIds.length === 0}
                        loading={exportingSelectedAudits}
                        size={'small'}
                        onClick={handleExportSelectedAudits}
                      >
                        {t('space.memory.actions.exportSelectedAudits', { ns: 'file' })}
                      </Button>
                      <Button
                        disabled={allVisibleSelected}
                        size={'small'}
                        onClick={selectAllVisible}
                      >
                        {t('space.memory.actions.selectAll', { ns: 'file' })}
                      </Button>
                      <Button
                        disabled={selectedEntryIds.length === 0}
                        size={'small'}
                        onClick={clearSelection}
                      >
                        {t('space.memory.actions.clearSelection', { ns: 'file' })}
                      </Button>
                    </Flexbox>
                  </Flexbox>
                </Block>
              )}

            {supportsRecallFilter &&
              (effectiveRecallFilter === 'active' || effectiveRecallFilter === 'all') &&
              sectionCanReview &&
              selectableEntryIds.length > 0 && (
                <Block padding={12} variant={'outlined'}>
                  <Flexbox
                    horizontal
                    align={'center'}
                    gap={10}
                    justify={'space-between'}
                    wrap={'wrap'}
                  >
                    <Text size={'small'} type={'secondary'}>
                      {t('space.memory.entries.selection', {
                        count: selectedEntryIds.length,
                        ns: 'file',
                      })}
                    </Text>
                    <Flexbox horizontal gap={8} wrap={'wrap'}>
                      <Button
                        disabled={selectedEntryIds.length === 0}
                        loading={exportingSelectedAuditSummary}
                        size={'small'}
                        onClick={handleExportSelectedAuditSummary}
                      >
                        {t('space.memory.actions.exportSelectedAuditSummary', { ns: 'file' })}
                      </Button>
                      <Button
                        disabled={selectedEntryIds.length === 0}
                        loading={exportingSelectedAudits}
                        size={'small'}
                        onClick={handleExportSelectedAudits}
                      >
                        {t('space.memory.actions.exportSelectedAudits', { ns: 'file' })}
                      </Button>
                      <Button
                        disabled={selectedEntryIds.length === 0}
                        loading={batchAction === 'stale'}
                        size={'small'}
                        onClick={handleBatchMarkStale}
                      >
                        {t('space.memory.actions.staleSelected', { ns: 'file' })}
                      </Button>
                      <Button
                        disabled={allVisibleSelected}
                        size={'small'}
                        onClick={selectAllVisible}
                      >
                        {t('space.memory.actions.selectAll', { ns: 'file' })}
                      </Button>
                      <Button
                        disabled={selectedEntryIds.length === 0}
                        size={'small'}
                        onClick={clearSelection}
                      >
                        {t('space.memory.actions.clearSelection', { ns: 'file' })}
                      </Button>
                    </Flexbox>
                  </Flexbox>
                </Block>
              )}

            {visibleEntryList.length === 0 ? (
              <Text type={'secondary'}>
                {supportsRecallFilter && effectiveRecallFilter === 'active' && entryList.length > 0
                  ? t('space.memory.filters.recall.emptyActive', { ns: 'file' })
                  : supportsRecallFilter &&
                      effectiveRecallFilter === 'stale' &&
                      entryList.length > 0
                    ? t('space.memory.filters.recall.emptyStale', { ns: 'file' })
                    : supportsRecallFilter &&
                        effectiveRecallFilter === 'disabled' &&
                        entryList.length > 0
                      ? t('space.memory.filters.recall.emptyDisabled', { ns: 'file' })
                      : supportsRecallFilter &&
                          effectiveRecallFilter === 'expired' &&
                          entryList.length > 0
                        ? t('space.memory.filters.recall.emptyExpired', { ns: 'file' })
                        : t(`space.memory.sections.${section}.empty`, { ns: 'file' })}
              </Text>
            ) : (
              <div className={styles.memoryEntryList}>
                {visibleEntryList.map((entry) => (
                  <div
                    key={entry.id}
                    className={
                      focusedEntryId === entry.id
                        ? `${styles.memoryEntry} ${styles.memoryEntryFocused}`
                        : styles.memoryEntry
                    }
                    ref={(node) => {
                      entryRefs.current[entry.id] = node;
                    }}
                  >
                    <Flexbox gap={10}>
                      <Flexbox horizontal align={'center'} gap={8} justify={'space-between'}>
                        <Flexbox horizontal align={'center'} gap={8} wrap={'wrap'}>
                          {selectableEntryIdSet.has(entry.id) && (
                            <Checkbox
                              checked={selectedEntryIds.includes(entry.id)}
                              onChange={(event) =>
                                toggleEntrySelection(entry.id, event.target.checked)
                              }
                            />
                          )}
                          <Text fontSize={16} weight={600}>
                            {entry.title}
                          </Text>
                          <Tag size={'small'} variant={'outlined'}>
                            {t(`space.memory.categories.${entry.category}`, { ns: 'file' })}
                          </Tag>
                          <Tag size={'small'} variant={'outlined'}>
                            {entry.kind === 'candidate'
                              ? t('space.memory.entries.candidate', { ns: 'file' })
                              : t('space.memory.entries.memory', { ns: 'file' })}
                          </Tag>
                          {entry.kind === 'memory' && sectionCanReview && (
                            <Tag size={'small'} variant={'outlined'}>
                              {renderRecallStatusLabel(entry)}
                            </Tag>
                          )}
                          <Button
                            size={'small'}
                            type={'text'}
                            onClick={() => openDetailEntry(entry.id)}
                          >
                            {t('space.memory.actions.viewDetails', { ns: 'file' })}
                          </Button>
                        </Flexbox>

                        {section === 'inbox' && sectionCanReview && (
                          <Flexbox horizontal gap={8}>
                            {entry.reviewHint?.kind === 'duplicate_published' && (
                              <Button
                                loading={mergingId === entry.id}
                                size={'small'}
                                onClick={() => handleMerge(entry, entry.reviewHint.match.id)}
                              >
                                {t('space.memory.actions.merge', { ns: 'file' })}
                              </Button>
                            )}
                            <Button
                              loading={rejectingId === entry.id}
                              size={'small'}
                              onClick={() => handleReject(entry.id)}
                            >
                              {t('space.memory.actions.reject', { ns: 'file' })}
                            </Button>
                            <Button
                              loading={publishingId === entry.id}
                              size={'small'}
                              type={'primary'}
                              onClick={() => handlePublish(entry)}
                            >
                              {t('space.memory.actions.publish', { ns: 'file' })}
                            </Button>
                          </Flexbox>
                        )}
                      </Flexbox>

                      <Flexbox horizontal align={'center'} gap={8} wrap={'wrap'}>
                        {renderGovernanceHistory(entry)}
                        {entry.summary && (
                          <Text size={'small'} type={'secondary'}>
                            {entry.summary}
                          </Text>
                        )}
                        {renderReviewHint(entry)}
                        {renderIntakeOriginLabel(entry) && (
                          <Tag size={'small'} variant={'outlined'}>
                            {renderIntakeOriginLabel(entry)}
                          </Tag>
                        )}
                        {renderProducerLabel(entry) && (
                          <Text size={'small'} type={'secondary'}>
                            {renderProducerLabel(entry)}
                          </Text>
                        )}
                        {entry.sourceRefs.length > 0 && (
                          <div className={styles.sourceRefList}>
                            {entry.sourceRefs.map((source) => (
                              <Tag
                                key={`${entry.id}-${source.kind}-${source.id}`}
                                size={'small'}
                                variant={'filled'}
                              >
                                {renderSourceLabel(source)}
                              </Tag>
                            ))}
                          </div>
                        )}
                        <Text size={'small'} type={'secondary'}>
                          {t('space.memory.entries.sources', {
                            count: entry.sourceCount,
                            ns: 'file',
                          })}
                        </Text>
                        <Text size={'small'} type={'secondary'}>
                          {renderTimelineLabel(entry)}
                        </Text>
                        {renderActorLabel(entry) && (
                          <Text size={'small'} type={'secondary'}>
                            {renderActorLabel(entry)}
                          </Text>
                        )}
                      </Flexbox>
                    </Flexbox>
                  </div>
                ))}
              </div>
            )}
          </Flexbox>
        </Block>

        <Button onClick={() => navigate(buildSpaceRootPath(summary.id))}>
          {t('space.settings.back', { ns: 'file' })}
        </Button>
      </Flexbox>
      {renderDetailDrawer()}
    </Flexbox>
  );
});

SpaceMemoryPage.displayName = 'SpaceMemoryPage';

export default SpaceMemoryPage;
