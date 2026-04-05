/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import CategoryMenu from './CategoryMenu';

const mockSetMode = vi.hoisted(() => vi.fn());

vi.mock('@lobehub/ui', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  Flexbox: ({ children, className, ...props }: any) => (
    <div className={className} {...props}>
      {children}
    </div>
  ),
  Icon: () => <span aria-hidden="true" />,
  Segmented: ({ options, onChange, value }: any) => (
    <div data-testid="category-segmented" data-value={value}>
      {options.map((option: any) => (
        <button key={option.value} type="button" onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('antd', () => ({
  Popover: ({ children, content }: any) => (
    <div>
      {children}
      <div data-testid="governance-popover">{content}</div>
    </div>
  ),
  Select: ({ onChange, options, value, ...rest }: any) => {
    const testId =
      rest['aria-label'] === 'Classification'
        ? 'classification-select'
        : rest['aria-label'] === 'Review Status'
          ? 'review-status-select'
          : 'usage-select';

    return (
      <select
        data-testid={testId}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        {...rest}
      >
        {options?.map((option: any) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  },
}));

vi.mock('antd-style', () => ({
  createStaticStyles: () => ({
    container: 'container',
    option: 'option',
    segmented: 'segmented',
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      options?.defaultValue ||
      (
        {
          'tab.all': 'All',
          'tab.images': 'Images',
          'tab.audios': 'Audio',
          'tab.videos': 'Video',
          'detail.asset.classification.all': 'All classifications',
          'detail.asset.classification.general': 'General',
          'detail.asset.classification.brand': 'Brand',
          'detail.asset.classification.product': 'Product',
          'detail.asset.classification.legal': 'Legal',
          'detail.asset.classification.finance': 'Finance',
          'detail.asset.classification.hr': 'HR',
          'detail.asset.classification.label': 'Classification',
          'detail.asset.reviewStatus.all': 'All review statuses',
          'detail.asset.reviewStatus.approved': 'Approved',
          'detail.asset.reviewStatus.archived': 'Archived',
          'detail.asset.reviewStatus.draft': 'Draft',
          'detail.asset.reviewStatus.label': 'Review Status',
          'detail.asset.usagePolicy.all': 'All usage policies',
          'detail.asset.usagePolicy.internal': 'Internal',
          'detail.asset.usagePolicy.public': 'Public',
          'detail.asset.usagePolicy.restricted': 'Restricted',
          'detail.asset.usagePolicy.label': 'Usage Policy',
          'filters.governance': 'Governance',
          'filters.governanceActive': `Governance (${options?.count})`,
          'filters.matchingFiles': `${options?.count} matching files`,
          'filters.clearGovernance': 'Clear governance filters',
          'filters.clearGovernanceFilter': `Clear ${options?.label} filter`,
        } as Record<string, string>
      )[key] ||
      key,
  }),
}));

vi.mock('@/config/contentIcons', () => ({
  RESOURCE_ENTRY_ICONS: {
    all: () => null,
    audios: () => null,
    documents: () => null,
    images: () => null,
    videos: () => null,
  },
}));

vi.mock('@/features/ResourceSpaces', () => ({
  buildFilesRootPath: (spaceId?: string) => (spaceId ? `/spaces/${spaceId}/files` : '/spaces'),
  stripFilesItemPath: (pathname: string) => pathname.replace(/\/item\/[^/]+$/, ''),
}));

vi.mock('@/routes/(main)/content/features/store', () => ({
  useContentManagerFetchGovernanceSummary: () => ({
    data: {
      classification: {
        counts: {
          brand: 2,
          finance: 0,
          general: 5,
          hr: 0,
          legal: 0,
          product: 1,
        },
        total: 8,
      },
      reviewStatus: {
        counts: {
          approved: 3,
          archived: 1,
          draft: 4,
        },
        total: 8,
      },
      usagePolicy: {
        counts: {
          internal: 4,
          public: 1,
          restricted: 3,
        },
        total: 8,
      },
    },
  }),
  useContentManagerStore: (selector: any) =>
    selector({
      category: 'home',
      currentFolderId: null,
      sourceSetId: undefined,
      setMode: mockSetMode,
    }),
}));

vi.mock('@/store/file', () => ({
  useFileStore: (selector: any) =>
    selector({
      total: 3,
    }),
}));

vi.mock('@/store/serverConfig', () => ({
  useServerConfigStore: (selector: any) =>
    selector({
      isMobile: false,
    }),
}));

const LocationDisplay = () => {
  const location = useLocation();

  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
};

const renderCategoryMenu = (initialEntry: string) =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/spaces/:spaceId/files"
          element={
            <>
              <CategoryMenu />
              <LocationDisplay />
            </>
          }
        />
        <Route
          path="/spaces/:spaceId/files/*"
          element={
            <>
              <CategoryMenu />
              <LocationDisplay />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );

describe('CategoryMenu', () => {
  it('preserves current sort and view params when switching filters', () => {
    renderCategoryMenu('/spaces/spc_1/files?view=masonry&sorter=name');

    fireEvent.click(screen.getByRole('button', { name: 'Images' }));

    const location = screen.getByTestId('location').textContent || '';
    const params = new URLSearchParams(location.split('?')[1]);

    expect(location.startsWith('/spaces/spc_1/files?')).toBe(true);
    expect(params.get('category')).toBe('images');
    expect(params.get('view')).toBe('masonry');
    expect(params.get('sorter')).toBe('name');
    expect(mockSetMode).toHaveBeenCalledWith('explorer');
  });

  it('clears the category param when returning to the all-content filter', () => {
    renderCategoryMenu('/spaces/spc_1/files?category=images&view=masonry&sorter=name');

    fireEvent.click(screen.getByRole('button', { name: 'All' }));

    const location = screen.getByTestId('location').textContent || '';
    const params = new URLSearchParams(location.split('?')[1]);

    expect(location.startsWith('/spaces/spc_1/files?')).toBe(true);
    expect(params.has('category')).toBe(false);
    expect(params.get('view')).toBe('masonry');
    expect(params.get('sorter')).toBe('name');
  });

  it('preserves current category params when switching asset classification', () => {
    renderCategoryMenu('/spaces/spc_1/files?category=images&view=masonry');

    fireEvent.change(screen.getByTestId('classification-select'), {
      target: { value: 'brand' },
    });

    const location = screen.getByTestId('location').textContent || '';
    const params = new URLSearchParams(location.split('?')[1]);

    expect(params.get('category')).toBe('images');
    expect(params.get('assetClassification')).toBe('brand');
    expect(params.get('view')).toBe('masonry');
  });

  it('preserves current classification params when switching usage policy', () => {
    renderCategoryMenu('/spaces/spc_1/files?assetClassification=brand&view=masonry');

    fireEvent.change(screen.getByTestId('usage-select'), {
      target: { value: 'restricted' },
    });

    const location = screen.getByTestId('location').textContent || '';
    const params = new URLSearchParams(location.split('?')[1]);

    expect(params.get('assetClassification')).toBe('brand');
    expect(params.get('assetUsagePolicy')).toBe('restricted');
    expect(params.get('view')).toBe('masonry');
  });

  it('preserves current governance params when switching review status', () => {
    renderCategoryMenu('/spaces/spc_1/files?assetClassification=brand&assetUsagePolicy=restricted');

    fireEvent.change(screen.getByTestId('review-status-select'), {
      target: { value: 'approved' },
    });

    const location = screen.getByTestId('location').textContent || '';
    const params = new URLSearchParams(location.split('?')[1]);

    expect(params.get('assetClassification')).toBe('brand');
    expect(params.get('assetUsagePolicy')).toBe('restricted');
    expect(params.get('assetReviewStatus')).toBe('approved');
  });

  it('preserves the current folder path when changing governance filters', () => {
    renderCategoryMenu('/spaces/spc_1/files/folder-a?view=masonry&scope=source-set:sst_1');

    fireEvent.change(screen.getByTestId('classification-select'), {
      target: { value: 'brand' },
    });

    const location = screen.getByTestId('location').textContent || '';
    const params = new URLSearchParams(location.split('?')[1]);

    expect(location.startsWith('/spaces/spc_1/files/folder-a?')).toBe(true);
    expect(params.get('scope')).toBe('source-set:sst_1');
    expect(params.get('view')).toBe('masonry');
    expect(params.get('assetClassification')).toBe('brand');
  });

  it('strips only the item segment while keeping the current folder path', () => {
    renderCategoryMenu(
      '/spaces/spc_1/files/folder-a/item/file_1?scope=source-set:sst_1&view=masonry',
    );

    fireEvent.change(screen.getByTestId('usage-select'), {
      target: { value: 'restricted' },
    });

    const location = screen.getByTestId('location').textContent || '';
    const params = new URLSearchParams(location.split('?')[1]);

    expect(location.startsWith('/spaces/spc_1/files/folder-a?')).toBe(true);
    expect(location.includes('/item/file_1')).toBe(false);
    expect(params.get('scope')).toBe('source-set:sst_1');
    expect(params.get('view')).toBe('masonry');
    expect(params.get('assetUsagePolicy')).toBe('restricted');
  });

  it('clears governance filters without dropping the current folder scope', () => {
    renderCategoryMenu(
      '/spaces/spc_1/files/folder-a?scope=source-set:sst_1&view=masonry&assetClassification=brand&assetReviewStatus=approved&assetUsagePolicy=restricted',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear governance filters' }));

    const location = screen.getByTestId('location').textContent || '';
    const params = new URLSearchParams(location.split('?')[1]);

    expect(location.startsWith('/spaces/spc_1/files/folder-a?')).toBe(true);
    expect(params.get('scope')).toBe('source-set:sst_1');
    expect(params.get('view')).toBe('masonry');
    expect(params.has('assetClassification')).toBe(false);
    expect(params.has('assetReviewStatus')).toBe(false);
    expect(params.has('assetUsagePolicy')).toBe(false);
  });

  it('shows active governance chips and clears one filter at a time', () => {
    renderCategoryMenu(
      '/spaces/spc_1/files?assetClassification=brand&assetReviewStatus=approved&assetUsagePolicy=restricted',
    );

    expect(
      screen.getByRole('button', { name: 'Clear Classification: Brand filter' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Clear Review Status: Approved filter' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Clear Usage Policy: Restricted filter' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Classification: Brand')).toBeInTheDocument();
    expect(screen.getByText('Review Status: Approved')).toBeInTheDocument();
    expect(screen.getByText('Usage Policy: Restricted')).toBeInTheDocument();
    expect(screen.getByText('3 matching files')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear Review Status: Approved filter' }));

    const location = screen.getByTestId('location').textContent || '';
    const params = new URLSearchParams(location.split('?')[1]);

    expect(params.get('assetClassification')).toBe('brand');
    expect(params.get('assetUsagePolicy')).toBe('restricted');
    expect(params.has('assetReviewStatus')).toBe(false);
  });

  it('shows governance summary counts inside filter options', () => {
    renderCategoryMenu('/spaces/spc_1/files');

    expect(screen.getByRole('option', { name: 'All classifications (8)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Brand (2)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Approved (3)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Restricted (3)' })).toBeInTheDocument();
  });
});
