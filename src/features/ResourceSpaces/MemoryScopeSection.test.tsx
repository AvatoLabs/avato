/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import MemoryScopeSection from './MemoryScopeSection';

const { navigateMock, openCreateSpaceMock, spacesState, summariesState } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  openCreateSpaceMock: vi.fn(),
  spacesState: {
    current: [] as Array<{ id: string; kind: 'personal' | 'team'; name: string }>,
  },
  summariesState: {
    current: [] as Array<[string, any]>,
  },
}));

vi.mock('@lobehub/ui', () => ({
  ActionIcon: ({ onClick, title }: any) => (
    <button aria-label={title} type={'button'} onClick={onClick} />
  ),
  Button: ({ children, onClick, title }: any) => (
    <button title={title} type={'button'} onClick={onClick}>
      {children}
    </button>
  ),
  Flexbox: ({ children }: any) => <div>{children}</div>,
  Text: ({ children, title }: any) => <span title={title}>{children}</span>,
}));

vi.mock('antd-style', () => ({
  createStaticStyles: () => ({
    sectionTitle: 'sectionTitle',
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, any>) => {
      const staticTranslations: Record<string, string> = {
        'personalTitle': 'Personal Memory',
        'scope.empty': 'No team spaces yet',
        'scope.open': 'Open Memory',
        'scope.openHint':
          'Open published workspace memory. Review access requires editor or admin role.',
        'scope.teamSpaces': 'Team Spaces',
        'scope.title': 'Memory Scopes',
        'space.create.title': 'Create Space',
      };

      if (key === 'scope.pending') return `${options?.count} pending`;
      if (key === 'scope.pendingHint')
        return `${options?.count} governance items need attention in this space.`;

      return staticTranslations[key] ?? key;
    },
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('swr', () => ({
  default: (key: unknown) => {
    if (key === 'resource-space-list') {
      return { data: spacesState.current, isLoading: false };
    }

    if (Array.isArray(key) && key[0] === 'space-memory-scope-summaries') {
      return { data: summariesState.current, isLoading: false };
    }

    return { data: undefined, isLoading: false };
  },
}));

vi.mock('@/features/NavPanel/components/NavItem', () => ({
  default: ({ extra, onClick, title }: any) => (
    <div>
      <button type={'button'} onClick={onClick}>
        {title}
      </button>
      {extra}
    </div>
  ),
}));

vi.mock('@/features/NavPanel/components/SkeletonList', () => ({
  default: () => <div>Loading</div>,
}));

vi.mock('@/libs/trpc/client', () => ({
  lambdaClient: {
    space: {
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

vi.mock('./resolveSpaceDisplayName', () => ({
  resolveSpaceDisplayName: (space: any) => space.name,
}));

vi.mock('./useOpenCreateSpaceModal', () => ({
  useOpenCreateSpaceModal: () => openCreateSpaceMock,
}));

const makeSummary = (recall?: {
  playbooks?: { active: number; disabled: number; expired: number; stale: number };
  policies?: { active: number; disabled: number; expired: number; stale: number };
  published?: { active: number; disabled: number; expired: number; stale: number };
}, options?: { canReview?: boolean }) => ({
  canCreate: true,
  canPublish: true,
  canReview: options?.canReview ?? true,
  id: 'spc_team',
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

describe('MemoryScopeSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    spacesState.current = [
      { id: 'spc_ops', kind: 'team', name: 'Ops Space' },
      { id: 'spc_clean', kind: 'team', name: 'Clean Space' },
    ];
    summariesState.current = [
      [
        'spc_ops',
        makeSummary({
          playbooks: { active: 0, disabled: 0, expired: 0, stale: 1 },
          policies: { active: 0, disabled: 1, expired: 1, stale: 0 },
          published: { active: 2, disabled: 0, expired: 0, stale: 0 },
        }),
      ],
      ['spc_clean', makeSummary()],
    ];
  });

  it('shows a compact pending governance badge only for spaces with recall backlog', () => {
    render(<MemoryScopeSection currentScope={'personal'} />);

    expect(screen.getByText('Ops Space')).toBeInTheDocument();
    expect(screen.getByText('Clean Space')).toBeInTheDocument();
    expect(screen.getByText('3 pending')).toBeInTheDocument();
    expect(screen.queryByText('0 pending')).not.toBeInTheDocument();
  });

  it('navigates to the selected team space memory page', () => {
    render(<MemoryScopeSection currentScope={'personal'} />);

    fireEvent.click(screen.getByRole('button', { name: 'Ops Space' }));

    expect(navigateMock).toHaveBeenCalledWith('/spaces/spc_ops/memory');
  });

  it('opens the first pending governance target when clicking the pending badge', () => {
    render(<MemoryScopeSection currentScope={'personal'} />);

    fireEvent.click(screen.getByRole('button', { name: '3 pending' }));

    expect(navigateMock).toHaveBeenCalledWith(
      '/spaces/spc_ops/memory?section=playbooks&recallFilter=stale',
    );
  });

  it('hides governance badges for spaces where the member cannot review', () => {
    summariesState.current = [
      [
        'spc_ops',
        makeSummary(
          {
            playbooks: { active: 0, disabled: 0, expired: 0, stale: 1 },
            policies: { active: 0, disabled: 1, expired: 1, stale: 0 },
            published: { active: 2, disabled: 0, expired: 0, stale: 0 },
          },
          { canReview: false },
        ),
      ],
      ['spc_clean', makeSummary()],
    ];

    render(<MemoryScopeSection currentScope={'personal'} />);

    expect(screen.queryByText('3 pending')).not.toBeInTheDocument();
  });

  it('shows an open memory action for team members without review capability', () => {
    summariesState.current = [
      [
        'spc_ops',
        makeSummary(
          {
            playbooks: { active: 0, disabled: 0, expired: 0, stale: 1 },
            policies: { active: 0, disabled: 1, expired: 1, stale: 0 },
            published: { active: 2, disabled: 0, expired: 0, stale: 0 },
          },
          { canReview: false },
        ),
      ],
      ['spc_clean', makeSummary()],
    ];

    render(<MemoryScopeSection currentScope={'personal'} />);

    const action = screen.getByRole('button', { name: 'Open Memory' });
    expect(action).toHaveAttribute(
      'title',
      'Open published workspace memory. Review access requires editor or admin role.',
    );

    fireEvent.click(action);

    expect(navigateMock).toHaveBeenCalledWith('/spaces/spc_ops/memory');
  });
});
