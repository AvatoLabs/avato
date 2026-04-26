/**
 * @vitest-environment happy-dom
 */
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SortType } from '@/types/files';

import { useContentManagerUrlSync } from './useContentManagerUrlSync';

const setSearchParamsMock = vi.hoisted(() => vi.fn());
const setSorterMock = vi.hoisted(() => vi.fn());
const setSortTypeMock = vi.hoisted(() => vi.fn());
const setViewModeMock = vi.hoisted(() => vi.fn());

const searchParamsState = vi.hoisted(() => ({
  current: new URLSearchParams(),
}));

const contentManagerState = vi.hoisted(() => ({
  setSorter: setSorterMock,
  setSortType: setSortTypeMock,
  setViewMode: setViewModeMock,
  sorter: 'createdAt' as 'name' | 'createdAt' | 'size',
  sortType: 'desc' as SortType,
  viewMode: 'list' as 'list' | 'masonry',
}));

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [searchParamsState.current, setSearchParamsMock],
}));

vi.mock('@/routes/(main)/content/features/store', () => ({
  useContentManagerStore: (selector: any) => selector(contentManagerState),
}));

const TestComponent = ({ enabled = true }: { enabled?: boolean }) => {
  useContentManagerUrlSync(enabled);

  return null;
};

describe('useContentManagerUrlSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    searchParamsState.current = new URLSearchParams();
    contentManagerState.sorter = 'createdAt';
    contentManagerState.sortType = SortType.Desc;
    contentManagerState.viewMode = 'list';
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

    expect(setSearchParamsMock).toHaveBeenCalledWith(
      new URLSearchParams('sorter=name'),
      { replace: true },
    );
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
