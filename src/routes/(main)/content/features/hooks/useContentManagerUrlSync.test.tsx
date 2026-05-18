/**
 * @vitest-environment happy-dom
 */
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SortType } from '@/types/files';

import { useContentManagerUrlSync, useIsRouteStateReady } from './useContentManagerUrlSync';

const setSearchParamsMock = vi.hoisted(() => vi.fn());
const setSorterMock = vi.hoisted(() => vi.fn());
const setSortTypeMock = vi.hoisted(() => vi.fn());
const setViewModeMock = vi.hoisted(() => vi.fn());
const setSourceSetIdMock = vi.hoisted(() => vi.fn());
const setSpaceIdMock = vi.hoisted(() => vi.fn());
const setCategoryMock = vi.hoisted(() => vi.fn());
const setAssetClassificationMock = vi.hoisted(() => vi.fn());
const setAssetRightsOwnerMock = vi.hoisted(() => vi.fn());
const setAssetReviewStatusMock = vi.hoisted(() => vi.fn());
const setAssetUsagePolicyMock = vi.hoisted(() => vi.fn());

const searchParamsState = vi.hoisted(() => ({
  current: new URLSearchParams(),
}));

const paramsState = vi.hoisted(() => ({
  spaceId: undefined as string | undefined,
}));

const contentManagerState = vi.hoisted(() => ({
  setSorter: setSorterMock,
  setSortType: setSortTypeMock,
  setViewMode: setViewModeMock,
  setSourceSetId: setSourceSetIdMock,
  setSpaceId: setSpaceIdMock,
  setCategory: setCategoryMock,
  setAssetClassification: setAssetClassificationMock,
  setAssetRightsOwner: setAssetRightsOwnerMock,
  setAssetReviewStatus: setAssetReviewStatusMock,
  setAssetUsagePolicy: setAssetUsagePolicyMock,
  sorter: 'createdAt' as 'name' | 'createdAt' | 'size',
  sortType: 'desc' as SortType,
  viewMode: 'list' as 'list' | 'masonry',
  sourceSetId: undefined as string | undefined,
  spaceId: undefined as string | undefined,
  category: 'home' as string,
  assetClassification: undefined as string | undefined,
  assetRightsOwner: undefined as string | undefined,
  assetReviewStatus: undefined as string | undefined,
  assetUsagePolicy: undefined as string | undefined,
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ spaceId: paramsState.spaceId }),
  useSearchParams: () => [searchParamsState.current, setSearchParamsMock],
}));

vi.mock('@/features/ContentManager/useFileScope', () => ({
  getFileScope: (searchParams: URLSearchParams) => searchParams.get('scope') || 'all',
  getSourceSetScopeId: (scope: string) =>
    scope.startsWith('source-set:') ? scope.slice('source-set:'.length) : null,
}));

vi.mock('@/helpers/activeWorkspaceSpace', () => ({
  setActiveWorkspaceSpaceId: vi.fn(),
}));

vi.mock('../store', () => ({
  useContentManagerStore: Object.assign((selector: any) => selector(contentManagerState), {
    getState: () => contentManagerState,
  }),
}));

const TestComponent = ({ enabled = true }: { enabled?: boolean }) => {
  useContentManagerUrlSync(enabled);

  return null;
};

