/**
 * @vitest-environment happy-dom
 */
import type {
  SpaceMemoryEntryResult,
  SpaceMemoryEntryPreview,
  SpaceMemorySectionResult,
  SpaceMemorySectionSummary,
  SpaceMemorySurfaceContract,
  SpaceMemorySummary,
} from '@lobechat/types';
import { getSpaceMemorySurfaceContract } from '@lobechat/types';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SpaceMemoryPage from './SpaceMemoryPage';

const {
  exportFileMock,
  exportJSONFileMock,
  exportAuditBundleQuery,
  exportAuditBundlesQuery,
  memorySidebarPortalMock,
  mergeEntryMutate,
  messageApi,
  mutateMock,
  navigateMock,
  publishEntriesMutate,
  publishEntryMutate,
  markEntriesStaleMutate,
  revalidateEntriesMutate,
  updateRecallPolicyMutate,
  writeTextMock,
  searchParamsState,
  setSearchParamsMock,
  swrState,
} = vi.hoisted(() => ({
  exportFileMock: vi.fn(),
  exportJSONFileMock: vi.fn(),
  exportAuditBundleQuery: vi.fn(),
  exportAuditBundlesQuery: vi.fn(),
  memorySidebarPortalMock: vi.fn(),
  mergeEntryMutate: vi.fn(),
  messageApi: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
  mutateMock: vi.fn(),
  navigateMock: vi.fn(),
  publishEntriesMutate: vi.fn(),
  publishEntryMutate: vi.fn(),
  markEntriesStaleMutate: vi.fn(),
  revalidateEntriesMutate: vi.fn(),
  updateRecallPolicyMutate: vi.fn(),
  writeTextMock: vi.fn(),
  searchParamsState: {
    initial: 'section=published',
  },
  setSearchParamsMock: vi.fn(),
  swrState: {
    entries: {} as Record<string, SpaceMemoryEntryResult>,
    sections: {} as Record<string, SpaceMemorySectionResult>,
    summary: null as SpaceMemorySummary | null,
  },
}));

vi.mock('@lobechat/utils/client', () => ({
  exportFile: exportFileMock,
  exportJSONFile: exportJSONFileMock,
}));

