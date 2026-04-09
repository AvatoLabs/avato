/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PageEmpty from './PageEmpty';

const { navigateMock, spacesState, summariesState } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  spacesState: {
    current: [] as Array<{ id: string; kind: 'personal' | 'team'; name: string }>,
  },
  summariesState: {
    current: [] as Array<[string, any]>,
  },
}));

vi.mock('@lobehub/ui', () => ({
  Button: ({ children, onClick }: any) => (
    <button type={'button'} onClick={onClick}>
      {children}
    </button>
  ),
  Center: ({ children }: any) => <div>{children}</div>,
  Empty: ({ action, description, title }: any) => (
    <div>
      {title}
      <div>{description}</div>
      {action}
    </div>
  ),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) => {
      const staticTranslations: Record<string, string> = {
        'pageList.empty': 'No docs yet. Click the button above to create your first one.',
        'pageList.noResults': 'No matching docs found',
        'pageList.tableEmpty': 'No tables yet. Click the button above to create your first one.',
        'pageList.tableNoResults': 'No matching tables found',
        'space.home.recall.actions.open': 'Open Space Memory',
      };

      if (key === 'space.home.recall.actions.review') return `Review ${options?.count} Pending`;

      return staticTranslations[key] ?? key;
    },
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');

  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/features/ResourceSpaces/SpaceList', () => ({
  SPACE_LIST_KEY: 'resource-space-list',
}));

vi.mock('@/features/ResourceSpaces/paths', () => ({
  buildSpaceMemoryPath: (spaceId: string) => `/spaces/${spaceId}/memory`,
}));

vi.mock('@/features/ResourceSpaces/useTeamSpaceMemoryScopeSummaries', () => ({
  buildPendingGovernancePath: (
    spaceId: string,
    target: { recallFilter: string; section: string },
  ) => `/spaces/${spaceId}/memory?section=${target.section}&recallFilter=${target.recallFilter}`,
  canReviewSpaceMemorySummary: (summary?: { contract?: { canManageRecall?: boolean } } | null) =>
    Boolean(summary?.contract?.canManageRecall),
  useTeamSpaceMemoryScopeSummaries: (spaces?: Array<{ id: string; kind?: string | null }>) => {
    const firstSpace = spaces?.[0];
    const summary = summariesState.current[0]?.[1];
    const canReview = Boolean(summary?.contract?.canManageRecall);

    return {
      pendingGovernanceCountBySpaceId: new Map([
        [firstSpace?.id ?? '', firstSpace?.kind === 'team' && canReview ? 2 : 0],
      ]),
      pendingGovernanceTargetBySpaceId: new Map([
        [
          firstSpace?.id ?? '',
          firstSpace?.kind === 'team' && canReview
            ? { recallFilter: 'stale', section: 'published' }
            : null,
        ],
      ]),
      spaceSummaryMap: firstSpace?.id
        ? new Map([
            [firstSpace.id, { contract: { canManageRecall: canReview } }],
          ])
        : new Map(),
    };
  },
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

vi.mock('swr', () => ({
  default: (key: unknown) =>
    key === 'resource-space-list'
      ? { data: spacesState.current, isLoading: false }
      : Array.isArray(key) && key[0] === 'space-memory-scope-summaries'
        ? { data: summariesState.current, isLoading: false }
        : { data: undefined, isLoading: false },
}));

const renderPageEmpty = (path: string, props?: Record<string, any>) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<PageEmpty {...props} />} path="/spaces/:spaceId/docs" />
      </Routes>
    </MemoryRouter>,
  );

describe('PageEmpty', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    summariesState.current = [];
  });

  it('shows a pending review action for team space docs empty states', () => {
    spacesState.current = [{ id: 'spc_ops', kind: 'team', name: 'Ops Space' }];
    summariesState.current = [['spc_ops', { contract: { canManageRecall: true } }]];

    renderPageEmpty('/spaces/spc_ops/docs');

    expect(
      screen.getByText('No docs yet. Click the button above to create your first one.'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Review 2 Pending' }));

    expect(navigateMock).toHaveBeenCalledWith(
      '/spaces/spc_ops/memory?section=published&recallFilter=stale',
    );
  });

  it('does not show the review action in search empty states', () => {
    spacesState.current = [{ id: 'spc_ops', kind: 'team', name: 'Ops Space' }];

    renderPageEmpty('/spaces/spc_ops/docs', { search: true });

    expect(screen.getByText('No matching docs found')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Review 2 Pending' })).not.toBeInTheDocument();
  });

  it('does not show the review action for personal spaces', () => {
    spacesState.current = [{ id: 'spc_personal', kind: 'personal', name: 'My Space' }];

    renderPageEmpty('/spaces/spc_personal/docs');

    expect(screen.queryByRole('button', { name: 'Review 2 Pending' })).not.toBeInTheDocument();
  });

  it('shows an open memory action for team viewers without review capability', () => {
    spacesState.current = [{ id: 'spc_ops', kind: 'team', name: 'Ops Space' }];
    summariesState.current = [['spc_ops', { contract: { canManageRecall: false } }]];

    renderPageEmpty('/spaces/spc_ops/docs');

    fireEvent.click(screen.getByRole('button', { name: 'Open Space Memory' }));

    expect(navigateMock).toHaveBeenCalledWith('/spaces/spc_ops/memory');
    expect(screen.queryByRole('button', { name: 'Review 2 Pending' })).not.toBeInTheDocument();
  });
});
