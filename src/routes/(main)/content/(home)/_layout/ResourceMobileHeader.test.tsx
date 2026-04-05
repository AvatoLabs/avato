/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ResourceMobileHeader from './ResourceMobileHeader';

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
  Button: ({ children, onClick, title }: any) => (
    <button title={title} type={'button'} onClick={onClick}>
      {children}
    </button>
  ),
  Flexbox: ({ children, onClick }: any) => (
    <div role={'button'} tabIndex={0} onClick={onClick}>
      {children}
    </div>
  ),
  Icon: ({ icon: IconComponent }: any) =>
    IconComponent ? <span>{IconComponent.displayName ?? 'icon'}</span> : <span>icon</span>,
  Modal: ({ children, open, title }: any) =>
    open ? (
      <div data-testid={'workspace-modal'}>
        <div>{title}</div>
        {children}
      </div>
    ) : null,
  Text: ({ children }: any) => <span>{children}</span>,
}));

vi.mock('@lobehub/ui/mobile', () => ({
  ChatHeader: ({ left, right }: any) => (
    <div>
      <div data-testid={'mobile-header-left'}>{left}</div>
      <div data-testid={'mobile-header-right'}>{right}</div>
    </div>
  ),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, any>) => {
      const staticTranslations: Record<string, string> = {
        'scope.open': 'Open Memory',
        'scope.openHint':
          'Open published workspace memory. Review access requires editor or admin role.',
        'shared.title': 'Shared with me',
        'space.create.title': 'Create Space',
        'space.sectionTitle': 'Spaces',
        'trash.title': 'Trash',
      };

      if (key === 'scope.pending') return `${options?.count} pending`;
      if (key === 'scope.pendingHint')
        return `${options?.count} governance items need attention in this space.`;

      return staticTranslations[key] ?? key;
    },
  }),
}));

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/spaces/spc_ops/files' }),
  useNavigate: () => navigateMock,
  useParams: () => ({ spaceId: 'spc_ops' }),
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
  default: ({ onClick, title }: any) => (
    <button type={'button'} onClick={onClick}>
      {title}
    </button>
  ),
}));

vi.mock('@/features/ResourceSpaces', () => ({
  SpaceList: ({ onSelectSpace }: any) => (
    <button type={'button'} onClick={() => onSelectSpace('spc_ops')}>
      SpaceList
    </button>
  ),
  buildFilesRootPath: (spaceId?: string | null) => `/spaces/${spaceId}/files`,
  buildFilesTrashPath: (spaceId?: string | null) => `/spaces/${spaceId}/files/trash`,
  buildSharedFilesPath: () => '/content/shared',
  buildSpaceMemoryPath: (spaceId: string) => `/spaces/${spaceId}/memory`,
  useSpaceName: () => 'Ops Space',
}));

vi.mock('@/features/ResourceSpaces/SpaceList', () => ({
  SPACE_LIST_KEY: 'resource-space-list',
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

vi.mock('@/features/ResourceSpaces/useOpenCreateSpaceModal', () => ({
  useOpenCreateSpaceModal: () => openCreateSpaceMock,
}));

vi.mock('@/routes/(main)/content/features/SourceSetTrashButton', () => ({
  SourceSetTrashButton: () => <div>SourceSetTrashButton</div>,
}));

vi.mock('./Header/CategoryMenu', () => ({
  default: () => <div>CategoryMenu</div>,
}));

const makeSummary = (
  recall?: {
    playbooks?: { active: number; disabled: number; expired: number; stale: number };
    policies?: { active: number; disabled: number; expired: number; stale: number };
    published?: { active: number; disabled: number; expired: number; stale: number };
  },
  options?: { canReview?: boolean },
) => ({
  canCreate: true,
  canPublish: true,
  canReview: options?.canReview ?? true,
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

describe('ResourceMobileHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    spacesState.current = [{ id: 'spc_ops', kind: 'team', name: 'Ops Space' }];
    summariesState.current = [
      [
        'spc_ops',
        makeSummary({
          playbooks: { active: 0, disabled: 1, expired: 0, stale: 0 },
          policies: { active: 0, disabled: 0, expired: 1, stale: 0 },
          published: { active: 1, disabled: 0, expired: 0, stale: 1 },
        }),
      ],
    ];
  });

  it('shows a pending quick action for the current team space and deep links to the first governance target', () => {
    render(<ResourceMobileHeader />);

    fireEvent.click(screen.getByRole('button', { name: '3 pending' }));

    expect(navigateMock).toHaveBeenCalledWith(
      '/spaces/spc_ops/memory?section=published&recallFilter=stale',
    );
    expect(screen.queryByTestId('workspace-modal')).not.toBeInTheDocument();
  });

  it('still opens the workspace switcher when tapping the current space title', () => {
    render(<ResourceMobileHeader />);

    fireEvent.click(screen.getByText('Ops Space').closest('[role="button"]')!);

    expect(screen.getByTestId('workspace-modal')).toBeInTheDocument();
    expect(screen.getByText('SpaceList')).toBeInTheDocument();
  });

  it('shows an open memory action for team members without review capability', () => {
    summariesState.current = [
      [
        'spc_ops',
        makeSummary(
          {
            playbooks: { active: 0, disabled: 1, expired: 0, stale: 0 },
            policies: { active: 0, disabled: 0, expired: 1, stale: 0 },
            published: { active: 1, disabled: 0, expired: 0, stale: 1 },
          },
          { canReview: false },
        ),
      ],
    ];

    render(<ResourceMobileHeader />);

    const action = screen.getByRole('button', { name: 'Open Memory' });
    expect(action).toHaveAttribute(
      'title',
      'Open published workspace memory. Review access requires editor or admin role.',
    );

    fireEvent.click(action);

    expect(navigateMock).toHaveBeenCalledWith('/spaces/spc_ops/memory');
    expect(screen.queryByTestId('workspace-modal')).not.toBeInTheDocument();
  });
});