vi.mock('@lobehub/ui', () => ({
  Block: ({ children }: any) => <div>{children}</div>,
  Button: ({ children, onClick, ...props }: any) => (
    <button {...props} type={'button'} onClick={onClick}>
      {children}
    </button>
  ),
  Flexbox: ({ children }: any) => <div>{children}</div>,
  Segmented: ({ onChange, options = [], value }: any) => (
    <div>
      {options.map((option: any) => (
        <button
          data-active={option.value === value}
          key={option.value}
          type={'button'}
          onClick={() => onChange?.(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  ),
  Tag: ({ children }: any) => <span>{children}</span>,
  Text: ({ children }: any) => <span>{children}</span>,
}));

vi.mock('antd', async () => {
  const Input = ({ onChange, value, ...props }: any) => (
    <input {...props} value={value ?? ''} onChange={onChange} />
  );

  Input.TextArea = ({ onChange, value, ...props }: any) => (
    <textarea {...props} value={value ?? ''} onChange={onChange} />
  );

  return {
    App: {
      useApp: () => ({ message: messageApi }),
    },
    Checkbox: ({ checked, children, onChange }: any) => (
      <label>
        <input checked={checked} type={'checkbox'} onChange={onChange} />
        {children}
      </label>
    ),
    Drawer: ({ children, open, title, onClose }: any) =>
      open ? (
        <div data-testid={'drawer'}>
          <div>{title}</div>
          <button type={'button'} onClick={onClose}>
            close
          </button>
          {children}
        </div>
      ) : null,
    Input,
  };
});

vi.mock('antd-style', () => ({
  createStyles: () => () => ({
    styles: new Proxy(
      {},
      {
        get: (_, key) => String(key),
      },
    ),
  }),
}));

vi.mock('react-i18next', () => ({
  Trans: ({ i18nKey }: any) => <>{i18nKey}</>,
  useTranslation: () => ({
    t: (key: string, options?: Record<string, any>) => {
      const staticTranslations: Record<string, string> = {
        'space.home.badges.team': 'Team Space',
        'space.memory.actions.batchFailureReason.already_reviewed': `${options?.count} already reviewed`,
        'space.memory.actions.clearSelection': 'Clear Selection',
        'space.memory.actions.copyAuditLink': 'Copy Audit Link',
        'space.memory.actions.copyAuditLinkError': 'Failed to copy audit link',
        'space.memory.actions.copyAuditLinkSuccess': 'Audit link copied',
        'space.memory.actions.exportAudit': 'Export Audit JSON',
        'space.memory.actions.exportAuditError': 'Failed to export audit JSON',
        'space.memory.actions.exportAuditSuccess': 'Audit JSON exported',
        'space.memory.actions.exportSelectedAudits': 'Export Selected Audits',
        'space.memory.actions.exportSelectedAuditsError': 'Failed to export selected audit JSON',
        'space.memory.actions.exportSelectedAuditsSuccess': 'Selected audit JSON exported',
        'space.memory.actions.exportSelectedAuditSummary': 'Export Selected Audit CSV',
        'space.memory.actions.exportSelectedAuditSummaryError':
          'Failed to export selected audit CSV',
        'space.memory.actions.exportSelectedAuditSummarySuccess': 'Selected audit CSV exported',
        'space.memory.actions.publishBatchFailureDetails': `Remaining: ${options?.details}`,
        'space.memory.actions.publishBatchPartial': `${options?.succeeded} published, ${options?.failed} still need review`,
        'space.memory.actions.publish': 'Publish',
        'space.memory.actions.publishSelected': 'Publish Selected',
        'space.memory.actions.publishSuccess': 'Memory published',
        'space.memory.actions.clearExpiry': 'Clear Expiry',
        'space.memory.actions.markStale': 'Mark Stale',
        'space.memory.actions.markVerifiedNow': 'Mark Verified Now',
        'space.memory.actions.reject': 'Reject',
        'space.memory.actions.revalidateNow': 'Revalidate Now',
        'space.memory.actions.revalidateSelected': 'Revalidate Selected',
        'space.memory.actions.staleSelected': 'Mark Selected as Needs Review',
        'space.memory.actions.saveRecallPolicy': 'Save Recall Policy',
        'space.memory.actions.saveRecallPolicyError': 'Failed to save recall policy',
        'space.memory.actions.saveRecallPolicySuccess': 'Recall policy saved',
        'space.memory.actions.selectAll': 'Select All',
        'space.memory.actions.viewAudit': 'View Audit',
        'space.memory.actions.viewDetails': 'View Details',
        'space.memory.categories.general': 'General',
        'space.memory.detail.content': 'Content',
        'space.memory.detail.empty': 'Nothing recorded yet.',
        'space.memory.detail.history': 'Governance History',
        'space.memory.detail.provenance': 'Provenance',
        'space.memory.detail.recall.active': 'Recall Active',
        'space.memory.detail.recall.disabled': 'Recall Paused',
        'space.memory.detail.recall.enabled': 'Enabled',
        'space.memory.detail.recall.expiresAt': 'Expires At',
        'space.memory.detail.recall.lastVerifiedAt': 'Last Verified At',
        'space.memory.detail.recall.noExpiry': 'No expiry',
        'space.memory.detail.recall.notStale': 'Not stale',
        'space.memory.detail.recall.stale': 'Marked Stale',
        'space.memory.detail.recall.staleAt': 'Stale At',
        'space.memory.detail.recall.title': 'Recall Policy',
        'space.memory.detail.recall.toggle': 'Include in Team Recall',
        'space.memory.detail.sources': 'Sources',
        'space.memory.detail.summary': 'Summary',
        'space.memory.detail.tabs.audit': 'Audit',
        'space.memory.detail.tabs.overview': 'Overview',
        'space.memory.entries.candidate': 'Candidate',
        'space.memory.entries.history.policyUpdated': 'Recall policy updated',
        'space.memory.entries.history.hide': 'Hide history',
        'space.memory.entries.history.after': 'After',
        'space.memory.entries.history.before': 'Before',
        'space.memory.entries.history.by': `by ${options?.name}`,
        'space.memory.entries.history.changeSet': 'Applied changes',
        'space.memory.entries.history.label': 'Recent review',
        'space.memory.entries.history.publish': 'Just published from Inbox',
        'space.memory.entries.history.resolution.content': 'Updated content',
        'space.memory.entries.history.resolution.sources': 'Appended sources',
        'space.memory.entries.history.resolution.summary': 'Updated summary',
        'space.memory.entries.history.resolution.title': 'Updated title',
        'space.memory.entries.intake.origin.manual': 'Manual',
        'space.memory.entries.memory': 'Published',
        'space.memory.entries.recall.active': 'Recall Active',
        'space.memory.entries.recall.disabled': 'Recall Paused',
        'space.memory.entries.recall.expired': 'Recall Expired',
        'space.memory.entries.recall.stale': 'Recall Stale',
        'space.memory.entries.intake.trace': `Trace: ${options?.id}`,
        'space.memory.entries.reviewHint.duplicatePublished': 'Possible duplicate',
        'space.memory.entries.reviewHint.mergeHint': 'Review merge impact',
        'space.memory.entries.reviewHint.updatesContent': 'Update content',
        'space.memory.entries.reviewHint.updatesSummary': 'Update summary',
        'space.memory.entries.reviewHint.updatesTitle': 'Update title',
        'space.memory.entries.selection': `${options?.count} selected`,
        'space.memory.overview.body': 'overview',
        'space.memory.overview.mode.reviewer': 'Reviewer mode',
        'space.memory.overview.mode.viewer': 'Viewer mode',
        'space.memory.overview.recallStatus': 'Workspace Recall Status',
        'space.memory.overview.title': 'How workspace memory works',
        'space.memory.filters.recall.active': 'Active',
        'space.memory.filters.recall.all': 'All',
        'space.memory.filters.recall.disabled': 'Paused',
        'space.memory.filters.recall.empty': 'No published memories need revalidation right now.',
        'space.memory.filters.recall.emptyActive':
          'No published memories are active for recall right now.',
        'space.memory.filters.recall.emptyDisabled': 'No published memories are paused right now.',
        'space.memory.filters.recall.emptyExpired': 'No published memories are expired right now.',
        'space.memory.filters.recall.emptyStale':
          'No published memories need revalidation right now.',
        'space.memory.filters.recall.expired': 'Expired',
        'space.memory.filters.recall.stale': 'Needs Review',
        'space.memory.filters.recall.summary': 'Recall Overview',
        'space.memory.sections.inbox.title': 'Inbox',
        'space.memory.sections.playbooks.title': 'Playbooks',
        'space.memory.sections.policies.title': 'Policies',
        'space.memory.sections.published.title': 'Published',
        'space.memory.sections.recallSummary': 'Section Recall Status',
        'space.memory.title': 'Space Memory',
        'space.settings.back': 'Back',
      };

      if (key in staticTranslations) {
        return staticTranslations[key];
      }

      switch (key) {
        case 'space.memory.actions.merge': {
          return 'Merge';
        }
        case 'space.memory.sections.inbox.description':
        case 'space.memory.sections.published.description':
        case 'space.memory.sections.playbooks.description':
        case 'space.memory.sections.policies.description': {
          return key;
        }
        case 'space.memory.entries.history.merge': {
          return `Just updated by merging candidate "${options?.name}"`;
        }
        case 'space.memory.entries.history.showMore_one':
        case 'space.memory.entries.history.showMore_other': {
          return `Show ${options?.count} earlier events`;
        }
        case 'space.memory.detail.title': {
          return `${options?.name} Details`;
        }
        case 'space.memory.detail.recall.expiresAtValue': {
          return `Expires ${options?.date}`;
        }
        case 'space.memory.detail.recall.lastVerifiedValue': {
          return `Verified ${options?.date}`;
        }
        case 'space.memory.detail.recall.staleAtValue': {
          return `Stale since ${options?.date}`;
        }
        case 'space.memory.entries.publishedBy': {
          return `Published by ${options?.name}`;
        }
        case 'space.memory.entries.publishedAt': {
          return `Published ${options?.time}`;
        }
        case 'space.memory.entries.intake.producer': {
          return `Producer: ${options?.name}`;
        }
        case 'space.memory.entries.sources_one':
        case 'space.memory.entries.sources_other': {
          return `${options?.count} sources`;
        }
        case 'space.memory.entries.title': {
          return `${options?.section} Entries`;
        }
        default: {
          return options?.defaultValue ?? key;
        }
      }
    },
  }),
}));

vi.mock('react-router-dom', async () => {
  const React = await import('react');

  return {
    useNavigate: () => navigateMock,
    useParams: () => ({ spaceId: 'spc_team' }),
    useSearchParams: () => {
      const [params, setParams] = React.useState(
        () => new URLSearchParams(searchParamsState.initial),
      );

      return [
        params,
        (next: URLSearchParams) => {
          const resolved = new URLSearchParams(next);
          searchParamsState.initial = resolved.toString();
          setSearchParamsMock(resolved);
          setParams(resolved);
        },
      ] as const;
    },
  };
});

vi.mock('swr', () => ({
  default: (key: any) => {
    if (!key) return { data: undefined, isLoading: false };
    if (Array.isArray(key) && key[0] === 'space-memory-summary') {
      return { data: swrState.summary, isLoading: false };
    }
    if (Array.isArray(key) && key[0] === 'space-memory-section') {
      return { data: swrState.sections[key[2]], isLoading: false };
    }
    if (Array.isArray(key) && key[0] === 'space-memory-entry') {
      return { data: swrState.entries[key[2]], error: undefined, isLoading: false };
    }

    return { data: undefined, isLoading: false };
  },
  useSWRConfig: () => ({ mutate: mutateMock }),
}));

vi.mock('@/libs/trpc/client', () => ({
  lambdaClient: {
    spaceMemory: {
      createCandidate: { mutate: vi.fn() },
      exportAuditBundle: { query: exportAuditBundleQuery },
      exportAuditBundles: { query: exportAuditBundlesQuery },
      getEntry: { query: vi.fn() },
      getSummary: { query: vi.fn() },
      ingestCandidates: { mutate: vi.fn() },
      listEntries: { query: vi.fn() },
      markEntriesStale: { mutate: markEntriesStaleMutate },
      mergeEntry: { mutate: mergeEntryMutate },
      publishEntries: { mutate: publishEntriesMutate },
      publishEntry: { mutate: publishEntryMutate },
      revalidateEntries: { mutate: revalidateEntriesMutate },
      rejectEntries: { mutate: vi.fn() },
      rejectEntry: { mutate: vi.fn() },
      updateRecallPolicy: { mutate: updateRecallPolicyMutate },
    },
  },
}));

vi.mock('@/hooks/useIsMobile', () => ({
  useIsMobile: () => false,
}));

vi.mock('@/store/user', () => ({
  useUserStore: (selector: any) => selector(),
}));

vi.mock('@/store/user/slices/auth/selectors', () => ({
  userProfileSelectors: {
    fullName: () => 'Arthur',
    username: () => 'arthur',
  },
}));

vi.mock('./MemorySidebarPortal', () => ({
  default: (props: any) => {
    memorySidebarPortalMock(props);
    return (
      <div data-testid={'memory-sidebar-portal'}>
        {props.currentScope}:{props.activeSpaceId ?? 'none'}
      </div>
    );
  },
}));

vi.mock('./SurfaceBreadcrumb', () => ({
  default: () => <div>SurfaceBreadcrumb</div>,
}));

vi.mock('./resolveSpaceDisplayName', () => ({
  resolveSpaceDisplayName: (summary: any) => summary.name,
}));

vi.mock('@/components/Loading/BrandTextLoading', () => ({
  default: () => <div>Loading</div>,
}));

const makeSectionSummary = (
  count: number,
  recall?: Partial<SpaceMemorySectionSummary['recall']>,
): SpaceMemorySectionSummary => ({
  count,
  recall: {
    active: 0,
    disabled: 0,
    expired: 0,
    stale: 0,
    ...recall,
  },
});

const makeSummary = (options?: { canReview?: boolean }): SpaceMemorySummary => ({
  contract: getSpaceMemorySurfaceContract(options?.canReview === false ? 'viewer' : 'reviewer', {
    canCreate: true,
  }),
  canCreate: true,
  canPublish: true,
  canReview: options?.canReview ?? true,
  id: 'spc_team',
  kind: 'team',
  membershipRole: 'editor',
  name: 'Ops Space',
  surface: options?.canReview === false ? 'viewer' : 'reviewer',
  sections: {
    inbox: makeSectionSummary(1),
    playbooks: makeSectionSummary(0),
    policies: makeSectionSummary(0),
    published: makeSectionSummary(1, { active: 1 }),
  },
});

const makeSectionResult = (
  items: SpaceMemoryEntryPreview[],
  options?: {
    canCreate?: boolean;
    canReview?: boolean;
    contract?: SpaceMemorySurfaceContract;
    section?: SpaceMemorySectionResult['section'];
  },
): SpaceMemorySectionResult => ({
  contract:
    options?.contract ??
    getSpaceMemorySurfaceContract(options?.canReview === false ? 'viewer' : 'reviewer', {
      canCreate: options?.canCreate ?? true,
    }),
  items,
  section: options?.section ?? 'published',
  surface: options?.canReview === false ? 'viewer' : 'reviewer',
});

const makeEntryResult = (
  entry: SpaceMemoryEntryPreview,
  options?: {
    canCreate?: boolean;
    canReview?: boolean;
    contract?: SpaceMemorySurfaceContract;
  },
): SpaceMemoryEntryResult => ({
  contract:
    options?.contract ??
    getSpaceMemorySurfaceContract(options?.canReview === false ? 'viewer' : 'reviewer', {
      canCreate: options?.canCreate ?? true,
    }),
  entry,
  surface: options?.canReview === false ? 'viewer' : 'reviewer',
});

const makePublishedEntry = (): SpaceMemoryEntryPreview => ({
  actor: { id: 'user-1', name: 'Arthur', username: 'arthur' },
  category: 'general',
  content: 'Full policy content',
  history: [
    {
      action: 'merged',
      actor: { id: 'user-1', name: 'Arthur', username: 'arthur' },
      at: '2026-04-04T10:00:00.000Z',
      resolution: {
        appendSources: true,
        applyContent: true,
        applySummary: true,
        applyTitle: true,
      },
      changes: {
        content: { after: 'Full policy content', before: 'Old policy content' },
        summary: { after: 'Published summary', before: 'Old summary' },
        title: { after: 'Release policy', before: 'Old title' },
      },
      sourceTitle: 'Candidate draft',
    },
    { action: 'published', at: '2026-04-03T09:00:00.000Z' },
  ],
  id: 'mem_published',
  intake: { origin: 'manual', producer: 'reviewer', traceId: 'trace-123' },
  kind: 'memory',
  publishedAt: '2026-04-04T10:00:00.000Z',
  recall: {
    lastVerifiedAt: '2026-04-04T10:00:00.000Z',
    recallEnabled: true,
  },
  sourceCount: 1,
  sourceRefs: [{ id: 'doc_1', kind: 'document', title: 'Runbook' }],
  summary: 'Published summary',
  title: 'Release policy',
  updatedAt: '2026-04-04T10:00:00.000Z',
});

const makeStalePublishedEntry = (): SpaceMemoryEntryPreview => ({
  ...makePublishedEntry(),
  id: 'mem_published_stale',
  publishedAt: '2026-04-04T09:00:00.000Z',
  recall: {
    lastVerifiedAt: '2026-04-04T10:00:00.000Z',
    recallBlockedReason: 'stale',
    recallEnabled: true,
    staleAt: '2026-04-04T12:00:00.000Z',
  },
  summary: 'Needs a reviewer to verify it again.',
  title: 'Needs revalidation',
  updatedAt: '2026-04-04T12:00:00.000Z',
});

const makeDisabledPublishedEntry = (): SpaceMemoryEntryPreview => ({
  ...makePublishedEntry(),
  id: 'mem_published_disabled',
  recall: {
    lastVerifiedAt: '2026-04-04T10:00:00.000Z',
    recallBlockedReason: 'disabled',
    recallEnabled: false,
  },
  summary: 'Recall is paused until the reviewer enables it again.',
  title: 'Paused recall',
  updatedAt: '2026-04-04T12:30:00.000Z',
});

const makeExpiredPublishedEntry = (): SpaceMemoryEntryPreview => ({
  ...makePublishedEntry(),
  id: 'mem_published_expired',
  recall: {
    expiresAt: '2026-04-03T09:00:00.000Z',
    lastVerifiedAt: '2026-04-03T09:00:00.000Z',
    recallBlockedReason: 'expired',
    recallEnabled: true,
  },
  summary: 'This policy must be renewed before recall resumes.',
  title: 'Expired recall',
  updatedAt: '2026-04-04T12:45:00.000Z',
});

const makeInboxEntry = (): SpaceMemoryEntryPreview => ({
  actor: { id: 'user-1', name: 'Arthur', username: 'arthur' },
  category: 'general',
  content: 'Candidate content',
  id: 'mem_candidate',
  intake: { origin: 'manual', producer: 'reviewer' },
  kind: 'candidate',
  sourceCount: 0,
  sourceRefs: [],
  summary: 'Candidate summary',
  title: 'Candidate title',
  updatedAt: '2026-04-04T11:00:00.000Z',
});

const makeDuplicateInboxEntry = (): SpaceMemoryEntryPreview => ({
  actor: { id: 'user-1', name: 'Arthur', username: 'arthur' },
  category: 'general',
  content: 'Candidate content',
  id: 'mem_candidate_duplicate',
  intake: { origin: 'manual', producer: 'reviewer' },
  kind: 'candidate',
  reviewHint: {
    kind: 'duplicate_published',
    match: {
      content: 'Full policy content',
      id: 'mem_published',
      publishedAt: '2026-04-04T10:00:00.000Z',
      summary: 'Published summary',
      title: 'Release policy',
    },
    mergePreview: {
      addedSourceCount: 1,
      updatesContent: true,
      updatesSummary: true,
      updatesTitle: true,
    },
  },
  sourceCount: 1,
  sourceRefs: [{ id: 'msg_1', kind: 'message', title: 'Latest discussion' }],
  summary: 'Candidate summary',
  title: 'Candidate title',
  updatedAt: '2026-04-04T11:00:00.000Z',
});

describe('SpaceMemoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: writeTextMock,
      },
    });
    searchParamsState.initial = 'section=published&focus=mem_published';
    swrState.summary = makeSummary();
    swrState.entries = {};
    swrState.sections = {
      inbox: makeSectionResult([makeInboxEntry()], { section: 'inbox' }),
      playbooks: makeSectionResult([], { section: 'playbooks' }),
      policies: makeSectionResult([], { section: 'policies' }),
      published: makeSectionResult([makePublishedEntry()], { section: 'published' }),
    };
    publishEntryMutate.mockResolvedValue({
      category: 'general',
      id: 'mem_published',
    });
    publishEntriesMutate.mockResolvedValue([]);
    markEntriesStaleMutate.mockResolvedValue([]);
    revalidateEntriesMutate.mockResolvedValue([]);
    updateRecallPolicyMutate.mockResolvedValue({
      id: 'mem_published',
      recallEnabled: false,
      staleAt: null,
    });
    exportAuditBundleQuery.mockImplementation(
      async ({
        id,
        recallFilter,
      }: {
        id: string;
        recallFilter: 'active' | 'all' | 'disabled' | 'expired' | 'stale';
        spaceId: string;
      }) => {
        const entry =
          id === 'mem_published_stale'
            ? makeStalePublishedEntry()
            : id === 'mem_published_disabled'
              ? makeDisabledPublishedEntry()
              : id === 'mem_published_expired'
                ? makeExpiredPublishedEntry()
                : id === 'mem_published'
                  ? makePublishedEntry()
                  : {
                      ...makePublishedEntry(),
                      id,
                    };

        return {
          auditPath: `/spaces/spc_team/memory/audit/${id}?section=published${
            recallFilter !== 'all' ? `&recallFilter=${recallFilter}` : ''
          }`,
          detailView: 'audit',
          entry,
          exportedAt: '2026-04-04T13:00:00.000Z',
          recallFilter,
          section: 'published',
          space: {
            id: 'spc_team',
            kind: 'team',
            membershipRole: 'editor',
            name: 'Ops Space',
          },
        };
      },
    );
    exportAuditBundlesQuery.mockImplementation(
      async ({
        ids,
        recallFilter,
      }: {
        ids: string[];
        recallFilter: 'active' | 'all' | 'disabled' | 'expired' | 'stale';
        spaceId: string;
      }) => ({
        count: ids.length,
        exportedAt: '2026-04-04T13:30:00.000Z',
        items: ids.map((id) => ({
          auditPath: `/spaces/spc_team/memory/audit/${id}?section=published${
            recallFilter !== 'all' ? `&recallFilter=${recallFilter}` : ''
          }`,
          detailView: 'audit',
          entry:
            id === 'mem_published_stale'
              ? makeStalePublishedEntry()
              : id === 'mem_published_disabled'
                ? makeDisabledPublishedEntry()
                : id === 'mem_published_expired'
                  ? makeExpiredPublishedEntry()
                  : makePublishedEntry(),
          exportedAt: '2026-04-04T13:30:00.000Z',
          recallFilter,
          section: 'published',
          space: {
            id: 'spc_team',
            kind: 'team',
            membershipRole: 'editor',
            name: 'Ops Space',
          },
        })),
        recallFilter,
        space: {
          id: 'spc_team',
          kind: 'team',
          membershipRole: 'editor',
          name: 'Ops Space',
        },
      }),
    );
    mergeEntryMutate.mockResolvedValue({
      updatedTarget: {
        category: 'general',
        id: 'mem_published',
      },
    });
    exportFileMock.mockImplementation(() => undefined);
    writeTextMock.mockResolvedValue(undefined);
    exportJSONFileMock.mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('opens the detail drawer with governance history and provenance', async () => {
    render(<SpaceMemoryPage />);

    fireEvent.click(screen.getByRole('button', { name: 'View Details' }));

    const drawer = await screen.findByTestId('drawer');
    const drawerQueries = within(drawer);

    expect(drawer).toBeInTheDocument();
    expect(drawerQueries.getByText('Release policy Details')).toBeInTheDocument();
    expect(drawerQueries.getByText('Overview')).toBeInTheDocument();
    expect(drawerQueries.getByText('Summary')).toBeInTheDocument();
    expect(drawerQueries.getByText('Content')).toBeInTheDocument();
    expect(drawerQueries.getByText('Sources')).toBeInTheDocument();
    expect(drawerQueries.getByText('Runbook')).toBeInTheDocument();
    fireEvent.click(drawerQueries.getByRole('button', { name: 'Audit' }));
    expect(drawerQueries.getByText('Governance History')).toBeInTheDocument();
    expect(drawerQueries.getByText('by Arthur')).toBeInTheDocument();
    expect(drawerQueries.getAllByText('Trace: trace-123').length).toBeGreaterThan(0);
    expect(drawerQueries.getByText('Updated title')).toBeInTheDocument();
    expect(drawerQueries.getByText('Updated summary')).toBeInTheDocument();
    expect(drawerQueries.getByText('Updated content')).toBeInTheDocument();
    expect(drawerQueries.getByText('Applied changes')).toBeInTheDocument();
    expect(drawerQueries.getByText('Before')).toBeInTheDocument();
    expect(drawerQueries.getByText('After')).toBeInTheDocument();
    expect(drawerQueries.getByText('Old title')).toBeInTheDocument();
    expect(drawerQueries.getAllByText('Release policy').length).toBeGreaterThan(0);
    expect(
      drawerQueries.getByText(/Just updated by merging candidate "Candidate draft"/),
    ).toBeInTheDocument();
    expect(drawerQueries.getByText(/Just published from Inbox/)).toBeInTheDocument();
    expect(setSearchParamsMock).toHaveBeenCalledWith(expect.any(URLSearchParams));
  });

  it('mounts the shared sidebar portal for team memory routes', () => {
    render(<SpaceMemoryPage />);

    expect(screen.getByTestId('memory-sidebar-portal')).toHaveTextContent('space:spc_team');
    expect(memorySidebarPortalMock).toHaveBeenCalledWith(
      expect.objectContaining({
        activeSpaceId: 'spc_team',
        currentScope: 'space',
      }),
    );
  });

  it('saves recall policy changes for published memories', async () => {
    render(<SpaceMemoryPage />);

    fireEvent.click(screen.getByRole('button', { name: 'View Details' }));

    const drawer = await screen.findByTestId('drawer');
    const drawerQueries = within(drawer);

    fireEvent.click(drawerQueries.getByRole('checkbox', { name: 'Include in Team Recall' }));
    fireEvent.change(drawerQueries.getByLabelText('Expires At'), {
      target: { value: '2026-04-10T20:30' },
    });
    fireEvent.click(drawerQueries.getByRole('button', { name: 'Mark Verified Now' }));
    fireEvent.click(drawerQueries.getByRole('button', { name: 'Save Recall Policy' }));

    await waitFor(() =>
      expect(updateRecallPolicyMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          expiresAt: new Date('2026-04-10T20:30').toISOString(),
          id: 'mem_published',
          recallEnabled: false,
          spaceId: 'spc_team',
          staleAt: null,
        }),
      ),
    );

    expect(messageApi.success).toHaveBeenCalledWith('Recall policy saved');
  });

  it('marks a published memory as stale before saving recall policy', async () => {
    render(<SpaceMemoryPage />);

    fireEvent.click(screen.getByRole('button', { name: 'View Details' }));

    const drawer = await screen.findByTestId('drawer');
    const drawerQueries = within(drawer);

    fireEvent.click(drawerQueries.getByRole('button', { name: 'Mark Stale' }));
    fireEvent.click(drawerQueries.getByRole('button', { name: 'Save Recall Policy' }));

    await waitFor(() =>
      expect(updateRecallPolicyMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'mem_published',
          staleAt: expect.any(String),
        }),
      ),
    );
  });

  it('publishes a candidate and focuses the published result with history', async () => {
    searchParamsState.initial = 'section=inbox';

    render(<SpaceMemoryPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() =>
      expect(publishEntryMutate).toHaveBeenCalledWith({
        id: 'mem_candidate',
        spaceId: 'spc_team',
      }),
    );

    await waitFor(() =>
      expect(setSearchParamsMock).toHaveBeenCalledWith(expect.any(URLSearchParams)),
    );

    expect(await screen.findByTestId('drawer')).toBeInTheDocument();
    expect(await screen.findByText('Governance History')).toBeInTheDocument();
    expect(await screen.findByText('Recent review')).toBeInTheDocument();
    expect(
      screen.getByText('Just updated by merging candidate "Candidate draft"'),
    ).toBeInTheDocument();
  });

  it('opens the audit view directly from the history strip', async () => {
    render(<SpaceMemoryPage />);

    fireEvent.click(screen.getByRole('button', { name: 'View Audit' }));

    const drawer = await screen.findByTestId('drawer');
    const drawerQueries = within(drawer);

    expect(drawerQueries.getByText('Audit')).toBeInTheDocument();
    expect(drawerQueries.getByText('Governance History')).toBeInTheDocument();
    expect(drawerQueries.queryByText('Summary')).not.toBeInTheDocument();

    const updatedParams = setSearchParamsMock.mock.calls
      .map(([params]) => params as URLSearchParams)
      .find(
        (params) =>
          params.get('detail') === 'mem_published' && params.get('detailView') === 'audit',
      );

    expect(updatedParams).toBeDefined();
  });

  it('copies a deep link for the audit view', async () => {
    render(<SpaceMemoryPage />);

    fireEvent.click(screen.getByRole('button', { name: 'View Audit' }));
    const drawer = await screen.findByTestId('drawer');

    fireEvent.click(within(drawer).getByRole('button', { name: 'Copy Audit Link' }));

    await waitFor(() => expect(writeTextMock).toHaveBeenCalledTimes(1));

    const copiedUrl = writeTextMock.mock.calls[0]?.[0];
    expect(copiedUrl).toContain('/spaces/spc_team/memory/audit/mem_published');
    expect(copiedUrl).toContain('section=published');
    expect(messageApi.success).toHaveBeenCalledWith('Audit link copied');
  });

  it('exports the current audit record as json', async () => {
    render(<SpaceMemoryPage />);

    fireEvent.click(screen.getByRole('button', { name: 'View Audit' }));
    const drawer = await screen.findByTestId('drawer');

    fireEvent.click(within(drawer).getByRole('button', { name: 'Export Audit JSON' }));

    await waitFor(() =>
      expect(exportAuditBundleQuery).toHaveBeenCalledWith({
        id: 'mem_published',
        recallFilter: 'all',
        spaceId: 'spc_team',
      }),
    );

    expect(exportJSONFileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        auditPath: '/spaces/spc_team/memory/audit/mem_published?section=published',
        auditUrl:
          'http://localhost:3000/spaces/spc_team/memory/audit/mem_published?section=published',
        detailView: 'audit',
        entry: expect.objectContaining({
          id: 'mem_published',
          title: 'Release policy',
        }),
        exportedAt: '2026-04-04T13:00:00.000Z',
        recallFilter: 'all',
        section: 'published',
        space: expect.objectContaining({
          displayName: 'Ops Space',
          id: 'spc_team',
        }),
      }),
      'Release policy-audit.json',
    );
    expect(messageApi.success).toHaveBeenCalledWith('Audit JSON exported');
  });

  it('exports selected stale memories as a bundled audit json', async () => {
    searchParamsState.initial = 'section=published&focus=mem_published_stale&recallFilter=stale';
    swrState.summary = {
      ...makeSummary(),
      sections: {
        inbox: makeSectionSummary(1),
        playbooks: makeSectionSummary(0),
        policies: makeSectionSummary(0),
        published: makeSectionSummary(1),
      },
    };
    swrState.sections.published = makeSectionResult([makeStalePublishedEntry()], {
      section: 'published',
    });

    render(<SpaceMemoryPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Select All' }));
    fireEvent.click(screen.getByRole('button', { name: 'Export Selected Audits' }));

    await waitFor(() =>
      expect(exportAuditBundlesQuery).toHaveBeenCalledWith({
        ids: ['mem_published_stale'],
        recallFilter: 'stale',
        spaceId: 'spc_team',
      }),
    );

    expect(exportJSONFileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        count: 1,
        exportedAt: '2026-04-04T13:30:00.000Z',
        items: [
          expect.objectContaining({
            auditPath:
              '/spaces/spc_team/memory/audit/mem_published_stale?section=published&recallFilter=stale',
            auditUrl:
              'http://localhost:3000/spaces/spc_team/memory/audit/mem_published_stale?section=published&recallFilter=stale',
            exportedAt: '2026-04-04T13:30:00.000Z',
            recallFilter: 'stale',
          }),
        ],
        recallFilter: 'stale',
        spaceId: 'spc_team',
        space: expect.objectContaining({
          displayName: 'Ops Space',
          id: 'spc_team',
        }),
      }),
      'Ops Space-space-memory-audit-bundle.json',
    );
    expect(messageApi.success).toHaveBeenCalledWith('Selected audit JSON exported');
  });

  it('exports selected stale memories as a csv summary index', async () => {
    searchParamsState.initial = 'section=published&focus=mem_published_stale&recallFilter=stale';
    swrState.summary = {
      ...makeSummary(),
      sections: {
        inbox: makeSectionSummary(1),
        playbooks: makeSectionSummary(0),
        policies: makeSectionSummary(0),
        published: makeSectionSummary(1),
      },
    };
    swrState.sections.published = makeSectionResult([makeStalePublishedEntry()], {
      section: 'published',
    });

    render(<SpaceMemoryPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Select All' }));
    fireEvent.click(screen.getByRole('button', { name: 'Export Selected Audit CSV' }));

    await waitFor(() =>
      expect(exportAuditBundlesQuery).toHaveBeenCalledWith({
        ids: ['mem_published_stale'],
        recallFilter: 'stale',
        spaceId: 'spc_team',
      }),
    );

    expect(exportFileMock).toHaveBeenCalledWith(
      expect.stringContaining('"Entry ID","Title","Category","Section","Recall Filter"'),
      'Ops Space-space-memory-audit-index.csv',
    );
    expect(exportFileMock).toHaveBeenCalledWith(
      expect.stringContaining(
        '"mem_published_stale","Needs revalidation","general","published","stale"',
      ),
      'Ops Space-space-memory-audit-index.csv',
    );
    expect(exportFileMock).toHaveBeenCalledWith(
      expect.stringContaining(
        '"http://localhost:3000/spaces/spc_team/memory/audit/mem_published_stale?section=published&recallFilter=stale"',
      ),
      'Ops Space-space-memory-audit-index.csv',
    );
    expect(messageApi.success).toHaveBeenCalledWith('Selected audit CSV exported');
  });

  it('exports selected paused memories with the disabled recall filter', async () => {
    searchParamsState.initial =
      'section=published&focus=mem_published_disabled&recallFilter=disabled';
    swrState.summary = {
      ...makeSummary(),
      sections: {
        inbox: makeSectionSummary(1),
        playbooks: makeSectionSummary(0),
        policies: makeSectionSummary(0),
        published: makeSectionSummary(1),
      },
    };
    swrState.sections.published = makeSectionResult([makeDisabledPublishedEntry()], {
      section: 'published',
    });

    render(<SpaceMemoryPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Select All' }));
    fireEvent.click(screen.getByRole('button', { name: 'Export Selected Audits' }));

    await waitFor(() =>
      expect(exportAuditBundlesQuery).toHaveBeenCalledWith({
        ids: ['mem_published_disabled'],
        recallFilter: 'disabled',
        spaceId: 'spc_team',
      }),
    );

    expect(exportJSONFileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [
          expect.objectContaining({
            auditPath:
              '/spaces/spc_team/memory/audit/mem_published_disabled?section=published&recallFilter=disabled',
            recallFilter: 'disabled',
          }),
        ],
        recallFilter: 'disabled',
      }),
      'Ops Space-space-memory-audit-bundle.json',
    );
  });

  it('keeps the stale recall filter in copied audit links', async () => {
    searchParamsState.initial = 'section=published&focus=mem_published&recallFilter=stale';
    swrState.summary = {
      ...makeSummary(),
      sections: {
        inbox: makeSectionSummary(1),
        playbooks: makeSectionSummary(0),
        policies: makeSectionSummary(0),
        published: makeSectionSummary(2),
      },
    };
    swrState.sections.published = makeSectionResult([makeStalePublishedEntry()], {
      section: 'published',
    });

    render(<SpaceMemoryPage />);

    fireEvent.click(screen.getByRole('button', { name: 'View Audit' }));
    const drawer = await screen.findByTestId('drawer');

    fireEvent.click(within(drawer).getByRole('button', { name: 'Copy Audit Link' }));

    await waitFor(() => expect(writeTextMock).toHaveBeenCalledTimes(1));

    const copiedUrl = writeTextMock.mock.calls[0]?.[0];
    expect(copiedUrl).toContain('/spaces/spc_team/memory/audit/mem_published_stale');
    expect(copiedUrl).toContain('section=published');
    expect(copiedUrl).toContain('recallFilter=stale');
  });

  it('sends reviewer merge resolution when merging a duplicate candidate', async () => {
    searchParamsState.initial = 'section=inbox';
    swrState.sections.inbox = makeSectionResult([makeDuplicateInboxEntry()], { section: 'inbox' });

    render(<SpaceMemoryPage />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Update title' }));
    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));

    await waitFor(() =>
      expect(mergeEntryMutate).toHaveBeenCalledWith({
        candidateId: 'mem_candidate_duplicate',
        merge: {
          appendSources: true,
          applyContent: true,
          applySummary: true,
          applyTitle: false,
        },
        spaceId: 'spc_team',
        targetEntryId: 'mem_published',
      }),
    );
  });

  it('keeps failed entries selected after partial batch publish', async () => {
    searchParamsState.initial = 'section=inbox';
    swrState.summary = {
      ...makeSummary(),
      sections: {
        inbox: makeSectionSummary(2),
        playbooks: makeSectionSummary(0),
        policies: makeSectionSummary(0),
        published: makeSectionSummary(1),
      },
    };
    swrState.sections.inbox = makeSectionResult(
      [
        makeInboxEntry(),
        {
          ...makeInboxEntry(),
          id: 'mem_candidate_two',
          title: 'Second candidate',
        },
      ],
      { section: 'inbox' },
    );
    publishEntriesMutate.mockResolvedValue([
      { id: 'mem_candidate', reviewedBy: 'user-1', status: 'published' },
      { id: 'mem_candidate_two', reason: 'already_reviewed', status: 'skipped' },
    ]);

    render(<SpaceMemoryPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Select All' }));
    fireEvent.click(screen.getByRole('button', { name: 'Publish Selected' }));

    await waitFor(() =>
      expect(publishEntriesMutate).toHaveBeenCalledWith({
        ids: ['mem_candidate', 'mem_candidate_two'],
        spaceId: 'spc_team',
      }),
    );

    expect(messageApi.warning).toHaveBeenCalledWith(
      expect.stringContaining('1 published, 1 still need review'),
    );
    expect(messageApi.warning).toHaveBeenCalledWith(expect.stringContaining('1 already reviewed'));
    expect(await screen.findByText('1 selected')).toBeInTheDocument();
  });

  it('filters published entries to stale memories only', async () => {
    swrState.summary = {
      ...makeSummary(),
      sections: {
        inbox: makeSectionSummary(1),
        playbooks: makeSectionSummary(0),
        policies: makeSectionSummary(0),
        published: makeSectionSummary(2),
      },
    };
    swrState.sections.published = makeSectionResult(
      [makePublishedEntry(), makeStalePublishedEntry()],
      { section: 'published' },
    );

    render(<SpaceMemoryPage />);

    expect(screen.getByText('Release policy')).toBeInTheDocument();
    expect(screen.getByText('Needs revalidation')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Needs Review' }));

    await waitFor(() =>
      expect(setSearchParamsMock).toHaveBeenCalledWith(expect.any(URLSearchParams)),
    );

    const updatedParams = setSearchParamsMock.mock.calls
      .map(([params]) => params as URLSearchParams)
      .find((params) => params.get('recallFilter') === 'stale');

    expect(updatedParams).toBeDefined();
    expect(screen.queryByText('Release policy')).not.toBeInTheDocument();
    expect(screen.getByText('Needs revalidation')).toBeInTheDocument();
  });

  it('filters published entries to paused memories only', async () => {
    swrState.summary = {
      ...makeSummary(),
      sections: {
        inbox: makeSectionSummary(1),
        playbooks: makeSectionSummary(0),
        policies: makeSectionSummary(0),
        published: makeSectionSummary(3),
      },
    };
    swrState.sections.published = makeSectionResult(
      [makePublishedEntry(), makeDisabledPublishedEntry(), makeExpiredPublishedEntry()],
      { section: 'published' },
    );

    render(<SpaceMemoryPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Paused' }));

    await waitFor(() =>
      expect(setSearchParamsMock).toHaveBeenCalledWith(expect.any(URLSearchParams)),
    );

    const updatedParams = setSearchParamsMock.mock.calls
      .map(([params]) => params as URLSearchParams)
      .find((params) => params.get('recallFilter') === 'disabled');

    expect(updatedParams).toBeDefined();
    expect(screen.queryByText('Release policy')).not.toBeInTheDocument();
    expect(screen.queryByText('Expired recall')).not.toBeInTheDocument();
    expect(screen.getByText('Paused recall')).toBeInTheDocument();
  });

  it('shows recall overview counts and filters published entries to active memories only', async () => {
    swrState.summary = {
      ...makeSummary(),
      sections: {
        inbox: { count: 1, recall: { active: 0, disabled: 0, expired: 0, stale: 0 } },
        playbooks: { count: 0, recall: { active: 0, disabled: 0, expired: 0, stale: 0 } },
        policies: { count: 0, recall: { active: 0, disabled: 0, expired: 0, stale: 0 } },
        published: { count: 4, recall: { active: 1, disabled: 1, expired: 1, stale: 1 } },
      },
    };
    swrState.sections.published = makeSectionResult(
      [
        makePublishedEntry(),
        makeDisabledPublishedEntry(),
        makeExpiredPublishedEntry(),
        makeStalePublishedEntry(),
      ],
      { section: 'published' },
    );

    render(<SpaceMemoryPage />);

    expect(screen.getByText('Recall Overview')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Active 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Paused 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expired 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Needs Review 1' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Active' }));

    await waitFor(() =>
      expect(setSearchParamsMock).toHaveBeenCalledWith(expect.any(URLSearchParams)),
    );

    const updatedParams = setSearchParamsMock.mock.calls
      .map(([params]) => params as URLSearchParams)
      .find((params) => params.get('recallFilter') === 'active');

    expect(updatedParams).toBeDefined();
    expect(screen.getByText('Release policy')).toBeInTheDocument();
    expect(screen.queryByText('Paused recall')).not.toBeInTheDocument();
    expect(screen.queryByText('Expired recall')).not.toBeInTheDocument();
    expect(screen.queryByText('Needs revalidation')).not.toBeInTheDocument();
  });

  it('hides reviewer-only recall controls and audit surfaces for viewers', async () => {
    searchParamsState.initial = 'section=published&focus=mem_published&recallFilter=stale';
    swrState.summary = {
      ...makeSummary({ canReview: false }),
      sections: {
        inbox: { count: 1, recall: { active: 0, disabled: 0, expired: 0, stale: 0 } },
        playbooks: { count: 0, recall: { active: 0, disabled: 0, expired: 0, stale: 0 } },
        policies: { count: 0, recall: { active: 0, disabled: 0, expired: 0, stale: 0 } },
        published: { count: 2, recall: { active: 1, disabled: 0, expired: 0, stale: 1 } },
      },
    };
    swrState.sections.published = makeSectionResult(
      [makePublishedEntry(), makeStalePublishedEntry()],
      { section: 'published', canReview: false },
    );

    render(<SpaceMemoryPage />);

    expect(screen.queryByText('Workspace Recall Status')).not.toBeInTheDocument();
    expect(screen.queryByText('Section Recall Status')).not.toBeInTheDocument();
    expect(screen.queryByText('Recall Overview')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Needs Review' })).not.toBeInTheDocument();
    expect(screen.queryByText('Recall Active')).not.toBeInTheDocument();
    expect(screen.queryByText('Recall Stale')).not.toBeInTheDocument();
    expect(screen.getByText('Release policy')).toBeInTheDocument();
    expect(screen.getByText('Needs revalidation')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'View Details' })[0]!);

    const drawer = await screen.findByTestId('drawer');
    const drawerQueries = within(drawer);

    expect(drawerQueries.queryByText('Audit')).not.toBeInTheDocument();
    expect(
      drawerQueries.queryByRole('button', { name: 'Copy Audit Link' }),
    ).not.toBeInTheDocument();
    expect(
      drawerQueries.queryByRole('button', { name: 'Export Audit JSON' }),
    ).not.toBeInTheDocument();
    expect(drawerQueries.queryByText('Recall Policy')).not.toBeInTheDocument();

    const normalizedParams = setSearchParamsMock.mock.calls
      .map(([params]) => params as URLSearchParams)
      .find((params) => !params.has('recallFilter'));

    expect(normalizedParams).toBeDefined();
  });

  it('navigates directly to a reviewed section filter from the section recall summary', async () => {
    swrState.summary = {
      ...makeSummary(),
      sections: {
        inbox: { count: 1, recall: { active: 0, disabled: 0, expired: 0, stale: 0 } },
        playbooks: { count: 2, recall: { active: 1, disabled: 0, expired: 0, stale: 1 } },
        policies: { count: 3, recall: { active: 1, disabled: 1, expired: 1, stale: 0 } },
        published: { count: 1, recall: { active: 1, disabled: 0, expired: 0, stale: 0 } },
      },
    };

    render(<SpaceMemoryPage />);

    expect(screen.getByText('Section Recall Status')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Policies Expired 1' }));

    await waitFor(() =>
      expect(setSearchParamsMock).toHaveBeenCalledWith(expect.any(URLSearchParams)),
    );

    const updatedParams = setSearchParamsMock.mock.calls
      .map(([params]) => params as URLSearchParams)
      .find(
        (params) =>
          params.get('section') === 'policies' && params.get('recallFilter') === 'expired',
      );

    expect(updatedParams).toBeDefined();
  });

  it('navigates to the first matching section from the workspace recall status block', async () => {
    swrState.summary = {
      ...makeSummary(),
      sections: {
        inbox: { count: 1, recall: { active: 0, disabled: 0, expired: 0, stale: 0 } },
        playbooks: { count: 2, recall: { active: 1, disabled: 0, expired: 0, stale: 1 } },
        policies: { count: 3, recall: { active: 1, disabled: 1, expired: 1, stale: 1 } },
        published: { count: 1, recall: { active: 1, disabled: 0, expired: 0, stale: 0 } },
      },
    };

    render(<SpaceMemoryPage />);

    expect(screen.getByText('Workspace Recall Status')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Workspace Needs Review 2' }));

    await waitFor(() =>
      expect(setSearchParamsMock).toHaveBeenCalledWith(expect.any(URLSearchParams)),
    );

    const updatedParams = setSearchParamsMock.mock.calls
      .map(([params]) => params as URLSearchParams)
      .find(
        (params) => params.get('section') === 'playbooks' && params.get('recallFilter') === 'stale',
      );

    expect(updatedParams).toBeDefined();
  });

  it('shows a dedicated empty state when no published memories need revalidation', async () => {
    render(<SpaceMemoryPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Needs Review' }));

    await waitFor(() =>
      expect(setSearchParamsMock).toHaveBeenCalledWith(expect.any(URLSearchParams)),
    );

    expect(
      screen.getByText('No published memories need revalidation right now.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Release policy')).not.toBeInTheDocument();
  });

  it('revalidates selected stale published memories in batch', async () => {
    searchParamsState.initial = 'section=published&focus=mem_published_stale&recallFilter=stale';
    swrState.summary = {
      ...makeSummary(),
      sections: {
        inbox: makeSectionSummary(1),
        playbooks: makeSectionSummary(0),
        policies: makeSectionSummary(0),
        published: makeSectionSummary(1),
      },
    };
    swrState.sections.published = makeSectionResult([makeStalePublishedEntry()], {
      section: 'published',
    });
    revalidateEntriesMutate.mockResolvedValue([
      { id: 'mem_published_stale', reviewedBy: 'user-1', status: 'revalidated' },
    ]);

    render(<SpaceMemoryPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Select All' }));
    fireEvent.click(screen.getByRole('button', { name: 'Revalidate Selected' }));

    await waitFor(() =>
      expect(revalidateEntriesMutate).toHaveBeenCalledWith({
        ids: ['mem_published_stale'],
        spaceId: 'spc_team',
      }),
    );
  });

  it('marks selected published memories as needs review in batch', async () => {
    searchParamsState.initial = 'section=published&focus=mem_published';
    swrState.summary = {
      ...makeSummary(),
      sections: {
        inbox: makeSectionSummary(1),
        playbooks: makeSectionSummary(0),
        policies: makeSectionSummary(0),
        published: makeSectionSummary(2),
      },
    };
    swrState.sections.published = makeSectionResult(
      [makePublishedEntry(), makeStalePublishedEntry()],
      { section: 'published' },
    );
    markEntriesStaleMutate.mockResolvedValue([
      { id: 'mem_published', reviewedBy: 'user-1', status: 'stale' },
    ]);

    render(<SpaceMemoryPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Select All' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mark Selected as Needs Review' }));

    await waitFor(() =>
      expect(markEntriesStaleMutate).toHaveBeenCalledWith({
        ids: ['mem_published'],
        spaceId: 'spc_team',
      }),
    );
  });

  it('opens detail deep links outside the current section and corrects the section', async () => {
    searchParamsState.initial = 'section=inbox&detail=mem_published';
    swrState.entries = {
      mem_published: makeEntryResult(makePublishedEntry()),
    };
    swrState.sections.inbox = makeSectionResult([], { section: 'inbox' });

    render(<SpaceMemoryPage />);

    const drawer = await screen.findByTestId('drawer');
    expect(drawer).toBeInTheDocument();
    expect(within(drawer).getByText('Release policy Details')).toBeInTheDocument();

    await waitFor(() =>
      expect(setSearchParamsMock).toHaveBeenCalledWith(expect.any(URLSearchParams)),
    );

    const updatedParams = setSearchParamsMock.mock.calls
      .map(([params]) => params as URLSearchParams)
      .find(
        (params) =>
          params.get('detail') === 'mem_published' && params.get('section') === 'published',
      );

    expect(updatedParams).toBeDefined();
  });
});
