/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import CategoryMenu from './CategoryMenu';

const mockSetMode = vi.hoisted(() => vi.fn());

vi.mock('@lobehub/ui', () => ({
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
  buildContentRootPath: (spaceId?: string) => (spaceId ? `/spaces/${spaceId}/files` : '/content'),
}));

vi.mock('@/routes/(main)/content/features/store', () => ({
  useContentManagerStore: (selector: any) =>
    selector({
      category: 'home',
      setMode: mockSetMode,
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

describe('CategoryMenu', () => {
  it('preserves current sort and view params when switching filters', () => {
    render(
      <MemoryRouter initialEntries={['/spaces/spc_1/files?view=masonry&sorter=name']}>
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
        </Routes>
      </MemoryRouter>,
    );

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
    render(
      <MemoryRouter
        initialEntries={['/spaces/spc_1/files?category=images&view=masonry&sorter=name']}
      >
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
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'All' }));

    const location = screen.getByTestId('location').textContent || '';
    const params = new URLSearchParams(location.split('?')[1]);

    expect(location.startsWith('/spaces/spc_1/files?')).toBe(true);
    expect(params.has('category')).toBe(false);
    expect(params.get('view')).toBe('masonry');
    expect(params.get('sorter')).toBe('name');
  });
});
