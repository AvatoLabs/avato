/**
 * @vitest-environment happy-dom
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import RecentPageList from './List';

let mockHomeState = {
  isRecentPagesInit: true,
  recentPages: [] as any[],
};

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/features/Pages/usePageScope', () => ({
  buildPageScopeSearch: (scope: string) => `&scope=${scope}`,
  createSourceSetPageScope: (sourceSetId: string) => `source-set:${sourceSetId}`,
}));

vi.mock('@/store/home/selectors', () => ({
  homeRecentSelectors: {
    isRecentPagesInit: (s: any) => s.isRecentPagesInit,
    recentPages: (s: any) => s.recentPages,
  },
}));

vi.mock('@/store/home/store', () => ({
  useHomeStore: (selector: any) => selector(mockHomeState),
}));

vi.mock('@/utils/docs', () => ({
  getPageDetailPath: vi.fn(
    (id: string, kind: string, spaceId: string) => `/spaces/${spaceId}/docs/${id}?kind=${kind}`,
  ),
  getPageKindFromDocument: vi.fn(() => 'doc'),
}));

vi.mock('@/routes/(main)/home/features/components/GroupSkeleton', () => ({
  default: () => <div>skeleton</div>,
}));

vi.mock('./Item', () => ({
  default: ({ document }: any) => <span>{document.title}</span>,
}));

describe('RecentPageList', () => {
  beforeEach(() => {
    mockHomeState = {
      isRecentPagesInit: true,
      recentPages: [],
    };
  });

  it('routes source-set pages to the scoped doc detail path', () => {
    mockHomeState.recentPages = [
      {
        id: 'docs_1',
        sourceSetId: 'ss_1',
        spaceId: 'spc_1',
        title: 'Spec',
      },
    ];

    render(<RecentPageList />);

    expect(screen.getByRole('link', { name: 'Spec' })).toHaveAttribute(
      'href',
      '/spaces/spc_1/docs/docs_1?kind=doc&scope=source-set:ss_1',
    );
  });

  it('keeps unscoped pages on the plain doc detail path', () => {
    mockHomeState.recentPages = [
      {
        id: 'docs_2',
        spaceId: 'spc_1',
        title: 'Guide',
      },
    ];

    render(<RecentPageList />);

    expect(screen.getByRole('link', { name: 'Guide' })).toHaveAttribute(
      'href',
      '/spaces/spc_1/docs/docs_2?kind=doc',
    );
  });
});
