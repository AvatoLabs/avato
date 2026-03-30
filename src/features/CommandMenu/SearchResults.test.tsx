/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import SearchResults from './SearchResults';

const mockNavigate = vi.hoisted(() => vi.fn());

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
  buildContentFolderPath: (spaceId: string | null | undefined, folderSlug: string) =>
    spaceId ? `/content/spaces/${spaceId}/${folderSlug}` : `/content/${folderSlug}`,
  buildContentPreviewPath: (
    spaceId: string | null | undefined,
    fileId: string,
    sourceSetId?: string | null,
  ) =>
    sourceSetId
      ? `/content/spaces/${spaceId}/source-sets/${sourceSetId}/item/${fileId}`
      : `/content/spaces/${spaceId}/item/${fileId}`,
  buildContentRootPath: (spaceId: string | null | undefined) =>
    spaceId ? `/content/spaces/${spaceId}` : '/content',
  buildSourceSetFolderPath: (
    spaceId: string | null | undefined,
    sourceSetId: string,
    folderSlug: string,
  ) => `/content/spaces/${spaceId}/source-sets/${sourceSetId}/${folderSlug}`,
  buildSourceSetPath: (spaceId: string | null | undefined, sourceSetId: string) =>
    `/content/spaces/${spaceId}/source-sets/${sourceSetId}`,
}));

vi.mock('@/store/docs', () => ({
  usePageStore: {
    getState: () => ({}),
  },
}));

vi.mock('@/store/docs/slices/list/selectors', () => ({
  listSelectors: {
    getDocumentById: () => () => undefined,
  },
}));

vi.mock('@/utils/markdownToTxt', () => ({
  markdownToTxt: (value: string) => value,
}));

vi.mock('@/utils/docs', () => ({
  getPageDetailPath: (id: string) => `/docs/${id}`,
  getPageKindFromDocument: () => 'page',
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
      '/content/spaces/spc_1/source-sets/ss-1/item/file-1',
    );

    fireEvent.click(resultButtons[1]);
    expect(mockNavigate).toHaveBeenNthCalledWith(2, '/content/spaces/spc_1/design-docs');

    fireEvent.click(resultButtons[2]);
    expect(mockNavigate).toHaveBeenNthCalledWith(3, '/content/spaces/spc_1/source-sets/ss-1');
  });
});
