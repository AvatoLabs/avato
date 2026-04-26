/**
 * @vitest-environment happy-dom
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import RecentResourceList from './List';

let mockHomeState = {
  isRecentResourcesInit: true,
  recentResources: [] as any[],
};

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/features/ContentManager/utils/isCanonicalDocumentEntry', () => ({
  isCanonicalDocumentEntry: ({ id, sourceType }: { id: string; sourceType?: string | null }) =>
    sourceType === 'document' || id.startsWith('docs_'),
}));

vi.mock('@/features/ResourceSpaces', () => ({
  buildFilesPreviewPath: vi.fn(
    (spaceId: string, id: string) => `/spaces/${spaceId}/files/item/${id}`,
  ),
}));

vi.mock('@/store/home/selectors', () => ({
  homeRecentSelectors: {
    isRecentResourcesInit: (s: any) => s.isRecentResourcesInit,
    recentResources: (s: any) => s.recentResources,
  },
}));

vi.mock('@/store/home/store', () => ({
  useHomeStore: (selector: any) => selector(mockHomeState),
}));

vi.mock('@/utils/docs', () => ({
  getPageDetailPath: vi.fn(
    (id: string, kind: string, spaceId: string) => `/spaces/${spaceId}/docs/${id}?kind=${kind}`,
  ),
}));

vi.mock('@/features/Pages/usePageScope', () => ({
  buildPageScopeSearch: (scope: string) => `&scope=${scope}`,
  createSourceSetPageScope: (sourceSetId: string) => `source-set:${sourceSetId}`,
}));

vi.mock('@/routes/(main)/home/features/components/GroupSkeleton', () => ({
  default: () => <div>skeleton</div>,
}));

vi.mock('./Item', () => ({
  default: ({ file }: any) => <span>{file.name}</span>,
}));

describe('RecentResourceList', () => {
  beforeEach(() => {
    mockHomeState = {
      isRecentResourcesInit: true,
      recentResources: [],
    };
  });

  it('routes file-backed documents to the canonical doc detail path', () => {
    mockHomeState.recentResources = [
      {
        fileId: 'file_1',
        fileType: 'text/markdown',
        id: 'docs_1',
        name: 'Spec',
        sourceSetId: 'ss_1',
        sourceType: 'file',
        spaceId: 'spc_1',
      },
    ];

    render(<RecentResourceList />);

    expect(screen.getByRole('link', { name: 'Spec' })).toHaveAttribute(
      'href',
      '/spaces/spc_1/docs/docs_1?kind=doc&scope=source-set:ss_1',
    );
  });

  it('keeps raw files on the files preview path', () => {
    mockHomeState.recentResources = [
      {
        fileId: 'file_2',
        fileType: 'application/pdf',
        id: 'file_2',
        name: 'Guide.pdf',
        sourceType: 'file',
        spaceId: 'spc_1',
      },
    ];

    render(<RecentResourceList />);

    expect(screen.getByRole('link', { name: 'Guide.pdf' })).toHaveAttribute(
      'href',
      '/spaces/spc_1/files/item/file_2',
    );
  });
});
