/**
 * @vitest-environment happy-dom
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { useSourceSetBackPath } from './useSourceSetBackPath';

const mockFolderBreadcrumb = vi.hoisted(() => vi.fn());

vi.mock('@/routes/(main)/content/features/store', () => ({
  useContentManagerFetchContentFolderBreadcrumb: (...args: any[]) => ({
    data: mockFolderBreadcrumb(...args),
  }),
}));

const HookProbe = () => {
  const backPath = useSourceSetBackPath();

  return <div data-testid="back-path">{backPath}</div>;
};

const renderRoute = (initialEntry: string) =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route element={<HookProbe />} path="/content/source-sets/:id" />
        <Route element={<HookProbe />} path="/content/source-sets/:id/:slug" />
        <Route element={<HookProbe />} path="/content/source-sets/:id/trash" />
        <Route element={<HookProbe />} path="/content/spaces/:spaceId/source-sets/:id" />
        <Route element={<HookProbe />} path="/content/spaces/:spaceId/source-sets/:id/:slug" />
        <Route element={<HookProbe />} path="/content/spaces/:spaceId/source-sets/:id/trash" />
      </Routes>
    </MemoryRouter>,
  );

describe('useSourceSetBackPath', () => {
  it('returns the space root at source-set root', () => {
    mockFolderBreadcrumb.mockReturnValue([]);

    renderRoute('/content/spaces/spc_1/source-sets/ss_1');

    expect(screen.getByTestId('back-path')).toHaveTextContent('/content/spaces/spc_1');
  });

  it('returns the source-set root for a first-level folder', () => {
    mockFolderBreadcrumb.mockReturnValue([
      { id: 'docs_folder_1', name: 'Folder 1', slug: 'folder-1' },
    ]);

    renderRoute('/content/spaces/spc_1/source-sets/ss_1/folder-1');

    expect(screen.getByTestId('back-path')).toHaveTextContent(
      '/content/spaces/spc_1/source-sets/ss_1',
    );
  });

  it('returns the parent folder path for nested folders', () => {
    mockFolderBreadcrumb.mockReturnValue([
      { id: 'docs_folder_1', name: 'Folder 1', slug: 'folder-1' },
      { id: 'docs_folder_2', name: 'Folder 2', slug: 'folder-2' },
    ]);

    renderRoute('/content/spaces/spc_1/source-sets/ss_1/folder-2');

    expect(screen.getByTestId('back-path')).toHaveTextContent(
      '/content/spaces/spc_1/source-sets/ss_1/folder-1',
    );
  });

  it('returns the source-set root from source-set trash', () => {
    mockFolderBreadcrumb.mockReturnValue([]);

    renderRoute('/content/spaces/spc_1/source-sets/ss_1/trash');

    expect(screen.getByTestId('back-path')).toHaveTextContent(
      '/content/spaces/spc_1/source-sets/ss_1',
    );
  });
});
