/**
 * @vitest-environment happy-dom
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SpaceHomePage from './SpaceHomePage';

const { spaceState, summariesState } = vi.hoisted(() => ({
  spaceState: {
    current: undefined as
      | {
          description?: string;
          id: string;
          kind: 'personal' | 'team';
          membershipRole?: string;
          name: string;
        }
      | undefined,
  },
  summariesState: {
    current: [] as Array<[string, any]>,
  },
}));

vi.mock('@lobehub/ui', () => ({
  Flexbox: ({ children }: any) => <div>{children}</div>,
  Icon: () => <span>icon</span>,
  Tag: ({ children }: any) => <span>{children}</span>,
  Text: ({ as, children }: any) => {
    const Component = as ?? 'span';

    return <Component>{children}</Component>;
  },
}));

vi.mock('antd-style', () => ({
  createStyles: () => () => ({
    styles: {
      card: 'card',
      cardGrid: 'cardGrid',
      overviewActions: 'overviewActions',
      overviewCard: 'overviewCard',
      overviewLink: 'overviewLink',
      page: 'page',
      title: 'title',
    },
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, any>) => {
      const staticTranslations: Record<string, string> = {
        'space.home.badges.personal': 'Personal Space',
        'space.home.badges.team': 'Team Space',
        'space.home.cards.docs.description': 'Docs description',
        'space.home.cards.files.description': 'Files description',
        'space.home.cards.members.description': 'Members description',
        'space.home.cards.memory.personalDescription': 'Personal memory description',
        'space.home.cards.memory.teamDescription': 'Team memory description',
        'space.home.cards.settings.description': 'Settings description',
        'space.home.cards.sourceSets.description': 'Source sets description',
        'space.home.description.personalFallback': 'Personal fallback',
        'space.home.description.teamFallback': 'Team fallback',
        'space.home.recall.actions.open': 'Open Space Memory',
        'space.home.recall.description.clear': 'Memory is healthy',
        'space.home.recall.title': 'Memory Governance',
        'space.roles.editor': 'Editor',
        'sourceSet.title': 'Source Sets',
        'space.members.title': 'Members',
        'space.settings.title': 'Settings',
        'tab.files': 'Files',
        'tab.memory': 'Memory',
        'tab.pages': 'Docs',
      };

      if (key === 'space.home.recall.actions.review') return `Review ${options?.count} Pending`;
      if (key === 'space.home.recall.description.pending')
        return `${options?.count} published memory items need attention`;
      if (key === 'space.home.recall.metrics.active') return `Active ${options?.count}`;
      if (key === 'space.home.recall.metrics.paused') return `Paused ${options?.count}`;
      if (key === 'space.home.recall.metrics.expired') return `Expired ${options?.count}`;
      if (key === 'space.home.recall.metrics.stale') return `Needs Review ${options?.count}`;

      return staticTranslations[key] ?? key;
    },
  }),
}));

vi.mock('swr', () => ({
  default: (key: unknown) => {
    if (Array.isArray(key) && key[0] === 'space') {
      return { data: spaceState.current, isLoading: false };
    }

    if (Array.isArray(key) && key[0] === 'space-memory-scope-summaries') {
      return { data: summariesState.current, isLoading: false };
    }

    return { data: undefined, isLoading: false };
  },
}));

vi.mock('@/components/Loading/BrandTextLoading', () => ({
  default: () => <div>Loading</div>,
}));

vi.mock('@/libs/trpc/client', () => ({
  lambdaClient: {
    space: {
      getSpace: {
        query: vi.fn(),
      },
      listSpaces: {
        query: vi.fn(),
      },
    },
    spaceMemory: {
      getSummary: {
        query: vi.fn(),
      },
    },
  },
}));

vi.mock('@/store/user', () => ({
  useUserStore: (selector: any) => selector({ fullName: 'Arthur', username: 'arthur' }),
}));

vi.mock('@/store/user/slices/auth/selectors', () => ({
  userProfileSelectors: {
    fullName: (state: any) => state.fullName,
    username: (state: any) => state.username,
  },
}));

vi.mock('@/utils/docs', () => ({
  getPageRootPath: (_kind: string, spaceId: string) => `/spaces/${spaceId}/docs`,
}));

vi.mock('./resolveSpaceDisplayName', () => ({
  resolveSpaceDisplayName: (space: any) => space.name,
}));

const makeSummary = (recall?: {
  playbooks?: { active: number; disabled: number; expired: number; stale: number };
  policies?: { active: number; disabled: number; expired: number; stale: number };
  published?: { active: number; disabled: number; expired: number; stale: number };
}, options?: { canReview?: boolean; contractCanReview?: boolean }) => ({
  canCreate: true,
  canPublish: true,
  canReview: options?.canReview ?? true,
  contract:
    options?.contractCanReview === undefined
      ? undefined
      : options.contractCanReview
        ? {
            canAccessAudit: true,
            canManageRecall: true,
            canViewInbox: true,
            detailViews: ['audit', 'overview'],
            recallFilters: ['active', 'all', 'disabled', 'expired', 'stale'],
            sections: ['inbox', 'published', 'playbooks', 'policies'],
          }
        : {
            canAccessAudit: false,
            canManageRecall: false,
            canViewInbox: false,
            detailViews: ['overview'],
            recallFilters: ['all'],
            sections: ['published', 'playbooks', 'policies'],
          },
  id: 'spc_ops',
  kind: 'team',
  membershipRole: 'editor',
  name: 'Ops Space',
  surface: options?.canReview === false ? 'viewer' : 'reviewer',
  sections: {
    inbox: { count: 0, recall: { active: 0, disabled: 0, expired: 0, stale: 0 } },
    playbooks: {
      count: 0,
      recall: recall?.playbooks ?? { active: 0, disabled: 0, expired: 0, stale: 0 },
    },
    policies: {
      count: 0,
      recall: recall?.policies ?? { active: 0, disabled: 0, expired: 0, stale: 0 },
    },
    published: {
      count: 0,
      recall: recall?.published ?? { active: 0, disabled: 0, expired: 0, stale: 0 },
    },
  },
});

const renderPage = (path = '/spaces/spc_ops') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<SpaceHomePage />} path="/spaces/:spaceId" />
      </Routes>
    </MemoryRouter>,
  );

describe('SpaceHomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a memory governance overview for team spaces with a deep link to the first pending target', () => {
    spaceState.current = {
      id: 'spc_ops',
      kind: 'team',
      membershipRole: 'editor',
      name: 'Ops Space',
    };
    summariesState.current = [
      [
        'spc_ops',
        makeSummary({
          playbooks: { active: 0, disabled: 1, expired: 0, stale: 1 },
          policies: { active: 0, disabled: 0, expired: 1, stale: 0 },
          published: { active: 2, disabled: 0, expired: 0, stale: 0 },
        }),
      ],
    ];

    renderPage();

    expect(screen.getByText('Memory Governance')).toBeInTheDocument();
    expect(screen.getByText('3 published memory items need attention')).toBeInTheDocument();
    expect(screen.getByText('Active 2')).toBeInTheDocument();
    expect(screen.getByText('Paused 1')).toBeInTheDocument();
    expect(screen.getByText('Expired 1')).toBeInTheDocument();
    expect(screen.getByText('Needs Review 1')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Review 3 Pending' })).toHaveAttribute(
      'href',
      '/spaces/spc_ops/memory?section=playbooks&recallFilter=stale',
    );
    expect(screen.getByRole('link', { name: 'Open Space Memory' })).toHaveAttribute(
      'href',
      '/spaces/spc_ops/memory',
    );
  });

  it('does not show the memory governance overview for personal spaces', () => {
    spaceState.current = {
      id: 'spc_personal',
      kind: 'personal',
      name: 'My Space',
    };
    summariesState.current = [];

    renderPage('/spaces/spc_personal');

    expect(screen.queryByText('Memory Governance')).not.toBeInTheDocument();
  });

  it('does not show the memory governance overview for team members without review capability', () => {
    spaceState.current = {
      id: 'spc_ops',
      kind: 'team',
      membershipRole: 'member',
      name: 'Ops Space',
    };
    summariesState.current = [
      [
        'spc_ops',
        makeSummary(
          {
            playbooks: { active: 0, disabled: 1, expired: 0, stale: 1 },
            policies: { active: 0, disabled: 0, expired: 1, stale: 0 },
            published: { active: 2, disabled: 0, expired: 0, stale: 0 },
          },
          { canReview: false },
        ),
      ],
    ];

    renderPage();

    expect(screen.queryByText('Memory Governance')).not.toBeInTheDocument();
    expect(screen.queryByText('Review 3 Pending')).not.toBeInTheDocument();
  });

  it('trusts the explicit surface contract before the legacy surface string', () => {
    spaceState.current = {
      id: 'spc_ops',
      kind: 'team',
      membershipRole: 'editor',
      name: 'Ops Space',
    };
    summariesState.current = [
      [
        'spc_ops',
        makeSummary(
          {
            playbooks: { active: 0, disabled: 1, expired: 0, stale: 1 },
            policies: { active: 0, disabled: 0, expired: 1, stale: 0 },
            published: { active: 2, disabled: 0, expired: 0, stale: 0 },
          },
          { canReview: false, contractCanReview: true },
        ),
      ],
    ];

    renderPage();

    expect(screen.getByText('Memory Governance')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Review 3 Pending' })).toHaveAttribute(
      'href',
      '/spaces/spc_ops/memory?section=playbooks&recallFilter=stale',
    );
  });
});
