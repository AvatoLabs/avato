/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SpaceList from './SpaceList';

const {
  navigateMock,
  onSelectSpaceMock,
  pendingCountsState,
  pendingTargetsState,
  spacesState,
  summaryMapState,
} =
  vi.hoisted(() => ({
    navigateMock: vi.fn(),
    onSelectSpaceMock: vi.fn(),
    pendingCountsState: {
      current: new Map<string, number>(),
    },
    pendingTargetsState: {
      current: new Map<
        string,
        { recallFilter: 'disabled' | 'expired' | 'stale'; section: string }
      >(),
    },
    spacesState: {
      current: [] as Array<{ id: string; kind: 'personal' | 'team'; name: string }>,
    },
    summaryMapState: {
      current: new Map<string, any>(),
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

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, any>) => {
      const staticTranslations: Record<string, string> = {
        'scope.open': 'Open Memory',
        'scope.openHint':
          'Open published workspace memory. Review access requires editor or admin role.',
        'space.settings.title': 'Space Settings',
      };

      if (key === 'scope.pending') return `${options?.count} pending`;
      if (key === 'scope.pendingHint')
        return `${options?.count} governance items need attention in this space.`;

      return staticTranslations[key] ?? key;
    },
  }),
}));

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/spaces/spc_ops' }),
  useNavigate: () => navigateMock,
}));

vi.mock('swr', () => ({
  default: (key: unknown) => {
    if (key === 'resource-space-list') {
      return { data: spacesState.current, isLoading: false };
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

vi.mock('./useTeamSpaceMemoryScopeSummaries', () => ({
  buildPendingGovernancePath: (
    spaceId: string,
    target: { recallFilter: string; section: string },
  ) => `/spaces/${spaceId}/memory?section=${target.section}&recallFilter=${target.recallFilter}`,
  canReviewSpaceMemorySummary: (summary?: {
    contract?: { canManageRecall?: boolean };
    surface?: string;
  } | null) => summary?.contract?.canManageRecall ?? summary?.surface === 'reviewer',
  useTeamSpaceMemoryScopeSummaries: () => ({
    isLoading: false,
    pendingGovernanceCountBySpaceId: pendingCountsState.current,
    pendingGovernanceTargetBySpaceId: pendingTargetsState.current,
    spaceSummaryMap: summaryMapState.current,
  }),
}));

describe('SpaceList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    spacesState.current = [
      { id: 'spc_personal', kind: 'personal', name: 'My Space' },
      { id: 'spc_ops', kind: 'team', name: 'Ops Space' },
      { id: 'spc_clean', kind: 'team', name: 'Clean Space' },
    ];
    pendingCountsState.current = new Map([
      ['spc_ops', 4],
      ['spc_clean', 0],
    ]);
    pendingTargetsState.current = new Map([
      ['spc_ops', { recallFilter: 'expired', section: 'policies' }],
      ['spc_clean', null as any],
    ]);
    summaryMapState.current = new Map([
      ['spc_ops', { canReview: true, surface: 'reviewer' }],
      ['spc_clean', { canReview: true, surface: 'reviewer' }],
    ]);
  });

  it('shows a pending governance badge only for team spaces with backlog', () => {
    render(<SpaceList currentSpaceId={'spc_ops'} onSelectSpace={onSelectSpaceMock} />);

    expect(screen.getByText('Ops Space')).toBeInTheDocument();
    expect(screen.getByText('4 pending')).toBeInTheDocument();
    expect(screen.queryByText('0 pending')).not.toBeInTheDocument();
  });

  it('selects a space when clicking the row and opens settings from the action icon', () => {
    render(<SpaceList currentSpaceId={'spc_ops'} onSelectSpace={onSelectSpaceMock} />);

    fireEvent.click(screen.getByRole('button', { name: 'Ops Space' }));
    expect(onSelectSpaceMock).toHaveBeenCalledWith('spc_ops');

    fireEvent.click(screen.getAllByRole('button', { name: 'Space Settings' })[0]!);
    expect(navigateMock).toHaveBeenCalledWith('/spaces/spc_ops/settings');
  });

  it('opens the first pending governance target when clicking the pending badge', () => {
    render(<SpaceList currentSpaceId={'spc_ops'} onSelectSpace={onSelectSpaceMock} />);

    fireEvent.click(screen.getByRole('button', { name: '4 pending' }));

    expect(navigateMock).toHaveBeenCalledWith(
      '/spaces/spc_ops/memory?section=policies&recallFilter=expired',
    );
    expect(onSelectSpaceMock).not.toHaveBeenCalled();
  });

  it('shows an open memory action for team members without review capability', () => {
    pendingCountsState.current = new Map([
      ['spc_ops', 0],
      ['spc_clean', 0],
    ]);
    pendingTargetsState.current = new Map([
      ['spc_ops', null as any],
      ['spc_clean', null as any],
    ]);
    summaryMapState.current = new Map([
      ['spc_ops', { canReview: false, surface: 'viewer' }],
      ['spc_clean', { canReview: true, surface: 'reviewer' }],
    ]);

    render(<SpaceList currentSpaceId={'spc_ops'} onSelectSpace={onSelectSpaceMock} />);

    const action = screen.getByRole('button', { name: 'Open Memory' });
    expect(action).toHaveAttribute(
      'title',
      'Open published workspace memory. Review access requires editor or admin role.',
    );

    fireEvent.click(action);

    expect(navigateMock).toHaveBeenCalledWith('/spaces/spc_ops/memory');
    expect(onSelectSpaceMock).not.toHaveBeenCalled();
  });
});