describe('useContentManagerUrlSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    searchParamsState.current = new URLSearchParams();
    paramsState.spaceId = undefined;
    contentManagerState.sorter = 'createdAt';
    contentManagerState.sortType = SortType.Desc;
    contentManagerState.viewMode = 'list';
    contentManagerState.sourceSetId = undefined;
    contentManagerState.spaceId = undefined;
    contentManagerState.category = 'home';
    contentManagerState.assetClassification = undefined;
    contentManagerState.assetRightsOwner = undefined;
    contentManagerState.assetReviewStatus = undefined;
    contentManagerState.assetUsagePolicy = undefined;
  });

  it('does not touch store or url when both are already at canonical defaults', () => {
    render(<TestComponent />);

    expect(setSorterMock).not.toHaveBeenCalled();
    expect(setSortTypeMock).not.toHaveBeenCalled();
    expect(setViewModeMock).not.toHaveBeenCalled();
    expect(setSearchParamsMock).not.toHaveBeenCalled();
  });

  it('hydrates store from URL without immediately overwriting the URL with stale store state', () => {
    searchParamsState.current = new URLSearchParams('sorter=name&sortType=asc&view=masonry');

    render(<TestComponent />);

    expect(setSorterMock).toHaveBeenCalledWith('name');
    expect(setSortTypeMock).toHaveBeenCalledWith(SortType.Asc);
    expect(setViewModeMock).toHaveBeenCalledWith('masonry');
    expect(setSearchParamsMock).not.toHaveBeenCalled();
  });

  it('canonicalizes explicit default params once store and url are in sync', () => {
    searchParamsState.current = new URLSearchParams('sorter=createdAt&sortType=desc&view=list');

    render(<TestComponent />);

    expect(setSearchParamsMock).toHaveBeenCalledWith(new URLSearchParams(), { replace: true });
  });

  it('pushes store-driven sort changes back into the URL', () => {
    const { rerender } = render(<TestComponent />);

    expect(setSearchParamsMock).not.toHaveBeenCalled();

    contentManagerState.sorter = 'name';
    rerender(<TestComponent />);

    expect(setSearchParamsMock).toHaveBeenCalledWith(new URLSearchParams('sorter=name'), {
      replace: true,
    });
  });

  it('syncs sourceSetId from URL scope param to store', () => {
    searchParamsState.current = new URLSearchParams('scope=source-set:ss_1');

    render(<TestComponent />);

    expect(setSourceSetIdMock).toHaveBeenCalledWith('ss_1');
  });

  it('syncs spaceId from route params to store', () => {
    paramsState.spaceId = 'spc_1';

    render(<TestComponent />);

    expect(setSpaceIdMock).toHaveBeenCalledWith('spc_1');
  });

  it('syncs category from URL to store', () => {
    searchParamsState.current = new URLSearchParams('category=documents');

    render(<TestComponent />);

    expect(setCategoryMock).toHaveBeenCalledWith('documents');
  });

  it('syncs governance filters from URL to store', () => {
    searchParamsState.current = new URLSearchParams(
      'assetClassification=image&assetReviewStatus=approved&assetUsagePolicy=internal',
    );

    render(<TestComponent />);

    expect(setAssetClassificationMock).toHaveBeenCalledWith('image');
    expect(setAssetReviewStatusMock).toHaveBeenCalledWith('approved');
    expect(setAssetUsagePolicyMock).toHaveBeenCalledWith('internal');
  });

  it('does nothing when disabled', () => {
    searchParamsState.current = new URLSearchParams('sorter=name&sortType=asc&view=masonry');

    render(<TestComponent enabled={false} />);

    expect(setSorterMock).not.toHaveBeenCalled();
    expect(setSortTypeMock).not.toHaveBeenCalled();
    expect(setViewModeMock).not.toHaveBeenCalled();
    expect(setSearchParamsMock).not.toHaveBeenCalled();
  });
});

describe('useIsRouteStateReady', () => {
  const ReadyCheckComponent = () => {
    const ready = useIsRouteStateReady();
    return <div data-testid="ready">{ready ? 'yes' : 'no'}</div>;
  };

  beforeEach(() => {
    searchParamsState.current = new URLSearchParams();
    paramsState.spaceId = undefined;
    contentManagerState.sourceSetId = undefined;
    contentManagerState.spaceId = undefined;
    contentManagerState.category = 'home';
    contentManagerState.assetClassification = undefined;
    contentManagerState.assetRightsOwner = undefined;
    contentManagerState.assetReviewStatus = undefined;
    contentManagerState.assetUsagePolicy = undefined;
  });

  it('returns true when store matches URL', () => {
    render(<ReadyCheckComponent />);

    expect(document.querySelector('[data-testid="ready"]')).toHaveTextContent('yes');
  });

  it('returns false when sourceSetId is out of sync', () => {
    searchParamsState.current = new URLSearchParams('scope=source-set:ss_1');
    contentManagerState.sourceSetId = undefined;

    render(<ReadyCheckComponent />);

    expect(document.querySelector('[data-testid="ready"]')).toHaveTextContent('no');
  });

  it('returns false when spaceId is out of sync', () => {
    paramsState.spaceId = 'spc_1';
    contentManagerState.spaceId = undefined;

    render(<ReadyCheckComponent />);

    expect(document.querySelector('[data-testid="ready"]')).toHaveTextContent('no');
  });
});
