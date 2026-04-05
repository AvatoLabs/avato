/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setActiveWorkspaceSpaceId } from '@/helpers/activeWorkspaceSpace';
import { FilesTabs } from '@/types/files';

import RecentResource from './index';

const mockNavigate = vi.hoisted(() => vi.fn());
const mockSetCategory = vi.hoisted(() => vi.fn());

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
        'home.recentFiles': 'Recent Files',
        'menu.openHome': 'Open Home',
      })[key] || key,
  }),
}));

vi.mock('@/components/NeuralNetworkLoading', () => ({
  default: () => <div>loading</div>,
}));

vi.mock('@/features/ResourceSpaces', () => ({
  buildFilesRootPath: (spaceId?: string | null) =>
    spaceId ? `/spaces/${spaceId}/files` : '/spaces',
}));

vi.mock('@/hooks/useInitRecentResource', () => ({
  useInitRecentResource: () => ({ isRevalidating: false }),
}));

vi.mock('@/routes/(main)/content/features/store', () => ({
  useContentManagerStore: (selector: any) =>
    selector({
      setCategory: mockSetCategory,
    }),
}));

vi.mock('@/store/home/selectors', () => ({
  homeRecentSelectors: {
    isRecentResourcesInit: (s: any) => s.isRecentResourcesInit,
    recentResources: (s: any) => s.recentResources,
  },
}));

vi.mock('@/store/home/store', () => ({
  useHomeStore: (selector: any) =>
    selector({
      isRecentResourcesInit: false,
      recentResources: [{ id: 'file-1', name: 'Guide' }],
    }),
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
  default: () => <div>recent-resource-list</div>,
}));

describe('RecentResource', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActiveWorkspaceSpaceId('space-hint');
    window.history.replaceState({}, '', '/spaces/space-route/files');
  });

  it('keeps a generic title and opens files in the route workspace', () => {
    render(<RecentResource />);

    expect(screen.getByText('Recent Files')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open Home' }));

    expect(mockSetCategory).toHaveBeenCalledWith(FilesTabs.Home);
    expect(mockNavigate).toHaveBeenCalledWith('/spaces/space-route/files');
  });
});
