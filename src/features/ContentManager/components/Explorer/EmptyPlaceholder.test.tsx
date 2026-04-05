/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import EmptyPlaceholder from './EmptyPlaceholder';

const mockNavigate = vi.hoisted(() => vi.fn());
const mockOpenCreateSourceSet = vi.hoisted(() => vi.fn());
const mockPushDockFileList = vi.hoisted(() => vi.fn());
const memoryCapabilityState = vi.hoisted(() => ({
  canReview: true,
}));

vi.mock('@lobehub/ui', () => ({
  Center: ({ children, className, style }: any) => (
    <div className={className} style={style}>
      {children}
    </div>
  ),
  FileTypeIcon: ({ icon, className }: any) => <div className={className}>{icon}</div>,
  Flexbox: ({ children, className, style }: any) => (
    <div className={className} style={style}>
      {children}
    </div>
  ),
  Icon: ({ icon: IconComponent }: any) =>
    IconComponent ? (
      <span aria-hidden="true">
        <IconComponent data-testid="icon" />
      </span>
    ) : (
      <span aria-hidden="true">icon</span>
    ),
  Text: ({ children, className }: any) => <span className={className}>{children}</span>,
}));

vi.mock('antd', () => ({
  Upload: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('antd-style', () => {
  const mockCssVar = {
    borderRadiusLG: '12px',
    colorBgContainer: '#fff',
    colorBorder: '#ddd',
    colorBorderSecondary: '#eee',
    colorFillSecondary: '#f5f5f5',
    colorPrimary: '#1677ff',
    colorPrimaryBg: '#e6f4ff',
    colorPrimaryBorder: '#91caff',
    colorText: '#111',
    colorTextLightSolid: '#fff',
  };

  return {
    createStaticStyles: (factory: any) => factory({ css: () => 'cls', cssVar: mockCssVar }),
    cssVar: mockCssVar,
    cx: (...classNames: string[]) => classNames.filter(Boolean).join(' '),
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number; defaultValue?: string }) => {
      if (key === 'space.home.recall.actions.open') return 'Open Space Memory';
      if (key === 'space.home.recall.actions.review') return `Review ${options?.count} Pending`;

      return options?.defaultValue ?? key;
    },
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');

  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/config/contentIcons', () => ({
  RESOURCE_ENTRY_ICONS: {
    plus: () => <span>plus</span>,
    uploadArrow: () => <span>upload</span>,
  },
}));

vi.mock('@/features/SourceSetModal', () => ({
  useCreateSourceSetModal: () => ({
    open: mockOpenCreateSourceSet,
  }),
}));

vi.mock('@/features/ResourceSpaces', () => ({
  buildSourceSetPath: (spaceId: string | undefined, id: string) =>
    `/spaces/${spaceId}/files?scope=source-set:${id}`,
}));

vi.mock('@/features/ResourceSpaces/paths', () => ({
  buildSpaceMemoryPath: (spaceId: string) => `/spaces/${spaceId}/memory`,
}));

vi.mock('@/features/ResourceSpaces/SpaceList', () => ({
  SPACE_LIST_KEY: 'resource-space-list',
}));

vi.mock('@/features/ResourceSpaces/useTeamSpaceMemoryScopeSummaries', () => ({
  buildPendingGovernancePath: (
    spaceId: string,
    target: { recallFilter: string; section: string },
  ) => `/spaces/${spaceId}/memory?section=${target.section}&recallFilter=${target.recallFilter}`,
  canReviewSpaceMemorySummary: (summary?: {
    contract?: { canManageRecall?: boolean };
    surface?: string;
  } | null) => summary?.contract?.canManageRecall ?? summary?.surface === 'reviewer',
  useTeamSpaceMemoryScopeSummaries: () => ({
    pendingGovernanceCountBySpaceId: new Map([['space-1', memoryCapabilityState.canReview ? 2 : 0]]),
    pendingGovernanceTargetBySpaceId: new Map([
      [
        'space-1',
        memoryCapabilityState.canReview ? { recallFilter: 'stale', section: 'published' } : null,
      ],
    ]),
    spaceSummaryMap: new Map([
      [
        'space-1',
        {
          canReview: memoryCapabilityState.canReview,
          surface: memoryCapabilityState.canReview ? 'reviewer' : 'viewer',
        },
      ],
    ]),
  }),
}));

vi.mock('@/routes/(main)/content/features/store', () => ({
  useContentManagerStore: (selector: any) =>
    selector({
      sourceSetId: undefined,
      spaceId: 'space-1',
    }),
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
      ? {
          data: [{ id: 'space-1', kind: 'team', name: 'Ops Space' }],
          isLoading: false,
        }
      : { data: undefined, isLoading: false },
}));

vi.mock('@/store/file', () => ({
  useFileStore: (selector: any) =>
    selector({
      pushDockFileList: mockPushDockFileList,
    }),
}));

vi.mock('@/store/serverConfig', () => ({
  useServerConfigStore: (selector: any) =>
    selector({
      isMobile: false,
    }),
}));

describe('EmptyPlaceholder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    memoryCapabilityState.canReview = true;
  });

  it('renders keyboard-accessible buttons for all empty-state actions', () => {
    render(
      <MemoryRouter>
        <EmptyPlaceholder />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: /actions\.sourceSet/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /actions\.file/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /actions\.folder/i })).toBeInTheDocument();
  });

  it('keeps create source-set action wired after switching to button semantics', () => {
    render(
      <MemoryRouter>
        <EmptyPlaceholder />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /actions\.sourceSet/i }));

    expect(mockOpenCreateSourceSet).toHaveBeenCalledWith({ spaceId: 'space-1' });
  });

  it('shows a pending memory review action and deep links to the first governance target', () => {
    render(
      <MemoryRouter>
        <EmptyPlaceholder />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Review 2 Pending' }));

    expect(mockNavigate).toHaveBeenCalledWith(
      '/spaces/space-1/memory?section=published&recallFilter=stale',
    );
  });

  it('shows an open memory action for viewers without review capability', () => {
    memoryCapabilityState.canReview = false;

    render(
      <MemoryRouter>
        <EmptyPlaceholder />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open Space Memory' }));

    expect(mockNavigate).toHaveBeenCalledWith('/spaces/space-1/memory');
    expect(screen.queryByRole('button', { name: 'Review 2 Pending' })).not.toBeInTheDocument();
  });
});
