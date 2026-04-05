/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setActiveWorkspaceSpaceId } from '@/helpers/activeWorkspaceSpace';

import RecentPage from './index';

const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock('@lobehub/ui', () => ({
  ActionIcon: ({ ...props }: any) => (
    <button type="button" {...props}>
      action
    </button>
  ),
  DropdownMenu: ({ children, items }: any) => (
    <div>
      {children}
      {items?.map((item: any) => (
        <button key={item.key} type="button" onClick={item.onClick}>
          {item.label}
        </button>
      ))}
    </div>
  ),
  Flexbox: ({ as, children, ...props }: any) => {
    const Component = as || 'div';
    return <Component {...props}>{children}</Component>;
  },
  Tag: ({ children }: any) => <span>{children}</span>,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');

  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'home.recentDocs': 'Recent Docs',
        'menu.openDocs': 'Open Docs',
      })[key] || key,
  }),
}));

vi.mock('@/components/NeuralNetworkLoading', () => ({
  default: () => <div>loading</div>,
}));

vi.mock('@/hooks/useInitRecentPage', () => ({
  useInitRecentPage: () => ({ isRevalidating: false }),
}));

vi.mock('@/store/home/selectors', () => ({
  homeRecentSelectors: {
    isRecentPagesInit: (s: any) => s.isRecentPagesInit,
    recentPages: (s: any) => s.recentPages,
  },
}));

vi.mock('@/store/home/store', () => ({
  useHomeStore: (selector: any) =>
    selector({
      isRecentPagesInit: false,
      recentPages: [{ id: 'page-1', title: 'Doc 1' }],
    }),
}));

vi.mock('@/utils/docs', () => ({
  getPageRootPath: (_kind: string, spaceId?: string | null) =>
    spaceId ? `/spaces/${spaceId}/docs` : '/docs',
}));

vi.mock('../components/GroupBlock', () => ({
  default: ({ title, action, children }: any) => (
    <div>
      <div>{title}</div>
      <div>{action}</div>
      <div>{children}</div>
    </div>
  ),
}));

vi.mock('../components/GroupSkeleton', () => ({
  default: () => <div>skeleton</div>,
}));

vi.mock('../components/ScrollShadowWithButton', () => ({
  default: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('./List', () => ({
  default: () => <div>recent-page-list</div>,
}));

describe('RecentPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActiveWorkspaceSpaceId('space-hint');
    window.history.replaceState({}, '', '/spaces/space-route/docs');
  });

  it('keeps a generic title and opens docs in the route workspace', () => {
    render(<RecentPage />);

    expect(screen.getByText('Recent Docs')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open Docs' }));

    expect(mockNavigate).toHaveBeenCalledWith('/spaces/space-route/docs');
  });
});
