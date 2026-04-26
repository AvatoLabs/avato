/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SearchResults from './SearchResults';

const mockNavigate = vi.hoisted(() => vi.fn());
const mockDocuments = vi.hoisted<Record<string, any>>(() => ({}));

vi.mock('cmdk', () => ({
  Command: {
    Empty: ({ children }: any) => <div>{children}</div>,
    Group: ({ children }: any) => <div>{children}</div>,
    Item: ({ children, onSelect }: any) => (
      <button type="button" onClick={onSelect}>
        {children}
      </button>
    ),
    List: ({ children }: any) => <div>{children}</div>,
    Separator: () => <div />,
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) => options?.type || key,
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');

  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/features/ResourceSpaces', () => ({
  buildFilesFolderPath: (spaceId: string | null | undefined, folderSlug: string) =>
    spaceId ? `/spaces/${spaceId}/files/${folderSlug}` : `/spaces/${folderSlug}`,
  buildFilesPreviewPath: (
    spaceId: string | null | undefined,
    fileId: string,
    sourceSetId?: string | null,
  ) =>
    sourceSetId
      ? `/spaces/${spaceId}/files/item/${fileId}?scope=source-set:${sourceSetId}`
      : `/spaces/${spaceId}/files/item/${fileId}`,
  buildFilesRootPath: (spaceId: string | null | undefined) =>
    spaceId ? `/spaces/${spaceId}/files` : '/spaces',
  buildSourceSetFolderPath: (
    spaceId: string | null | undefined,
    sourceSetId: string,
    folderSlug: string,
  ) => `/spaces/${spaceId}/files/${folderSlug}?scope=source-set:${sourceSetId}`,
  buildSourceSetPath: (spaceId: string | null | undefined, sourceSetId: string) =>
    `/spaces/${spaceId}/files?scope=source-set:${sourceSetId}`,
}));

vi.mock('@/store/docs', () => ({
  usePageStore: {
    getState: () => ({}),
  },
}));

vi.mock('@/store/docs/slices/list/selectors', () => ({
  listSelectors: {
    getDocumentById: (id: string) => () => mockDocuments[id],
  },
}));

vi.mock('@/utils/markdownToTxt', () => ({
  markdownToTxt: (value: string) => value,
}));

vi.mock('@/utils/docs', () => ({
  getPageDetailPath: (id: string, _kind?: string, spaceId?: string) =>
    `/spaces/${spaceId}/docs/${id}`,
  getPageKindFromDocument: () => 'page',
}));

vi.mock('@/features/Pages/usePageScope', () => ({
  buildPageScopeSearch: (scope: string) => `?scope=${scope}`,
  createSourceSetPageScope: (sourceSetId: string) => `source-set:${sourceSetId}`,
}));

vi.mock('./components', () => ({
  CommandItem: ({ onSelect, title }: any) => (
    <button type="button" onClick={onSelect}>
      {typeof title === 'string' ? title : 'result'}
    </button>
  ),
}));

vi.mock('./styles', () => ({
  styles: {
    itemContent: 'itemContent',
    itemDetails: 'itemDetails',
    itemIcon: 'itemIcon',
    itemTitle: 'itemTitle',
  },
}));

describe('SearchResults', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    Object.keys(mockDocuments).forEach((key) => {
      delete mockDocuments[key];
    });
  });

  it('navigates files, folders, and source sets with space-scoped content routes', () => {
    render(
      <MemoryRouter>
        <SearchResults
          isLoading={false}
          searchQuery="design"
          typeFilter={undefined}
          results={
            [
              {
                createdAt: new Date('2026-03-28T00:00:00Z'),
                fileType: 'text/plain',
                id: 'file-1',
                name: 'Spec',
                relevance: 1,
                size: 12,
                sourceSetId: 'ss-1',
                spaceId: 'spc_1',
                title: 'Spec',
                type: 'file',
                updatedAt: new Date('2026-03-28T00:00:00Z'),
                url: null,
              },
              {
                createdAt: new Date('2026-03-28T00:00:00Z'),
                id: 'folder-1',
                relevance: 1,
                slug: 'design-docs',
                sourceSetId: null,
                spaceId: 'spc_1',
                title: 'Design Docs',
                type: 'folder',
                updatedAt: new Date('2026-03-28T00:00:00Z'),
              },
              {
                avatar: null,
                createdAt: new Date('2026-03-28T00:00:00Z'),
                id: 'ss-1',
                relevance: 1,
                spaceId: 'spc_1',
                title: 'Library One',
                type: 'sourceSet',
                updatedAt: new Date('2026-03-28T00:00:00Z'),
              },
            ] as any
          }
          onClose={vi.fn()}
          onSetTypeFilter={vi.fn()}
        />
      </MemoryRouter>,
    );

    const resultButtons = screen.getAllByText('result');

    fireEvent.click(resultButtons[0]);
    expect(mockNavigate).toHaveBeenNthCalledWith(
      1,
      '/spaces/spc_1/files/item/file-1?scope=source-set:ss-1',
    );

    fireEvent.click(resultButtons[1]);
    expect(mockNavigate).toHaveBeenNthCalledWith(2, '/spaces/spc_1/files/design-docs');

    fireEvent.click(resultButtons[2]);
    expect(mockNavigate).toHaveBeenNthCalledWith(3, '/spaces/spc_1/files?scope=source-set:ss-1');
  });

  it('navigates canonical document-backed file hits to the doc detail path', () => {
    render(
      <MemoryRouter>
        <SearchResults
          isLoading={false}
          searchQuery="spec"
          typeFilter={undefined}
          results={
            [
              {
                createdAt: new Date('2026-03-28T00:00:00Z'),
                fileType: 'text/markdown',
                id: 'docs_existing_1',
                name: 'Spec',
                relevance: 1,
                size: 12,
                sourceSetId: 'ss-1',
                spaceId: 'spc_1',
                title: 'Spec',
                type: 'file',
                updatedAt: new Date('2026-03-28T00:00:00Z'),
                url: null,
              },
            ] as any
          }
          onClose={vi.fn()}
          onSetTypeFilter={vi.fn()}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('result'));

    expect(mockNavigate).toHaveBeenCalledWith(
      '/spaces/spc_1/docs/docs_existing_1?scope=source-set:ss-1',
    );
  });

  it('navigates page hits with their source-set page scope preserved', () => {
    mockDocuments.docs_page_1 = {
      id: 'docs_page_1',
      metadata: {},
      sourceSetId: 'ss_1',
      spaceId: 'spc_1',
    };

    render(
      <MemoryRouter>
        <SearchResults
          isLoading={false}
          searchQuery="spec"
          typeFilter={undefined}
          results={
            [
              {
                createdAt: new Date('2026-03-28T00:00:00Z'),
                id: 'docs_page_1',
                relevance: 1,
                spaceId: 'spc_1',
                title: 'Spec Page',
                type: 'page',
                updatedAt: new Date('2026-03-28T00:00:00Z'),
              },
            ] as any
          }
          onClose={vi.fn()}
          onSetTypeFilter={vi.fn()}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('result'));

    expect(mockNavigate).toHaveBeenCalledWith(
      '/spaces/spc_1/docs/docs_page_1?scope=source-set:ss_1',
    );
  });
});
