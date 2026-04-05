/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SourceSetListSection from './SourceSetListSection';

const mockNavigate = vi.hoisted(() => vi.fn());
const mockOpenCreateSourceSet = vi.hoisted(() => vi.fn());
const mockUseFetchSourceSetList = vi.hoisted(() => vi.fn());
const mockSetScope = vi.hoisted(() => vi.fn());
const memoryCapabilityState = vi.hoisted(() => ({
  canReview: true,
}));

vi.mock('@lobehub/ui', () => ({
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
  Text: ({ children, className, style }: any) => (
    <span className={className} style={style}>
      {children}
    </span>
  ),
}));

vi.mock('antd-style', () => {
  const mockCssVar = {
    colorBorder: '#ddd',
    colorFillSecondary: '#f5f5f5',
    colorFillTertiary: '#fafafa',
    colorPrimary: '#1677ff',
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
    sourceSet: () => <span>sourceSet</span>,
  },
}));

vi.mock('@/features/SourceSetModal', () => ({
  useCreateSourceSetModal: () => ({
    open: mockOpenCreateSourceSet,
  }),
}));

vi.mock('@/features/ContentManager/useFileScope', () => ({
  buildSourceSetFileScope: (id: string) => `source-set:${id}`,
  useFileScope: () => ({
    setScope: mockSetScope,
  }),
}));

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

vi.mock('@/store/sourceSet', () => ({
  useSourceSetStore: (selector: any) =>
    selector({
      useFetchSourceSetList: mockUseFetchSourceSetList,
    }),
}));

describe('SourceSetListSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    memoryCapabilityState.canReview = true;
  });

  it('renders source-set cards and create action as buttons', () => {
    mockUseFetchSourceSetList.mockReturnValue({
      data: [{ id: 'ss-1', name: 'Docs', spaceId: undefined }],
      isLoading: false,
    });

    render(
      <MemoryRouter>
        <SourceSetListSection />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: /Docs/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New Source Set' })).toBeInTheDocument();
  });

  it('preserves existing actions after switching cards to buttons', () => {
    mockUseFetchSourceSetList.mockReturnValue({
      data: [{ id: 'ss-1', name: 'Docs', spaceId: undefined }],
      isLoading: false,
    });

    render(
      <MemoryRouter>
        <SourceSetListSection />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Docs/i }));
    fireEvent.click(screen.getByRole('button', { name: 'New Source Set' }));

    expect(mockSetScope).toHaveBeenCalledWith('source-set:ss-1', 'space-1');
    expect(mockOpenCreateSourceSet).toHaveBeenCalledWith({ spaceId: 'space-1' });
  });

  it('shows a pending memory review quick action and deep links to the first governance target', () => {
    mockUseFetchSourceSetList.mockReturnValue({
      data: [{ id: 'ss-1', name: 'Docs', spaceId: undefined }],
      isLoading: false,
    });

    render(
      <MemoryRouter>
        <SourceSetListSection />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Review 2 Pending' }));

    expect(mockNavigate).toHaveBeenCalledWith(
      '/spaces/space-1/memory?section=published&recallFilter=stale',
    );
  });

  it('shows an open memory quick action for viewers without review capability', () => {
    memoryCapabilityState.canReview = false;
    mockUseFetchSourceSetList.mockReturnValue({
      data: [{ id: 'ss-1', name: 'Docs', spaceId: undefined }],
      isLoading: false,
    });

    render(
      <MemoryRouter>
        <SourceSetListSection />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open Space Memory' }));

    expect(mockNavigate).toHaveBeenCalledWith('/spaces/space-1/memory');
    expect(screen.queryByRole('button', { name: 'Review 2 Pending' })).not.toBeInTheDocument();
  });
});
