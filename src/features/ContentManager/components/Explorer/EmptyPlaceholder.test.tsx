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
const searchParamsState = vi.hoisted(() => ({
  value: 'assetClassification=brand&category=images',
}));
const contentManagerState = vi.hoisted(() => ({
  assetClassification: 'brand' as string | undefined,
  assetRightsOwner: undefined as string | undefined,
  assetReviewStatus: undefined as string | undefined,
  assetUsagePolicy: undefined as string | undefined,
}));
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
    t: (
      key: string,
      options?: { count?: number; defaultValue?: string; label?: string },
    ) => {
      if (key === 'filters.clearGovernance') return 'Clear governance filters';
      if (key === 'filters.adjustGovernance') return 'Adjust governance filters';
      if (key === 'filters.adjustGovernanceFilter') return `Adjust ${options?.label} filter`;
      if (key === 'filters.clearGovernanceFilter') return `Clear ${options?.label} filter`;
      if (key === 'filters.empty.activeTitle') return 'Active governance filters';
      if (key === 'filters.empty.description')
        return 'Try clearing one or more governance filters to see matching files.';
      if (key === 'filters.empty.title') return 'No files match the current governance filters';
      if (key === 'detail.asset.classification.label') return 'Classification';
      if (key === 'detail.asset.classification.brand') return 'Brand';
      if (key === 'detail.asset.rightsOwner.label') return 'Rights Owner';
      if (key === 'detail.asset.reviewStatus.label') return 'Review Status';
      if (key === 'detail.asset.reviewStatus.approved') return 'Approved';
      if (key === 'detail.asset.usagePolicy.label') return 'Usage Policy';
      if (key === 'detail.asset.usagePolicy.restricted') return 'Restricted';
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
    useLocation: () => ({
      pathname: '/spaces/space-1/files',
    }),
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(searchParamsState.value)],
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
  canReviewSpaceMemorySummary: (summary?: { contract?: { canManageRecall?: boolean } } | null) =>
    Boolean(summary?.contract?.canManageRecall),
  useTeamSpaceMemoryScopeSummaries: () => ({
    pendingGovernanceCountBySpaceId: new Map([
      ['space-1', memoryCapabilityState.canReview ? 2 : 0],
    ]),
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
          contract: { canManageRecall: memoryCapabilityState.canReview },
        },
      ],
    ]),
  }),
}));

vi.mock('@/routes/(main)/content/features/store', () => ({
  useContentManagerStore: (selector: any) =>
    selector({
      assetClassification: contentManagerState.assetClassification,
      assetRightsOwner: contentManagerState.assetRightsOwner,
      assetReviewStatus: contentManagerState.assetReviewStatus,
      assetUsagePolicy: contentManagerState.assetUsagePolicy,
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
    searchParamsState.value = 'assetClassification=brand&category=images';
    contentManagerState.assetClassification = 'brand';
    contentManagerState.assetRightsOwner = undefined;
    contentManagerState.assetReviewStatus = undefined;
    contentManagerState.assetUsagePolicy = undefined;
  });

  it('prioritizes clearing governance filters when filtered results are empty', () => {
    render(
      <MemoryRouter>
        <EmptyPlaceholder />
      </MemoryRouter>,
    );

    expect(screen.getByText('No files match the current governance filters')).toBeInTheDocument();
    expect(screen.getByText('Active governance filters')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Adjust Classification: Brand filter' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Clear Classification: Brand filter' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adjust governance filters' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear governance filters' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /actions\.sourceSet/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /actions\.file/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /actions\.folder/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Review 2 Pending' })).not.toBeInTheDocument();
  });

  it('clears governance filters without dropping unrelated query params', () => {
    render(
      <MemoryRouter>
        <EmptyPlaceholder />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear governance filters' }));

    expect(mockNavigate).toHaveBeenCalledWith('/spaces/space-1/files?category=images');
  });

  it('opens the governance panel with current filters intact', () => {
    render(
      <MemoryRouter>
        <EmptyPlaceholder />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Adjust governance filters' }));

    expect(mockNavigate).toHaveBeenCalledWith(
      '/spaces/space-1/files?assetClassification=brand&category=images&openGovernance=1',
    );
  });

  it('opens the governance panel focused on a single governance filter', () => {
    render(
      <MemoryRouter>
        <EmptyPlaceholder />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Adjust Classification: Brand filter' }));

    expect(mockNavigate).toHaveBeenCalledWith(
      '/spaces/space-1/files?assetClassification=brand&category=images&openGovernance=1&focusGovernance=assetClassification',
    );
  });

  it('clears a single governance filter without dropping the others', () => {
    searchParamsState.value =
      'assetClassification=brand&assetUsagePolicy=restricted&category=images';

    render(
      <MemoryRouter>
        <EmptyPlaceholder />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear Classification: Brand filter' }));

    expect(mockNavigate).toHaveBeenCalledWith(
      '/spaces/space-1/files?assetUsagePolicy=restricted&category=images',
    );
  });

  it('shows and clears a rights owner governance filter', () => {
    searchParamsState.value = 'assetRightsOwner=Brand%20Team&category=images';
    contentManagerState.assetClassification = undefined;
    contentManagerState.assetRightsOwner = 'Brand Team';

    render(
      <MemoryRouter>
        <EmptyPlaceholder />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('button', { name: 'Clear Rights Owner: Brand Team filter' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Brand Team')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear Rights Owner: Brand Team filter' }));

    expect(mockNavigate).toHaveBeenCalledWith('/spaces/space-1/files?category=images');
  });

  it('keeps create source-set action wired after switching to button semantics', () => {
    searchParamsState.value = 'category=images';
    contentManagerState.assetClassification = undefined;

    render(
      <MemoryRouter>
        <EmptyPlaceholder />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /actions\.sourceSet/i }));

    expect(mockOpenCreateSourceSet).toHaveBeenCalledWith({ spaceId: 'space-1' });
  });

  it('shows a pending memory review action and deep links to the first governance target', () => {
    searchParamsState.value = '';
    contentManagerState.assetClassification = undefined;

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
    searchParamsState.value = '';
    contentManagerState.assetClassification = undefined;

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
