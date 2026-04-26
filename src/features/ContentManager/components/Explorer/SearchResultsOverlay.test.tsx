/**
 * @vitest-environment happy-dom
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SearchResultsOverlay from './SearchResultsOverlay';

const contentManagerState = vi.hoisted(() => ({
  category: 'images' as string | undefined,
  mode: 'explorer' as 'doc' | 'editor' | 'explorer',
  searchQuery: 'brand system' as string | null,
  sourceSetId: undefined as string | undefined,
  spaceId: 'space-1' as string | undefined,
  viewMode: 'list' as 'list' | 'masonry',
}));
const mockUseClientDataSWR = vi.hoisted(() => vi.fn());

vi.mock('@lobehub/ui', () => ({
  Center: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Checkbox: (props: any) => <input type={'checkbox'} {...props} />,
  Flexbox: ({
    as,
    children,
    align: _align,
    gap: _gap,
    height: _height,
    horizontal: _horizontal,
    justify: _justify,
    paddingInline: _paddingInline,
    wrap: _wrap,
    ...props
  }: any) => {
    const Component = as || 'div';
    return <Component {...props}>{children}</Component>;
  },
}));

vi.mock('@virtuoso.dev/masonry', () => ({
  VirtuosoMasonry: ({ data }: any) => <div>{`masonry:${data.length}`}</div>,
}));

vi.mock('antd-style', () => ({
  createStaticStyles: () => ({
    body: 'body',
    count: 'count',
    header: 'header',
    headerEyebrow: 'headerEyebrow',
    headerSummary: 'headerSummary',
    headerTitle: 'headerTitle',
    headerTop: 'headerTop',
    listBody: 'listBody',
    listHeader: 'listHeader',
    listViewport: 'listViewport',
    masonryScroll: 'masonryScroll',
    masonryStage: 'masonryStage',
    overlay: 'overlay',
  }),
  cssVar: {
    colorBorderSecondary: '#eee',
    colorTextDescription: '#999',
  },
}));

vi.mock('lucide-react', () => ({
  Search: () => <svg data-testid={'search-icon'} />,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      (
        {
          'emptyState.search.description': 'Try another search.',
          'emptyState.search.title': 'Search',
          'FileManager.title.createdAt': 'Created',
          'FileManager.title.size': 'Size',
          'FileManager.title.title': 'Title',
        } as Record<string, string>
      )[key] || key,
  }),
}));

vi.mock('react-virtuoso', () => ({
  Virtuoso: ({ data, itemContent }: any) => (
    <div>
      {data.map((item: any, index: number) => (
        <div key={item.id}>{itemContent(index, item)}</div>
      ))}
    </div>
  ),
}));

vi.mock('@/components/NeuralNetworkLoading', () => ({
  default: () => <div>loading</div>,
}));

vi.mock('@/libs/swr', () => ({
  useClientDataSWR: mockUseClientDataSWR,
}));

vi.mock('@/routes/(main)/content/features/store', () => ({
  useContentManagerStore: (selector: any) => selector(contentManagerState),
}));

vi.mock('@/services/content', () => ({
  contentService: {
    queryContentItems: vi.fn(),
  },
}));

vi.mock('@/store/global', () => ({
  useGlobalStore: (selector: any) =>
    selector({
      status: {
        contentManagerColumnWidths: {
          date: 160,
          name: 320,
          size: 120,
        },
      },
    }),
}));

vi.mock('@/store/global/initialState', () => ({
  INITIAL_STATUS: {
    contentManagerColumnWidths: {
      date: 160,
      name: 320,
      size: 120,
    },
  },
}));

vi.mock('../EmptyState', () => ({
  default: ({ title }: any) => <div>{title}</div>,
}));

vi.mock('./items', () => ({
  mapContentItemsToExplorerItems: (items: any[]) => items,
}));

vi.mock('./ListView/ListItem', () => ({
  default: ({ id }: any) => <div>{`list-item:${id}`}</div>,
}));

vi.mock('./MasonryView/MasonryItem/MasonryItemWrapper', () => ({
  default: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('./queryParams', () => ({
  getExplorerCategoryFilter: (category: string | undefined) => category,
}));

vi.mock('./useMasonryColumnCount', () => ({
  useMasonryColumnCount: () => 3,
}));

describe('SearchResultsOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    contentManagerState.category = 'images';
    contentManagerState.mode = 'explorer';
    contentManagerState.searchQuery = 'brand system';
    contentManagerState.sourceSetId = undefined;
    contentManagerState.spaceId = 'space-1';
    contentManagerState.viewMode = 'list';
  });

  it('renders a search workbench header with query and result count', () => {
    mockUseClientDataSWR.mockReturnValue({
      data: [
        { id: 'file-1', name: 'Brand Spec' },
        { id: 'file-2', name: 'Brand Guide' },
      ],
      isLoading: false,
    });

    render(<SearchResultsOverlay />);

    expect(screen.getByTestId('resource-search-overlay')).toBeInTheDocument();
    expect(screen.getByText('Search')).toBeInTheDocument();
    expect(screen.getByText('brand system')).toBeInTheDocument();
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
    expect(screen.getByText('list-item:file-1')).toBeInTheDocument();
    expect(screen.getByText('list-item:file-2')).toBeInTheDocument();
  });

  it('renders an empty state inside the overlay body', () => {
    mockUseClientDataSWR.mockReturnValue({
      data: [],
      isLoading: false,
    });

    render(<SearchResultsOverlay />);

    expect(screen.getByTestId('resource-search-overlay')).toBeInTheDocument();
    expect(screen.getAllByText('Search').length).toBeGreaterThan(0);
  });

  it('returns null when search overlay is inactive', () => {
    contentManagerState.searchQuery = null;
    mockUseClientDataSWR.mockReturnValue({
      data: undefined,
      isLoading: false,
    });

    const { container } = render(<SearchResultsOverlay />);

    expect(container).toBeEmptyDOMElement();
  });
});
