/**
 * @vitest-environment happy-dom
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ResourceExplorer from './index';

const mockUseExplorerItems = vi.hoisted(() => vi.fn());
const mockSetSelectedFileIds = vi.hoisted(() => vi.fn());
const mockHeader = vi.hoisted(() => vi.fn());
const contentManagerState = vi.hoisted(() => ({
  assetClassification: 'brand' as string | undefined,
  assetRightsOwner: 'Brand Team' as string | undefined,
  assetReviewStatus: 'approved' as string | undefined,
  assetUsagePolicy: 'restricted' as string | undefined,
  category: 'images',
  mode: 'explorer',
  searchQuery: null as string | null,
  setSelectedFileIds: mockSetSelectedFileIds,
  sortType: 'desc',
  sorter: 'createdAt',
  sourceSetId: undefined as string | undefined,
  spaceId: 'space-1' as string | undefined,
  viewMode: 'list',
}));

vi.mock('@lobehub/ui', () => ({
  Flexbox: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('antd-style', () => ({
  createStaticStyles: () => ({
    page: 'page',
    pageMobile: 'pageMobile',
    shell: 'shell',
    sourceSetSection: 'sourceSetSection',
    stage: 'stage',
    viewport: 'viewport',
  }),
  cx: (...classNames: Array<string | false | null | undefined>) =>
    classNames.filter(Boolean).join(' '),
}));

vi.mock('@/routes/(main)/content/features/store', () => ({
  useContentManagerStore: (selector: any) => selector(contentManagerState),
}));

vi.mock('@/routes/(main)/content/features/hooks/useContentManagerUrlSync', () => ({
  useContentManagerUrlSync: vi.fn(),
}));

vi.mock('@/routes/(main)/content/features/hooks/useFolderPath', () => ({
  useFolderPath: () => ({
    currentFolderSlug: null,
  }),
}));

vi.mock('@/store/serverConfig', () => ({
  useServerConfigStore: (selector: any) =>
    selector({
      isMobile: false,
    }),
}));

vi.mock('../../useFileScope', () => ({
  getSourceSetScopeId: vi.fn(() => null),
  useFileScope: () => ({
    scope: 'all',
  }),
}));

vi.mock('../SourceSetListSection', () => ({
  default: () => <div>source-set-list</div>,
}));

vi.mock('./Header', () => ({
  default: (props: any) => {
    mockHeader(props);
    return <div>header</div>;
  },
}));

vi.mock('./ListView', () => ({
  default: () => <div>list-view</div>,
}));

vi.mock('./MasonryView', () => ({
  default: () => <div>masonry-view</div>,
}));

vi.mock('./EmptyPlaceholder', () => ({
  default: () => <div>empty-placeholder</div>,
}));

vi.mock('./SearchResultsOverlay', () => ({
  default: () => <div>search-results</div>,
}));

vi.mock('./useCheckTaskStatus', () => ({
  useCheckTaskStatus: vi.fn(),
}));

vi.mock('./useContentExplorer', () => ({
  useContentExplorer: vi.fn(),
}));

vi.mock('./useExplorerItems', () => ({
  useExplorerItems: mockUseExplorerItems,
}));

describe('ResourceExplorer', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    contentManagerState.assetClassification = 'brand';
    contentManagerState.assetRightsOwner = 'Brand Team';
    contentManagerState.assetReviewStatus = 'approved';
    contentManagerState.assetUsagePolicy = 'restricted';
    contentManagerState.category = 'images';
    contentManagerState.mode = 'explorer';
    contentManagerState.searchQuery = null;
    contentManagerState.sortType = 'desc';
    contentManagerState.sorter = 'createdAt';
    contentManagerState.sourceSetId = undefined;
    contentManagerState.spaceId = 'space-1';
    contentManagerState.viewMode = 'list';

    mockUseExplorerItems.mockReturnValue({
      data: [{ id: 'file-1' }],
      governanceCapabilities: {
        canApprove: true,
        canArchive: false,
        canEditGovernance: true,
      },
      hasResolvedData: true,
      isLoading: false,
      isValidating: false,
    });
  });

  it('passes asset rights owner into explorer query params', () => {
    render(<ResourceExplorer />);

    expect(screen.getByTestId('resource-explorer-shell')).toBeInTheDocument();
    expect(screen.getByTestId('resource-explorer-stage')).toBeInTheDocument();
    expect(screen.getByTestId('resource-explorer-viewport')).toBeInTheDocument();
    expect(mockUseExplorerItems).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        params: expect.objectContaining({
          assetClassification: 'brand',
          assetRightsOwner: 'Brand Team',
          assetReviewStatus: 'approved',
          assetUsagePolicy: 'restricted',
          category: 'images',
          showFilesInSourceSet: true,
          sourceSetId: undefined,
          spaceId: 'space-1',
        }),
        sorter: 'createdAt',
        sortType: 'desc',
      }),
    );
  });

  it('passes scope governance capabilities down to the header', () => {
    render(<ResourceExplorer />);

    expect(mockHeader).toHaveBeenCalledWith(
      expect.objectContaining({
        governanceCapabilities: {
          canApprove: true,
          canArchive: false,
          canEditGovernance: true,
        },
      }),
    );
  });
});
